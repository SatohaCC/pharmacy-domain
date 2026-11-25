"""法人ユースケースの公開入出力モデルと Inbound Port。Presentation から Domain を隠蔽する。"""

from dataclasses import dataclass
from datetime import datetime
from typing import Protocol


@dataclass(frozen=True, slots=True)
class RegisterCorporationInput:
    """法人登録コマンドの入力。"""

    category: str
    name: str
    corporate_number: str | None = None
    address: str = ""


@dataclass(frozen=True, slots=True)
class UpdateCorporationInput:
    """法人基本情報更新コマンドの入力。"""

    name: str | None = None
    address: str | None = None
    corporate_number: str | None = None
    provided_fields: frozenset[str] | None = None


@dataclass(frozen=True, slots=True)
class ChangeCorporationStatusInput:
    """法人存続状態変更コマンドの入力。"""

    status: str


@dataclass(frozen=True, slots=True)
class ListCorporationsQuery:
    """法人一覧取得クエリの検索条件。"""

    category: str | None = None
    status: str | None = None
    query: str | None = None


@dataclass(frozen=True, slots=True)
class CorporationItem:
    """法人の公開用読み取り結果。"""

    id: str
    category: str
    name: str
    corporate_number: str | None
    address: str
    status: str
    created_at: datetime
    updated_at: datetime


@dataclass(frozen=True, slots=True)
class CorporationListResult:
    """法人一覧の公開用読み取り結果。"""

    items: tuple[CorporationItem, ...]
    total: int


class CorporationCommandPort(Protocol):
    """プレゼンテーション層へ公開する法人更新系（Command）ポート。"""

    def register_corporation(
        self,
        data: RegisterCorporationInput,
        *,
        corporation_id: str | None = None,
        now: datetime | None = None,
    ) -> CorporationItem:
        """新しい法人（または個人開設者）を登録する。"""
        ...

    def update_corporation(
        self,
        corporation_id: str,
        data: UpdateCorporationInput,
        *,
        now: datetime | None = None,
    ) -> CorporationItem:
        """既存法人の名称・所在地・法人番号を更新する。"""
        ...

    def change_status(
        self,
        corporation_id: str,
        data: ChangeCorporationStatusInput,
        *,
        now: datetime | None = None,
    ) -> CorporationItem:
        """法人の存続状態を変更する。"""
        ...


class CorporationQueryPort(Protocol):
    """プレゼンテーション層へ公開する法人参照系（Query）ポート。"""

    def get_corporation(self, corporation_id: str) -> CorporationItem:
        """指定 ID の法人を取得する。"""
        ...

    def list_corporations(self, query: ListCorporationsQuery) -> CorporationListResult:
        """条件に一致する法人一覧を取得する。"""
        ...
