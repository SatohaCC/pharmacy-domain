"""法人コンテキストのドメイン例外。"""

from typing import ClassVar

from app.domain.foundation.exceptions import (
    DomainConflictError,
    DomainNotFoundError,
    DomainValidationError,
    ErrorDetails,
)


class CorporationNotFoundError(DomainNotFoundError):
    """指定された法人が存在しないことを表す例外。"""

    default_code: ClassVar[str] = "CORPORATION_NOT_FOUND"

    def __init__(self) -> None:
        super().__init__(
            "指定された法人が見つかりません。",
            code=self.default_code,
            details={"resource": "corporation"},
        )


class DuplicateCorporateNumberError(DomainConflictError):
    """13 桁の法人番号が既に登録されていることを表す例外。"""

    default_code: ClassVar[str] = "DUPLICATE_CORPORATE_NUMBER"

    def __init__(self) -> None:
        super().__init__(
            "同じ法人番号の法人が既に存在します。",
            code=self.default_code,
            details={"field": "corporate_number"},
        )


class EmptyCorporationUpdateError(DomainValidationError):
    """更新対象フィールドが 1 つも指定されていないことを表す例外。"""

    default_code: ClassVar[str] = "EMPTY_UPDATE"

    def __init__(self) -> None:
        super().__init__(
            "更新する項目を 1 つ以上指定してください。",
            code=self.default_code,
        )


class InvalidCorporationUpdateError(DomainValidationError):
    """更新内容が不正であることを表す例外。"""

    default_code: ClassVar[str] = "INVALID_UPDATE"

    def __init__(
        self,
        message: str = "更新内容が不正です。",
        *,
        details: ErrorDetails | None = None,
    ) -> None:
        super().__init__(message, code=self.default_code, details=details)


class InvalidCorporationTransitionError(DomainValidationError):
    """許可されない存続状態遷移を表す例外。"""

    default_code: ClassVar[str] = "INVALID_CORPORATION_TRANSITION"

    def __init__(
        self,
        message: str,
        *,
        details: ErrorDetails | None = None,
    ) -> None:
        super().__init__(message, code=self.default_code, details=details)
