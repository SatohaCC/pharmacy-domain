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

__all__ = [
    "DomainAuthorizationError",
    "DomainConflictError",
    "DomainError",
    "DomainNotFoundError",
    "DomainValidationError",
    "ErrorDetailScalar",
    "ErrorDetails",
]
