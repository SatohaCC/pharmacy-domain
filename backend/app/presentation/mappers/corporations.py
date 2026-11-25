"""法人 DTO とアプリケーション契約の明示的な相互変換。"""

from typing import Literal, cast

from app.application.corporate.contracts import (
    ChangeCorporationStatusInput,
    CorporationItem,
    CorporationListResult,
    ListCorporationsQuery,
    RegisterCorporationInput,
    UpdateCorporationInput,
)
from app.presentation.dto.corporations import (
    CorporationCreateRequest,
    CorporationListResponse,
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
    )


def to_update_corporation_input(dto: CorporationUpdateRequest) -> UpdateCorporationInput:
    """法人部分更新リクエスト DTO をアプリケーション入力へ変換する。"""
    return UpdateCorporationInput(
        name=dto.name,
        address=dto.address,
        corporate_number=dto.corporate_number,
        provided_fields=frozenset(dto.model_fields_set),
    )


def to_change_status_input(dto: CorporationStatusChangeRequest) -> ChangeCorporationStatusInput:
    """存続状態変更リクエスト DTO をアプリケーション入力へ変換する。"""
    return ChangeCorporationStatusInput(status=dto.status)


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
