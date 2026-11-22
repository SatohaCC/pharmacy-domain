from typing import Literal

from pydantic import BaseModel


class HealthResponse(BaseModel):
    """ヘルスチェックのレスポンススキーマ。"""

    status: Literal["ok"]
    service: str
