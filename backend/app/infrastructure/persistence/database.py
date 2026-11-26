"""SQLite / PostgreSQL 互換の SQLAlchemy エンジン設定とスキーマ定義。"""

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
    Integer,
    MetaData,
    Table,
    Text,
    create_engine,
    event,
)
from sqlalchemy.engine import Connection, Engine, RootTransaction
from sqlalchemy.exc import DBAPIError, OperationalError
from sqlalchemy.pool import QueuePool

_WAL_RETRY_COUNT = 20
_WAL_RETRY_INTERVAL_SECONDS = 0.05
CORPORATION_WRITE_LOCK_KEY = 1001
AUTH_WRITE_LOCK_KEY = 1002
_POSTGRES_WRITE_LOCK_TIMEOUT_MS = 5000
_POSTGRES_LOCK_CONFLICT_SQLSTATES = frozenset({"55P03", "40P01", "40001"})

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
    postgresql_where=sa.text("corporate_number IS NOT NULL"),
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

corporation_history_table = Table(
    "corporation_history",
    metadata,
    Column("sequence", Integer, primary_key=True),
    Column("corporation_id", Text, ForeignKey("corporations.id"), nullable=False),
    Column("valid_from", Date, nullable=False),
    Column("valid_to", Date),
    Column("name", Text, nullable=False),
    Column("corporate_number", Text),
    Column("address", Text, nullable=False),
    Column("status", Text, nullable=False),
    Column("recorded_at", Text, nullable=False),
    Column("kind", Text, nullable=False),
    Column("evidence", Text),
    Column("surviving_corporation_id", Text, ForeignKey("corporations.id")),
    CheckConstraint("valid_to IS NULL OR valid_from < valid_to"),
    CheckConstraint("status IN ('active', 'dissolved', 'merged_out')"),
    CheckConstraint(
        "surviving_corporation_id IS NULL OR surviving_corporation_id <> corporation_id"
    ),
    Index("idx_corporation_history_records", "corporation_id", "sequence"),
)

auth_users_table = Table(
    "auth_users",
    metadata,
    Column("id", Text, primary_key=True, nullable=False),
    Column("email", Text, nullable=False),
    Column("display_name", Text, nullable=False),
    Column("affiliation_type", Text, nullable=False),
    Column("tenant_id", Text, ForeignKey("corporations.id"), nullable=True),
    Column("status", Text, nullable=False),
    Column("password_hash", Text, nullable=False),
    Column("created_by", Text, ForeignKey("auth_users.id"), nullable=True),
    Column("created_at", Text, nullable=False),
    Column("updated_at", Text, nullable=False),
    CheckConstraint("affiliation_type IN ('vendor', 'tenant')"),
    CheckConstraint(
        "(affiliation_type = 'vendor' AND tenant_id IS NULL) OR "
        "(affiliation_type = 'tenant' AND tenant_id IS NOT NULL)"
    ),
    CheckConstraint("status IN ('active', 'disabled')"),
)

Index("idx_auth_users_created_at", sa.text("created_at DESC"), _table=auth_users_table)  # type: ignore[arg-type]
Index(
    "uq_auth_users_vendor_email",
    auth_users_table.c.email,
    unique=True,
    sqlite_where=sa.text("affiliation_type = 'vendor'"),
    postgresql_where=sa.text("affiliation_type = 'vendor'"),
)
Index(
    "uq_auth_users_tenant_email",
    auth_users_table.c.tenant_id,
    auth_users_table.c.email,
    unique=True,
    sqlite_where=sa.text("affiliation_type = 'tenant'"),
    postgresql_where=sa.text("affiliation_type = 'tenant'"),
)

auth_role_assignments_table = Table(
    "auth_role_assignments",
    metadata,
    Column("id", Text, primary_key=True, nullable=False),
    Column("user_id", Text, ForeignKey("auth_users.id"), nullable=False),
    Column("role", Text, nullable=False),
    Column("scope_type", Text, nullable=False),
    Column("tenant_id", Text, ForeignKey("corporations.id"), nullable=True),
    Column("valid_from", Text, nullable=False),
    Column("valid_to", Text, nullable=True),
    Column("revoked_at", Text, nullable=True),
    Column("granted_by", Text, ForeignKey("auth_users.id"), nullable=True),
    Column("granted_at", Text, nullable=False),
    CheckConstraint("scope_type IN ('vendor', 'tenant')"),
    CheckConstraint(
        "(scope_type = 'vendor' AND tenant_id IS NULL AND "
        "role IN ('vendor_admin', 'vendor_member')) "
        "OR (scope_type = 'tenant' AND tenant_id IS NOT NULL AND "
        "role IN ('tenant_admin', 'pharmacist', 'clerk'))"
    ),
    CheckConstraint("valid_to IS NULL OR valid_from < valid_to"),
    Index("idx_auth_role_assignments_user_id", "user_id"),
)

auth_refresh_sessions_table = Table(
    "auth_refresh_sessions",
    metadata,
    Column("id", Text, primary_key=True, nullable=False),
    Column("family_id", Text, nullable=False),
    Column("user_id", Text, ForeignKey("auth_users.id"), nullable=False),
    Column("scope_type", Text, nullable=False),
    Column("tenant_id", Text, ForeignKey("corporations.id"), nullable=True),
    Column("token_hash", Text, nullable=False),
    Column("issued_at", Text, nullable=False),
    Column("expires_at", Text, nullable=False),
    Column("rotated_at", Text, nullable=True),
    Column("revoked_at", Text, nullable=True),
    Column("replaced_by_session_id", Text, nullable=True),
    CheckConstraint("scope_type IN ('vendor', 'tenant')"),
    CheckConstraint(
        "(scope_type = 'vendor' AND tenant_id IS NULL) OR "
        "(scope_type = 'tenant' AND tenant_id IS NOT NULL)"
    ),
    Index("idx_auth_refresh_sessions_family_id", "family_id"),
    Index("idx_auth_refresh_sessions_user_id", "user_id"),
)


def database_url(database_target: str) -> str:
    """接続先（SQLite パスまたは PostgreSQL URL）から SQLAlchemy 接続 URL を組み立てる。"""
    target = database_target.strip()
    if target.startswith("postgresql://"):
        return "postgresql+psycopg://" + target.removeprefix("postgresql://")
    if target.startswith("postgres://"):
        return "postgresql+psycopg://" + target.removeprefix("postgres://")
    if target.startswith(("postgresql+", "sqlite:")):
        return target
    if target == ":memory:":
        return "sqlite:///:memory:"
    path = Path(target)
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


def create_app_engine(database_target: str) -> Engine:
    """アプリケーション用の SQLAlchemy Engine を生成する（SQLite / PostgreSQL 両対応）。"""
    url = database_url(database_target)
    if not url.startswith("sqlite:"):
        return create_engine(url, poolclass=QueuePool, pool_pre_ping=True)

    is_memory = url == "sqlite:///:memory:"
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


def begin_write_transaction(
    connection: Connection,
    *,
    lock_key: int = CORPORATION_WRITE_LOCK_KEY,
) -> RootTransaction:
    """業務状態を読み取る前に書き込みトランザクションを開始し、直列化ロックを取得する。"""
    if connection.dialect.name == "sqlite":
        return connection.execution_options(sqlite_write_transaction=True).begin()
    transaction = connection.begin()
    try:
        connection.execute(
            sa.text("SELECT set_config('lock_timeout', :timeout, true)"),
            {"timeout": f"{_POSTGRES_WRITE_LOCK_TIMEOUT_MS}ms"},
        )
        connection.execute(
            sa.text("SELECT pg_advisory_xact_lock(:lock_key)"),
            {"lock_key": lock_key},
        )
    except BaseException:
        if transaction.is_active:
            transaction.rollback()
        raise
    return transaction


def is_write_lock_conflict(exc: BaseException) -> bool:
    """書き込みロック待機タイムアウト・デッドロック・直列化競合かどうかを判定する。"""
    if (
        isinstance(exc, OperationalError)
        and isinstance(exc.orig, sqlite3.OperationalError)
        and (exc.orig.sqlite_errorcode & 0xFF) == sqlite3.SQLITE_BUSY
    ):
        return True
    if isinstance(exc, DBAPIError):
        return getattr(exc.orig, "sqlstate", None) in _POSTGRES_LOCK_CONFLICT_SQLSTATES
    return False


@contextmanager
def migration_connection(engine: Engine) -> Iterator[Connection]:
    """Alembic マイグレーション実行用の接続を提供する。"""
    with engine.begin() as connection:
        yield connection
