"""ヘルスチェック用の公開 DTO。"""

from typing import Literal

from pydantic import BaseModel


class HealthResponse(BaseModel):
    """ヘルスチェックレスポンス。"""

    status: Literal["ok"]
    service: str
