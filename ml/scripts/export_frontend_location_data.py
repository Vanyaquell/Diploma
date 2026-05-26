from __future__ import annotations

import argparse
import json
from pathlib import Path

import pandas as pd


SCRIPT_DIR = Path(__file__).resolve().parent
ML_ROOT = SCRIPT_DIR.parent
PROJECT_ROOT = ML_ROOT.parent

CITY_ORDER = ["Москва", "Санкт-Петербург", "Казань", "Нижний Новгород"]
DISTRICT_MIN_COUNT = 5
METRO_MIN_COUNT = 5
MAX_DISTRICT_OPTIONS = 25
MAX_METRO_OPTIONS = 30
MAX_RECOMMENDATIONS = 3
MIN_RECOMMENDATION_COUNT = 2


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Export frontend district/metro option lists and recommendation maps from cleaned listings."
    )
    parser.add_argument(
        "--input",
        type=Path,
        default=ML_ROOT / "data" / "interim" / "cleaned_listings.csv",
        help="Path to the cleaned listings CSV.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=PROJECT_ROOT / "frontend" / "src" / "data" / "location-options.ts",
        help="Path to the generated frontend TypeScript file.",
    )
    return parser.parse_args()


def normalize_value(value: object) -> str:
    if value is None:
        return "unknown"

    text = str(value).strip()
    if text == "" or text.lower() in {"nan", "none"}:
        return "unknown"

    return text


def select_main_values(series: pd.Series, min_count: int, max_items: int) -> list[str]:
    counts = series[series != "unknown"].value_counts()
    filtered = counts[counts >= min_count].head(max_items).index.tolist()
    return ["unknown", *filtered]


def build_recommendation_map(
    frame: pd.DataFrame,
    source_column: str,
    target_column: str,
    allowed_source_values: list[str],
    allowed_target_values: list[str],
) -> dict[str, list[str]]:
    source_allowed = {value for value in allowed_source_values if value != "unknown"}
    target_allowed = {value for value in allowed_target_values if value != "unknown"}

    pair_counts = (
        frame[
            frame[source_column].isin(source_allowed)
            & frame[target_column].isin(target_allowed)
        ]
        .groupby([source_column, target_column])
        .size()
        .reset_index(name="count")
    )

    recommendations: dict[str, list[str]] = {}
    if pair_counts.empty:
        return recommendations

    for source_value, source_frame in pair_counts.groupby(source_column):
        top_targets = (
            source_frame[source_frame["count"] >= MIN_RECOMMENDATION_COUNT]
            .sort_values(by=["count", target_column], ascending=[False, True])
            .head(MAX_RECOMMENDATIONS)[target_column]
            .tolist()
        )

        if top_targets:
            recommendations[source_value] = top_targets

    return recommendations


def build_city_payload(clean_frame: pd.DataFrame) -> tuple[
    dict[str, list[str]],
    dict[str, list[str]],
    dict[str, dict[str, list[str]]],
    dict[str, dict[str, list[str]]],
]:
    district_options: dict[str, list[str]] = {}
    underground_options: dict[str, list[str]] = {}
    district_to_underground: dict[str, dict[str, list[str]]] = {}
    underground_to_district: dict[str, dict[str, list[str]]] = {}

    for city in CITY_ORDER:
        city_frame = clean_frame[clean_frame["city"] == city].copy()
        if city_frame.empty:
            continue

        city_frame["district"] = city_frame["district"].map(normalize_value)
        city_frame["underground"] = city_frame["underground"].map(normalize_value)

        city_district_options = select_main_values(
            city_frame["district"],
            min_count=DISTRICT_MIN_COUNT,
            max_items=MAX_DISTRICT_OPTIONS,
        )
        city_underground_options = select_main_values(
            city_frame["underground"],
            min_count=METRO_MIN_COUNT,
            max_items=MAX_METRO_OPTIONS,
        )

        district_options[city] = city_district_options
        underground_options[city] = city_underground_options
        district_to_underground[city] = build_recommendation_map(
            city_frame,
            source_column="district",
            target_column="underground",
            allowed_source_values=city_district_options,
            allowed_target_values=city_underground_options,
        )
        underground_to_district[city] = build_recommendation_map(
            city_frame,
            source_column="underground",
            target_column="district",
            allowed_source_values=city_underground_options,
            allowed_target_values=city_district_options,
        )

    return district_options, underground_options, district_to_underground, underground_to_district


def dump_ts_constant(name: str, value: object) -> str:
    return f"const {name} = {json.dumps(value, ensure_ascii=False, indent=2)} as const;\n"


def render_typescript(
    district_options: dict[str, list[str]],
    underground_options: dict[str, list[str]],
    district_to_underground: dict[str, dict[str, list[str]]],
    underground_to_district: dict[str, dict[str, list[str]]],
) -> str:
    generated_note = (
        "// This file is generated from ml/data/interim/cleaned_listings.csv.\n"
        "// Do not edit manually: re-run ml/scripts/export_frontend_location_data.py.\n\n"
    )

    content = generated_note
    content += dump_ts_constant("DISTRICT_OPTIONS_DATA", district_options)
    content += "\n"
    content += dump_ts_constant("UNDERGROUND_OPTIONS_DATA", underground_options)
    content += "\n"
    content += dump_ts_constant("DISTRICT_TO_UNDERGROUND_RECOMMENDATIONS_DATA", district_to_underground)
    content += "\n"
    content += dump_ts_constant("UNDERGROUND_TO_DISTRICT_RECOMMENDATIONS_DATA", underground_to_district)
    content += "\n"
    content += (
        "export {\n"
        "  DISTRICT_OPTIONS_DATA,\n"
        "  UNDERGROUND_OPTIONS_DATA,\n"
        "  DISTRICT_TO_UNDERGROUND_RECOMMENDATIONS_DATA,\n"
        "  UNDERGROUND_TO_DISTRICT_RECOMMENDATIONS_DATA,\n"
        "};\n"
    )
    return content


def main() -> None:
    args = parse_args()
    clean_frame = pd.read_csv(args.input, encoding="utf-8")
    district_options, underground_options, district_to_underground, underground_to_district = build_city_payload(clean_frame)
    output_content = render_typescript(
        district_options=district_options,
        underground_options=underground_options,
        district_to_underground=district_to_underground,
        underground_to_district=underground_to_district,
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(output_content, encoding="utf-8")
    print(f"Saved frontend location data: {args.output}")


if __name__ == "__main__":
    main()
