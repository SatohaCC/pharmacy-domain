from typing import Annotated

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, PydanticBaseSettingsSource, SettingsConfigDict

_VALID_LOG_LEVELS = frozenset({"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"})
_DEFAULT_LOG_LEVEL = "INFO"
_DEFAULT_DATABASE_PATH = "data/app.db"


class _EnvironmentSettings(BaseSettings):
    model_config = SettingsConfigDict(frozen=True, env_ignore_empty=True, case_sensitive=True)

    cors_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["http://localhost:3000", "http://127.0.0.1:3000"],
        validation_alias="CORS_ORIGINS",
    )
    docs_enabled: bool = Field(default=True, validation_alias="DOCS_ENABLED")
    log_level: str = Field(default=_DEFAULT_LOG_LEVEL, validation_alias="LOG_LEVEL")
    database_path: str = Field(default=_DEFAULT_DATABASE_PATH, validation_alias="DATABASE_PATH")

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _parse_origins(cls, raw: object) -> object:
        if isinstance(raw, str):
            return [origin for part in raw.split(",") if (origin := part.strip())]
        return raw

    @field_validator("docs_enabled", mode="before")
    @classmethod
    def _parse_docs_enabled(cls, raw: object) -> object:
        if not isinstance(raw, str):
            return raw
        normalized = raw.strip().lower()
        if normalized in {"", "1", "true", "yes", "on"}:
            return True
        if normalized in {"0", "false", "no", "off"}:
            return False
        raise ValueError(f"不正な真偽値設定です: {raw}")

    @field_validator("log_level")
    @classmethod
    def _parse_log_level(cls, raw: str) -> str:
        normalized = raw.strip().upper() or _DEFAULT_LOG_LEVEL
        if normalized not in _VALID_LOG_LEVELS:
            raise ValueError(f"不正なログレベル設定です: {raw}")
        return normalized

    @field_validator("database_path")
    @classmethod
    def _parse_database_path(cls, raw: str) -> str:
        return raw.strip() or _DEFAULT_DATABASE_PATH


class Settings(_EnvironmentSettings):
    """起動時に読み込むか、明示的に注入するアプリケーション設定。"""

    model_config = SettingsConfigDict(populate_by_name=True)

    app_name: str = "Template API"
    service_name: str = "template-backend"

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls: type[BaseSettings],
        init_settings: PydanticBaseSettingsSource,
        env_settings: PydanticBaseSettingsSource,
        dotenv_settings: PydanticBaseSettingsSource,
        file_secret_settings: PydanticBaseSettingsSource,
    ) -> tuple[PydanticBaseSettingsSource, ...]:
        # 明示的に生成した設定を使うテストが実行環境の DB を参照しないようにする。
        return (init_settings,)


def load_settings() -> Settings:
    """現在の環境変数からアプリケーション設定を生成する。"""
    return Settings(**_EnvironmentSettings().model_dump())
