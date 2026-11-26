"""共通認証コンテキストの値オブジェクト定義。"""

from dataclasses import dataclass
from enum import StrEnum

from app.domain.auth.exceptions import ScopeViolationError
from app.domain.auth.identifiers import TenantId


class AffiliationType(StrEnum):
    """認証主体およびロール付与先の所属スコープ種別。"""

    VENDOR = "vendor"
    TENANT = "tenant"


class UserStatus(StrEnum):
    """認証ユーザーのアカウント状態。"""

    ACTIVE = "active"
    DISABLED = "disabled"


class TokenType(StrEnum):
    """JWT トークンの種別。"""

    ACCESS = "access"
    REFRESH = "refresh"


class RoleName(StrEnum):
    """スコープ付きロール名。"""

    VENDOR_ADMIN = "vendor_admin"
    VENDOR_MEMBER = "vendor_member"
    TENANT_ADMIN = "tenant_admin"
    PHARMACIST = "pharmacist"
    CLERK = "clerk"

    def allowed_scope_type(self) -> AffiliationType:
        """このロールを付与可能なスコープ種別を返す。"""
        if self in (RoleName.VENDOR_ADMIN, RoleName.VENDOR_MEMBER):
            return AffiliationType.VENDOR
        return AffiliationType.TENANT


@dataclass(frozen=True, slots=True)
class AuthScope:
    """認可対象となるスコープ（ベンダー全体または特定薬局テナント）。"""

    scope_type: AffiliationType
    tenant_id: TenantId | None = None

    def __post_init__(self) -> None:
        if self.scope_type == AffiliationType.VENDOR and self.tenant_id is not None:
            raise ScopeViolationError(
                "ベンダースコープでは tenant_id を指定できません。",
                code="INVALID_ROLE_SCOPE",
            )
        if self.scope_type == AffiliationType.TENANT and self.tenant_id is None:
            raise ScopeViolationError(
                "テナントスコープでは tenant_id の指定が必須です。",
                code="INVALID_ROLE_SCOPE",
            )

    @classmethod
    def vendor(cls) -> AuthScope:
        """ベンダー全体スコープを生成する。"""
        return cls(scope_type=AffiliationType.VENDOR, tenant_id=None)

    @classmethod
    def tenant(cls, tenant_id: TenantId) -> AuthScope:
        """特定法人テナントのスコープを生成する。"""
        return cls(scope_type=AffiliationType.TENANT, tenant_id=tenant_id)
