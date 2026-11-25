"""ドメイン例外からアプリケーション層公開例外への変換ヘルパー。"""

from app.application.foundation.errors import (
    ApplicationAuthorizationError,
    ApplicationConflictError,
    ApplicationError,
    ApplicationNotFoundError,
    ApplicationValidationError,
    StateImpact,
)
from app.domain.foundation.exceptions import (
    DomainAuthorizationError,
    DomainConflictError,
    DomainError,
    DomainNotFoundError,
    DomainValidationError,
)


def from_domain_error(
    exc: DomainError,
    *,
    state_impact: StateImpact = "unchanged",
) -> ApplicationError:
    """ドメイン例外をアプリケーション層の公開例外へ変換する。"""
    if isinstance(exc, DomainNotFoundError):
        return ApplicationNotFoundError(
            exc.message,
            code=exc.code,
            details=exc.details,
            state_impact=state_impact,
        )
    if isinstance(exc, DomainConflictError):
        return ApplicationConflictError(
            exc.message,
            code=exc.code,
            details=exc.details,
            state_impact=state_impact,
        )
    if isinstance(exc, DomainAuthorizationError):
        return ApplicationAuthorizationError(
            exc.message,
            code=exc.code,
            details=exc.details,
            state_impact=state_impact,
            conceal_as_not_found=exc.conceal_as_not_found,
        )
    if isinstance(exc, DomainValidationError):
        return ApplicationValidationError(
            exc.message,
            code=exc.code,
            details=exc.details,
            state_impact=state_impact,
        )
    return ApplicationError(
        exc.message,
        code=exc.code,
        details=exc.details,
        state_impact=state_impact,
    )
