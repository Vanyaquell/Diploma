from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pandas as pd

from .paths import INTERIM_DATA_DIR, RAW_DATA_DIR, ensure_directories


STRING_COLUMNS = [
    "url",
    "location",
    "district",
    "street",
    "house_number",
    "underground",
    "residential_complex",
    "house_material_type",
    "heating_type",
    "finish_type",
    "object_type",
    "author",
    "author_type",
    "city_slug",
    "requested_city",
    "requested_rooms",
    "collected_at",
]

NUMERIC_COLUMNS = [
    "floor",
    "floors_count",
    "rooms_count",
    "total_meters",
    "living_meters",
    "kitchen_meters",
    "price",
    "price_per_m2",
    "year_of_construction",
]

COLUMN_ALIASES = {
    "year_construction": "year_of_construction",
    "building_year": "year_of_construction",
    "total_floors": "floors_count",
    "rooms": "rooms_count",
    "area": "total_meters",
}

COMBINED_RAW_PATTERNS = (
    "*_merged_raw_browser.csv",
    "*_all_cities_raw_browser.csv",
    "*_merged_raw.csv",
    "*_all_cities_raw.csv",
)


def _normalize_rooms_count(value: Any) -> float | None:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None

    text = str(value).strip().lower()
    if text in {"studio", "0", "0.0"}:
        return 0.0

    try:
        return float(text.replace(",", "."))
    except ValueError:
        return None


def _to_numeric(series: pd.Series) -> pd.Series:
    return pd.to_numeric(series, errors="coerce")


def standardize_columns(frame: pd.DataFrame) -> pd.DataFrame:
    frame = frame.rename(columns=COLUMN_ALIASES).copy()
    for column in STRING_COLUMNS + NUMERIC_COLUMNS:
        if column not in frame.columns:
            frame[column] = pd.NA
    return frame


def _find_combined_raw_candidates(input_path: Path) -> list[Path]:
    combined_candidates: list[Path] = []
    for pattern in COMBINED_RAW_PATTERNS:
        combined_candidates.extend(path for path in input_path.glob(pattern) if path.is_file())

    return sorted(set(combined_candidates))


def resolve_raw_input(input_path: Path | None = None) -> Path:
    input_path = input_path or RAW_DATA_DIR
    if input_path.is_file():
        return input_path

    combined_candidates = _find_combined_raw_candidates(input_path)
    if combined_candidates:
        return combined_candidates[-1]

    csv_candidates = sorted(input_path.rglob("*.csv"))
    if not csv_candidates:
        raise FileNotFoundError(f"No CSV files found in {input_path}")
    return csv_candidates[-1]


def load_raw_dataset(input_path: Path | None = None) -> pd.DataFrame:
    input_path = input_path or RAW_DATA_DIR
    if input_path.is_file():
        return pd.read_csv(input_path, encoding="utf-8")

    combined_candidates = _find_combined_raw_candidates(input_path)
    if combined_candidates:
        return pd.read_csv(combined_candidates[-1], encoding="utf-8")

    csv_candidates = sorted(input_path.rglob("*.csv"))
    if not csv_candidates:
        raise FileNotFoundError(f"No CSV files found in {input_path}")

    frames = [pd.read_csv(path, encoding="utf-8") for path in csv_candidates]
    return pd.concat(frames, ignore_index=True)


def clean_dataset(frame: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, int]]:
    report: dict[str, int] = {"rows_before": int(len(frame))}
    frame = standardize_columns(frame)

    for column in STRING_COLUMNS:
        frame[column] = frame[column].astype("string").str.strip()
        frame[column] = frame[column].replace({"": pd.NA, "nan": pd.NA, "None": pd.NA})

    frame["rooms_count"] = frame["rooms_count"].apply(_normalize_rooms_count)
    if "requested_rooms" in frame.columns:
        studio_mask = frame["requested_rooms"].astype("string").str.lower() == "studio"
        frame.loc[studio_mask, "rooms_count"] = 0.0
    for column in [col for col in NUMERIC_COLUMNS if col != "rooms_count"]:
        frame[column] = _to_numeric(frame[column])

    frame["city"] = frame["requested_city"].fillna(frame["location"]).astype("string").str.strip()

    before_target_filter = len(frame)
    frame = frame[frame["price"].notna() & frame["total_meters"].notna()]
    report["rows_removed_missing_target_or_area"] = int(before_target_filter - len(frame))

    before_duplicate_filter = len(frame)
    if frame["url"].notna().any():
        frame = frame.drop_duplicates(subset=["url"], keep="first")
    else:
        frame = frame.drop_duplicates(
            subset=["city", "district", "street", "house_number", "rooms_count", "total_meters", "price"],
            keep="first",
        )
    report["duplicates_removed"] = int(before_duplicate_filter - len(frame))

    numeric_filters = (
        frame["price"].between(500_000, 500_000_000, inclusive="both")
        & frame["total_meters"].between(10, 400, inclusive="both")
        & frame["floor"].fillna(1).between(1, 100, inclusive="both")
        & frame["floors_count"].fillna(1).between(1, 100, inclusive="both")
        & frame["year_of_construction"].fillna(2000).between(1800, 2035, inclusive="both")
    )
    if "rooms_count" in frame:
        numeric_filters = numeric_filters & frame["rooms_count"].fillna(0).between(0, 10, inclusive="both")

    before_numeric_filter = len(frame)
    frame = frame[numeric_filters]
    report["rows_removed_by_numeric_filters"] = int(before_numeric_filter - len(frame))

    before_floor_filter = len(frame)
    valid_floor_relation = (
        frame["floor"].isna()
        | frame["floors_count"].isna()
        | (frame["floor"] <= frame["floors_count"])
    )
    frame = frame[valid_floor_relation]
    report["rows_removed_invalid_floor_relation"] = int(before_floor_filter - len(frame))

    frame["price_per_m2"] = frame["price_per_m2"].fillna(frame["price"] / frame["total_meters"])
    frame["district"] = frame["district"].fillna("unknown")
    frame["underground"] = frame["underground"].fillna("unknown")
    frame["finish_type"] = frame["finish_type"].fillna("unknown")
    frame["house_material_type"] = frame["house_material_type"].fillna("unknown")
    frame["object_type"] = frame["object_type"].fillna("flat")

    frame = frame.sort_values(by=["city", "district", "price"], ascending=[True, True, True]).reset_index(drop=True)
    report["rows_after"] = int(len(frame))
    return frame, report


def save_clean_dataset(frame: pd.DataFrame, output_path: Path | None = None) -> Path:
    ensure_directories()
    output_path = output_path or (INTERIM_DATA_DIR / "cleaned_listings.csv")
    frame.to_csv(output_path, index=False, encoding="utf-8")
    return output_path


def save_cleaning_report(report: dict[str, int], output_path: Path | None = None) -> Path:
    ensure_directories()
    output_path = output_path or (INTERIM_DATA_DIR / "cleaning_report.json")
    output_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    return output_path
