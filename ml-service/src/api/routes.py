from __future__ import annotations

from fastapi import APIRouter

from src.core.model_registry import model_registry
from src.schemas.prediction import PredictionRequest, PredictionResponse
from src.services.prediction_service import predict_price


router = APIRouter()


@router.get("/health")
def health_check() -> dict[str, object]:
    return {
        "status": "ok",
        "model_loaded": model_registry.is_loaded(),
    }


@router.get("/model-info")
def model_info() -> dict[str, object]:
    return model_registry.get_model_info()


@router.post("/reload-model")
def reload_model() -> dict[str, object]:
    model_registry.reload()
    return {
        "status": "reloaded",
        "model_info": model_registry.get_model_info(),
    }


@router.post("/predict", response_model=PredictionResponse)
def predict(request: PredictionRequest) -> PredictionResponse:
    return PredictionResponse(**predict_price(request))
