"""アプリケーション層の公開例外契約。"""

import re
from collections.abc import Mapping
from types import MappingProxyType
from typing import Literal

type ErrorDetailScalar = str | int | float | bool | None
type ErrorDetails = Mapping[str, ErrorDetailScalar]
type StateImpact = Literal["unchanged", "draft_preserved", "unknown"]

_ERROR_CODE_PATTERN = re.compile(r"^[A-Z][A-Z0-9_]*$")
_DETAIL_KEY_PATTERN = re.compile(r"^[a-z][a-z0-9_]*$")
_CONTROL_CHAR_PATTERN = re.compile(r"[\x00-\x1f\x7f]")
_VALID_STATE_IMPACTS: frozenset[str] = frozenset({"unchanged", "draft_preserved", "unknown"})


def _validate_error_details(details: ErrorDetails | None) -> ErrorDetails:
    if not details:
        return MappingProxyType({})
    normalized: dict[str, ErrorDetailScalar] = {}
    for key, value in details.items():
        if not isinstance(key, str) or not _DETAIL_KEY_PATTERN.fullmatch(key):
            raise ValueError("details のキー形式が不正です。")
        if value is not None and not isinstance(value, bool | int | float | str):
            raise TypeError("details の値にはプリミティブ型のみ指定できます。")
        if isinstance(value, str) and _CONTROL_CHAR_PATTERN.search(value):
            raise ValueError("details の文字列値に制御文字は含められません。")
        normalized[key] = value
    return MappingProxyType(normalized)


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
        self._details = _validate_error_details(details)
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
