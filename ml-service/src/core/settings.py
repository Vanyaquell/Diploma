from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(slots=True)
class Settings:
    host: str
    port: int
    model_version: str
    ml_src_path: Path
    model_path: Path
    metrics_path: Path
    training_summary_path: Path
    feature_manifest_path: Path


def build_settings() -> Settings:
    service_root = Path(__file__).resolve().parents[2]
    project_root = service_root.parent
    ml_root = project_root / "ml"

    return Settings(
        host=os.getenv("HOST", "127.0.0.1"),
        port=int(os.getenv("PORT", "8400")),
        model_version=os.getenv("MODEL_VERSION", "1.0.0"),
        ml_src_path=Path(os.getenv("ML_SRC_PATH", ml_root / "src")),
        model_path=Path(os.getenv("MODEL_PATH", ml_root / "artifacts" / "best_model.joblib")),
        metrics_path=Path(os.getenv("METRICS_PATH", ml_root / "artifacts" / "metrics.json")),
        training_summary_path=Path(
            os.getenv("TRAINING_SUMMARY_PATH", ml_root / "artifacts" / "training_summary.json")
        ),
        feature_manifest_path=Path(
            os.getenv("FEATURE_MANIFEST_PATH", ml_root / "data" / "processed" / "feature_manifest.json")
        ),
    )


settings = build_settings()
