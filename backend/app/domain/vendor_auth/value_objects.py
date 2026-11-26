"""システムベンダー認証コンテキストの値オブジェクト（Enum）。"""

from enum import StrEnum


class VendorRole(StrEnum):
    """システムベンダーユーザーのロール。"""

    ADMIN = "admin"
    MEMBER = "member"


class VendorUserStatus(StrEnum):
    """システムベンダーユーザーのアカウント状態。"""

    ACTIVE = "active"
    DISABLED = "disabled"


class VendorTokenType(StrEnum):
    """JWT トークンの種別。"""

    ACCESS = "access"
    REFRESH = "refresh"
