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
    AwareDatetime,
    DomainPrimitive,
    FiniteFloatPrimitive,
    IntPrimitive,
    MaskedPiiString,
    NonEmptyString,
    StringPrimitive,
)
from app.domain.foundation.value_objects import EffectiveDateRange

__all__ = [
    "AwareDatetime",
    "DomainAuthorizationError",
    "DomainConflictError",
    "DomainError",
    "DomainNotFoundError",
    "DomainPrimitive",
    "DomainValidationError",
    "EffectiveDateRange",
    "EntityId",
    "ErrorDetailScalar",
    "ErrorDetails",
    "FiniteFloatPrimitive",
    "IntPrimitive",
    "MaskedPiiString",
    "NonEmptyString",
    "StringPrimitive",
]
