"""アプリケーション層の公開例外契約。"""

import math
import re
from collections.abc import Mapping
from types import MappingProxyType
from typing import ClassVar, Literal

type ErrorDetailScalar = str | int | float | bool | None
type ErrorDetails = Mapping[str, ErrorDetailScalar]
type StateImpact = Literal["unchanged", "draft_preserved", "unknown"]

_ERROR_CODE_PATTERN = re.compile(r"^[A-Z][A-Z0-9_]*$")
_DETAIL_KEY_PATTERN = re.compile(r"^[a-z][a-z0-9_]*$")
_CONTROL_CHAR_PATTERN = re.compile(r"[\x00-\x1f\x7f]")
_VALID_STATE_IMPACTS: frozenset[str] = frozenset({"unchanged", "draft_preserved", "unknown"})
_DEFAULT_APPLICATION_MESSAGE = "処理を実行できませんでした。"


def _resolve_code(code: str | None, default_code: str) -> str:
    if isinstance(code, str) and _ERROR_CODE_PATTERN.fullmatch(code):
        return code
    return default_code


def _resolve_message(message: str, default_message: str) -> str:
    if not isinstance(message, str):
        return default_message
    cleaned = _CONTROL_CHAR_PATTERN.sub("", message).strip()
    return cleaned if cleaned else default_message


def _sanitize_error_details(details: ErrorDetails | None) -> ErrorDetails:
    if not details:
        return MappingProxyType({})
    normalized: dict[str, ErrorDetailScalar] = {}
    for key, value in details.items():
        if not isinstance(key, str) or not _DETAIL_KEY_PATTERN.fullmatch(key):
            continue
        if value is None or isinstance(value, bool | int):
            normalized[key] = value
        elif isinstance(value, float):
            if math.isfinite(value):
                normalized[key] = value
        elif isinstance(value, str):
            normalized[key] = _CONTROL_CHAR_PATTERN.sub("", value)
    return MappingProxyType(normalized)


def _resolve_state_impact(state_impact: StateImpact) -> StateImpact:
    if state_impact in _VALID_STATE_IMPACTS:
        return state_impact
    return "unchanged"


class ApplicationError(Exception):
    """ユースケース実行時の失敗を表す基底例外。"""

    default_code: ClassVar[str] = "APPLICATION_ERROR"

    def __init__(
        self,
        message: str,
        *,
        code: str | None = None,
        details: ErrorDetails | None = None,
        state_impact: StateImpact = "unchanged",
    ) -> None:
        resolved_message = _resolve_message(message, _DEFAULT_APPLICATION_MESSAGE)
        super().__init__(resolved_message)
        self._code = _resolve_code(code, self.default_code)
        self._message = resolved_message
        self._details = _sanitize_error_details(details)
        self._state_impact: StateImpact = _resolve_state_impact(state_impact)

    @property
    def code(self) -> str:
        return self._code

    @property
    def message(self) -> str:
        return self._message

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

    default_code: ClassVar[str] = "BAD_REQUEST"


class ApplicationValidationError(ApplicationError):
    """業務値や形式の検証失敗を表す例外。"""

    default_code: ClassVar[str] = "VALIDATION_ERROR"


class ApplicationAuthorizationError(ApplicationError):
    """資格・ロール・テナント境界など業務上の認可違反を表す例外。"""

    default_code: ClassVar[str] = "FORBIDDEN"


class ApplicationNotFoundError(ApplicationError):
    """対象リソースが存在しないことを表す例外。"""

    default_code: ClassVar[str] = "NOT_FOUND"


class ApplicationConflictError(ApplicationError):
    """競合や一意性制約違反を表す例外。"""

    default_code: ClassVar[str] = "CONFLICT"
