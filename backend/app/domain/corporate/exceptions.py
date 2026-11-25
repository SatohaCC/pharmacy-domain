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


class CorporateRelationNotFoundError(DomainNotFoundError):
    """指定された法人間関係が存在しないことを表す例外。"""

    default_code: ClassVar[str] = "CORPORATE_RELATION_NOT_FOUND"

    def __init__(self) -> None:
        super().__init__("指定された法人間関係が見つかりません。")


class SelfCorporateRelationError(DomainValidationError):
    """同じ法人を関係の両端に指定したことを表す例外。"""

    default_code: ClassVar[str] = "SELF_CORPORATE_RELATION"

    def __init__(self) -> None:
        super().__init__("同じ法人同士の関係は登録できません。")


class DuplicateCorporateRelationError(DomainConflictError):
    """同一ペア・同種別の関係で適用期間が重複したことを表す例外。"""

    default_code: ClassVar[str] = "DUPLICATE_CORPORATE_RELATION"

    def __init__(self) -> None:
        super().__init__("同じ法人間に適用期間が重複する同種の関係があります。")


class MultipleCorporateParentsError(DomainConflictError):
    """子法人に同一時点で複数の親が成立することを表す例外。"""

    default_code: ClassVar[str] = "MULTIPLE_CORPORATE_PARENTS"

    def __init__(self) -> None:
        super().__init__("同じ子法人に適用期間が重複する別の親法人があります。")


class CorporateRelationCycleError(DomainConflictError):
    """同一時点に親子関係が循環することを表す例外。"""

    default_code: ClassVar[str] = "CORPORATE_RELATION_CYCLE"

    def __init__(self) -> None:
        super().__init__("指定された期間に親子関係が循環します。")
