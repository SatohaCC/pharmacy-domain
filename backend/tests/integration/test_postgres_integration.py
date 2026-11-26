"""PostgreSQL 向けマイグレーション・制約・検索・認証の統合テスト。"""

import io
import os
from datetime import date
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.cli.bootstrap_vendor_admin import main as cli_main
from app.infrastructure.config import Settings
from app.infrastructure.persistence.database import create_app_engine
from app.main import create_app

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
