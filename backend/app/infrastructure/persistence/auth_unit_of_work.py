"""SQLAlchemy を用いた AuthUnitOfWork 実装。"""

import sqlite3
from types import TracebackType

from sqlalchemy import Connection, Engine, RootTransaction
from sqlalchemy.exc import OperationalError

from app.application.foundation.errors import ApplicationConflictError
from app.infrastructure.persistence.auth_refresh_session_repository import (
    SqlAlchemyRefreshSessionRepository,
)
from app.infrastructure.persistence.auth_role_assignment_repository import (
    SqlAlchemyRoleAssignmentRepository,
)
from app.infrastructure.persistence.auth_user_repository import SqlAlchemyAuthUserRepository
from app.infrastructure.persistence.database import begin_write_transaction


class SqlAlchemyAuthUnitOfWork:
    """1 操作ごとに独立したトランザクションを提供する共通認証 Unit of Work。"""

    def __init__(self, engine: Engine) -> None:
        self._engine = engine
        self._connection: Connection | None = None
        self._transaction: RootTransaction | None = None
        self._committed = False
        self._users: SqlAlchemyAuthUserRepository
        self._role_assignments: SqlAlchemyRoleAssignmentRepository
        self._refresh_sessions: SqlAlchemyRefreshSessionRepository

    @property
    def users(self) -> SqlAlchemyAuthUserRepository:
        """同一トランザクション内のユーザーリポジトリを返す。"""
        return self._users

    @property
    def role_assignments(self) -> SqlAlchemyRoleAssignmentRepository:
        """同一トランザクション内のロール付与リポジトリを返す。"""
        return self._role_assignments

    @property
    def refresh_sessions(self) -> SqlAlchemyRefreshSessionRepository:
        """同一トランザクション内のリフレッシュセッションリポジトリを返す。"""
        return self._refresh_sessions

    def __enter__(self) -> SqlAlchemyAuthUnitOfWork:
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
                    code="AUTH_CONFLICT",
                ) from exc
            raise
        self._connection = connection
        self._transaction = transaction
        self._committed = False
        self._users = SqlAlchemyAuthUserRepository(connection)
        self._role_assignments = SqlAlchemyRoleAssignmentRepository(connection)
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


class SqlAlchemyAuthUnitOfWorkFactory:
    """操作ごとの SqlAlchemyAuthUnitOfWork を生成するファクトリ。"""

    def __init__(self, engine: Engine) -> None:
        self._engine = engine

    def __call__(self) -> SqlAlchemyAuthUnitOfWork:
        return SqlAlchemyAuthUnitOfWork(self._engine)
