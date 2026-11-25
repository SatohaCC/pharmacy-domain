"""SQLite / SQLAlchemy エンジン設定とスキーマ定義。"""

import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from time import sleep

import sqlalchemy as sa
from sqlalchemy import (
    CheckConstraint,
    Column,
    Date,
    ForeignKey,
    Index,
    MetaData,
    Table,
    Text,
    create_engine,
    event,
)
from sqlalchemy.engine import Connection, Engine, RootTransaction
from sqlalchemy.pool import QueuePool

_WAL_RETRY_COUNT = 20
_WAL_RETRY_INTERVAL_SECONDS = 0.05

metadata = MetaData()

corporations_table = Table(
    "corporations",
    metadata,
    Column("id", Text, primary_key=True, nullable=False),
    Column("category", Text, nullable=False),
    Column("name", Text, nullable=False),
    Column("corporate_number", Text, nullable=True),
    Column("address", Text, nullable=False),
    Column("status", Text, nullable=False),
    Column("created_at", Text, nullable=False),
    Column("updated_at", Text, nullable=False),
    CheckConstraint("category IN ('corporation', 'individual')"),
    CheckConstraint("status IN ('active', 'dissolved', 'merged_out')"),
    CheckConstraint("NOT (category = 'individual' AND corporate_number IS NOT NULL)"),
)

Index("idx_corporations_created_at", sa.text("created_at DESC"), _table=corporations_table)  # type: ignore[arg-type]
Index(
    "uq_corporations_corporate_number",
    corporations_table.c.corporate_number,
    unique=True,
    sqlite_where=sa.text("corporate_number IS NOT NULL"),
)

corporate_relations_table = Table(
    "corporate_relations",
    metadata,
    Column("id", Text, primary_key=True),
    Column("source_corporation_id", Text, ForeignKey("corporations.id"), nullable=False),
    Column("target_corporation_id", Text, ForeignKey("corporations.id"), nullable=False),
    Column("relation_type", Text, nullable=False),
    CheckConstraint("source_corporation_id <> target_corporation_id"),
    CheckConstraint("relation_type IN ('parent_child', 'affiliate', 'fc_vc')"),
    Index("idx_corporate_relations_source", "source_corporation_id"),
    Index("idx_corporate_relations_target", "target_corporation_id"),
)

corporate_relation_revisions_table = Table(
    "corporate_relation_revisions",
    metadata,
    Column("relation_id", Text, ForeignKey("corporate_relations.id"), primary_key=True),
    Column("recorded_at", Text, primary_key=True),
    Column("valid_from", Date, nullable=False),
    Column("valid_to", Date),
    Column("evidence", Text, nullable=False),
    Column("confirmation_status", Text, nullable=False),
    CheckConstraint("valid_to IS NULL OR valid_from < valid_to"),
    CheckConstraint("confirmation_status IN ('unverified', 'verified')"),
)


def database_url(database_path: str) -> str:
    """データベースパスから SQLAlchemy 接続 URL を組み立てる。"""
    if database_path == ":memory:":
        return "sqlite:///:memory:"
    path = Path(database_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    return f"sqlite:///{path.as_posix()}"


def _unicode_contains(haystack: str | None, needle: str | None) -> bool:
    if haystack is None or needle is None:
        return False
    return needle.casefold() in haystack.casefold()


def _enable_wal(connection: sqlite3.Connection) -> None:
    for attempt in range(_WAL_RETRY_COUNT):
        try:
            connection.execute("PRAGMA journal_mode=WAL")
            return
        except sqlite3.OperationalError:
            if attempt == _WAL_RETRY_COUNT - 1:
                raise
            sleep(_WAL_RETRY_INTERVAL_SECONDS)


def create_app_engine(database_path: str) -> Engine:
    """アプリケーション用の SQLAlchemy Engine を生成する。"""
    url = database_url(database_path)
    is_memory = database_path == ":memory:"
    # メモリ DB は 1 接続に属するため、同じ接続を一度に 1 操作だけに貸し出す。
    pool_options = {"pool_size": 1, "max_overflow": 0} if is_memory else {}
    engine = create_engine(
        url,
        connect_args={"check_same_thread": False},
        poolclass=QueuePool,
        **pool_options,
    )

    @event.listens_for(engine, "connect")
    def _on_connect(dbapi_connection: object, _connection_record: object) -> None:
        if not isinstance(dbapi_connection, sqlite3.Connection):
            return
        # Python sqlite3 の暗黙的な DDL コミットを防ぎ、トランザクション境界を明示管理する。
        dbapi_connection.isolation_level = None
        dbapi_connection.create_function("unicode_contains", 2, _unicode_contains)
        dbapi_connection.execute("PRAGMA foreign_keys=ON")
        if not is_memory:
            _enable_wal(dbapi_connection)

    @event.listens_for(engine, "begin")
    def _on_begin(connection: Connection) -> None:
        if connection.get_execution_options().get("sqlite_write_transaction"):
            connection.exec_driver_sql("BEGIN IMMEDIATE")
        else:
            connection.exec_driver_sql("BEGIN")

    return engine


def begin_write_transaction(connection: Connection) -> RootTransaction:
    """業務状態を読み取る前に SQLite の書き込み権を取得する。"""
    return connection.execution_options(sqlite_write_transaction=True).begin()


@contextmanager
def migration_connection(engine: Engine) -> Iterator[Connection]:
    """Alembic マイグレーション実行用の接続を提供する。"""
    with engine.begin() as connection:
        yield connection
