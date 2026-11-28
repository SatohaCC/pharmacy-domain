"""法人 API 用の公開 DTO。"""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


class CorporationCreateRequest(BaseModel):
    """法人登録リクエスト DTO。"""

    category: Literal["corporation", "individual"]
    name: str
    representative_name: str
    corporate_number: str | None = None
    address: str = ""
    valid_from: date | None = None
    valid_to: date | None = None
    evidence: str | None = None
    usage_status: Literal["not_started", "active", "suspended"] = "not_started"


class CorporationUpdateRequest(BaseModel):
    """法人基本情報部分更新リクエスト DTO。"""

    name: str | None = None
    representative_name: str | None = None
    address: str | None = None
    corporate_number: str | None = None
    valid_from: date | None = None
    valid_to: date | None = None
    evidence: str | None = None


class CorporationStatusChangeRequest(BaseModel):
    """法人存続状態変更リクエスト DTO。"""

    status: Literal["active", "dissolved", "merged_out"]
    effective_date: date | None = None
    evidence: str | None = None


class CorporationUsageStatusChangeRequest(BaseModel):
    """法人システム利用状態変更リクエスト DTO。"""

    usage_status: Literal["not_started", "active", "suspended"]


class CorporationHistoryCorrectionRequest(BaseModel):
    """指定日を含む既知の有効期間について、変更前の記録を保持して訂正する。"""

    model_config = ConfigDict(extra="forbid")

    as_of: date
    evidence: str
    name: str | None = None
    representative_name: str | None = None
    address: str | None = None
    corporate_number: str | None = None
    valid_from: date | None = None
    valid_to: date | None = None


class CorporationMergerRequest(BaseModel):
    """吸収合併の存続法人、効力日、根拠を記録する。"""

    model_config = ConfigDict(extra="forbid")

    surviving_corporation_id: str
    effective_date: date
    evidence: str


class CorporationResponse(BaseModel):
    """法人レスポンス DTO。"""

    id: str
    category: Literal["corporation", "individual"]
    name: str
    corporate_number: str | None
    address: str
    status: Literal["active", "dissolved", "merged_out"]
    created_at: datetime
    updated_at: datetime
    valid_from: date | None = None
    valid_to: date | None = None
    usage_status: Literal["not_started", "active", "suspended"] = "not_started"
    representative_name: str


class CorporationListResponse(BaseModel):
    """法人一覧レスポンス DTO。"""

    items: list[CorporationResponse]
    total: int


class CorporationHistoryResponse(BaseModel):
    """法人の有効期間・記録日時と当時のスナップショット。"""

    corporation: CorporationResponse
    valid_from: date
    valid_to: date | None
    recorded_at: datetime
    kind: Literal["legacy", "registration", "profile", "correction", "dissolution", "merger"]
    evidence: str | None
    surviving_corporation_id: str | None
    recorded_by: str | None = None
