"""法人 DTO とアプリケーション契約の明示的な相互変換。"""

from typing import Literal, cast

from app.application.corporate.contracts import (
    ChangeCorporationStatusInput,
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
)


def to_register_corporation_input(dto: CorporationCreateRequest) -> RegisterCorporationInput:
    """法人登録リクエスト DTO をアプリケーション入力へ変換する。"""
    return RegisterCorporationInput(
        category=dto.category,
        name=dto.name,
        corporate_number=dto.corporate_number,
        address=dto.address,
        valid_from=dto.valid_from,
        evidence=dto.evidence,
    )


def to_update_corporation_input(dto: CorporationUpdateRequest) -> UpdateCorporationInput:
    """法人部分更新リクエスト DTO をアプリケーション入力へ変換する。"""
    return UpdateCorporationInput(
        name=dto.name,
        address=dto.address,
        corporate_number=dto.corporate_number,
        provided_fields=frozenset(dto.model_fields_set),
        valid_from=dto.valid_from,
        evidence=dto.evidence,
    )


def to_change_status_input(dto: CorporationStatusChangeRequest) -> ChangeCorporationStatusInput:
    """存続状態変更リクエスト DTO をアプリケーション入力へ変換する。"""
    return ChangeCorporationStatusInput(
        status=dto.status,
        effective_date=dto.effective_date,
        evidence=dto.evidence,
    )


def to_merger_input(dto: CorporationMergerRequest) -> ChangeCorporationStatusInput:
    """吸収合併の必要事項を存続状態変更入力に変換する。"""
    return ChangeCorporationStatusInput(
        status="merged_out",
        effective_date=dto.effective_date,
        evidence=dto.evidence,
        surviving_corporation_id=dto.surviving_corporation_id,
    )


def to_correction_input(dto: CorporationHistoryCorrectionRequest) -> UpdateCorporationInput:
    """法人履歴訂正に指定された項目を保持して変換する。"""
    return UpdateCorporationInput(
        name=dto.name,
        address=dto.address,
        corporate_number=dto.corporate_number,
        evidence=dto.evidence,
        provided_fields=frozenset(dto.model_fields_set),
    )


def to_list_corporations_query(
    *,
    category: Literal["corporation", "individual"] | None,
    status: Literal["active", "dissolved", "merged_out"] | None,
    q: str | None,
) -> ListCorporationsQuery:
    """クエリパラメータをアプリケーション検索条件へ変換する。"""
    return ListCorporationsQuery(category=category, status=status, query=q)


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
