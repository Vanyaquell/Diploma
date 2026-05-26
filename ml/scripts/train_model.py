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

from real_estate_ml.training import (
    evaluate_candidates,
    extract_feature_importance,
    fit_final_model,
    load_feature_dataset,
    load_training_config,
    save_training_outputs,
)
from real_estate_ml.paths import ARTIFACTS_DIR, PROCESSED_DATA_DIR


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train and compare price prediction models.")
    parser.add_argument(
        "--input",
        type=Path,
        default=PROCESSED_DATA_DIR / "model_input.csv",
        help="Path to the model-ready dataset CSV.",
    )
    parser.add_argument(
        "--config",
        type=Path,
        default=ML_ROOT / "config" / "training_config.json",
        help="Path to the JSON config with training settings.",
    )
    parser.add_argument(
        "--artifacts-dir",
        type=Path,
        default=ARTIFACTS_DIR,
        help="Directory where the trained model and metrics will be saved.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    config = load_training_config(args.config)
    dataset = load_feature_dataset(args.input)

    best_model_name, _, metrics, prediction_samples = evaluate_candidates(dataset, config)
    final_model = fit_final_model(dataset, best_model_name, config)
    feature_importance = extract_feature_importance(final_model)
    saved_paths = save_training_outputs(
        final_model=final_model,
        best_model_name=best_model_name,
        metrics=metrics,
        prediction_samples=prediction_samples,
        feature_importance=feature_importance,
        dataset=dataset,
        artifacts_dir=args.artifacts_dir,
    )

    print(f"Selected model: {best_model_name}")
    print(json.dumps(metrics, indent=2))
    print(f"Saved artifacts: {saved_paths['model']}")


if __name__ == "__main__":
    main()
