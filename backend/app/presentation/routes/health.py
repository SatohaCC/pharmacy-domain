"""ヘルスチェック用ルーター。"""

from typing import Annotated

from fastapi import APIRouter, Depends

from app.presentation.dependencies import get_service_name
from app.presentation.dto.health import HealthResponse

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health_check(
    service_name: Annotated[str, Depends(get_service_name)],
) -> HealthResponse:
    """サービスの稼働状態を返す。"""
    return HealthResponse(status="ok", service=service_name)
