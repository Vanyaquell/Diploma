from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI

from src.api.routes import router
from src.core.model_registry import model_registry


@asynccontextmanager
async def lifespan(app: FastAPI):
    model_registry.load()
    yield


app = FastAPI(
    title="Real Estate ML Service",
    version="1.0.0",
    lifespan=lifespan,
)

app.include_router(router)
