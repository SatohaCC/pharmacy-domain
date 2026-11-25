"""時刻・ID 生成ポートの具象実装。"""

import uuid
from datetime import UTC, datetime


class SystemClock:
    """UTC 現在時刻を返す時計実装。"""

    def now(self) -> datetime:
        """現在の UTC 時刻を返す。"""
        return datetime.now(UTC)


class Uuid4Generator:
    """UUIDv4 hex 文字列を生成する ID 生成器。"""

    def new_id(self) -> str:
        """新しい UUIDv4 hex 文字列を返す。"""
        return uuid.uuid4().hex
