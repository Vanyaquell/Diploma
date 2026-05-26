from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

import joblib
import pandas as pd

from .settings import settings


class ModelRegistry:
    def __init__(self) -> None:
        self.model = None
        self.metrics: dict[str, Any] = {}
        self.training_summary: dict[str, Any] = {}
        self.feature_manifest: dict[str, Any] = {}
        self.active_numeric_features: list[str] = []
        self.active_categorical_features: list[str] = []

    def load(self) -> None:
        if not settings.model_path.exists():
            raise FileNotFoundError(f"Model file was not found: {settings.model_path}")

        ml_src_path = str(settings.ml_src_path)
        if ml_src_path not in sys.path:
            sys.path.insert(0, ml_src_path)

        self.model = joblib.load(settings.model_path)
        self.metrics = self._load_json(settings.metrics_path)
        self.training_summary = self._load_json(settings.training_summary_path)
        self.feature_manifest = self._load_json(settings.feature_manifest_path)
        self.active_numeric_features = self.training_summary.get(
            "active_numeric_features",
            self.feature_manifest.get("active_numeric_features", []),
        )
        self.active_categorical_features = self.training_summary.get(
            "active_categorical_features",
            self.feature_manifest.get("active_categorical_features", []),
        )

    def is_loaded(self) -> bool:
        return self.model is not None

    def ensure_loaded(self) -> None:
        if not self.is_loaded():
            self.load()

    def reload(self) -> None:
        self.model = None
        self.metrics = {}
        self.training_summary = {}
        self.feature_manifest = {}
        self.active_numeric_features = []
        self.active_categorical_features = []
        self.load()

    def predict(self, payload: dict[str, Any]) -> float:
        self.ensure_loaded()
        feature_columns = self.active_numeric_features + self.active_categorical_features

        row = {}
        for column in feature_columns:
            row[column] = payload.get(column)

        frame = pd.DataFrame([row], columns=feature_columns)
        prediction = self.model.predict(frame)[0]
        return float(prediction)

    def get_model_info(self) -> dict[str, Any]:
        self.ensure_loaded()
        selected_model = self.training_summary.get("selected_model", "unknown")
        return {
            "selected_model": selected_model,
            "model_version": self.training_summary.get("model_version", settings.model_version),
            "active_numeric_features": self.active_numeric_features,
            "active_categorical_features": self.active_categorical_features,
            "model_path": str(settings.model_path),
            "trained_at": self.training_summary.get("trained_at"),
            "dataset_version_id": self.training_summary.get("dataset_version_id"),
            "selected_model_metrics": self.metrics.get(selected_model, {}),
        }

    @staticmethod
    def _load_json(path: Path) -> dict[str, Any]:
        if not path.exists():
            return {}
        return json.loads(path.read_text(encoding="utf-8"))


model_registry = ModelRegistry()
