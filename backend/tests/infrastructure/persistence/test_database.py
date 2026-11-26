"""infrastructure/persistence/database の単体テスト。"""

import sqlite3
from contextlib import closing
from pathlib import Path

import pytest
from sqlalchemy.exc import DBAPIError

from app.infrastructure.persistence import database


def test_wal_initialization_retries_when_another_connection_holds_a_write_lock(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    database_path = tmp_path / "concurrent.db"
    with (
        closing(sqlite3.connect(database_path)) as writer,
        closing(sqlite3.connect(database_path, timeout=0)) as startup,
    ):
        writer.execute("BEGIN IMMEDIATE")
        monkeypatch.setattr(database, "sleep", lambda _seconds: writer.rollback())

        database._enable_wal(startup)

        assert not writer.in_transaction
        assert startup.execute("PRAGMA journal_mode").fetchone() == ("wal",)


def test_database_url_normalizes_sqlite_and_postgresql_targets() -> None:
    assert database.database_url(":memory:") == "sqlite:///:memory:"
    assert (
        database.database_url("postgresql://pharmacy:pharmacy@127.0.0.1:5432/pharmacy")
        == "postgresql+psycopg://pharmacy:pharmacy@127.0.0.1:5432/pharmacy"
    )
    assert (
        database.database_url("postgres://pharmacy:pharmacy@127.0.0.1:5432/pharmacy")
        == "postgresql+psycopg://pharmacy:pharmacy@127.0.0.1:5432/pharmacy"
    )
    assert (
        database.database_url("postgresql+psycopg://pharmacy:pharmacy@127.0.0.1:5432/pharmacy")
        == "postgresql+psycopg://pharmacy:pharmacy@127.0.0.1:5432/pharmacy"
    )


@pytest.mark.parametrize("sqlstate", ["55P03", "40P01", "40001"])
def test_is_write_lock_conflict_recognizes_postgres_lock_sqlstates(sqlstate: str) -> None:
    class _OrigError(Exception):
        def __init__(self, state: str) -> None:
            self.sqlstate = state

    exc = DBAPIError("SELECT pg_advisory_xact_lock(:lock_key)", {}, _OrigError(sqlstate))
    assert database.is_write_lock_conflict(exc) is True

    unrelated = DBAPIError("INSERT ...", {}, _OrigError("23505"))
    assert database.is_write_lock_conflict(unrelated) is False
