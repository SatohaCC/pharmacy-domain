import json
import logging
from contextvars import ContextVar
from datetime import UTC, datetime
from typing import TextIO

request_id_context: ContextVar[str] = ContextVar("request_id", default="-")

_CORE_LOG_FIELDS = frozenset({"timestamp", "level", "logger", "request_id", "message", "exception"})


class JsonLogFormatter(logging.Formatter):
    """リクエスト ID を含む構造化 JSON ログフォーマッタ。"""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, object] = {
            "timestamp": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "request_id": request_id_context.get(),
            "message": record.getMessage(),
        }
        structured_fields = getattr(record, "structured_fields", None)
        if isinstance(structured_fields, dict):
            for key, value in structured_fields.items():
                key_str = str(key)
                if key_str not in _CORE_LOG_FIELDS:
                    payload[key_str] = value
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False)


def _resolve_log_level(level: int | str) -> int:
    if isinstance(level, bool):
        raise ValueError(f"不正なログレベルです: {level}")
    if isinstance(level, int):
        return level
    normalized = level.strip().upper()
    mapping = logging.getLevelNamesMapping()
    resolved = mapping.get(normalized)
    if resolved is None:
        raise ValueError(f"不正なログレベルです: {level}")
    return resolved


class _AppStreamHandler(logging.StreamHandler[TextIO]):
    """アプリケーションが既定で登録した構造化ログハンドラ識別用クラス。"""


def configure_logging(level: int | str = logging.INFO) -> logging.Logger:
    """アプリケーションロガーへ構造化 JSON フォーマッタを設定して返す。"""
    resolved_level = _resolve_log_level(level)
    logger = logging.getLogger("app")
    logger.setLevel(resolved_level)
    logger.propagate = False
    if not any(isinstance(h, _AppStreamHandler) for h in logger.handlers):
        handler = _AppStreamHandler()
        handler.setFormatter(JsonLogFormatter())
        logger.addHandler(handler)
    return logger
