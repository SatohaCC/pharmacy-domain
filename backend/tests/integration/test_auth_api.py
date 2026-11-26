"""共通認証・ロール API（/api/auth/*）の統合テスト。"""

import io
import sqlite3
from collections.abc import MutableMapping
from contextlib import closing
from datetime import UTC, datetime, timedelta
from http.cookies import SimpleCookie
from pathlib import Path
from typing import Any, cast

import anyio
import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from httpx import Response

from app.cli.bootstrap_vendor_admin import main as cli_main
from app.domain.auth.value_objects import TokenType
from app.infrastructure.config import Settings
from app.infrastructure.security.jwt_codec import Hs256JwtTokenIssuer
from app.main import create_app

_ALEMBIC_INI = Path(__file__).resolve().parents[2] / "alembic.ini"


def _assert_auth_cookie_headers(response: Response, *, cleared: bool = False) -> None:
    cookies = SimpleCookie()
    for header in response.headers.get_list("set-cookie"):
        cookies.load(header)

    expected = {
        "auth_access_token": ("/api", "1800"),
        "auth_refresh_token": ("/api/auth", "28800"),
    }
    assert set(cookies) == set(expected)
    for name, (path, max_age) in expected.items():
        cookie = cookies[name]
        assert cookie["path"] == path
        assert cookie["max-age"] == ("0" if cleared else max_age)
        assert cookie["httponly"] and cookie["secure"]
        assert cookie["samesite"] == "lax"


@pytest.fixture
def vendor_auth_db(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> Path:
    db_path = tmp_path / "unified_auth.db"
    monkeypatch.setenv("DATABASE_PATH", str(db_path))
    command.upgrade(Config(str(_ALEMBIC_INI)), "head")

    monkeypatch.setattr("sys.stdin", io.StringIO("VendorAdmin123!\n"))
    assert (
        cli_main(
            [
                "--email",
                "admin@vendor.example.com",
                "--name",
                "システム管理者",
                "--password-stdin",
            ]
        )
        == 0
    )
    return db_path


def test_unified_auth_api_end_to_end_flow(vendor_auth_db: Path) -> None:
    settings = Settings(database_path=str(vendor_auth_db), auth_cookie_secure=True)
    app = create_app(settings)

    with TestClient(app, base_url="https://testserver") as client:
        assert client.get("/api/auth/me").status_code == 401
        assert client.get("/api/vendor/auth/me").status_code == 404

        bad_login = client.post(
            "/api/auth/login",
            json={"email": "admin@vendor.example.com", "password": "WrongPassword123!"},
        )
        assert bad_login.status_code == 401
        assert bad_login.json()["code"] == "INVALID_CREDENTIALS"

        login_res = client.post(
            "/api/auth/login",
            json={"email": "admin@vendor.example.com", "password": "VendorAdmin123!"},
        )
        assert login_res.status_code == 200
        _assert_auth_cookie_headers(login_res)
        login_data = login_res.json()
        assert login_data["user"]["email"] == "admin@vendor.example.com"
        assert login_data["user"]["affiliation_type"] == "vendor"
        assert login_data["user"]["roles"] == ["vendor_admin"]
        assert login_data["access_token_expires_in_seconds"] == 1800
        assert login_data["refresh_token_expires_in_seconds"] == 28800

        access_cookie = client.cookies.get("auth_access_token")
        refresh_cookie = client.cookies.get("auth_refresh_token")
        assert access_cookie
        assert refresh_cookie

        jwt_issuer = Hs256JwtTokenIssuer(
            secret_key=settings.jwt_secret_key,
            issuer=settings.jwt_issuer,
        )
        now = datetime.now(UTC) - timedelta(minutes=1)
        access_claims = jwt_issuer.verify_token(
            access_cookie, expected_type=TokenType.ACCESS, now=now
        )
        refresh_claims = jwt_issuer.verify_token(
            refresh_cookie, expected_type=TokenType.REFRESH, now=now
        )
        assert int((access_claims.expires_at - access_claims.issued_at).total_seconds()) == 1800
        assert int((refresh_claims.expires_at - refresh_claims.issued_at).total_seconds()) == 28800

        me_res = client.get("/api/auth/me")
        assert me_res.status_code == 200
        assert me_res.json()["roles"] == ["vendor_admin"]

        # リフレッシュローテーション。
        refresh_res = client.post(
            "/api/auth/refresh",
            headers={"X-Requested-With": "XMLHttpRequest"},
        )
        assert refresh_res.status_code == 200
        _assert_auth_cookie_headers(refresh_res)
        new_refresh_cookie = client.cookies.get("auth_refresh_token")
        assert new_refresh_cookie
        assert new_refresh_cookie != refresh_cookie

        # ログアウト → 即時失効。
        logout_res = client.post(
            "/api/auth/logout",
            headers={"X-Requested-With": "XMLHttpRequest"},
        )
        assert logout_res.status_code == 204
        _assert_auth_cookie_headers(logout_res, cleared=True)
        assert not client.cookies
        assert client.get("/api/auth/me").status_code == 401

        with closing(sqlite3.connect(vendor_auth_db)) as connection:
            sessions = connection.execute(
                "SELECT family_id, revoked_at FROM auth_refresh_sessions"
            ).fetchall()
        assert len(sessions) == 2
        assert len({family_id for family_id, _ in sessions}) == 1
        assert all(revoked_at is not None for _, revoked_at in sessions)

        after_logout_refresh = client.post(
            "/api/auth/refresh",
            headers={
                "X-Requested-With": "XMLHttpRequest",
                "Cookie": f"auth_refresh_token={new_refresh_cookie}",
            },
        )
        assert after_logout_refresh.status_code == 401
        assert after_logout_refresh.json()["code"] == "REFRESH_TOKEN_REVOKED"

        # 非 ASCII 不正 Cookie でも 500 にならず 401/204 で拒否・削除される。
        async def _call_asgi(
            method: str,
            path: str,
            *,
            cookie_bytes: bytes,
            extra_headers: list[tuple[bytes, bytes]] | None = None,
        ) -> tuple[int, list[tuple[bytes, bytes]], bytes]:
            status_code = 0
            resp_headers: list[tuple[bytes, bytes]] = []
            chunks: list[bytes] = []
            headers = [(b"host", b"testserver"), (b"cookie", cookie_bytes), *(extra_headers or [])]
            scope: dict[str, Any] = {
                "type": "http",
                "asgi": {"version": "3.0"},
                "http_version": "1.1",
                "method": method,
                "scheme": "http",
                "path": path,
                "raw_path": path.encode("ascii"),
                "query_string": b"",
                "headers": headers,
                "client": ("127.0.0.1", 12345),
                "server": ("testserver", 80),
            }

            async def receive() -> MutableMapping[str, Any]:
                return {"type": "http.request", "body": b"", "more_body": False}

            async def send(message: MutableMapping[str, Any]) -> None:
                nonlocal status_code, resp_headers
                if message["type"] == "http.response.start":
                    status_code = cast(int, message["status"])
                    resp_headers = list(cast(list[tuple[bytes, bytes]], message["headers"]))
                elif message["type"] == "http.response.body":
                    chunks.append(cast(bytes, message.get("body", b"")))

            await app(scope, receive, send)
            return status_code, resp_headers, b"".join(chunks)

        me_status, _, me_body = anyio.run(
            lambda: _call_asgi(
                "GET", "/api/auth/me", cookie_bytes="auth_access_token=é.e.e".encode()
            )
        )
        assert me_status == 401
        assert b"AUTH_TOKEN_INVALID" in me_body

        refresh_status, _, refresh_body = anyio.run(
            lambda: _call_asgi(
                "POST",
                "/api/auth/refresh",
                cookie_bytes="auth_refresh_token=é.e.e".encode(),
                extra_headers=[(b"x-requested-with", b"XMLHttpRequest")],
            )
        )
        assert refresh_status == 401
        assert b"REFRESH_TOKEN_INVALID" in refresh_body

        logout_status, logout_headers, _ = anyio.run(
            lambda: _call_asgi(
                "POST",
                "/api/auth/logout",
                cookie_bytes="auth_refresh_token=é.e.e".encode(),
                extra_headers=[(b"x-requested-with", b"XMLHttpRequest")],
            )
        )
        assert logout_status == 204
        set_cookies = b" ".join(v for k, v in logout_headers if k.lower() == b"set-cookie")
        assert b"Max-Age=0" in set_cookies


def test_tenant_login_issues_unified_auth_cookies(vendor_auth_db: Path) -> None:
    settings = Settings(database_path=str(vendor_auth_db), auth_cookie_secure=True)
    app = create_app(settings)
    tenant_email = "staff@pharmacy.example.com"

    with TestClient(app, base_url="https://testserver") as client:
        corporation = client.post(
            "/api/corporations",
            json={"category": "corporation", "name": "さくら薬局", "address": "東京都新宿区"},
        )
        assert corporation.status_code == 201
        tenant_id = corporation.json()["id"]
        with closing(sqlite3.connect(vendor_auth_db)) as connection, connection:
            connection.execute(
                """
                INSERT INTO auth_users (id, email, display_name, affiliation_type, tenant_id,
                                        status, password_hash, created_at, updated_at)
                SELECT 'tenant-user', ?, '薬局スタッフ', 'tenant', ?,
                       status, password_hash, created_at, updated_at
                FROM auth_users WHERE email = ? AND affiliation_type = 'vendor'
                """,
                (tenant_email, tenant_id, "admin@vendor.example.com"),
            )

        tenant_login = client.post(
            "/api/auth/login",
            json={
                "email": tenant_email,
                "password": "VendorAdmin123!",
                "scope_type": "tenant",
                "tenant_id": tenant_id,
            },
        )
        assert tenant_login.status_code == 200
        assert tenant_login.json()["user"]["affiliation_type"] == "tenant"
        assert tenant_login.json()["user"]["tenant_id"] == tenant_id
        _assert_auth_cookie_headers(tenant_login)


def test_vendor_users_api_roles_rbac_and_csrf(vendor_auth_db: Path) -> None:
    app = create_app(Settings(database_path=str(vendor_auth_db)))

    with TestClient(app) as client:
        # 未認証は 401
        assert client.get("/api/vendor/users").status_code == 401

        login_res = client.post(
            "/api/auth/login",
            json={"email": "admin@vendor.example.com", "password": "VendorAdmin123!"},
        )
        assert login_res.status_code == 200

        # CSRF ヘッダーなしは 403
        no_csrf = client.post(
            "/api/vendor/users",
            json={
                "email": "staff@vendor.example.com",
                "display_name": "運用 太郎",
                "roles": ["vendor_member"],
                "password": "StaffUser1234!",
            },
        )
        assert no_csrf.status_code == 403

        # vendor_admin による vendor_member 発行 (201)
        created = client.post(
            "/api/vendor/users",
            headers={"X-Requested-With": "XMLHttpRequest"},
            json={
                "email": "staff@vendor.example.com",
                "display_name": "運用 太郎",
                "roles": ["vendor_member"],
                "password": "StaffUser1234!",
            },
        )
        assert created.status_code == 201
        created_data = created.json()
        assert created_data["roles"] == ["vendor_member"]
        assert created_data["affiliation_type"] == "vendor"

        # メール重複は 409 (DUPLICATE_VENDOR_EMAIL)
        duplicate = client.post(
            "/api/vendor/users",
            headers={"X-Requested-With": "XMLHttpRequest"},
            json={
                "email": "staff@vendor.example.com",
                "display_name": "重複 太郎",
                "roles": ["vendor_member"],
                "password": "StaffUser1234!",
            },
        )
        assert duplicate.status_code == 409
        assert duplicate.json()["code"] == "DUPLICATE_VENDOR_EMAIL"

        # 一覧取得は 200 (2件)
        listed = client.get("/api/vendor/users")
        assert listed.status_code == 200
        assert listed.json()["total"] == 2

        # vendor_member で再ログインすると /api/vendor/users の GET/POST は 403
        assert (
            client.post(
                "/api/auth/logout",
                headers={"X-Requested-With": "XMLHttpRequest"},
            ).status_code
            == 204
        )
        staff_login = client.post(
            "/api/auth/login",
            json={"email": "staff@vendor.example.com", "password": "StaffUser1234!"},
        )
        assert staff_login.status_code == 200
        assert staff_login.json()["user"]["roles"] == ["vendor_member"]

        forbidden_list = client.get("/api/vendor/users")
        assert forbidden_list.status_code == 403
        assert forbidden_list.json()["code"] == "VENDOR_ADMIN_REQUIRED"

        forbidden_create = client.post(
            "/api/vendor/users",
            headers={"X-Requested-With": "XMLHttpRequest"},
            json={
                "email": "another@vendor.example.com",
                "display_name": "別の社員",
                "roles": ["vendor_member"],
                "password": "StaffUser1234!",
            },
        )
        assert forbidden_create.status_code == 403
        assert forbidden_create.json()["code"] == "VENDOR_ADMIN_REQUIRED"
