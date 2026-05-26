from __future__ import annotations

from .typing_utils import PredictionPayload
from src.core.model_registry import model_registry
from src.schemas.prediction import PredictionRequest


def build_feature_payload(request: PredictionRequest) -> PredictionPayload:
    payload: PredictionPayload = {
        "city": request.city.strip(),
        "district": request.district.strip() or "unknown",
        "underground": request.underground.strip() or "unknown",
        "house_material_type": request.house_material_type.strip() or "unknown",
        "finish_type": request.finish_type.strip() or "unknown",
        "object_type": request.object_type.strip() or "flat",
        "total_meters": request.total_meters,
        "rooms_count": request.rooms_count,
        "floor": request.floor,
        "floors_count": request.floors_count,
    }

    payload["city_district"] = f"{payload['city']}__{payload['district']}"
    payload["floor_ratio"] = request.floor / request.floors_count if request.floors_count else None
    payload["is_top_floor"] = int(request.floor == request.floors_count)
    payload["is_first_floor"] = int(request.floor == 1)
    payload["room_density"] = request.rooms_count / request.total_meters if request.total_meters else None

    return payload


def predict_price(request: PredictionRequest) -> dict[str, float | str]:
    payload = build_feature_payload(request)
    predicted_price = model_registry.predict(payload)
    model_info = model_registry.get_model_info()
    selected_model_metrics = model_info.get("selected_model_metrics", {})
    margin_percent = selected_model_metrics.get("mape")
    price_per_square_meter = predicted_price / request.total_meters if request.total_meters else 0
    estimated_price_min = predicted_price
    estimated_price_max = predicted_price

    if isinstance(margin_percent, (int, float)):
        estimated_price_min = predicted_price * (1 - float(margin_percent))
        estimated_price_max = predicted_price * (1 + float(margin_percent))

    return {
        "predicted_price": round(predicted_price, 2),
        "model_name": model_info["selected_model"],
        "model_version": model_info["model_version"],
        "price_per_square_meter": round(price_per_square_meter, 2),
        "estimated_price_min": round(estimated_price_min, 2),
        "estimated_price_max": round(estimated_price_max, 2),
        "confidence_margin_percent": float(margin_percent) if isinstance(margin_percent, (int, float)) else None,
    }
