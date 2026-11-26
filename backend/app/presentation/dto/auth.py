"""共通認証 API の Pydantic DTO 定義。"""

from typing import Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field


class AuthLoginRequest(BaseModel):
    """共通ログインリクエスト DTO。"""

    model_config = ConfigDict(extra="forbid")

    email: str = Field(min_length=1, max_length=254)
    password: str = Field(min_length=1, max_length=128)
    scope_type: Literal["vendor", "tenant"] = "vendor"
    tenant_id: str | None = None


def _default_vendor_roles() -> list[Literal["vendor_admin", "vendor_member"]]:
    return ["vendor_member"]


class CreateVendorUserV2Request(BaseModel):
    """ベンダー社員アカウント発行リクエスト DTO（ロール配列対応）。"""

    model_config = ConfigDict(extra="forbid")

    email: str = Field(min_length=3, max_length=254)
    display_name: str = Field(min_length=1, max_length=100)
    roles: list[Literal["vendor_admin", "vendor_member"]] = Field(
        default_factory=_default_vendor_roles,
        min_length=1,
    )
    password: str = Field(min_length=13, max_length=128)


class AuthUserResponse(BaseModel):
    """共通認証ユーザーレスポンス DTO。"""

    id: str
    email: str
    display_name: str
    affiliation_type: Literal["vendor", "tenant"]
    tenant_id: str | None
    roles: list[Literal["vendor_admin", "vendor_member", "tenant_admin", "pharmacist", "clerk"]]
    status: Literal["active", "disabled"]
    created_at: AwareDatetime
    updated_at: AwareDatetime


class AuthSessionResponse(BaseModel):
    """ログイン・トークン更新成功時のレスポンス DTO。"""

    user: AuthUserResponse
    access_token_expires_in_seconds: int
    refresh_token_expires_in_seconds: int


class AuthUserListResponse(BaseModel):
    """共通認証ユーザー一覧レスポンス DTO。"""

    items: list[AuthUserResponse]
    total: int
