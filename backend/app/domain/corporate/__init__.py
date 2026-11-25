"""法人コンテキストのドメイン層パッケージ。"""

from app.domain.corporate.entities import Corporation
from app.domain.corporate.exceptions import (
    CorporationNotFoundError,
    DuplicateCorporateNumberError,
    EmptyCorporationUpdateError,
    InvalidCorporationTransitionError,
    InvalidCorporationUpdateError,
)
from app.domain.corporate.identifiers import CorporationId
from app.domain.corporate.primitives import (
    CorporateAddress,
    CorporateNumber,
    CorporationName,
)
from app.domain.corporate.repositories import CorporationRepository
from app.domain.corporate.value_objects import CorporationCategory, CorporationStatus

__all__ = [
    "CorporateAddress",
    "CorporateNumber",
    "Corporation",
    "CorporationCategory",
    "CorporationId",
    "CorporationName",
    "CorporationNotFoundError",
    "CorporationRepository",
    "CorporationStatus",
    "DuplicateCorporateNumberError",
    "EmptyCorporationUpdateError",
    "InvalidCorporationTransitionError",
    "InvalidCorporationUpdateError",
]
