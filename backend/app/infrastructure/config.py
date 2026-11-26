"""環境変数とアプリケーション設定の読み込み。"""

import os
from dataclasses import dataclass, field

_DEFAULT_CORS_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"]
_DEFAULT_DEV_JWT_SECRET = "dev-only-pharmacy-domain-vendor-auth-secret-key-min-32"
_MIN_JWT_SECRET_LENGTH = 32
_VALID_LOG_LEVELS = frozenset({"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"})
_TRUE_VALUES = frozenset({"1", "true", "yes", "on"})
_FALSE_VALUES = frozenset({"0", "false", "no", "off"})


@dataclass(frozen=True, slots=True)
class Settings:
    """アプリケーションの実行時設定。"""

    app_name: str = "Template API"
    service_name: str = "template-backend"
    cors_origins: list[str] = field(default_factory=lambda: list(_DEFAULT_CORS_ORIGINS))
    docs_enabled: bool = True
    log_level: str = "INFO"
    database_path: str = "data/app.db"
    jwt_secret_key: str = _DEFAULT_DEV_JWT_SECRET
    jwt_issuer: str = "pharmacy-domain"
    auth_cookie_secure: bool = False


def _parse_bool(raw: str) -> bool:
    normalized = raw.strip().lower()
    if normalized in _TRUE_VALUES:
        return True
    if normalized in _FALSE_VALUES:
        return False
    raise ValueError(f"不正な真偽値設定です: {raw}")


def _parse_log_level(raw: str) -> str:
    normalized = raw.strip().upper()
    if normalized not in _VALID_LOG_LEVELS:
        raise ValueError(f"不正なログレベル設定です: {raw}")
    return normalized


def _parse_cors_origins(raw: str) -> list[str]:
    origins = [item.strip() for item in raw.split(",") if item.strip()]
    return origins or list(_DEFAULT_CORS_ORIGINS)


def _parse_jwt_secret_key(raw: str | None) -> str:
    if raw is None:
        return _DEFAULT_DEV_JWT_SECRET
    secret = raw.strip()
    if len(secret) < _MIN_JWT_SECRET_LENGTH:
        raise ValueError(f"JWT_SECRET_KEY は {_MIN_JWT_SECRET_LENGTH} 文字以上で設定してください。")
    return secret


def load_settings() -> Settings:
    """環境変数からサポート対象の設定を読み込む。"""
    raw_cors = os.environ.get("CORS_ORIGINS", "")
    raw_docs = os.environ.get("DOCS_ENABLED", "")
    raw_log = os.environ.get("LOG_LEVEL", "")
    raw_db = os.environ.get("DATABASE_PATH", "")
    raw_jwt_secret = os.environ.get("JWT_SECRET_KEY")
    raw_jwt_issuer = os.environ.get("JWT_ISSUER", "")
    raw_cookie_secure = os.environ.get("AUTH_COOKIE_SECURE", "")

    cors_origins = (
        _parse_cors_origins(raw_cors) if raw_cors.strip() else list(_DEFAULT_CORS_ORIGINS)
    )
    docs_enabled = _parse_bool(raw_docs) if raw_docs.strip() else True
    log_level = _parse_log_level(raw_log) if raw_log.strip() else "INFO"
    database_path = raw_db.strip() if raw_db.strip() else "data/app.db"
    jwt_secret_key = _parse_jwt_secret_key(raw_jwt_secret)
    jwt_issuer = raw_jwt_issuer.strip() if raw_jwt_issuer.strip() else "pharmacy-domain"
    auth_cookie_secure = _parse_bool(raw_cookie_secure) if raw_cookie_secure.strip() else False

    return Settings(
        cors_origins=cors_origins,
        docs_enabled=docs_enabled,
        log_level=log_level,
        database_path=database_path,
        jwt_secret_key=jwt_secret_key,
        jwt_issuer=jwt_issuer,
        auth_cookie_secure=auth_cookie_secure,
    )
