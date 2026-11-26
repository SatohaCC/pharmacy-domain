"""PostgreSQL 向けマイグレーション・制約・検索・認証の統合テスト。"""

import io
import os
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from pathlib import Path
from threading import Event

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from httpx import Response
from sqlalchemy import Connection, event, text

from app.cli.bootstrap_vendor_admin import main as cli_main
from app.infrastructure.config import Settings
from app.infrastructure.persistence import database
from app.infrastructure.persistence.database import (
    CORPORATION_WRITE_LOCK_KEY,
    create_app_engine,
)
from app.infrastructure.persistence.unit_of_work import SqlAlchemyCorporationUnitOfWork
from app.main import APP_ENGINE_RESOURCE_NAME, create_app

_ALEMBIC_INI = Path(__file__).resolve().parents[2] / "alembic.ini"


def _reset_postgres_schema(postgres_url: str) -> None:
    engine = create_app_engine(postgres_url)
    try:
        with engine.begin() as connection:
            connection.execute(text("DROP SCHEMA IF EXISTS public CASCADE"))
            connection.execute(text("CREATE SCHEMA public"))
    finally:
        engine.dispose()


def test_postgres_migrations_and_api_end_to_end(monkeypatch: pytest.MonkeyPatch) -> None:
    """TEST_POSTGRES_URL が指定されている環境で PostgreSQL の移行と API 一連を検証する。"""
    postgres_url = os.environ.get("TEST_POSTGRES_URL", "").strip()
    if not postgres_url:
        pytest.skip("TEST_POSTGRES_URL が未設定のため PostgreSQL 統合テストをスキップします")

    _reset_postgres_schema(postgres_url)
    monkeypatch.setenv("DATABASE_URL", postgres_url)
    alembic_cfg = Config(str(_ALEMBIC_INI))

    try:
        # 1. 0002 -> legacy 法人挿入 -> 0003 (Asia/Tokyo 日付変換) -> 0005 移行を検証する。
        command.upgrade(alembic_cfg, "0002_corporate_relations")
        engine = create_app_engine(postgres_url)
        try:
            with engine.begin() as connection:
                connection.execute(
                    text(
                        "INSERT INTO corporations "
                        "(id, category, name, corporate_number, address, status, "
                        "created_at, updated_at) "
                        "VALUES ('legacy-pg', 'corporation', '移行前薬局', NULL, '東京都', "
                        "'active', '2025-01-01T00:00:00+00:00', '2025-05-01T16:00:00+00:00')"
                    )
                )
        finally:
            engine.dispose()

        command.upgrade(alembic_cfg, "0004_vendor_auth")
        engine = create_app_engine(postgres_url)
        try:
            with engine.begin() as connection:
                connection.execute(
                    text(
                        "INSERT INTO vendor_users "
                        "(id, email, display_name, role, status, password_hash, "
                        "created_by, created_at, updated_at) "
                        "VALUES ('legacy-admin', 'legacy@vendor.example.com', '旧管理者', "
                        "'admin', 'active', 'scrypt$dummy', NULL, "
                        "'2025-05-01T00:00:00+00:00', '2025-05-01T00:00:00+00:00')"
                    )
                )
        finally:
            engine.dispose()

        command.upgrade(alembic_cfg, "head")

        engine = create_app_engine(postgres_url)
        try:
            with engine.connect() as connection:
                valid_from = connection.execute(
                    text(
                        "SELECT valid_from FROM corporation_history "
                        "WHERE corporation_id = 'legacy-pg'"
                    )
                ).scalar_one()
                assert valid_from == date(2025, 5, 2)

                migrated_role = connection.execute(
                    text("SELECT role FROM auth_role_assignments WHERE user_id = 'legacy-admin'")
                ).scalar_one()
                assert migrated_role == "vendor_admin"
        finally:
            engine.dispose()

        # 2. クリーンな DB に対して CLI 初期管理者発行と API フローを検証する。
        _reset_postgres_schema(postgres_url)
        command.upgrade(alembic_cfg, "head")

        monkeypatch.setattr("sys.stdin", io.StringIO("VendorAdmin123!\n"))
        assert (
            cli_main(
                [
                    "--email",
                    "admin@vendor.example.com",
                    "--name",
                    "初期システム管理者",
                    "--password-stdin",
                ]
            )
            == 0
        )

        app = create_app(Settings(database_url=postgres_url))
        with TestClient(app) as client:
            login_res = client.post(
                "/api/auth/login",
                json={"email": "admin@vendor.example.com", "password": "VendorAdmin123!"},
            )
            assert login_res.status_code == 200
            assert login_res.json()["user"]["roles"] == ["vendor_admin"]

            me_res = client.get("/api/auth/me")
            assert me_res.status_code == 200

            # 部分一意インデックスにより、個人開設者（corporate_number=None）は複数登録できる。
            ind1 = client.post(
                "/api/corporations",
                headers={"X-Requested-With": "XMLHttpRequest"},
                json={"category": "individual", "name": "個人薬局A"},
            )
            ind2 = client.post(
                "/api/corporations",
                headers={"X-Requested-With": "XMLHttpRequest"},
                json={"category": "individual", "name": "個人薬局B"},
            )
            assert ind1.status_code == 201
            assert ind2.status_code == 201

            corp_res = client.post(
                "/api/corporations",
                headers={"X-Requested-With": "XMLHttpRequest"},
                json={
                    "category": "corporation",
                    "name": "株式会社Sakura薬局",
                    "corporate_number": "1234567890123",
                    "address": "東京都新宿区1-2-3",
                },
            )
            assert corp_res.status_code == 201
            corp_id = corp_res.json()["id"]

            dup_corp = client.post(
                "/api/corporations",
                headers={"X-Requested-With": "XMLHttpRequest"},
                json={
                    "category": "corporation",
                    "name": "重複テスト薬局",
                    "corporate_number": "1234567890123",
                },
            )
            assert dup_corp.status_code == 409
            assert dup_corp.json()["code"] == "DUPLICATE_CORPORATE_NUMBER"

            # 大文字小文字を区別しない PostgreSQL ILIKE 検索。
            search_res = client.get("/api/corporations", params={"q": "sakura"})
            assert search_res.status_code == 200
            assert search_res.json()["total"] == 1
            assert search_res.json()["items"][0]["id"] == corp_id

            patch_res = client.patch(
                f"/api/corporations/{corp_id}",
                headers={"X-Requested-With": "XMLHttpRequest"},
                json={"address": "東京都渋谷区4-5-6"},
            )
            assert patch_res.status_code == 200
            assert patch_res.json()["address"] == "東京都渋谷区4-5-6"

            relation_res = client.post(
                "/api/corporate-relations",
                headers={"X-Requested-With": "XMLHttpRequest"},
                json={
                    "source_corporation_id": corp_id,
                    "target_corporation_id": ind1.json()["id"],
                    "relation_type": "parent_child",
                    "valid_from": "2026-01-01",
                    "evidence": "登記確認",
                },
            )
            assert relation_res.status_code == 201

            member_res = client.post(
                "/api/vendor/users",
                headers={"X-Requested-With": "XMLHttpRequest"},
                json={
                    "email": "member@vendor.example.com",
                    "display_name": "運用社員",
                    "roles": ["vendor_member"],
                    "password": "VendorMember123!",
                },
            )
            assert member_res.status_code == 201

            dup_member = client.post(
                "/api/vendor/users",
                headers={"X-Requested-With": "XMLHttpRequest"},
                json={
                    "email": "MEMBER@vendor.example.com",
                    "display_name": "重複社員",
                    "roles": ["vendor_member"],
                    "password": "VendorMember123!",
                },
            )
            assert dup_member.status_code == 409
            assert dup_member.json()["code"] == "DUPLICATE_VENDOR_EMAIL"

            refresh_res = client.post(
                "/api/auth/refresh",
                headers={"X-Requested-With": "XMLHttpRequest"},
            )
            assert refresh_res.status_code == 200

            logout_res = client.post(
                "/api/auth/logout",
                headers={"X-Requested-With": "XMLHttpRequest"},
            )
            assert logout_res.status_code == 204
    finally:
        _reset_postgres_schema(postgres_url)


def _overlap_postgres_corporation_writes(
    engine: database.Engine,
    first_request: Callable[[], Response],
    second_request: Callable[[], Response],
    monkeypatch: pytest.MonkeyPatch,
) -> tuple[Response, Response]:
    first_write_pending = Event()
    second_write_attempted = Event()
    commit = SqlAlchemyCorporationUnitOfWork.commit

    def commit_after_second_request(uow: SqlAlchemyCorporationUnitOfWork) -> None:
        if not first_write_pending.is_set():
            first_write_pending.set()
            assert second_write_attempted.wait(timeout=5)
        commit(uow)

    def observe_write_attempt(
        _connection: Connection, _cursor: object, statement: str, *_event_args: object
    ) -> None:
        if first_write_pending.is_set() and "pg_advisory_xact_lock" in statement:
            second_write_attempted.set()

    monkeypatch.setattr(SqlAlchemyCorporationUnitOfWork, "commit", commit_after_second_request)
    event.listen(engine, "before_cursor_execute", observe_write_attempt)
    try:
        with ThreadPoolExecutor(max_workers=2) as workers:
            first = workers.submit(first_request)
            assert first_write_pending.wait(timeout=5)
            second = workers.submit(second_request)
            return first.result(timeout=10), second.result(timeout=10)
    finally:
        event.remove(engine, "before_cursor_execute", observe_write_attempt)


def test_postgres_concurrent_writes_preserve_serialization_and_report_lock_timeout(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """PostgreSQL でも同時書き込みの検証・永続化直列化とロック競合 409 応答を維持する。"""
    postgres_url = os.environ.get("TEST_POSTGRES_URL", "").strip()
    if not postgres_url:
        pytest.skip("TEST_POSTGRES_URL が未設定のため PostgreSQL 統合テストをスキップします")

    _reset_postgres_schema(postgres_url)
    monkeypatch.setenv("DATABASE_URL", postgres_url)
    command.upgrade(Config(str(_ALEMBIC_INI)), "head")

    monkeypatch.setattr("sys.stdin", io.StringIO("VendorAdmin123!\n"))
    assert (
        cli_main(
            [
                "--email",
                "admin@vendor.example.com",
                "--name",
                "初期システム管理者",
                "--password-stdin",
            ]
        )
        == 0
    )

    app = create_app(Settings(database_url=postgres_url))
    try:
        with TestClient(app, headers={"X-Requested-With": "XMLHttpRequest"}) as client:
            login_res = client.post(
                "/api/auth/login",
                json={"email": "admin@vendor.example.com", "password": "VendorAdmin123!"},
            )
            assert login_res.status_code == 200
            engine = app.state.resources.require(APP_ENGINE_RESOURCE_NAME, database.Engine)

            # 1. 解散と同時実行された基本情報 PATCH は解散後の状態を見て 400 で拒否される。
            created = client.post(
                "/api/corporations",
                json={"category": "corporation", "name": "法人"},
            )
            assert created.status_code == 201
            corp_id = created.json()["id"]
            corp_path = f"/api/corporations/{corp_id}"

            dissolved, renamed = _overlap_postgres_corporation_writes(
                engine,
                lambda: client.patch(f"{corp_path}/status", json={"status": "dissolved"}),
                lambda: client.patch(corp_path, json={"name": "変更後"}),
                monkeypatch,
            )
            assert dissolved.status_code == 200
            assert renamed.status_code == 400
            assert renamed.json()["code"] == "INVALID_UPDATE"
            saved = client.get(corp_path).json()
            assert saved["status"] == "dissolved"
            assert saved["name"] == "法人"
            history = client.get(f"{corp_path}/history").json()
            assert [record["kind"] for record in history] == ["registration", "dissolution"]

            # 2. 同一子法人への異なる親法人の同時親子登録は 201 + 409 に直列化される。
            parent_a = client.post(
                "/api/corporations", json={"category": "corporation", "name": "親法人A"}
            ).json()["id"]
            parent_b = client.post(
                "/api/corporations", json={"category": "corporation", "name": "親法人B"}
            ).json()["id"]
            child = client.post(
                "/api/corporations", json={"category": "corporation", "name": "子法人"}
            ).json()["id"]

            rel1, rel2 = _overlap_postgres_corporation_writes(
                engine,
                lambda: client.post(
                    "/api/corporate-relations",
                    json={
                        "source_corporation_id": parent_a,
                        "target_corporation_id": child,
                        "relation_type": "parent_child",
                        "valid_from": "2026-01-01",
                        "evidence": "契約書A",
                    },
                ),
                lambda: client.post(
                    "/api/corporate-relations",
                    json={
                        "source_corporation_id": parent_b,
                        "target_corporation_id": child,
                        "relation_type": "parent_child",
                        "valid_from": "2026-01-01",
                        "evidence": "契約書B",
                    },
                ),
                monkeypatch,
            )
            assert rel1.status_code == 201
            assert rel2.status_code == 409

            # 3. 書き込みロック待機タイムアウト時は 409 CORPORATION_CONFLICT を返す。
            monkeypatch.setattr(database, "_POSTGRES_WRITE_LOCK_TIMEOUT_MS", 50)
            with engine.begin() as lock_holder:
                lock_holder.execute(
                    text("SELECT pg_advisory_xact_lock(:lock_key)"),
                    {"lock_key": CORPORATION_WRITE_LOCK_KEY},
                )
                conflict_res = client.patch(
                    f"/api/corporations/{parent_a}/status",
                    json={"status": "dissolved"},
                )
            assert conflict_res.status_code == 409
            assert conflict_res.json()["code"] == "CORPORATION_CONFLICT"
    finally:
        _reset_postgres_schema(postgres_url)
