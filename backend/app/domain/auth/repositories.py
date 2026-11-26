"""共通認証コンテキストのリポジトリ抽象定義。"""

from collections.abc import Sequence
from typing import Protocol

from app.domain.auth.entities import RefreshSession, RoleAssignment, User
from app.domain.auth.identifiers import (
    RefreshSessionId,
    RefreshTokenFamilyId,
    UserId,
)
from app.domain.auth.primitives import UserEmail
from app.domain.auth.value_objects import AffiliationType, AuthScope
from app.domain.foundation.primitives import AwareDatetime


class AuthUserRepository(Protocol):
    """User 集約の永続化抽象。"""

    def count_by_affiliation(self, affiliation_type: AffiliationType) -> int:
        """指定所属種別の登録済みユーザー数を返す。"""
        ...

    def get_by_id(self, user_id: UserId) -> User | None:
        """ID でユーザーを取得する。"""
        ...

    def get_by_email_in_scope(self, email: UserEmail, scope: AuthScope) -> User | None:
        """指定スコープ内でメールアドレスが一致するユーザーを取得する。"""
        ...

    def add(self, user: User) -> None:
        """新しいユーザーを永続化する。"""
        ...

    def save(self, user: User) -> None:
        """既存ユーザーの変更を保存する。"""
        ...


class RoleAssignmentRepository(Protocol):
    """RoleAssignment の永続化抽象。"""

    def list_active_for_user(self, user_id: UserId, now: AwareDatetime) -> Sequence[RoleAssignment]:
        """指定時点で有効なロール付与一覧を返す。"""
        ...

    def list_active_for_users(
        self, user_ids: Sequence[UserId], now: AwareDatetime
    ) -> Sequence[RoleAssignment]:
        """複数ユーザーの指定時点で有効なロール付与一覧を返す。"""
        ...

    def add(self, assignment: RoleAssignment) -> None:
        """新しいロール付与を永続化する。"""
        ...

    def save(self, assignment: RoleAssignment) -> None:
        """ロール付与の変更を保存する。"""
        ...

    def revoke_all_for_user(self, user_id: UserId, now: AwareDatetime) -> None:
        """指定ユーザーの全ロール付与を即時失効させる。"""
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

    def revoke_all_for_user(self, user_id: UserId, now: AwareDatetime) -> None:
        """指定ユーザーの全セッションを即時失効させる。"""
        ...
