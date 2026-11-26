"""システムベンダー認証コンテキストのリポジトリ抽象定義。"""

from typing import Protocol

from app.domain.foundation.primitives import AwareDatetime
from app.domain.vendor_auth.entities import RefreshSession, VendorUser
from app.domain.vendor_auth.identifiers import (
    RefreshSessionId,
    RefreshTokenFamilyId,
    VendorUserId,
)
from app.domain.vendor_auth.primitives import VendorEmail


class VendorUserRepository(Protocol):
    """VendorUser 集約の永続化抽象。"""

    def count_all(self) -> int:
        """登録済みベンダーユーザーの総数を返す。"""
        ...

    def get_by_id(self, user_id: VendorUserId) -> VendorUser | None:
        """ID でベンダーユーザーを取得する。"""
        ...

    def get_by_email(self, email: VendorEmail) -> VendorUser | None:
        """メールアドレスでベンダーユーザーを取得する。"""
        ...

    def add(self, user: VendorUser) -> None:
        """新しいベンダーユーザーを永続化する。"""
        ...

    def save(self, user: VendorUser) -> None:
        """既存ベンダーユーザーの変更を保存する。"""
        ...


class RefreshSessionRepository(Protocol):
    """RefreshSession の永続化抽象。"""

    def get_by_id(self, session_id: RefreshSessionId) -> RefreshSession | None:
        """セッション ID でリフレッシュセッションを取得する。"""
        ...

    def add(self, session: RefreshSession) -> None:
        """新しいリフレッシュセッションを追加する。"""
        ...

    def save(self, session: RefreshSession) -> None:
        """リフレッシュセッションの変更を保存する。"""
        ...

    def revoke_family(self, family_id: RefreshTokenFamilyId, now: AwareDatetime) -> None:
        """同一ファミリーの全セッションを即時失効させる。"""
        ...

    def revoke_all_for_user(self, vendor_user_id: VendorUserId, now: AwareDatetime) -> None:
        """指定ユーザーの全セッションを即時失効させる。"""
        ...
