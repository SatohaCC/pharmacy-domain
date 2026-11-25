"""業務非依存のドメイン基底モジュール。"""

from app.domain.foundation.exceptions import (
    DomainAuthorizationError,
    DomainConflictError,
    DomainError,
    DomainNotFoundError,
    DomainValidationError,
    ErrorDetails,
    ErrorDetailScalar,
)
from app.domain.foundation.identifiers import EntityId
from app.domain.foundation.primitives import (
    DomainPrimitive,
    FiniteFloatPrimitive,
    IntPrimitive,
    MaskedPiiString,
    NonEmptyString,
    StringPrimitive,
    ensure_aware_datetime,
)

__all__ = [
    "DomainAuthorizationError",
    "DomainConflictError",
    "DomainError",
    "DomainNotFoundError",
    "DomainPrimitive",
    "DomainValidationError",
    "EntityId",
    "ErrorDetailScalar",
    "ErrorDetails",
    "FiniteFloatPrimitive",
    "IntPrimitive",
    "MaskedPiiString",
    "NonEmptyString",
    "StringPrimitive",
    "ensure_aware_datetime",
]
