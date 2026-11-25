"""公開 DTO パッケージ。"""

from app.presentation.dto.corporations import (
    CorporationCreateRequest,
    CorporationListResponse,
    CorporationResponse,
    CorporationStatusChangeRequest,
    CorporationUpdateRequest,
)
from app.presentation.dto.error import (
    ErrorAction,
    ErrorActionType,
    ErrorDetailScalar,
    ErrorResponse,
    ValidationErrorDetail,
)
from app.presentation.dto.health import HealthResponse

__all__ = [
    "CorporationCreateRequest",
    "CorporationListResponse",
    "CorporationResponse",
    "CorporationStatusChangeRequest",
    "CorporationUpdateRequest",
    "ErrorAction",
    "ErrorActionType",
    "ErrorDetailScalar",
    "ErrorResponse",
    "HealthResponse",
    "ValidationErrorDetail",
]
