"""法人間関係の HTTP DTO と公開ユースケース契約を変換する。"""

from app.application.corporate.contracts import (
    CorporateRelationItem,
    CorporateRelationRevisionItem,
    CorrectCorporateRelationInput,
    RegisterCorporateRelationInput,
)
from app.presentation.dto.corporate_relations import (
    CorporateRelationCorrectionRequest,
    CorporateRelationCreateRequest,
    CorporateRelationResponse,
    CorporateRelationRevisionResponse,
)


def to_register_relation_input(
    data: CorporateRelationCreateRequest,
    *,
    recorded_by: str | None = None,
) -> RegisterCorporateRelationInput:
    """登録リクエストを公開コマンドに変換する。"""
    return RegisterCorporateRelationInput(
        source_corporation_id=data.source_corporation_id,
        target_corporation_id=data.target_corporation_id,
        relation_type=data.relation_type,
        valid_from=data.valid_from,
        valid_to=data.valid_to,
        evidence=data.evidence,
        recorded_by=recorded_by,
    )


def to_correct_relation_input(
    data: CorporateRelationCorrectionRequest,
    *,
    recorded_by: str | None = None,
) -> CorrectCorporateRelationInput:
    """指定の有無を保持したまま訂正コマンドに変換する。"""
    return CorrectCorporateRelationInput(
        valid_from=data.valid_from,
        valid_to=data.valid_to,
        evidence=data.evidence,
        provided_fields=frozenset(data.model_fields_set),
        recorded_by=recorded_by,
    )


def to_relation_response(data: CorporateRelationItem) -> CorporateRelationResponse:
    """公開用の関係をレスポンス DTO に変換する。"""
    return CorporateRelationResponse.model_validate(data, from_attributes=True)


def to_revision_response(data: CorporateRelationRevisionItem) -> CorporateRelationRevisionResponse:
    """公開用の改訂をレスポンス DTO に変換する。"""
    return CorporateRelationRevisionResponse.model_validate(data, from_attributes=True)
