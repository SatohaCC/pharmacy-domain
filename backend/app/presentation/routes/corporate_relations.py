"""法人間関係の登録・変更・参照 API。"""

from datetime import date
from typing import Annotated, Any

from fastapi import APIRouter, Depends, status
from pydantic import AwareDatetime

from app.application.corporate.contracts import (
    CorporateRelationCommandPort,
    CorporateRelationQueryPort,
    ListCorporateRelationsQuery,
)
from app.presentation.dependencies import (
    get_corporate_relation_commands,
    get_corporate_relation_queries,
)
from app.presentation.dto.corporate_relations import (
    CorporateRelationCorrectionRequest,
    CorporateRelationCreateRequest,
    CorporateRelationEndRequest,
    CorporateRelationListResponse,
    CorporateRelationResponse,
    CorporateRelationRevisionResponse,
)
from app.presentation.dto.error import ErrorResponse
from app.presentation.mappers.corporate_relations import (
    to_correct_relation_input,
    to_register_relation_input,
    to_relation_response,
    to_revision_response,
)

router = APIRouter(prefix="/api/corporate-relations", tags=["corporate-relations"])
_WRITE_ERRORS: dict[int | str, dict[str, Any]] = {
    404: {"model": ErrorResponse},
    409: {"model": ErrorResponse},
    422: {"model": ErrorResponse},
}
_READ_ERRORS: dict[int | str, dict[str, Any]] = {
    404: {"model": ErrorResponse},
    422: {"model": ErrorResponse},
}


@router.post("", status_code=status.HTTP_201_CREATED, responses=_WRITE_ERRORS)
def register_relation(
    body: CorporateRelationCreateRequest,
    commands: Annotated[CorporateRelationCommandPort, Depends(get_corporate_relation_commands)],
) -> CorporateRelationResponse:
    """両端の法人を指定して関係を登録する。"""
    return to_relation_response(commands.register_relation(to_register_relation_input(body)))


@router.get("", responses={422: {"model": ErrorResponse}})
def list_relations(
    queries: Annotated[CorporateRelationQueryPort, Depends(get_corporate_relation_queries)],
    corporation_id: str | None = None,
    as_of: date | None = None,
    recorded_as_of: AwareDatetime | None = None,
) -> CorporateRelationListResponse:
    """法人、有効日、記録時点で法人間関係を絞り込む。"""
    records = queries.list_relations(
        ListCorporateRelationsQuery(corporation_id, as_of, recorded_as_of)
    )
    return CorporateRelationListResponse(
        items=[to_relation_response(record) for record in records], total=len(records)
    )


@router.get("/{relation_id}", responses=_READ_ERRORS)
def get_relation(
    relation_id: str,
    queries: Annotated[CorporateRelationQueryPort, Depends(get_corporate_relation_queries)],
    recorded_as_of: AwareDatetime | None = None,
) -> CorporateRelationResponse:
    """関係の詳細を指定の記録時点で取得する。"""
    return to_relation_response(queries.get_relation(relation_id, recorded_as_of))


@router.patch("/{relation_id}", responses=_WRITE_ERRORS)
def correct_relation(
    relation_id: str,
    body: CorporateRelationCorrectionRequest,
    commands: Annotated[CorporateRelationCommandPort, Depends(get_corporate_relation_commands)],
) -> CorporateRelationResponse:
    """関係の期間・根拠・確認状態を訂正する。"""
    return to_relation_response(
        commands.correct_relation(relation_id, to_correct_relation_input(body))
    )


@router.post("/{relation_id}/end", responses=_WRITE_ERRORS)
def end_relation(
    relation_id: str,
    body: CorporateRelationEndRequest,
    commands: Annotated[CorporateRelationCommandPort, Depends(get_corporate_relation_commands)],
) -> CorporateRelationResponse:
    """指定日で法人間関係の有効期間を終了する。"""
    return to_relation_response(commands.end_relation(relation_id, body.valid_to))


@router.get("/{relation_id}/history", responses=_READ_ERRORS)
def relation_history(
    relation_id: str,
    queries: Annotated[CorporateRelationQueryPort, Depends(get_corporate_relation_queries)],
) -> list[CorporateRelationRevisionResponse]:
    """法人間関係の改訂履歴を記録順に取得する。"""
    return [to_revision_response(record) for record in queries.list_revisions(relation_id)]
