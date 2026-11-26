"""システムベンダー認証コンテキストの Outbound Port 定義。"""

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from types import TracebackType
from typing import Protocol

from app.domain.vendor_auth.entities import VendorUser
from app.domain.vendor_auth.identifiers import RefreshSessionId, RefreshTokenFamilyId, VendorUserId
from app.domain.vendor_auth.primitives import PasswordHash, PlainPassword, TokenHash
from app.domain.vendor_auth.repositories import (
    RefreshSessionRepository,
    VendorUserRepository,
)
from app.domain.vendor_auth.value_objects import VendorRole, VendorTokenType


class VendorAuthUnitOfWork(Protocol):
    """ベンダー認証コンテキストのトランザクション境界。"""

    @property
    def users(self) -> VendorUserRepository:
        """同一トランザクション内のベンダーユーザーリポジトリ。"""
        ...

    @property
    def refresh_sessions(self) -> RefreshSessionRepository:
        """同一トランザクション内のリフレッシュセッションリポジトリ。"""
        ...

    def __enter__(self) -> VendorAuthUnitOfWork: ...

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


class VendorAuthUnitOfWorkFactory(Protocol):
    """操作ごとの VendorAuthUnitOfWork を生成するファクトリ。"""

    def __call__(self) -> VendorAuthUnitOfWork: ...


class VendorUserReadGateway(Protocol):
    """参照系クエリ用ゲートウェイ。"""

    def get_by_id(self, user_id: str) -> VendorUser | None:
        """ID でベンダーユーザーを取得する。"""
        ...

    def list_all(self) -> Sequence[VendorUser]:
        """登録済みベンダーユーザー一覧を作成日時降順で取得する。"""
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
    token_type: VendorTokenType
    role: VendorRole
    family_id: str | None
    issued_at: datetime
    expires_at: datetime


class JwtTokenIssuer(Protocol):
    """JWT トークンの発行と検証ポート。"""

    def issue_access_token(
        self,
        *,
        user_id: VendorUserId,
        role: VendorRole,
        token_id: str,
        now: datetime,
    ) -> str:
        """有効期限 30 分のアクセストークンを発行する。"""
        ...

    def issue_refresh_token(
        self,
        *,
        user_id: VendorUserId,
        role: VendorRole,
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
        expected_type: VendorTokenType,
        now: datetime,
    ) -> VerifiedTokenClaims:
        """JWT の署名・発行者・種別・有効期限を検証してクレームを返す。"""
        ...
