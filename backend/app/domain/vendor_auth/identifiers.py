"""システムベンダー認証コンテキストの識別子定義。"""

from dataclasses import dataclass

from app.domain.foundation.identifiers import EntityId


@dataclass(frozen=True, slots=True)
class VendorUserId(EntityId):
    """システムベンダーユーザーを一意に識別する ID。"""


@dataclass(frozen=True, slots=True)
class RefreshSessionId(EntityId):
    """リフレッシュトークンセッション（JWT jti）を一意に識別する ID。"""


@dataclass(frozen=True, slots=True)
class RefreshTokenFamilyId(EntityId):
    """ローテーション系列（ファミリー）を一意に識別する ID。"""
