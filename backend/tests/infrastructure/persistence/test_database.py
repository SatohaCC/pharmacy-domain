"""infrastructure/persistence/database の単体テスト。"""

import sqlite3
from contextlib import closing
from pathlib import Path

import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from app.infrastructure.persistence import database

_ALEMBIC_INI = Path(__file__).resolve().parents[3] / "alembic.ini"
_STRUCTURAL_DIFF_KINDS = frozenset(
    {
        "add_table",
        "remove_table",
        "add_column",
        "remove_column",
        "modify_nullable",
        "modify_type",
        "add_fk",
        "remove_fk",
    }
)


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


def test_alembic_head_matches_sqlalchemy_metadata(tmp_path: Path) -> None:
    """Alembic head の SQLite スキーマと database.metadata に構造差分がないことを検証する。"""
    db_path = tmp_path / "schema_diff.sqlite3"
    engine = database.create_app_engine(str(db_path))
    config = Config(str(_ALEMBIC_INI))
    try:
        with engine.begin() as connection:
            config.attributes["connection"] = connection
            command.upgrade(config, "head")
        with engine.connect() as connection:
            diffs = compare_metadata(MigrationContext.configure(connection), database.metadata)
        structural_diffs = [diff for diff in diffs if diff[0] in _STRUCTURAL_DIFF_KINDS]
        assert structural_diffs == []
    finally:
        engine.dispose()


def test_alembic_latest_migration_roundtrip_with_existing_data(tmp_path: Path) -> None:
    """既存データ入りの SQLite DB で head 適用と 0007 への往復が通ることを検証する。"""
    db_path = tmp_path / "roundtrip.sqlite3"
    engine = database.create_app_engine(str(db_path))
    config = Config(str(_ALEMBIC_INI))
    try:
        with engine.begin() as connection:
            config.attributes["connection"] = connection
            command.upgrade(config, "0006_corporate_recorded_by")
            connection.execute(
                text(
                    "INSERT INTO corporations "
                    "(id, category, name, address, status, created_at, updated_at) "
                    "VALUES ('corp-1', 'corporation', 'テスト法人', '', 'active', "
                    "'2026-01-01T00:00:00+00:00', '2026-01-01T00:00:00+00:00')"
                )
            )
            connection.execute(
                text(
                    "INSERT INTO corporation_history "
                    "(corporation_id, valid_from, name, address, status, recorded_at, kind) "
                    "VALUES ('corp-1', '2026-01-01', 'テスト法人', '', 'active', "
                    "'2026-01-01T00:00:00+00:00', 'registration')"
                )
            )
            command.upgrade(config, "head")
            command.downgrade(config, "0007_corporate_usage_status")
            command.upgrade(config, "head")
    finally:
        engine.dispose()
