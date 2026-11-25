"""アプリケーション層共通の外部ポート定義。"""

from datetime import datetime
from typing import Protocol


class Clock(Protocol):
    """現在時刻を提供するポート。"""

    def now(self) -> datetime:
        """タイムゾーン付きの現在時刻を返す。"""
        ...


class IdGenerator(Protocol):
    """一意な識別子文字列を生成するポート。"""

    def new_id(self) -> str:
        """新しい識別子文字列を返す。"""
        ...
