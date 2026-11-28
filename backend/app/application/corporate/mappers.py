"""法人コンテキストにおける Domain と Application 契約の変換ヘルパー。"""

from app.application.corporate.contracts import CorporationHistoryItem, CorporationItem
from app.application.foundation.error_mappers import from_domain_error
from app.application.foundation.errors import (
    ApplicationBadRequestError,
    ApplicationError,
    ApplicationValidationError,
)
from app.domain.corporate.entities import Corporation
from app.domain.corporate.exceptions import (
    EmptyCorporationUpdateError,
    InvalidCorporationTransitionError,
    InvalidCorporationUpdateError,
)
from app.domain.corporate.history import CorporationHistoryRecord
from app.domain.corporate.value_objects import (
    CorporationCategory,
    CorporationStatus,
    CorporationUsageStatus,
)
from app.domain.foundation.exceptions import DomainError
from app.domain.foundation.value_objects import EffectiveDateRange


def to_application_error(exc: DomainError) -> ApplicationError:
    """ドメイン例外をアプリケーション層の公開例外へ変換する。"""
    if isinstance(
        exc,
        (
            EmptyCorporationUpdateError,
            InvalidCorporationUpdateError,
            InvalidCorporationTransitionError,
        ),
    ):
        return ApplicationBadRequestError(
            exc.message,
            code=exc.code,
            details=exc.details,
        )
    return from_domain_error(exc)


def to_corporation_item(
    corporation: Corporation,
    *,
    period: EffectiveDateRange | None = None,
) -> CorporationItem:
    """法人集約を公開用読み取り結果へ変換する。"""
    return CorporationItem(
        id=corporation.id.value,
        category=corporation.category.value,
        name=corporation.name.value,
        corporate_number=(
            corporation.corporate_number.value if corporation.corporate_number is not None else None
        ),
        address=corporation.address.value,
        status=corporation.status.value,
        created_at=corporation.created_at.value,
        updated_at=corporation.updated_at.value,
        valid_from=period.valid_from if period is not None else None,
        valid_to=period.valid_to if period is not None else None,
        usage_status=corporation.usage_status.value,
        representative_name=(
            corporation.representative_name.value
            if corporation.representative_name is not None
            else ""
        ),
    )


def to_corporation_history_item(record: CorporationHistoryRecord) -> CorporationHistoryItem:
    """有効期間つきの法人記録を公開契約に変換する。"""
    return CorporationHistoryItem(
        corporation=to_corporation_item(record.corporation, period=record.period),
        valid_from=record.period.valid_from,
        valid_to=record.period.valid_to,
        recorded_at=record.recorded_at.value,
        kind=record.kind.value,
        evidence=record.evidence.value if record.evidence is not None else None,
        surviving_corporation_id=(
            record.surviving_corporation_id.value
            if record.surviving_corporation_id is not None
            else None
        ),
        recorded_by=record.recorded_by,
    )


def parse_category(raw: str) -> CorporationCategory:
    """法人区分文字列を検証付きで Value Object へ変換する。"""
    try:
        return CorporationCategory(raw)
    except ValueError as exc:
        raise ApplicationValidationError(
            "不正な法人区分です。",
            code="VALIDATION_ERROR",
            details={"field": "category"},
        ) from exc


def parse_status(raw: str) -> CorporationStatus:
    """存続状態文字列を検証付きで Value Object へ変換する。"""
    try:
        return CorporationStatus(raw)
    except ValueError as exc:
        raise ApplicationValidationError(
            "不正な存続状態です。",
            code="VALIDATION_ERROR",
            details={"field": "status"},
        ) from exc


def parse_usage_status(raw: str) -> CorporationUsageStatus:
    """システム利用状態文字列を検証付きで Value Object へ変換する。"""
    try:
        return CorporationUsageStatus(raw)
    except ValueError as exc:
        raise ApplicationValidationError(
            "不正なシステム利用状態です。",
            code="VALIDATION_ERROR",
            details={"field": "usage_status"},
        ) from exc
