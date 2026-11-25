"""infrastructure/persistence/database の単体テスト。"""

import sqlite3
from contextlib import closing
from pathlib import Path

import pytest

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
