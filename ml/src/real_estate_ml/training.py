from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from catboost import CatBoostRegressor
from sklearn.base import BaseEstimator, RegressorMixin
from sklearn.compose import ColumnTransformer
from sklearn.dummy import DummyRegressor
from sklearn.ensemble import ExtraTreesRegressor, RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_absolute_error, mean_absolute_percentage_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.compose import TransformedTargetRegressor
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from .features import CATEGORICAL_FEATURES, NUMERIC_FEATURES, TARGET_COLUMN, select_active_feature_columns
from .paths import ARTIFACTS_DIR, PROCESSED_DATA_DIR, ensure_directories


class CatBoostRegressorWrapper(BaseEstimator, RegressorMixin):
    def __init__(
        self,
        iterations: int = 700,
        learning_rate: float = 0.05,
        depth: int = 8,
        random_state: int = 42,
        cat_features: tuple[str, ...] = (),
    ) -> None:
        self.iterations = iterations
        self.learning_rate = learning_rate
        self.depth = depth
        self.random_state = random_state
        self.cat_features = cat_features

    def fit(self, X: pd.DataFrame, y: pd.Series):
        self.model_ = CatBoostRegressor(
            loss_function="RMSE",
            iterations=self.iterations,
            learning_rate=self.learning_rate,
            depth=self.depth,
            random_seed=self.random_state,
            verbose=False,
            allow_writing_files=False,
            cat_features=list(self.cat_features),
        )
        self.model_.fit(X, y)
        self.feature_importances_ = self.model_.feature_importances_
        self.feature_names_ = list(getattr(self.model_, "feature_names_", getattr(X, "columns", [])))
        return self

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        return self.model_.predict(X)


@dataclass(slots=True)
class TrainingConfig:
    test_size: float = 0.2
    random_state: int = 42
    candidate_models: list[str] = field(default_factory=lambda: ["dummy", "random_forest", "extra_trees", "catboost"])
    target_column: str = TARGET_COLUMN


def load_training_config(config_path: Path) -> TrainingConfig:
    payload = json.loads(config_path.read_text(encoding="utf-8"))
    return TrainingConfig(
        test_size=payload.get("test_size", 0.2),
        random_state=payload.get("random_state", 42),
        candidate_models=payload.get("candidate_models", ["dummy", "random_forest", "extra_trees", "catboost"]),
        target_column=payload.get("target_column", TARGET_COLUMN),
    )


def load_feature_dataset(input_path: Path | None = None) -> pd.DataFrame:
    input_path = input_path or (PROCESSED_DATA_DIR / "model_input.csv")
    return pd.read_csv(input_path, encoding="utf-8")


def build_preprocessor(numeric_features: list[str], categorical_features: list[str]) -> ColumnTransformer:
    try:
        encoder = OneHotEncoder(handle_unknown="ignore", sparse_output=True)
    except TypeError:
        encoder = OneHotEncoder(handle_unknown="ignore", sparse=True)

    numeric_pipeline = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
        ]
    )
    categorical_pipeline = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="most_frequent")),
            ("encoder", encoder),
        ]
    )
    return ColumnTransformer(
        transformers=[
            ("numeric", numeric_pipeline, numeric_features),
            ("categorical", categorical_pipeline, categorical_features),
        ],
        remainder="drop",
    )


def build_estimator(model_name: str, random_state: int, categorical_features: list[str] | None = None):
    if model_name == "dummy":
        return DummyRegressor(strategy="median")
    if model_name == "random_forest":
        return RandomForestRegressor(
            n_estimators=300,
            random_state=random_state,
            n_jobs=-1,
            min_samples_leaf=2,
        )
    if model_name == "extra_trees":
        return ExtraTreesRegressor(
            n_estimators=400,
            random_state=random_state,
            n_jobs=-1,
            min_samples_leaf=1,
        )
    if model_name == "catboost":
        return CatBoostRegressorWrapper(
            iterations=700,
            learning_rate=0.05,
            depth=8,
            random_state=random_state,
            cat_features=tuple(categorical_features or []),
        )
    raise ValueError(f"Unsupported model name: {model_name}")


def build_model_pipeline(
    model_name: str,
    random_state: int,
    numeric_features: list[str],
    categorical_features: list[str],
) -> TransformedTargetRegressor:
    if model_name == "catboost":
        pipeline = build_estimator(
            model_name,
            random_state=random_state,
            categorical_features=categorical_features,
        )
    else:
        preprocessor = build_preprocessor(numeric_features=numeric_features, categorical_features=categorical_features)
        estimator = build_estimator(
            model_name,
            random_state=random_state,
            categorical_features=categorical_features,
        )
        pipeline = Pipeline(
            steps=[
                ("preprocessor", preprocessor),
                ("model", estimator),
            ]
        )

    return TransformedTargetRegressor(
        regressor=pipeline,
        func=np.log1p,
        inverse_func=np.expm1,
    )


def compute_metrics(y_true: pd.Series, y_pred: np.ndarray) -> dict[str, float]:
    return {
        "mae": float(mean_absolute_error(y_true, y_pred)),
        "rmse": float(np.sqrt(mean_squared_error(y_true, y_pred))),
        "mape": float(mean_absolute_percentage_error(y_true, y_pred)),
        "r2": float(r2_score(y_true, y_pred)),
    }


def evaluate_candidates(dataset: pd.DataFrame, config: TrainingConfig) -> tuple[str, TransformedTargetRegressor, dict[str, dict[str, float]], dict[str, pd.DataFrame]]:
    numeric_features, categorical_features = select_active_feature_columns(dataset)
    feature_columns = numeric_features + categorical_features
    X = dataset[feature_columns]
    y = dataset[config.target_column]

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=config.test_size,
        random_state=config.random_state,
    )

    results: dict[str, dict[str, float]] = {}
    prediction_samples: dict[str, pd.DataFrame] = {}
    fitted_models: dict[str, TransformedTargetRegressor] = {}

    for model_name in config.candidate_models:
        model = build_model_pipeline(
            model_name,
            random_state=config.random_state,
            numeric_features=numeric_features,
            categorical_features=categorical_features,
        )
        model.fit(X_train, y_train)
        predictions = model.predict(X_test)
        results[model_name] = compute_metrics(y_test, predictions)
        prediction_samples[model_name] = pd.DataFrame(
            {
                "actual_price": y_test.reset_index(drop=True),
                "predicted_price": pd.Series(predictions).round(2),
            }
        ).head(200)
        fitted_models[model_name] = model

    best_model_name = min(results, key=lambda name: results[name]["rmse"])
    best_model = fitted_models[best_model_name]
    return best_model_name, best_model, results, prediction_samples


def fit_final_model(dataset: pd.DataFrame, model_name: str, config: TrainingConfig) -> TransformedTargetRegressor:
    numeric_features, categorical_features = select_active_feature_columns(dataset)
    X = dataset[numeric_features + categorical_features]
    y = dataset[config.target_column]
    model = build_model_pipeline(
        model_name,
        random_state=config.random_state,
        numeric_features=numeric_features,
        categorical_features=categorical_features,
    )
    model.fit(X, y)
    return model


def extract_feature_importance(model: TransformedTargetRegressor) -> pd.DataFrame:
    pipeline = model.regressor_

    if hasattr(pipeline, "named_steps"):
        preprocessor = pipeline.named_steps["preprocessor"]
        estimator = pipeline.named_steps["model"]

        if not hasattr(estimator, "feature_importances_"):
            return pd.DataFrame(columns=["feature", "importance"])

        feature_names = preprocessor.get_feature_names_out()
        importance = pd.DataFrame({"feature": feature_names, "importance": estimator.feature_importances_})
        return importance.sort_values(by="importance", ascending=False).reset_index(drop=True)

    if not hasattr(pipeline, "feature_importances_"):
        return pd.DataFrame(columns=["feature", "importance"])

    feature_names = getattr(pipeline, "feature_names_", None)
    if not feature_names:
        feature_names = getattr(pipeline, "feature_names_in_", None)
    if feature_names is None:
        feature_names = [f"feature_{index}" for index in range(len(pipeline.feature_importances_))]

    importance = pd.DataFrame({"feature": feature_names, "importance": pipeline.feature_importances_})
    return importance.sort_values(by="importance", ascending=False).reset_index(drop=True)


def save_training_outputs(
    final_model: TransformedTargetRegressor,
    best_model_name: str,
    metrics: dict[str, dict[str, float]],
    prediction_samples: dict[str, pd.DataFrame],
    feature_importance: pd.DataFrame,
    dataset: pd.DataFrame,
    artifacts_dir: Path | None = None,
) -> dict[str, Path]:
    ensure_directories()
    artifacts_dir = artifacts_dir or ARTIFACTS_DIR
    artifacts_dir.mkdir(parents=True, exist_ok=True)

    model_path = artifacts_dir / "best_model.joblib"
    metrics_path = artifacts_dir / "metrics.json"
    summary_path = artifacts_dir / "training_summary.json"
    importance_path = artifacts_dir / "feature_importance.csv"

    joblib.dump(final_model, model_path)
    metrics_path.write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    summary_payload = {
        "selected_model": best_model_name,
        "metrics_file": str(metrics_path),
        "model_file": str(model_path),
        "active_numeric_features": select_active_feature_columns(dataset)[0],
        "active_categorical_features": select_active_feature_columns(dataset)[1],
    }
    summary_path.write_text(json.dumps(summary_payload, indent=2), encoding="utf-8")

    if feature_importance.empty:
        importance_path.write_text("feature,importance\n", encoding="utf-8")
    else:
        feature_importance.to_csv(importance_path, index=False, encoding="utf-8")

    prediction_paths: dict[str, str] = {}
    for model_name, sample in prediction_samples.items():
        sample_path = artifacts_dir / f"{model_name}_predictions_sample.csv"
        sample.to_csv(sample_path, index=False, encoding="utf-8")
        prediction_paths[model_name] = str(sample_path)

    return {
        "model": model_path,
        "metrics": metrics_path,
        "summary": summary_path,
        "importance": importance_path,
        **{f"sample_{name}": Path(path) for name, path in prediction_paths.items()},
    }
