"""infrastructure/config の単体テスト。"""

import os

import pytest

from app.infrastructure.config import load_settings


def test_load_settings_parses_existing_environment_formats(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CORS_ORIGINS", "https://one.example, , https://two.example ")
    monkeypatch.setenv("DOCS_ENABLED", " Off ")
    monkeypatch.setenv("LOG_LEVEL", " debug ")
    monkeypatch.setenv("DATABASE_PATH", " :memory: ")
    monkeypatch.setenv("DATABASE_URL", " postgresql://user:pass@127.0.0.1:5432/pharmacy ")

    loaded = load_settings()

    assert loaded.cors_origins == ["https://one.example", "https://two.example"]
    assert loaded.docs_enabled is False
    assert loaded.log_level == "DEBUG"
    assert loaded.database_path == ":memory:"
    assert loaded.database_url == "postgresql://user:pass@127.0.0.1:5432/pharmacy"
    assert loaded.effective_database_target == "postgresql://user:pass@127.0.0.1:5432/pharmacy"


@pytest.mark.parametrize("empty_value", [None, ""])
def test_load_settings_uses_defaults(
    monkeypatch: pytest.MonkeyPatch, empty_value: str | None
) -> None:
    for key in ("CORS_ORIGINS", "DOCS_ENABLED", "LOG_LEVEL", "DATABASE_PATH", "DATABASE_URL"):
        if empty_value is None:
            monkeypatch.delenv(key, raising=False)
        else:
            monkeypatch.setenv(key, empty_value)

    loaded = load_settings()

    assert loaded.cors_origins == ["http://localhost:3000", "http://127.0.0.1:3000"]
    assert loaded.docs_enabled is True
    assert loaded.log_level == "INFO"
    assert loaded.database_path == "data/app.db"
    assert loaded.database_url is None
    assert loaded.effective_database_target == "data/app.db"


def test_load_settings_reads_only_supported_environment_fields(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("APP_NAME", "Ignored API name")
    monkeypatch.setenv("SERVICE_NAME", "ignored-service")

    loaded = load_settings()

    assert loaded.app_name == "Template API"
    assert loaded.service_name == "template-backend"


def test_load_settings_preserves_case_sensitive_environment_lookup(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        os,
        "environ",
        {"DOCS_ENABLED": "false", "docs_enabled": "true", "database_path": "ignored.db"},
    )

    loaded = load_settings()

    assert loaded.docs_enabled is False
    assert loaded.database_path == "data/app.db"


def test_load_settings_rejects_invalid_values(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DOCS_ENABLED", "invalid-bool")
    with pytest.raises(ValueError, match="不正な真偽値設定です"):
        load_settings()

    monkeypatch.delenv("DOCS_ENABLED")
    monkeypatch.setenv("LOG_LEVEL", "VERBOSE")
    with pytest.raises(ValueError, match="不正なログレベル設定です"):
        load_settings()
