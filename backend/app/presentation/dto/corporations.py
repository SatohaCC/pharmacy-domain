"""法人 API 用の公開 DTO。"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class CorporationCreateRequest(BaseModel):
    """法人登録リクエスト DTO。"""

    category: Literal["corporation", "individual"]
    name: str
    corporate_number: str | None = None
    address: str = ""


class CorporationUpdateRequest(BaseModel):
    """法人基本情報部分更新リクエスト DTO。"""

    name: str | None = None
    address: str | None = None
    corporate_number: str | None = None


class CorporationStatusChangeRequest(BaseModel):
    """法人存続状態変更リクエスト DTO。"""

    status: Literal["active", "dissolved", "merged_out"]


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


class CorporationListResponse(BaseModel):
    """法人一覧レスポンス DTO。"""

    items: list[CorporationResponse]
    total: int
