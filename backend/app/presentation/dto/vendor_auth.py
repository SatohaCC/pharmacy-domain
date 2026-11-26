"""システムベンダー認証・ユーザー管理 API の Pydantic DTO 定義。"""

from typing import Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field


class VendorLoginRequest(BaseModel):
    """ログインリクエスト DTO。"""

    model_config = ConfigDict(extra="forbid")

    email: str = Field(min_length=1, max_length=254)
    password: str = Field(min_length=1, max_length=128)


class CreateVendorUserRequest(BaseModel):
    """ベンダー社員アカウント発行リクエスト DTO。"""

    model_config = ConfigDict(extra="forbid")

    email: str = Field(min_length=3, max_length=254)
    display_name: str = Field(min_length=1, max_length=100)
    role: Literal["admin", "member"] = "member"
    password: str = Field(min_length=13, max_length=128)


class VendorUserResponse(BaseModel):
    """ベンダーユーザーレスポンス DTO。"""

    id: str
    email: str
    display_name: str
    role: Literal["admin", "member"]
    status: Literal["active", "disabled"]
    created_at: AwareDatetime
    updated_at: AwareDatetime


class VendorAuthSessionResponse(BaseModel):
    """ログイン・トークン更新成功時のレスポンス DTO。"""

    user: VendorUserResponse
    access_token_expires_in_seconds: int
    refresh_token_expires_in_seconds: int


class VendorUserListResponse(BaseModel):
    """ベンダーユーザー一覧レスポンス DTO。"""

    items: list[VendorUserResponse]
    total: int
