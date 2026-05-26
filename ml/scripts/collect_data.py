from __future__ import annotations

import argparse
import sys
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
ML_ROOT = SCRIPT_DIR.parent
SRC_DIR = ML_ROOT / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from real_estate_ml.collection import collect_dataset, load_collection_config
from real_estate_ml.paths import RAW_DATA_DIR


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Collect flat listings with cianparser.")
    parser.add_argument(
        "--config",
        type=Path,
        default=ML_ROOT / "config" / "collection_config.json",
        help="Path to the JSON config with cities, room groups, and parser settings.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=RAW_DATA_DIR,
        help="Directory where raw CSV files will be saved.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    config = load_collection_config(args.config)
    combined, saved_files, combined_path = collect_dataset(config=config, output_dir=args.output_dir)
    print(f"Collected {len(combined):,} rows into {len(saved_files)} files.")
    print(f"Combined dataset: {combined_path}")


if __name__ == "__main__":
    main()
