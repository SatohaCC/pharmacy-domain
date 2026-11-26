"""システムベンダー認証・アカウント発行 API の統合テスト。"""

from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient

from app.cli.bootstrap_vendor_admin import main as cli_main
from app.infrastructure.config import Settings
from app.infrastructure.security.jwt_codec import Hs256JwtTokenIssuer
from app.main import create_app

_ALEMBIC_INI = Path(__file__).resolve().parents[2] / "alembic.ini"


def test_vendor_auth_end_to_end_api_flow(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    db_path = tmp_path / "vendor_auth.db"
    monkeypatch.setenv("DATABASE_PATH", str(db_path))
    command.upgrade(Config(str(_ALEMBIC_INI)), "head")

    import io

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

    settings = Settings(database_path=str(db_path))
    app = create_app(settings)

    with TestClient(app) as client:
        # 未認証の /me は 401。
        unauth_me = client.get("/api/vendor/auth/me")
        assert unauth_me.status_code == 401

        # 不正パスワードは 401。
        bad_login = client.post(
            "/api/vendor/auth/login",
            json={"email": "admin@vendor.example.com", "password": "WrongPassword123!"},
        )
        assert bad_login.status_code == 401
        assert bad_login.json()["code"] == "INVALID_CREDENTIALS"

        # 正しい認証情報でログインし HttpOnly Cookie（30分 / 480分）を受領。
        login_res = client.post(
            "/api/vendor/auth/login",
            json={"email": "admin@vendor.example.com", "password": "VendorAdmin123!"},
        )
        assert login_res.status_code == 200
        login_data = login_res.json()
        assert login_data["user"]["email"] == "admin@vendor.example.com"
        assert login_data["user"]["role"] == "admin"
        assert login_data["access_token_expires_in_seconds"] == 1800
        assert login_data["refresh_token_expires_in_seconds"] == 28800

        access_cookie = client.cookies.get("vendor_access_token")
        refresh_cookie = client.cookies.get("vendor_refresh_token")
        assert access_cookie
        assert refresh_cookie

        # JWT のクレームに 30分 / 480分 が設定されていることを確認。
        jwt_issuer = Hs256JwtTokenIssuer(
            secret_key=settings.jwt_secret_key,
            issuer=settings.jwt_issuer,
        )
        from app.domain.vendor_auth.value_objects import VendorTokenType

        now = datetime.now(UTC) - timedelta(minutes=1)
        access_claims = jwt_issuer.verify_token(
            access_cookie,
            expected_type=VendorTokenType.ACCESS,
            now=now,
        )
        refresh_claims = jwt_issuer.verify_token(
            refresh_cookie,
            expected_type=VendorTokenType.REFRESH,
            now=now,
        )
        assert int((access_claims.expires_at - access_claims.issued_at).total_seconds()) == 1800
        assert int((refresh_claims.expires_at - refresh_claims.issued_at).total_seconds()) == 28800

        # /me 取得。
        me_res = client.get("/api/vendor/auth/me")
        assert me_res.status_code == 200
        assert me_res.json()["email"] == "admin@vendor.example.com"

        # CSRF ヘッダ/Origin なしの POST は 403。
        csrf_fail = client.post(
            "/api/vendor/users",
            json={
                "email": "member@vendor.example.com",
                "display_name": "一般社員",
                "role": "member",
                "password": "MemberPass123!",
            },
        )
        assert csrf_fail.status_code == 403
        assert csrf_fail.json()["code"] == "CSRF_VALIDATION_FAILED"

        # 管理者によるベンダー社員発行。
        create_res = client.post(
            "/api/vendor/users",
            headers={"X-Requested-With": "XMLHttpRequest"},
            json={
                "email": "member@vendor.example.com",
                "display_name": "運用社員",
                "role": "member",
                "password": "MemberPass123!",
            },
        )
        assert create_res.status_code == 201
        assert create_res.json()["role"] == "member"

        # メール重複は 409。
        dup_res = client.post(
            "/api/vendor/users",
            headers={"X-Requested-With": "XMLHttpRequest"},
            json={
                "email": "MEMBER@vendor.example.com",
                "display_name": "重複社員",
                "role": "member",
                "password": "MemberPass123!",
            },
        )
        assert dup_res.status_code == 409
        assert dup_res.json()["code"] == "DUPLICATE_VENDOR_EMAIL"

        # リフレッシュトークンローテーション。
        refresh_res = client.post(
            "/api/vendor/auth/refresh",
            headers={"X-Requested-With": "XMLHttpRequest"},
        )
        assert refresh_res.status_code == 200
        new_refresh_cookie = client.cookies.get("vendor_refresh_token")
        assert new_refresh_cookie
        assert new_refresh_cookie != refresh_cookie

        # ログアウト → DB セッション即時失効 → リフレッシュ不可。
        logout_res = client.post(
            "/api/vendor/auth/logout",
            headers={"X-Requested-With": "XMLHttpRequest"},
        )
        assert logout_res.status_code == 204
        after_logout_refresh = client.post(
            "/api/vendor/auth/refresh",
            headers={"X-Requested-With": "XMLHttpRequest"},
            cookies={"vendor_refresh_token": new_refresh_cookie},
        )
        assert after_logout_refresh.status_code == 401

        # 発行した一般社員でログインし、管理 API は 403 になることを確認。
        member_login = client.post(
            "/api/vendor/auth/login",
            json={"email": "member@vendor.example.com", "password": "MemberPass123!"},
        )
        assert member_login.status_code == 200
        assert client.get("/api/vendor/users").status_code == 403
        assert (
            client.post(
                "/api/vendor/users",
                headers={"X-Requested-With": "XMLHttpRequest"},
                json={
                    "email": "other@vendor.example.com",
                    "display_name": "不正作成",
                    "role": "member",
                    "password": "OtherPass123!",
                },
            ).status_code
            == 403
        )

        # 非 ASCII を含む不正な Cookie が送られても 500 にならず 401/204(Cookie削除) で処理される。
        # httpx はリクエストヘッダの非 ASCII を送信前に拒否するため、
        # ASGI スコープへ生バイト列を直接渡して検証する。
        from collections.abc import MutableMapping
        from typing import Any, cast

        import anyio

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
                "GET",
                "/api/vendor/auth/me",
                cookie_bytes="vendor_access_token=é.e.e".encode(),
            )
        )
        assert me_status == 401
        assert b"AUTH_TOKEN_INVALID" in me_body

        refresh_status, _, refresh_body = anyio.run(
            lambda: _call_asgi(
                "POST",
                "/api/vendor/auth/refresh",
                cookie_bytes="vendor_refresh_token=é.e.e".encode(),
                extra_headers=[(b"x-requested-with", b"XMLHttpRequest")],
            )
        )
        assert refresh_status == 401
        assert b"REFRESH_TOKEN_INVALID" in refresh_body

        logout_status, logout_headers, _ = anyio.run(
            lambda: _call_asgi(
                "POST",
                "/api/vendor/auth/logout",
                cookie_bytes="vendor_refresh_token=é.e.e".encode(),
                extra_headers=[(b"x-requested-with", b"XMLHttpRequest")],
            )
        )
        assert logout_status == 204
        set_cookies = b" ".join(v for k, v in logout_headers if k.lower() == b"set-cookie")
        assert b"Max-Age=0" in set_cookies
