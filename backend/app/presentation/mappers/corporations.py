"""法人 DTO とアプリケーション契約の明示的な相互変換。"""

from typing import Literal, cast

from app.application.corporate.contracts import (
    ChangeCorporationStatusInput,
    ChangeCorporationUsageStatusInput,
    CorporationHistoryItem,
    CorporationItem,
    CorporationListResult,
    ListCorporationsQuery,
    RegisterCorporationInput,
    UpdateCorporationInput,
)
from app.presentation.dto.corporations import (
    CorporationCreateRequest,
    CorporationHistoryCorrectionRequest,
    CorporationHistoryResponse,
    CorporationListResponse,
    CorporationMergerRequest,
    CorporationResponse,
    CorporationStatusChangeRequest,
    CorporationUpdateRequest,
    CorporationUsageStatusChangeRequest,
)


def to_register_corporation_input(
    dto: CorporationCreateRequest,
    *,
    recorded_by: str | None = None,
) -> RegisterCorporationInput:
    """法人登録リクエスト DTO をアプリケーション入力へ変換する。"""
    return RegisterCorporationInput(
        category=dto.category,
        name=dto.name,
        corporate_number=dto.corporate_number,
        address=dto.address,
        valid_from=dto.valid_from,
        valid_to=dto.valid_to,
        evidence=dto.evidence,
        recorded_by=recorded_by,
        usage_status=dto.usage_status,
    )


def to_update_corporation_input(
    dto: CorporationUpdateRequest,
    *,
    recorded_by: str | None = None,
) -> UpdateCorporationInput:
    """法人部分更新リクエスト DTO をアプリケーション入力へ変換する。"""
    return UpdateCorporationInput(
        name=dto.name,
        address=dto.address,
        corporate_number=dto.corporate_number,
        provided_fields=frozenset(dto.model_fields_set),
        valid_from=dto.valid_from,
        valid_to=dto.valid_to,
        evidence=dto.evidence,
        recorded_by=recorded_by,
    )


def to_change_status_input(
    dto: CorporationStatusChangeRequest,
    *,
    recorded_by: str | None = None,
) -> ChangeCorporationStatusInput:
    """存続状態変更リクエスト DTO をアプリケーション入力へ変換する。"""
    return ChangeCorporationStatusInput(
        status=dto.status,
        effective_date=dto.effective_date,
        evidence=dto.evidence,
        recorded_by=recorded_by,
    )


def to_merger_input(
    dto: CorporationMergerRequest,
    *,
    recorded_by: str | None = None,
) -> ChangeCorporationStatusInput:
    """吸収合併の必要事項を存続状態変更入力に変換する。"""
    return ChangeCorporationStatusInput(
        status="merged_out",
        effective_date=dto.effective_date,
        evidence=dto.evidence,
        surviving_corporation_id=dto.surviving_corporation_id,
        recorded_by=recorded_by,
    )


def to_correction_input(
    dto: CorporationHistoryCorrectionRequest,
    *,
    recorded_by: str | None = None,
) -> UpdateCorporationInput:
    """法人履歴訂正に指定された項目を保持して変換する。"""
    return UpdateCorporationInput(
        name=dto.name,
        address=dto.address,
        corporate_number=dto.corporate_number,
        valid_from=dto.valid_from,
        valid_to=dto.valid_to,
        evidence=dto.evidence,
        provided_fields=frozenset(dto.model_fields_set),
        recorded_by=recorded_by,
    )


def to_change_usage_status_input(
    dto: CorporationUsageStatusChangeRequest,
    *,
    recorded_by: str | None = None,
) -> ChangeCorporationUsageStatusInput:
    """システム利用状態変更リクエスト DTO をアプリケーション入力へ変換する。"""
    return ChangeCorporationUsageStatusInput(
        usage_status=dto.usage_status,
        recorded_by=recorded_by,
    )


def to_list_corporations_query(
    *,
    category: Literal["corporation", "individual"] | None,
    status: Literal["active", "dissolved", "merged_out"] | None,
    usage_status: Literal["not_started", "active", "suspended"] | None = None,
    q: str | None,
) -> ListCorporationsQuery:
    """クエリパラメータをアプリケーション検索条件へ変換する。"""
    return ListCorporationsQuery(
        category=category,
        status=status,
        usage_status=usage_status,
        query=q,
    )


def to_corporation_response(item: CorporationItem) -> CorporationResponse:
    """アプリケーション結果項目を公開レスポンス DTO へ変換する。"""
    return CorporationResponse(
        id=item.id,
        category=cast(Literal["corporation", "individual"], item.category),
        name=item.name,
        corporate_number=item.corporate_number,
        address=item.address,
        status=cast(Literal["active", "dissolved", "merged_out"], item.status),
        created_at=item.created_at,
        updated_at=item.updated_at,
        valid_from=item.valid_from,
        valid_to=item.valid_to,
        usage_status=cast(Literal["not_started", "active", "suspended"], item.usage_status),
    )


def to_corporation_list_response(result: CorporationListResult) -> CorporationListResponse:
    """アプリケーション一覧結果を公開一覧レスポンス DTO へ変換する。"""
    return CorporationListResponse(
        items=[to_corporation_response(item) for item in result.items],
        total=result.total,
    )


def to_corporation_history_response(result: CorporationHistoryItem) -> CorporationHistoryResponse:
    """法人履歴とそのスナップショットを HTTP レスポンスに変換する。"""
    return CorporationHistoryResponse.model_validate(result, from_attributes=True)
