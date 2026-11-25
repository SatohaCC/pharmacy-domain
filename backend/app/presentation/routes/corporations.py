"""法人 API 用ルーター。入力変換と Command / Query 委譲のみを担う。"""

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, status

from app.application.corporate.contracts import (
    CorporationCommandPort,
    CorporationQueryPort,
)
from app.presentation.dependencies import (
    get_corporation_commands,
    get_corporation_queries,
)
from app.presentation.dto.corporations import (
    CorporationCreateRequest,
    CorporationListResponse,
    CorporationResponse,
    CorporationStatusChangeRequest,
    CorporationUpdateRequest,
)
from app.presentation.dto.error import ErrorResponse
from app.presentation.mappers.corporations import (
    to_change_status_input,
    to_corporation_list_response,
    to_corporation_response,
    to_list_corporations_query,
    to_register_corporation_input,
    to_update_corporation_input,
)

router = APIRouter(prefix="/api/corporations", tags=["corporations"])


@router.get("", response_model=CorporationListResponse)
def list_corporations(
    queries: Annotated[CorporationQueryPort, Depends(get_corporation_queries)],
    category: Literal["corporation", "individual"] | None = None,
    corporation_status: Annotated[
        Literal["active", "dissolved", "merged_out"] | None,
        Query(alias="status"),
    ] = None,
    q: str | None = None,
) -> CorporationListResponse:
    """条件に一致する法人一覧を返す。"""
    result = queries.list_corporations(
        to_list_corporations_query(category=category, status=corporation_status, q=q)
    )
    return to_corporation_list_response(result)


@router.post(
    "",
    response_model=CorporationResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        409: {"model": ErrorResponse},
        422: {"model": ErrorResponse},
    },
)
def register_corporation(
    payload: CorporationCreateRequest,
    commands: Annotated[CorporationCommandPort, Depends(get_corporation_commands)],
) -> CorporationResponse:
    """新しい法人（または個人開設者）を登録する。"""
    created = commands.register_corporation(to_register_corporation_input(payload))
    return to_corporation_response(created)


@router.get(
    "/{corporation_id}",
    response_model=CorporationResponse,
    responses={404: {"model": ErrorResponse}},
)
def get_corporation(
    corporation_id: str,
    queries: Annotated[CorporationQueryPort, Depends(get_corporation_queries)],
) -> CorporationResponse:
    """指定 ID の法人を取得する。"""
    item = queries.get_corporation(corporation_id)
    return to_corporation_response(item)


@router.patch(
    "/{corporation_id}",
    response_model=CorporationResponse,
    responses={
        400: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
        409: {"model": ErrorResponse},
        422: {"model": ErrorResponse},
    },
)
def update_corporation(
    corporation_id: str,
    payload: CorporationUpdateRequest,
    commands: Annotated[CorporationCommandPort, Depends(get_corporation_commands)],
) -> CorporationResponse:
    """指定 ID の法人基本情報を部分更新する。"""
    updated = commands.update_corporation(corporation_id, to_update_corporation_input(payload))
    return to_corporation_response(updated)


@router.patch(
    "/{corporation_id}/status",
    response_model=CorporationResponse,
    responses={
        400: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
        409: {"model": ErrorResponse},
        422: {"model": ErrorResponse},
    },
)
def change_corporation_status(
    corporation_id: str,
    payload: CorporationStatusChangeRequest,
    commands: Annotated[CorporationCommandPort, Depends(get_corporation_commands)],
) -> CorporationResponse:
    """指定 ID の法人の存続状態を変更する。"""
    updated = commands.change_status(corporation_id, to_change_status_input(payload))
    return to_corporation_response(updated)
