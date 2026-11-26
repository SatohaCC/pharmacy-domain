"""ドメインモデルと公開契約 DTO の変換マッパー。"""

from app.application.vendor_auth.contracts import (
    VendorAuthPrincipal,
    VendorUserView,
)
from app.domain.vendor_auth.entities import VendorUser


def to_vendor_user_view(user: VendorUser) -> VendorUserView:
    """VendorUser エンティティを公開用 VendorUserView へ変換する。"""
    return VendorUserView(
        id=user.id.value,
        email=user.email.value,
        display_name=user.display_name.value,
        role=user.role.value,  # type: ignore[arg-type]
        status=user.status.value,  # type: ignore[arg-type]
        created_at=user.created_at.value,
        updated_at=user.updated_at.value,
    )


def to_vendor_auth_principal(user: VendorUser) -> VendorAuthPrincipal:
    """VendorUser エンティティを認証主体 VendorAuthPrincipal へ変換する。"""
    return VendorAuthPrincipal(
        user_id=user.id.value,
        email=user.email.value,
        display_name=user.display_name.value,
        role=user.role.value,  # type: ignore[arg-type]
    )
