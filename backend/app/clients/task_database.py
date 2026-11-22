import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from threading import Lock
from time import monotonic, sleep

from alembic import command
from alembic.config import Config
from sqlalchemy import CheckConstraint, Column, Index, MetaData, Table, Text, create_engine, event
from sqlalchemy.engine import URL, Connection, Engine
from sqlalchemy.pool import StaticPool

_BACKEND_DIR = Path(__file__).resolve().parents[2]
_MIGRATION_LOCK = Lock()

metadata = MetaData()
tasks = Table(
    "tasks",
    metadata,
    Column("id", Text, primary_key=True, nullable=True),
    Column("title", Text, nullable=False),
    Column("description", Text, nullable=False),
    Column("status", Text, nullable=False),
    Column("priority", Text, nullable=False),
    Column("created_at", Text, nullable=False),
    Column("updated_at", Text, nullable=False),
    CheckConstraint("status IN ('open', 'done')"),
    CheckConstraint("priority IN ('low', 'medium', 'high')"),
)
Index("idx_tasks_created_at", tasks.c.created_at.desc())


def database_url(database_path: str) -> URL:
    """設定されたパスを SQLAlchemy の SQLite URL に変換する。"""
    path = database_path if database_path == ":memory:" else str(_BACKEND_DIR / database_path)
    return URL.create("sqlite", database=path)


def _enable_wal(connection: sqlite3.Connection) -> None:
    deadline = monotonic() + 5
    while True:
        try:
            connection.execute("PRAGMA journal_mode = WAL").close()
            return
        except sqlite3.OperationalError as error:
            # 初回の WAL 切り替えは busy_timeout を待たずに失敗する場合がある。
            if (
                error.sqlite_errorcode
                not in {
                    sqlite3.SQLITE_BUSY,
                    sqlite3.SQLITE_LOCKED,
                }
                or monotonic() >= deadline
            ):
                raise
            sleep(0.05)


def create_task_engine(database_path: str) -> Engine:
    """タスク用の SQLite エンジンを作成する。"""
    url = database_url(database_path)
    if database_path == ":memory:":
        engine = create_engine(url, poolclass=StaticPool, connect_args={"check_same_thread": False})
    else:
        (_BACKEND_DIR / database_path).parent.mkdir(parents=True, exist_ok=True)
        engine = create_engine(url)

    @event.listens_for(engine, "connect")
    def configure_sqlite(connection: sqlite3.Connection, _record: object) -> None:
        connection.execute("PRAGMA busy_timeout = 5000").close()
        if database_path != ":memory:":
            _enable_wal(connection)
        # SQLite 標準の LOWER() が扱えない Unicode の大小文字を検索できるようにする。
        connection.create_function(
            "UNICODE_LOWER",
            1,
            str.lower,
            deterministic=True,
        )

    return engine


@contextmanager
def migration_connection(engine: Engine) -> Iterator[Connection]:
    """SQLite のスキーマ変更と履歴更新を同じトランザクションで行う。"""
    with engine.connect() as connection, connection.begin():
        # 複数プロセスが同時に起動しても、バージョン確認の前に書き込みを直列化する。
        connection.exec_driver_sql("BEGIN IMMEDIATE")
        yield connection


def upgrade_task_database(engine: Engine) -> None:
    """既存データを維持しながら、タスク DB を現在のリビジョンへ更新する。"""
    config = Config(str(_BACKEND_DIR / "alembic.ini"))
    # Alembic の実行コンテキストは同一プロセス内でも同時に切り替えない。
    with _MIGRATION_LOCK, migration_connection(engine) as connection:
        config.attributes["connection"] = connection
        command.upgrade(config, "head")
