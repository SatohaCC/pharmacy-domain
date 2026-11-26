"""Alembic 0004 -> 0005 マイグレーションとスコープ付き一意制約のテスト。"""

from pathlib import Path

import sqlalchemy as sa
from alembic import command
from alembic.config import Config

from app.infrastructure.persistence.database import create_app_engine

_ALEMBIC_INI = Path(__file__).resolve().parents[3] / "alembic.ini"


def test_migration_0004_to_0005_preserves_vendor_users_and_sessions(
    tmp_path: Path,
    monkeypatch: object,
) -> None:
    db_path = tmp_path / "migration_test.db"
    monkeypatch.setenv("DATABASE_PATH", str(db_path))  # type: ignore[attr-defined]
    cfg = Config(str(_ALEMBIC_INI))

    command.upgrade(cfg, "0004_vendor_auth")

    engine = create_app_engine(str(db_path))
    try:
        with engine.begin() as conn:
            conn.execute(
                sa.text(
                    "INSERT INTO vendor_users "
                    "(id, email, display_name, role, status, password_hash, "
                    "created_by, created_at, updated_at) "
                    "VALUES ('u1', 'admin@example.com', '管理者', 'admin', 'active', "
                    "'scrypt$dummy', NULL, '2026-11-26T00:00:00+00:00', "
                    "'2026-11-26T00:00:00+00:00'), "
                    "('u2', 'member@example.com', '社員', 'member', 'active', "
                    "'scrypt$dummy2', 'u1', '2026-11-26T00:01:00+00:00', "
                    "'2026-11-26T00:01:00+00:00')"
                )
            )
            conn.execute(
                sa.text(
                    "INSERT INTO vendor_refresh_sessions "
                    "(id, family_id, vendor_user_id, token_hash, issued_at, expires_at) "
                    "VALUES ('s1', 'f1', 'u1', :token_hash, "
                    "'2026-11-26T00:00:00+00:00', '2026-11-26T08:00:00+00:00')"
                ),
                {"token_hash": "a" * 64},
            )
    finally:
        engine.dispose()

    command.upgrade(cfg, "head")

    engine_after = create_app_engine(str(db_path))
    try:
        with engine_after.connect() as conn:
            users = (
                conn.execute(
                    sa.text(
                        "SELECT id, email, affiliation_type, tenant_id FROM auth_users ORDER BY id"
                    )
                )
                .mappings()
                .all()
            )
            assert len(users) == 2
            assert users[0]["affiliation_type"] == "vendor"
            assert users[0]["tenant_id"] is None

            roles = (
                conn.execute(
                    sa.text(
                        "SELECT user_id, role, scope_type FROM auth_role_assignments "
                        "ORDER BY user_id"
                    )
                )
                .mappings()
                .all()
            )
            assert [(r["user_id"], r["role"], r["scope_type"]) for r in roles] == [
                ("u1", "vendor_admin", "vendor"),
                ("u2", "vendor_member", "vendor"),
            ]

            sessions = (
                conn.execute(sa.text("SELECT id, user_id, scope_type FROM auth_refresh_sessions"))
                .mappings()
                .all()
            )
            assert [(s["id"], s["user_id"], s["scope_type"]) for s in sessions] == [
                ("s1", "u1", "vendor")
            ]
    finally:
        engine_after.dispose()
