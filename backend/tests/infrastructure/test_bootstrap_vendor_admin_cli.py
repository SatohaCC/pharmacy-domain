"""初期ベンダー管理者発行 CLI のテスト。"""

import io
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config

from app.cli.bootstrap_vendor_admin import main as cli_main

_ALEMBIC_INI = Path(__file__).resolve().parents[2] / "alembic.ini"


def test_bootstrap_vendor_admin_cli_flow(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    db_path = tmp_path / "cli.db"
    monkeypatch.setenv("DATABASE_PATH", str(db_path))
    command.upgrade(Config(str(_ALEMBIC_INI)), "head")

    monkeypatch.setattr("sys.stdin", io.StringIO("AdminPassword123!\n"))
    exit_code = cli_main(
        [
            "--email",
            "initial.admin@example.com",
            "--name",
            "初期システム管理者",
            "--password-stdin",
        ]
    )
    assert exit_code == 0

    # 2回目の実行は既存ユーザーがいるため失敗する。
    monkeypatch.setattr("sys.stdin", io.StringIO("AdminPassword123!\n"))
    second_code = cli_main(
        [
            "--email",
            "second.admin@example.com",
            "--name",
            "2人目管理者",
            "--password-stdin",
        ]
    )
    assert second_code == 1
