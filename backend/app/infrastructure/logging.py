"""構造化 JSON ログとリクエスト ID コンテキスト管理。"""

import json
import logging
import sys
from contextvars import ContextVar
from datetime import UTC, datetime

request_id_context: ContextVar[str] = ContextVar("request_id", default="-")


class JsonLogFormatter(logging.Formatter):
    """ログレコードを構造化 JSON 文字列へ整形するフォーマッタ。"""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, object] = {
            "timestamp": datetime.fromtimestamp(record.created, tz=UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "request_id": request_id_context.get(),
            "message": record.getMessage(),
        }
        structured_fields = getattr(record, "structured_fields", None)
        if isinstance(structured_fields, dict):
            payload.update(structured_fields)
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False)


def configure_logging(log_level: str) -> logging.Logger:
    """アプリケーションロガーを初期化する。"""
    logger = logging.getLogger("app")
    logger.setLevel(log_level)
    logger.propagate = False

    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(JsonLogFormatter())
        logger.addHandler(handler)
    else:
        for existing_handler in logger.handlers:
            existing_handler.setFormatter(JsonLogFormatter())

    return logger
