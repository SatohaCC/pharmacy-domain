"""法人コンテキストのドメイン層パッケージ。"""

from app.domain.corporate.entities import CorporateRelation, Corporation
from app.domain.corporate.exceptions import (
    CorporateRelationCycleError,
    CorporateRelationNotFoundError,
    CorporationNotFoundError,
    DuplicateCorporateNumberError,
    DuplicateCorporateRelationError,
    EmptyCorporationUpdateError,
    InvalidCorporationTransitionError,
    InvalidCorporationUpdateError,
    MultipleCorporateParentsError,
    SelfCorporateRelationError,
)
from app.domain.corporate.identifiers import CorporateRelationId, CorporationId
from app.domain.corporate.primitives import (
    CorporateAddress,
    CorporateNumber,
    CorporationEvidence,
    CorporationName,
    RepresentativeName,
)
from app.domain.corporate.repositories import CorporateRelationRepository, CorporationRepository
from app.domain.corporate.services import validate_corporate_relation
from app.domain.corporate.value_objects import (
    CorporateRelationRevision,
    CorporateRelationType,
    CorporationCategory,
    CorporationStatus,
)

__all__ = [
    "CorporateAddress",
    "CorporateNumber",
    "CorporateRelation",
    "CorporateRelationCycleError",
    "CorporateRelationId",
    "CorporateRelationNotFoundError",
    "CorporateRelationRepository",
    "CorporateRelationRevision",
    "CorporateRelationType",
    "Corporation",
    "CorporationCategory",
    "CorporationEvidence",
    "CorporationId",
    "CorporationName",
    "CorporationNotFoundError",
    "CorporationRepository",
    "CorporationStatus",
    "DuplicateCorporateNumberError",
    "DuplicateCorporateRelationError",
    "EmptyCorporationUpdateError",
    "InvalidCorporationTransitionError",
    "InvalidCorporationUpdateError",
    "MultipleCorporateParentsError",
    "RepresentativeName",
    "SelfCorporateRelationError",
    "validate_corporate_relation",
]
