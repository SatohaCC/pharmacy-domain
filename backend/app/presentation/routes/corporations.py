"""法人 API 用ルーター。入力変換と Command / Query 委譲のみを担う。"""

from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, status
from pydantic import AwareDatetime

from app.application.corporate.contracts import (
    CorporationCommandPort,
    CorporationQueryPort,
)
from app.application.foundation.errors import ApplicationValidationError
from app.presentation.dependencies import (
    get_corporation_commands,
    get_corporation_queries,
    require_vendor_user,
    verify_csrf_origin,
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
from app.presentation.dto.error import ErrorResponse
from app.presentation.mappers.corporations import (
    to_change_status_input,
    to_corporation_history_response,
    to_corporation_list_response,
    to_corporation_response,
    to_correction_input,
    to_list_corporations_query,
    to_merger_input,
    to_register_corporation_input,
    to_update_corporation_input,
)

router = APIRouter(
    prefix="/api/corporations",
    tags=["corporations"],
    dependencies=[Depends(require_vendor_user), Depends(verify_csrf_origin)],
    responses={
        401: {"model": ErrorResponse},
        403: {"model": ErrorResponse},
    },
)


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
    responses={404: {"model": ErrorResponse}, 422: {"model": ErrorResponse}},
)
def get_corporation(
    corporation_id: str,
    queries: Annotated[CorporationQueryPort, Depends(get_corporation_queries)],
    as_of: date | None = None,
    recorded_as_of: AwareDatetime | None = None,
) -> CorporationResponse:
    """指定 ID の法人の現在状態、または指定日に把握していた状態を取得する。"""
    if as_of is not None:
        record = queries.get_corporation_at(corporation_id, as_of, recorded_as_of)
        return to_corporation_response(record.corporation)
    if recorded_as_of is not None:
        raise ApplicationValidationError("記録日時の指定には as_of も必要です。")
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


@router.get(
    "/{corporation_id}/history",
    responses={404: {"model": ErrorResponse}, 422: {"model": ErrorResponse}},
)
def list_corporation_history(
    corporation_id: str,
    queries: Annotated[CorporationQueryPort, Depends(get_corporation_queries)],
) -> list[CorporationHistoryResponse]:
    """法人の登録・変更・訂正・存続状態の記録を追記順に取得する。"""
    return [to_corporation_history_response(item) for item in queries.list_history(corporation_id)]


@router.patch(
    "/{corporation_id}/history",
    responses={
        400: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
        409: {"model": ErrorResponse},
        422: {"model": ErrorResponse},
    },
)
def correct_corporation_history(
    corporation_id: str,
    payload: CorporationHistoryCorrectionRequest,
    commands: Annotated[CorporationCommandPort, Depends(get_corporation_commands)],
) -> CorporationHistoryResponse:
    """指定日を含む確認済みの期間について、過去の名称・所在地・法人番号を訂正する。"""
    record = commands.correct_history(corporation_id, payload.as_of, to_correction_input(payload))
    return to_corporation_history_response(record)


@router.post(
    "/{corporation_id}/merge",
    responses={
        400: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
        409: {"model": ErrorResponse},
        422: {"model": ErrorResponse},
    },
)
def merge_corporation(
    corporation_id: str,
    payload: CorporationMergerRequest,
    commands: Annotated[CorporationCommandPort, Depends(get_corporation_commands)],
) -> CorporationResponse:
    """存続法人・効力日・根拠を記録して吸収合併を確定する。"""
    return to_corporation_response(commands.change_status(corporation_id, to_merger_input(payload)))
