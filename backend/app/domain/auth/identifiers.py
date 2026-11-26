"""共通認証コンテキストの識別子定義。"""

from dataclasses import dataclass

from app.domain.foundation.identifiers import EntityId


@dataclass(frozen=True, slots=True)
class UserId(EntityId):
    """認証ユーザーを一意に識別する ID。"""


@dataclass(frozen=True, slots=True)
class RoleAssignmentId(EntityId):
    """ロール付与を一意に識別する ID。"""


@dataclass(frozen=True, slots=True)
class RefreshSessionId(EntityId):
    """リフレッシュトークンセッション（JWT jti）を一意に識別する ID。"""


@dataclass(frozen=True, slots=True)
class RefreshTokenFamilyId(EntityId):
    """ローテーション系列（ファミリー）を一意に識別する ID。"""


@dataclass(frozen=True, slots=True)
class TenantId(EntityId):
    """薬局テナント（法人 ID）を表す識別子。"""
