"""法人間関係 API のリクエストとレスポンス。"""

from datetime import date
from typing import Annotated, Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field
from pydantic.json_schema import SkipJsonSchema

RelationKind = Literal["parent_child", "affiliate", "fc_vc"]
ConfirmationStatus = Literal["unverified", "verified"]
_Omitted = Annotated[None, SkipJsonSchema()]


class CorporateRelationCreateRequest(BaseModel):
    """法人間関係の登録。親子の関係元に親法人を指定する。"""

    model_config = ConfigDict(extra="forbid")

    source_corporation_id: str
    target_corporation_id: str
    relation_type: RelationKind
    valid_from: date
    valid_to: date | None = None
    evidence: str
    confirmation_status: ConfirmationStatus = "unverified"


class CorporateRelationCorrectionRequest(BaseModel):
    """部分訂正。終了日に null を指定すると終了未定となる。"""

    model_config = ConfigDict(extra="forbid", json_schema_extra={"minProperties": 1})

    valid_from: date | _Omitted = Field(default_factory=lambda: None)
    valid_to: date | None = None
    evidence: str | _Omitted = Field(default_factory=lambda: None)
    confirmation_status: ConfirmationStatus | _Omitted = Field(default_factory=lambda: None)


class CorporateRelationEndRequest(BaseModel):
    """効力終了日を指定して法人間関係を終了する。"""

    model_config = ConfigDict(extra="forbid")

    valid_to: date


class CorporateRelationRevisionResponse(BaseModel):
    """法人間関係の改訂一件。"""

    valid_from: date
    valid_to: date | None
    evidence: str
    confirmation_status: ConfirmationStatus
    recorded_at: AwareDatetime


class CorporateRelationResponse(CorporateRelationRevisionResponse):
    """法人間関係の詳細。"""

    id: str
    source_corporation_id: str
    target_corporation_id: str
    relation_type: RelationKind


class CorporateRelationListResponse(BaseModel):
    """指定条件に一致する法人間関係の一覧。"""

    items: list[CorporateRelationResponse]
    total: int
