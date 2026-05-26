from __future__ import annotations

import argparse
import sys
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
ML_ROOT = SCRIPT_DIR.parent
SRC_DIR = ML_ROOT / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from real_estate_ml.features import (
    load_clean_dataset,
    prepare_feature_dataset,
    save_feature_dataset,
    save_feature_manifest,
)
from real_estate_ml.paths import INTERIM_DATA_DIR, PROCESSED_DATA_DIR


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build the model-ready feature dataset.")
    parser.add_argument(
        "--input",
        type=Path,
        default=INTERIM_DATA_DIR / "cleaned_listings.csv",
        help="Path to the cleaned dataset CSV.",
    )
    parser.add_argument(
        "--output-csv",
        type=Path,
        default=PROCESSED_DATA_DIR / "model_input.csv",
        help="Path for the model-ready dataset CSV.",
    )
    parser.add_argument(
        "--manifest-json",
        type=Path,
        default=PROCESSED_DATA_DIR / "feature_manifest.json",
        help="Path for the feature manifest JSON.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    clean_frame = load_clean_dataset(args.input)
    feature_frame, manifest = prepare_feature_dataset(clean_frame)
    csv_path = save_feature_dataset(feature_frame, args.output_csv)
    manifest_path = save_feature_manifest(manifest, args.manifest_json)

    print(f"Prepared rows: {len(feature_frame):,}")
    print(f"Saved model input: {csv_path}")
    print(f"Saved manifest: {manifest_path}")


if __name__ == "__main__":
    main()
