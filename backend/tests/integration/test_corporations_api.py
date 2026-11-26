"""法人 API の CRUD・バリデーション・認可・CSRF 統合テスト。"""

import io
import sqlite3
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient

from app.application.auth.contracts import AuthPrincipal
from app.cli.bootstrap_vendor_admin import main as cli_main
from app.infrastructure.config import Settings
from app.main import create_app
from app.presentation.dependencies import get_current_auth_principal

_ALEMBIC_INI = Path(__file__).resolve().parents[2] / "alembic.ini"


def _vendor_principal() -> AuthPrincipal:
    return AuthPrincipal(
        user_id="vendor-admin-1",
        email="admin@vendor.example.com",
        display_name="システム管理者",
        scope_type="vendor",
        tenant_id=None,
        roles=("vendor_admin",),
    )


def test_corporations_api_crud_and_validation_flow(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    db_path = tmp_path / "api.db"
    monkeypatch.setenv("DATABASE_PATH", str(db_path))
    command.upgrade(Config(str(_ALEMBIC_INI)), "head")
    app = create_app(Settings(database_path=str(db_path)))
    app.dependency_overrides[get_current_auth_principal] = _vendor_principal

    with TestClient(app, headers={"X-Requested-With": "XMLHttpRequest"}) as client:
        full_width_number = "１２３４５６７８９０１２３"
        invalid_number_create = client.post(
            "/api/corporations",
            json={
                "category": "corporation",
                "name": "法人番号の検証",
                "corporate_number": full_width_number,
            },
        )
        assert invalid_number_create.status_code == 422
        assert invalid_number_create.json()["code"] == "VALIDATION_ERROR"

        # 不正な空白名は 422。
        invalid_create = client.post(
            "/api/corporations",
            json={"category": "corporation", "name": "   "},
        )
        assert invalid_create.status_code == 422
        assert invalid_create.json()["code"] == "VALIDATION_ERROR"

        # 個人区分への法人番号指定は 422。
        invalid_individual = client.post(
            "/api/corporations",
            json={
                "category": "individual",
                "name": "山田太郎",
                "corporate_number": "1234567890123",
            },
        )
        assert invalid_individual.status_code == 422

        # 法人登録。
        created_res = client.post(
            "/api/corporations",
            json={
                "category": "corporation",
                "name": "株式会社さくら薬局",
                "corporate_number": "1234567890123",
                "address": "東京都新宿区1-2-3",
            },
        )
        assert created_res.status_code == 201
        created = created_res.json()
        corp_id = created["id"]
        assert created["category"] == "corporation"
        assert created["status"] == "active"

        invalid_number_patch = client.patch(
            f"/api/corporations/{corp_id}", json={"corporate_number": full_width_number}
        )
        assert invalid_number_patch.status_code == 422
        assert invalid_number_patch.json()["code"] == "VALIDATION_ERROR"

        # 同じ法人番号の重複登録は 409。
        dup_res = client.post(
            "/api/corporations",
            json={
                "category": "corporation",
                "name": "別名法人",
                "corporate_number": "1234567890123",
            },
        )
        assert dup_res.status_code == 409
        assert dup_res.json()["code"] == "DUPLICATE_CORPORATE_NUMBER"

        # 一覧・詳細取得。
        list_res = client.get("/api/corporations", params={"q": "さくら"})
        assert list_res.status_code == 200
        assert list_res.json()["total"] == 1

        get_res = client.get(f"/api/corporations/{corp_id}")
        assert get_res.status_code == 200
        assert get_res.json()["name"] == "株式会社さくら薬局"
        assert get_res.json()["corporate_number"] == "1234567890123"

        # 空の PATCH は 400。
        empty_patch = client.patch(f"/api/corporations/{corp_id}", json={})
        assert empty_patch.status_code == 400
        assert empty_patch.json()["code"] == "EMPTY_UPDATE"

        # name に null は 400。
        null_patch = client.patch(f"/api/corporations/{corp_id}", json={"name": None})
        assert null_patch.status_code == 400
        assert null_patch.json()["code"] == "INVALID_UPDATE"

        # 基本情報更新（自法人番号維持・所在地空文字クリア・address=null 拒否）。
        patch_res = client.patch(
            f"/api/corporations/{corp_id}",
            json={"address": "東京都渋谷区4-5-6", "corporate_number": "1234567890123"},
        )
        assert patch_res.status_code == 200
        assert patch_res.json()["address"] == "東京都渋谷区4-5-6"
        assert patch_res.json()["corporate_number"] == "1234567890123"

        clear_addr_res = client.patch(f"/api/corporations/{corp_id}", json={"address": ""})
        assert clear_addr_res.status_code == 200
        assert clear_addr_res.json()["address"] == ""

        null_addr_res = client.patch(f"/api/corporations/{corp_id}", json={"address": None})
        assert null_addr_res.status_code == 400
        assert null_addr_res.json()["code"] == "INVALID_UPDATE"

        # corporate_number=null で法人番号をクリアできる。
        clear_num_res = client.patch(
            f"/api/corporations/{corp_id}",
            json={"corporate_number": None},
        )
        assert clear_num_res.status_code == 200
        assert clear_num_res.json()["corporate_number"] is None

        # 別法人が使用中の法人番号への更新は 409。
        other_res = client.post(
            "/api/corporations",
            json={
                "category": "corporation",
                "name": "株式会社別法人",
                "corporate_number": "9999999999999",
            },
        )
        assert other_res.status_code == 201
        dup_patch_res = client.patch(
            f"/api/corporations/{corp_id}",
            json={"corporate_number": "9999999999999"},
        )
        assert dup_patch_res.status_code == 409
        assert dup_patch_res.json()["code"] == "DUPLICATE_CORPORATE_NUMBER"

        # 存続状態変更（合併消滅）。
        status_res = client.patch(
            f"/api/corporations/{corp_id}/status",
            json={"status": "merged_out"},
        )
        assert status_res.status_code == 200
        assert status_res.json()["status"] == "merged_out"

        # 合併消滅後の基本情報更新・再遷移は 400。
        update_after_merge = client.patch(
            f"/api/corporations/{corp_id}",
            json={"name": "消滅後変更"},
        )
        assert update_after_merge.status_code == 400
        assert update_after_merge.json()["code"] == "INVALID_UPDATE"

        re_transition = client.patch(
            f"/api/corporations/{corp_id}/status",
            json={"status": "active"},
        )
        assert re_transition.status_code == 400
        assert re_transition.json()["code"] == "INVALID_CORPORATION_TRANSITION"


def test_corporations_and_relations_require_vendor_auth_and_csrf(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    db_path = tmp_path / "corp_auth.db"
    monkeypatch.setenv("DATABASE_PATH", str(db_path))
    command.upgrade(Config(str(_ALEMBIC_INI)), "head")

    monkeypatch.setattr("sys.stdin", io.StringIO("VendorAdmin123!\n"))
    assert (
        cli_main(
            [
                "--email",
                "admin@vendor.example.com",
                "--name",
                "初期管理者",
                "--password-stdin",
            ]
        )
        == 0
    )

    app = create_app(Settings(database_path=str(db_path)))

    with TestClient(app) as client:
        # 1. 未認証時は GET / POST ともに 401 UNAUTHORIZED
        unauth_list = client.get("/api/corporations")
        assert unauth_list.status_code == 401
        assert unauth_list.json()["code"] == "UNAUTHORIZED"

        unauth_create = client.post(
            "/api/corporations",
            headers={"X-Requested-With": "XMLHttpRequest"},
            json={"category": "corporation", "name": "未認証法人"},
        )
        assert unauth_create.status_code == 401
        assert unauth_create.json()["code"] == "UNAUTHORIZED"

        unauth_relations = client.get("/api/corporate-relations")
        assert unauth_relations.status_code == 401
        assert unauth_relations.json()["code"] == "UNAUTHORIZED"

        # 2. vendor_admin でログインし、vendor_member を発行する
        login_res = client.post(
            "/api/auth/login",
            json={"email": "admin@vendor.example.com", "password": "VendorAdmin123!"},
        )
        assert login_res.status_code == 200

        # CSRF ヘッダーなしの POST /api/corporations は 403 CSRF_VALIDATION_FAILED
        no_csrf = client.post(
            "/api/corporations",
            json={"category": "corporation", "name": "CSRFなし法人"},
        )
        assert no_csrf.status_code == 403
        assert no_csrf.json()["code"] == "CSRF_VALIDATION_FAILED"

        member_res = client.post(
            "/api/vendor/users",
            headers={"X-Requested-With": "XMLHttpRequest"},
            json={
                "email": "member@vendor.example.com",
                "display_name": "一般社員",
                "roles": ["vendor_member"],
                "password": "VendorMember123!",
            },
        )
        assert member_res.status_code == 201

        # 3. vendor_member でログインしても法人の登録・参照・更新がすべて実行できる
        client.post("/api/auth/logout", headers={"X-Requested-With": "XMLHttpRequest"})
        member_login = client.post(
            "/api/auth/login",
            json={"email": "member@vendor.example.com", "password": "VendorMember123!"},
        )
        assert member_login.status_code == 200

        created_corp = client.post(
            "/api/corporations",
            headers={"X-Requested-With": "XMLHttpRequest"},
            json={
                "category": "corporation",
                "name": "株式会社あおぞら薬局",
                "corporate_number": "1111222233334",
                "address": "東京都千代田区1-1",
            },
        )
        assert created_corp.status_code == 201
        corp_id = created_corp.json()["id"]

        assert client.get("/api/corporations").status_code == 200
        assert client.get(f"/api/corporations/{corp_id}").status_code == 200

        patched_corp = client.patch(
            f"/api/corporations/{corp_id}",
            headers={"X-Requested-With": "XMLHttpRequest"},
            json={"address": "東京都千代田区2-2"},
        )
        assert patched_corp.status_code == 200
        assert patched_corp.json()["address"] == "東京都千代田区2-2"

        # 4. 薬局テナント所属ユーザー（tenant_admin）でログインした場合は 403 INSUFFICIENT_ROLE
        client.post("/api/auth/logout", headers={"X-Requested-With": "XMLHttpRequest"})
        with sqlite3.connect(db_path) as conn:
            conn.execute(
                """
                INSERT INTO auth_users (
                    id, email, display_name, affiliation_type, tenant_id,
                    status, password_hash, created_at, updated_at
                )
                SELECT 'tenant-user-1', 'admin@pharmacy.example.com', '薬局管理者', 'tenant', ?,
                       status, password_hash, created_at, updated_at
                FROM auth_users WHERE email = 'admin@vendor.example.com'
                """,
                (corp_id,),
            )
            conn.execute(
                """
                INSERT INTO auth_role_assignments (
                    id, user_id, role, scope_type, tenant_id,
                    valid_from, valid_to, revoked_at, granted_by, granted_at
                )
                VALUES (
                    'ra-tenant-1', 'tenant-user-1', 'tenant_admin', 'tenant', ?,
                    '2025-01-01T00:00:00+00:00', NULL, NULL, NULL, '2025-01-01T00:00:00+00:00'
                )
                """,
                (corp_id,),
            )

        tenant_login = client.post(
            "/api/auth/login",
            json={
                "email": "admin@pharmacy.example.com",
                "password": "VendorAdmin123!",
                "scope_type": "tenant",
                "tenant_id": corp_id,
            },
        )
        assert tenant_login.status_code == 200

        forbidden_get = client.get("/api/corporations")
        assert forbidden_get.status_code == 403
        assert forbidden_get.json()["code"] == "INSUFFICIENT_ROLE"

        forbidden_post = client.post(
            "/api/corporations",
            headers={"X-Requested-With": "XMLHttpRequest"},
            json={"category": "corporation", "name": "テナントからの不正登録"},
        )
        assert forbidden_post.status_code == 403
        assert forbidden_post.json()["code"] == "INSUFFICIENT_ROLE"
