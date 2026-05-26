from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd

from .paths import INTERIM_DATA_DIR, PROCESSED_DATA_DIR, ensure_directories


TARGET_COLUMN = "target_price"
NUMERIC_FEATURES = [
    "total_meters",
    "living_meters",
    "kitchen_meters",
    "floor",
    "floors_count",
    "rooms_count",
    "year_of_construction",
    "building_age",
    "floor_ratio",
    "is_top_floor",
    "is_first_floor",
    "room_density",
]
CATEGORICAL_FEATURES = [
    "city",
    "city_district",
    "district",
    "underground",
    "house_material_type",
    "finish_type",
    "object_type",
]

SOURCE_NUMERIC_COLUMNS = [
    "total_meters",
    "living_meters",
    "kitchen_meters",
    "floor",
    "floors_count",
    "rooms_count",
    "year_of_construction",
    "price",
]


def select_active_feature_columns(dataset: pd.DataFrame) -> tuple[list[str], list[str]]:
    numeric_features = [column for column in NUMERIC_FEATURES if column in dataset.columns and dataset[column].notna().any()]
    categorical_features = [column for column in CATEGORICAL_FEATURES if column in dataset.columns and dataset[column].notna().any()]
    return numeric_features, categorical_features


def detect_csv_format(input_path: Path) -> tuple[str, str]:
    first_line = input_path.read_text(encoding="utf-8-sig").splitlines()[0] if input_path.exists() else ""
    comma_count = first_line.count(",")
    semicolon_count = first_line.count(";")
    delimiter = ";" if semicolon_count > comma_count else ","
    decimal = "," if delimiter == ";" else "."
    return delimiter, decimal


def load_clean_dataset(input_path: Path | None = None) -> pd.DataFrame:
    input_path = input_path or (INTERIM_DATA_DIR / "cleaned_listings.csv")
    delimiter, decimal = detect_csv_format(input_path)
    dataset = pd.read_csv(input_path, encoding="utf-8-sig", sep=delimiter, decimal=decimal)

    for column in SOURCE_NUMERIC_COLUMNS:
        if column in dataset.columns:
            dataset[column] = pd.to_numeric(dataset[column], errors="coerce")

    return dataset


def prepare_feature_dataset(frame: pd.DataFrame, reference_year: int | None = None) -> tuple[pd.DataFrame, dict[str, object]]:
    reference_year = reference_year or datetime.utcnow().year
    dataset = frame.copy()

    dataset["city"] = dataset["city"].fillna("unknown").astype("string")
    dataset["district"] = dataset["district"].fillna("unknown").astype("string")
    dataset["underground"] = dataset["underground"].fillna("unknown").astype("string")
    dataset["house_material_type"] = dataset["house_material_type"].fillna("unknown").astype("string")
    dataset["finish_type"] = dataset["finish_type"].fillna("unknown").astype("string")
    dataset["object_type"] = dataset["object_type"].fillna("flat").astype("string")
    dataset["city_district"] = dataset["city"] + "__" + dataset["district"]

    dataset["building_age"] = np.where(
        dataset["year_of_construction"].notna(),
        np.maximum(0, reference_year - dataset["year_of_construction"]),
        np.nan,
    )
    dataset["floor_ratio"] = np.where(
        dataset["floors_count"].fillna(0) > 0,
        dataset["floor"] / dataset["floors_count"],
        np.nan,
    )
    dataset["is_top_floor"] = (
        (dataset["floor"].notna()) & (dataset["floors_count"].notna()) & (dataset["floor"] == dataset["floors_count"])
    ).astype(int)
    dataset["is_first_floor"] = (dataset["floor"].fillna(0) == 1).astype(int)
    dataset["room_density"] = np.where(
        dataset["total_meters"].fillna(0) > 0,
        dataset["rooms_count"].fillna(0) / dataset["total_meters"],
        np.nan,
    )
    dataset[TARGET_COLUMN] = dataset["price"]

    dataset = dataset[NUMERIC_FEATURES + CATEGORICAL_FEATURES + [TARGET_COLUMN]].copy()
    dataset = dataset[dataset[TARGET_COLUMN] > 0].reset_index(drop=True)

    active_numeric_features, active_categorical_features = select_active_feature_columns(dataset)

    manifest = {
        "target_column": TARGET_COLUMN,
        "numeric_features": NUMERIC_FEATURES,
        "categorical_features": CATEGORICAL_FEATURES,
        "active_numeric_features": active_numeric_features,
        "active_categorical_features": active_categorical_features,
        "rows": int(len(dataset)),
        "reference_year": reference_year,
    }
    return dataset, manifest


def save_feature_dataset(dataset: pd.DataFrame, output_path: Path | None = None) -> Path:
    ensure_directories()
    output_path = output_path or (PROCESSED_DATA_DIR / "model_input.csv")
    dataset.to_csv(output_path, index=False, encoding="utf-8")
    return output_path


def save_feature_manifest(manifest: dict[str, object], output_path: Path | None = None) -> Path:
    ensure_directories()
    output_path = output_path or (PROCESSED_DATA_DIR / "feature_manifest.json")
    output_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return output_path
