"""infrastructure/logging の単体テスト。"""

import json
import logging

from app.infrastructure.logging import JsonLogFormatter, request_id_context


def test_json_log_formatter_outputs_structured_payload() -> None:
    formatter = JsonLogFormatter()
    record = logging.LogRecord(
        name="app.test",
        level=logging.INFO,
        pathname=__file__,
        lineno=1,
        msg="hello %s",
        args=("world",),
        exc_info=None,
    )
    token = request_id_context.set("req-log-1")
    try:
        formatted = formatter.format(record)
    finally:
        request_id_context.reset(token)

    payload = json.loads(formatted)
    assert set(payload.keys()) == {"timestamp", "level", "logger", "request_id", "message"}
    assert payload["level"] == "INFO"
    assert payload["logger"] == "app.test"
    assert payload["request_id"] == "req-log-1"
    assert payload["message"] == "hello world"
