from __future__ import annotations

import argparse
import sys
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
ML_ROOT = SCRIPT_DIR.parent
SRC_DIR = ML_ROOT / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from real_estate_ml.cleaning import (
    clean_dataset,
    load_raw_dataset,
    resolve_raw_input,
    save_clean_dataset,
    save_cleaning_report,
)
from real_estate_ml.paths import INTERIM_DATA_DIR, RAW_DATA_DIR


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Clean raw real estate listings.")
    parser.add_argument(
        "--input",
        type=Path,
        default=RAW_DATA_DIR,
        help="Raw CSV file or directory with collected data.",
    )
    parser.add_argument(
        "--output-csv",
        type=Path,
        default=INTERIM_DATA_DIR / "cleaned_listings.csv",
        help="Path for the cleaned dataset CSV.",
    )
    parser.add_argument(
        "--report-json",
        type=Path,
        default=INTERIM_DATA_DIR / "cleaning_report.json",
        help="Path for the cleaning report JSON.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    raw_input_path = resolve_raw_input(args.input)
    raw_frame = load_raw_dataset(raw_input_path)
    cleaned_frame, report = clean_dataset(raw_frame)
    csv_path = save_clean_dataset(cleaned_frame, args.output_csv)
    report_path = save_cleaning_report(report, args.report_json)

    print(f"Used raw input: {raw_input_path}")
    print(f"Cleaned dataset rows: {len(cleaned_frame):,}")
    print(f"Saved cleaned CSV: {csv_path}")
    print(f"Saved cleaning report: {report_path}")


if __name__ == "__main__":
    main()
