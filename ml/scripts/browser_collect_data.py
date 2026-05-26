from __future__ import annotations

import argparse
import sys
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
ML_ROOT = SCRIPT_DIR.parent
SRC_DIR = ML_ROOT / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from real_estate_ml.browser_collection import BrowserRuntimeConfig, collect_dataset_with_browser
from real_estate_ml.collection import load_collection_config
from real_estate_ml.paths import RAW_DATA_DIR


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Collect listings in a visible browser with manual CAPTCHA solving.")
    parser.add_argument(
        "--config",
        type=Path,
        default=ML_ROOT / "config" / "collection_smoke_config.json",
        help="Path to the collection JSON config.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=RAW_DATA_DIR,
        help="Directory where raw CSV files will be saved.",
    )
    parser.add_argument(
        "--browser",
        choices=["chrome", "edge"],
        default="chrome",
        help="Visible browser to use for manual collection.",
    )
    parser.add_argument(
        "--page-wait-timeout",
        type=int,
        default=30,
        help="Seconds to wait for listing cards before treating the page as blocked or broken.",
    )
    parser.add_argument(
        "--manual-solve-timeout",
        type=int,
        default=300,
        help="Seconds to wait for you to solve CAPTCHA manually in the opened browser window.",
    )
    parser.add_argument(
        "--poll-interval",
        type=int,
        default=2,
        help="How often to re-check the page while waiting for listings.",
    )
    parser.add_argument(
        "--profile-dir",
        type=Path,
        default=ML_ROOT / "browser_profile" / "chrome",
        help="Persistent browser profile directory for cookies and solved sessions.",
    )
    parser.add_argument(
        "--keep-browser-open",
        action="store_true",
        help="Keep the browser open after the script finishes.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    config = load_collection_config(args.config)
    runtime_config = BrowserRuntimeConfig(
        browser=args.browser,
        page_wait_timeout_seconds=args.page_wait_timeout,
        manual_solve_timeout_seconds=args.manual_solve_timeout,
        poll_interval_seconds=args.poll_interval,
        profile_dir=args.profile_dir,
        keep_browser_open=args.keep_browser_open,
    )
    combined, saved_files, combined_path = collect_dataset_with_browser(
        config=config,
        runtime_config=runtime_config,
        output_dir=args.output_dir,
    )
    print(f"Collected {len(combined):,} rows into {len(saved_files)} files.")
    print(f"Combined dataset: {combined_path}")


if __name__ == "__main__":
    main()
