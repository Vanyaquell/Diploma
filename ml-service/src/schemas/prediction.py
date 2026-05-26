from __future__ import annotations

from pydantic import BaseModel, Field, model_validator


class PredictionRequest(BaseModel):
    city: str = Field(min_length=2, max_length=120)
    district: str = Field(default="unknown", min_length=1, max_length=120)
    underground: str = Field(default="unknown", min_length=1, max_length=120)
    total_meters: float = Field(gt=0, le=400)
    rooms_count: float = Field(ge=0, le=10)
    floor: int = Field(ge=1, le=100)
    floors_count: int = Field(ge=1, le=100)
    house_material_type: str = Field(default="unknown", min_length=1, max_length=120)
    finish_type: str = Field(default="unknown", min_length=1, max_length=120)
    object_type: str = Field(default="flat", min_length=1, max_length=60)

    @model_validator(mode="after")
    def validate_floor_relation(self) -> "PredictionRequest":
        if self.floor > self.floors_count:
            raise ValueError("Этаж квартиры не может превышать количество этажей в доме.")
        return self


class PredictionResponse(BaseModel):
    predicted_price: float
    model_name: str
    model_version: str
    price_per_square_meter: float
    estimated_price_min: float
    estimated_price_max: float
    confidence_margin_percent: float | None = None
