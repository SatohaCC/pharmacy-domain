"""SQLAlchemy を用いた Unit of Work 実装。"""

import sqlite3
from types import TracebackType

from sqlalchemy import Connection, Engine, RootTransaction
from sqlalchemy.exc import OperationalError

from app.application.foundation.errors import ApplicationConflictError
from app.infrastructure.persistence.corporation_repository import (
    SqlAlchemyCorporationRepository,
)
from app.infrastructure.persistence.database import begin_write_transaction


class SqlAlchemyCorporationUnitOfWork:
    """1 操作ごとに独立したトランザクションを提供する法人 Unit of Work。"""

    def __init__(self, engine: Engine) -> None:
        self._engine = engine
        self._connection: Connection | None = None
        self._transaction: RootTransaction | None = None
        self._committed = False
        self._corporations: SqlAlchemyCorporationRepository

    @property
    def corporations(self) -> SqlAlchemyCorporationRepository:
        """同一トランザクション内の法人集約リポジトリを返す。"""
        return self._corporations

    def __enter__(self) -> SqlAlchemyCorporationUnitOfWork:
        connection = self._engine.connect()
        try:
            transaction = begin_write_transaction(connection)
        except BaseException as exc:
            connection.close()
            # 拡張結果コードの下位 8 ビットは基本結果コードを表す。
            if (
                isinstance(exc, OperationalError)
                and isinstance(exc.orig, sqlite3.OperationalError)
                and (exc.orig.sqlite_errorcode & 0xFF) == sqlite3.SQLITE_BUSY
            ):
                raise ApplicationConflictError(
                    "法人データの書き込みが競合しました。再試行してください。",
                    code="CORPORATION_CONFLICT",
                ) from exc
            raise
        self._connection = connection
        self._transaction = transaction
        self._committed = False
        self._corporations = SqlAlchemyCorporationRepository(connection)
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


class SqlAlchemyCorporationUnitOfWorkFactory:
    """操作ごとの SqlAlchemyCorporationUnitOfWork を生成するファクトリ。"""

    def __init__(self, engine: Engine) -> None:
        self._engine = engine

    def __call__(self) -> SqlAlchemyCorporationUnitOfWork:
        return SqlAlchemyCorporationUnitOfWork(self._engine)
