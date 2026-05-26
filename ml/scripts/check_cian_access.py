from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
ML_ROOT = SCRIPT_DIR.parent
SRC_DIR = ML_ROOT / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from real_estate_ml.collection import check_collection_access, load_collection_config


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Check whether CIAN list pages are reachable for the given config.")
    parser.add_argument(
        "--config",
        type=Path,
        default=ML_ROOT / "config" / "collection_smoke_config.json",
        help="Path to the JSON config with cities, room groups, and proxy settings.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    config = load_collection_config(args.config)
    result = check_collection_access(config)
    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
