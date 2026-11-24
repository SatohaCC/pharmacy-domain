"""アプリケーション層の公開例外契約。"""

import re
from typing import Literal

from app.domain.foundation.exceptions import (
    DomainAuthorizationError,
    DomainConflictError,
    DomainError,
    DomainNotFoundError,
    DomainValidationError,
    ErrorDetails,
    validate_error_details,
)

type StateImpact = Literal["unchanged", "draft_preserved", "unknown"]

_ERROR_CODE_PATTERN = re.compile(r"^[A-Z][A-Z0-9_]*$")
_VALID_STATE_IMPACTS: frozenset[str] = frozenset({"unchanged", "draft_preserved", "unknown"})


class ApplicationError(Exception):
    """ユースケース実行時の失敗を表す基底例外。"""

    def __init__(
        self,
        message: str,
        *,
        code: str = "APPLICATION_ERROR",
        reason: str | None = None,
        action_hint: str | None = None,
        details: ErrorDetails | None = None,
        state_impact: StateImpact = "unchanged",
    ) -> None:
        if not message or not message.strip():
            raise ValueError("例外メッセージは空にできません。")
        if not _ERROR_CODE_PATTERN.fullmatch(code):
            raise ValueError("不正なエラーコード形式です。")
        if reason is not None and not reason.strip():
            raise ValueError("reason は空にできません。")
        if action_hint is not None and not action_hint.strip():
            raise ValueError("action_hint は空にできません。")
        if state_impact not in _VALID_STATE_IMPACTS:
            raise ValueError("不正な state_impact 指定です。")

        super().__init__(message)
        self._code = code
        self._message = message
        self._reason = reason if reason is not None else message
        self._action_hint = action_hint
        self._details = validate_error_details(details)
        self._state_impact: StateImpact = state_impact

    @property
    def code(self) -> str:
        return self._code

    @property
    def message(self) -> str:
        return self._message

    @property
    def reason(self) -> str:
        return self._reason

    @property
    def action_hint(self) -> str | None:
        return self._action_hint

    @property
    def details(self) -> ErrorDetails:
        """安全な構造化メタデータ（PIIや生の秘密値は含めないこと）。"""
        return self._details

    @property
    def state_impact(self) -> StateImpact:
        """トランザクションや保存状態に関する文脈。"""
        return self._state_impact


class ApplicationBadRequestError(ApplicationError):
    """入力の組み合わせや更新指定が不正であることを表す例外。"""

    def __init__(
        self,
        message: str,
        *,
        code: str = "BAD_REQUEST",
        reason: str | None = None,
        action_hint: str | None = None,
        details: ErrorDetails | None = None,
        state_impact: StateImpact = "unchanged",
    ) -> None:
        super().__init__(
            message,
            code=code,
            reason=reason,
            action_hint=action_hint,
            details=details,
            state_impact=state_impact,
        )


class ApplicationValidationError(ApplicationError):
    """業務値や形式の検証失敗を表す例外。"""

    def __init__(
        self,
        message: str,
        *,
        code: str = "VALIDATION_ERROR",
        reason: str | None = None,
        action_hint: str | None = None,
        details: ErrorDetails | None = None,
        state_impact: StateImpact = "unchanged",
    ) -> None:
        super().__init__(
            message,
            code=code,
            reason=reason,
            action_hint=action_hint,
            details=details,
            state_impact=state_impact,
        )


class ApplicationAuthorizationError(ApplicationError):
    """資格・ロール・テナント境界など業務上の認可違反を表す例外。"""

    def __init__(
        self,
        message: str,
        *,
        code: str = "FORBIDDEN",
        reason: str | None = None,
        action_hint: str | None = None,
        details: ErrorDetails | None = None,
        state_impact: StateImpact = "unchanged",
        conceal_as_not_found: bool = False,
    ) -> None:
        super().__init__(
            message,
            code=code,
            reason=reason,
            action_hint=action_hint,
            details=details,
            state_impact=state_impact,
        )
        self._conceal_as_not_found = conceal_as_not_found

    @property
    def conceal_as_not_found(self) -> bool:
        """IDOR 対策として外部境界で 404 へ秘匿マッピングするかを返す。"""
        return self._conceal_as_not_found


class ApplicationNotFoundError(ApplicationError):
    """対象リソースが存在しないことを表す例外。"""

    def __init__(
        self,
        message: str,
        *,
        code: str = "NOT_FOUND",
        reason: str | None = None,
        action_hint: str | None = None,
        details: ErrorDetails | None = None,
        state_impact: StateImpact = "unchanged",
    ) -> None:
        super().__init__(
            message,
            code=code,
            reason=reason,
            action_hint=action_hint,
            details=details,
            state_impact=state_impact,
        )


class ApplicationConflictError(ApplicationError):
    """競合や一意性制約違反を表す例外。"""

    def __init__(
        self,
        message: str,
        *,
        code: str = "CONFLICT",
        reason: str | None = None,
        action_hint: str | None = None,
        details: ErrorDetails | None = None,
        state_impact: StateImpact = "unchanged",
    ) -> None:
        super().__init__(
            message,
            code=code,
            reason=reason,
            action_hint=action_hint,
            details=details,
            state_impact=state_impact,
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
            reason=exc.reason,
            action_hint=exc.action_hint,
            details=exc.details,
            state_impact=state_impact,
        )
    if isinstance(exc, DomainConflictError):
        return ApplicationConflictError(
            exc.message,
            code=exc.code,
            reason=exc.reason,
            action_hint=exc.action_hint,
            details=exc.details,
            state_impact=state_impact,
        )
    if isinstance(exc, DomainAuthorizationError):
        return ApplicationAuthorizationError(
            exc.message,
            code=exc.code,
            reason=exc.reason,
            action_hint=exc.action_hint,
            details=exc.details,
            state_impact=state_impact,
            conceal_as_not_found=exc.conceal_as_not_found,
        )
    if isinstance(exc, DomainValidationError):
        return ApplicationValidationError(
            exc.message,
            code=exc.code,
            reason=exc.reason,
            action_hint=exc.action_hint,
            details=exc.details,
            state_impact=state_impact,
        )
    return ApplicationError(
        exc.message,
        code=exc.code,
        reason=exc.reason,
        action_hint=exc.action_hint,
        details=exc.details,
        state_impact=state_impact,
    )
