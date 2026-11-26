"""SQLAlchemy を用いた VendorAuthUnitOfWork 実装。"""

import sqlite3
from types import TracebackType

from sqlalchemy import Connection, Engine, RootTransaction
from sqlalchemy.exc import OperationalError

from app.application.foundation.errors import ApplicationConflictError
from app.infrastructure.persistence.database import begin_write_transaction
from app.infrastructure.persistence.vendor_refresh_session_repository import (
    SqlAlchemyRefreshSessionRepository,
)
from app.infrastructure.persistence.vendor_user_repository import (
    SqlAlchemyVendorUserRepository,
)


class SqlAlchemyVendorAuthUnitOfWork:
    """1 操作ごとに独立したトランザクションを提供するベンダー認証 Unit of Work。"""

    def __init__(self, engine: Engine) -> None:
        self._engine = engine
        self._connection: Connection | None = None
        self._transaction: RootTransaction | None = None
        self._committed = False
        self._users: SqlAlchemyVendorUserRepository
        self._refresh_sessions: SqlAlchemyRefreshSessionRepository

    @property
    def users(self) -> SqlAlchemyVendorUserRepository:
        """同一トランザクション内のベンダーユーザーリポジトリを返す。"""
        return self._users

    @property
    def refresh_sessions(self) -> SqlAlchemyRefreshSessionRepository:
        """同一トランザクション内のリフレッシュセッションリポジトリを返す。"""
        return self._refresh_sessions

    def __enter__(self) -> SqlAlchemyVendorAuthUnitOfWork:
        connection = self._engine.connect()
        try:
            transaction = begin_write_transaction(connection)
        except BaseException as exc:
            connection.close()
            if (
                isinstance(exc, OperationalError)
                and isinstance(exc.orig, sqlite3.OperationalError)
                and (exc.orig.sqlite_errorcode & 0xFF) == sqlite3.SQLITE_BUSY
            ):
                raise ApplicationConflictError(
                    "認証データの書き込みが競合しました。再試行してください。",
                    code="VENDOR_AUTH_CONFLICT",
                ) from exc
            raise
        self._connection = connection
        self._transaction = transaction
        self._committed = False
        self._users = SqlAlchemyVendorUserRepository(connection)
        self._refresh_sessions = SqlAlchemyRefreshSessionRepository(connection)
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: TracebackType | None,
    ) -> None:
        try:
            if (
                not self._committed
                and self._transaction is not None
                and self._transaction.is_active
            ):
                self._transaction.rollback()
        finally:
            if self._connection is not None:
                self._connection.close()
            self._transaction = None
            self._connection = None

    def commit(self) -> None:
        """現在のトランザクションを確定する。"""
        if self._transaction is None:
            raise RuntimeError("トランザクションが開始されていません。")
        self._transaction.commit()
        self._committed = True

    def rollback(self) -> None:
        """現在のトランザクションを破棄する。"""
        if self._transaction is not None and self._transaction.is_active:
            self._transaction.rollback()


class SqlAlchemyVendorAuthUnitOfWorkFactory:
    """操作ごとの SqlAlchemyVendorAuthUnitOfWork を生成するファクトリ。"""

    def __init__(self, engine: Engine) -> None:
        self._engine = engine

    def __call__(self) -> SqlAlchemyVendorAuthUnitOfWork:
        return SqlAlchemyVendorAuthUnitOfWork(self._engine)
