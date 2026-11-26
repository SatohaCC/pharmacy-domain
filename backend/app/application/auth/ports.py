"""共通認証コンテキストの Outbound Port 定義。"""

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from types import TracebackType
from typing import Protocol

from app.domain.auth.entities import RoleAssignment, User
from app.domain.auth.identifiers import (
    RefreshSessionId,
    RefreshTokenFamilyId,
    UserId,
)
from app.domain.auth.primitives import PasswordHash, PlainPassword, TokenHash
from app.domain.auth.repositories import (
    AuthUserRepository,
    RefreshSessionRepository,
    RoleAssignmentRepository,
)
from app.domain.auth.value_objects import AffiliationType, AuthScope, RoleName, TokenType


class AuthUnitOfWork(Protocol):
    """共通認証コンテキストのトランザクション境界。"""

    @property
    def users(self) -> AuthUserRepository:
        """同一トランザクション内のユーザーリポジトリ。"""
        ...

    @property
    def role_assignments(self) -> RoleAssignmentRepository:
        """同一トランザクション内のロール付与リポジトリ。"""
        ...

    @property
    def refresh_sessions(self) -> RefreshSessionRepository:
        """同一トランザクション内のリフレッシュセッションリポジトリ。"""
        ...

    def __enter__(self) -> AuthUnitOfWork: ...

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: TracebackType | None,
    ) -> None: ...

    def commit(self) -> None:
        """トランザクションを確定する。"""
        ...

    def rollback(self) -> None:
        """トランザクションを破棄する。"""
        ...


class AuthUnitOfWorkFactory(Protocol):
    """操作ごとの AuthUnitOfWork を生成するファクトリ。"""

    def __call__(self) -> AuthUnitOfWork: ...


class AuthUserReadGateway(Protocol):
    """参照系クエリ用ゲートウェイ。"""

    def get_by_id(self, user_id: str) -> User | None:
        """ID でユーザーを取得する。"""
        ...

    def list_active_roles_for_user(self, user_id: str, now: datetime) -> Sequence[RoleAssignment]:
        """指定時点で有効なロール付与一覧を取得する。"""
        ...

    def list_by_affiliation(
        self,
        affiliation_type: AffiliationType,
        *,
        tenant_id: str | None = None,
    ) -> Sequence[User]:
        """指定所属のユーザー一覧を作成日時降順で取得する。"""
        ...

    def list_active_roles_for_users(
        self, user_ids: Sequence[str], now: datetime
    ) -> Sequence[RoleAssignment]:
        """複数ユーザーの指定時点で有効なロール付与一覧を取得する。"""
        ...


class PasswordHasher(Protocol):
    """パスワードのハッシュ化と検証ポート。"""

    def hash(self, password: PlainPassword) -> PasswordHash:
        """平文パスワードをハッシュ化する。"""
        ...

    def verify(self, password: PlainPassword | str, password_hash: PasswordHash) -> bool:
        """平文パスワードとハッシュを定数時間で照合する。"""
        ...

    def dummy_verify(self) -> None:
        """ユーザー不在時のタイミング差を抑えるダミー検証を行う。"""
        ...


class TokenHasher(Protocol):
    """リフレッシュトークン文字列の SHA-256 ハッシュ化ポート。"""

    def hash_token(self, raw_token: str) -> TokenHash:
        """生のトークン文字列を TokenHash へ変換する。"""
        ...


@dataclass(frozen=True, slots=True)
class VerifiedTokenClaims:
    """検証済み JWT クレーム。"""

    subject: str
    token_id: str
    token_type: TokenType
    scope: AuthScope
    roles: tuple[RoleName, ...]
    family_id: str | None
    issued_at: datetime
    expires_at: datetime


class JwtTokenIssuer(Protocol):
    """JWT トークンの発行と検証ポート。"""

    def issue_access_token(
        self,
        *,
        user_id: UserId,
        scope: AuthScope,
        roles: Sequence[RoleName],
        token_id: str,
        now: datetime,
    ) -> str:
        """有効期限 30 分のアクセストークンを発行する。"""
        ...

    def issue_refresh_token(
        self,
        *,
        user_id: UserId,
        scope: AuthScope,
        roles: Sequence[RoleName],
        session_id: RefreshSessionId,
        family_id: RefreshTokenFamilyId,
        now: datetime,
    ) -> str:
        """有効期限 480 分のリフレッシュトークンを発行する。"""
        ...

    def verify_token(
        self,
        raw_token: str,
        *,
        expected_type: TokenType,
        now: datetime,
    ) -> VerifiedTokenClaims:
        """JWT の署名・発行者・種別・有効期限を検証してクレームを返す。"""
        ...
