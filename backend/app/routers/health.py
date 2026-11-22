from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.config import Settings
from app.routers.dependencies import get_settings
from app.schemas.health import HealthResponse
from app.services.health import get_health_status

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health_check(settings: Annotated[Settings, Depends(get_settings)]) -> HealthResponse:
    """サービスのヘルスステータスを返す。"""
    return get_health_status(settings.service_name)
