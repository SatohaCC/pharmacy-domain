"""法人ユースケースの公開入出力モデルと Inbound Port。Presentation から Domain を隠蔽する。"""

from dataclasses import dataclass
from datetime import date, datetime
from typing import Protocol


@dataclass(frozen=True, slots=True)
class RegisterCorporationInput:
    """法人登録コマンドの入力。"""

    category: str
    name: str
    corporate_number: str | None = None
    address: str = ""
    valid_from: date | None = None
    valid_to: date | None = None
    evidence: str | None = None
    recorded_by: str | None = None


@dataclass(frozen=True, slots=True)
class UpdateCorporationInput:
    """法人基本情報更新コマンドの入力。"""

    name: str | None = None
    address: str | None = None
    corporate_number: str | None = None
    provided_fields: frozenset[str] | None = None
    valid_from: date | None = None
    valid_to: date | None = None
    evidence: str | None = None
    recorded_by: str | None = None


@dataclass(frozen=True, slots=True)
class ChangeCorporationStatusInput:
    """法人存続状態変更コマンドの入力。"""

    status: str
    effective_date: date | None = None
    evidence: str | None = None
    surviving_corporation_id: str | None = None
    recorded_by: str | None = None


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
    valid_from: date | None = None
    valid_to: date | None = None


@dataclass(frozen=True, slots=True)
class CorporationListResult:
    """法人一覧の公開用読み取り結果。"""

    items: tuple[CorporationItem, ...]
    total: int


@dataclass(frozen=True, slots=True)
class CorporationHistoryItem:
    """有効期間・記録日時・根拠を持つ法人の履歴項目。"""

    corporation: CorporationItem
    valid_from: date
    valid_to: date | None
    recorded_at: datetime
    kind: str
    evidence: str | None
    surviving_corporation_id: str | None
    recorded_by: str | None = None


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

    def correct_history(
        self, corporation_id: str, as_of: date, data: UpdateCorporationInput
    ) -> CorporationHistoryItem:
        """指定日で有効だった基本情報を訂正し、訂正前の履歴を保持する。"""
        ...


class CorporationQueryPort(Protocol):
    """プレゼンテーション層へ公開する法人参照系（Query）ポート。"""

    def get_corporation(self, corporation_id: str) -> CorporationItem:
        """指定 ID の法人を取得する。"""
        ...

    def list_corporations(self, query: ListCorporationsQuery) -> CorporationListResult:
        """条件に一致する法人一覧を取得する。"""
        ...

    def get_corporation_at(
        self, corporation_id: str, as_of: date, recorded_as_of: datetime | None = None
    ) -> CorporationHistoryItem:
        """指定日時点に把握していた法人を取得する。"""
        ...

    def list_history(self, corporation_id: str) -> tuple[CorporationHistoryItem, ...]:
        """法人の履歴を記録順で返す。"""
        ...


@dataclass(frozen=True, slots=True)
class RegisterCorporateRelationInput:
    """法人間関係の登録入力。親子関係の関係元は親法人。"""

    source_corporation_id: str
    target_corporation_id: str
    relation_type: str
    valid_from: date
    evidence: str
    valid_to: date | None = None
    confirmation_status: str = "unverified"
    recorded_by: str | None = None


@dataclass(frozen=True, slots=True)
class CorrectCorporateRelationInput:
    """法人間関係の部分訂正入力。終了日の明示的な null は終了未定を表す。"""

    valid_from: date | None = None
    valid_to: date | None = None
    evidence: str | None = None
    confirmation_status: str | None = None
    provided_fields: frozenset[str] | None = None
    recorded_by: str | None = None


@dataclass(frozen=True, slots=True)
class ListCorporateRelationsQuery:
    """法人間関係の検索条件。法人 ID は関係の両端に対して照合する。"""

    corporation_id: str | None = None
    as_of: date | None = None
    recorded_as_of: datetime | None = None
    relation_type: str | None = None
    confirmation_status: str | None = None


@dataclass(frozen=True, slots=True)
class CorporateRelationRevisionItem:
    """法人間関係の記録一件。"""

    valid_from: date
    valid_to: date | None
    evidence: str
    confirmation_status: str
    recorded_at: datetime
    recorded_by: str | None


@dataclass(frozen=True, slots=True)
class CorporateRelationItem(CorporateRelationRevisionItem):
    """法人間関係の指定された改訂時点での状態。"""

    id: str
    source_corporation_id: str
    target_corporation_id: str
    relation_type: str


class CorporateRelationCommandPort(Protocol):
    """法人間関係の更新を公開する。"""

    def register_relation(self, data: RegisterCorporateRelationInput) -> CorporateRelationItem:
        """法人間関係を登録する。"""
        ...

    def correct_relation(
        self, relation_id: str, data: CorrectCorporateRelationInput
    ) -> CorporateRelationItem:
        """指定の関係に訂正記録を追加する。"""
        ...

    def end_relation(
        self,
        relation_id: str,
        end_date: date,
        *,
        recorded_by: str | None = None,
    ) -> CorporateRelationItem:
        """指定の関係を有効終了日で終了する。"""
        ...


class CorporateRelationQueryPort(Protocol):
    """法人間関係と改訂履歴の読み取りを公開する。"""

    def get_relation(
        self, relation_id: str, recorded_as_of: datetime | None = None
    ) -> CorporateRelationItem:
        """指定の記録時点における関係を返す。"""
        ...

    def list_relations(
        self, query: ListCorporateRelationsQuery
    ) -> tuple[CorporateRelationItem, ...]:
        """法人と有効日で絞り込んだ関係を返す。"""
        ...

    def list_revisions(self, relation_id: str) -> tuple[CorporateRelationRevisionItem, ...]:
        """指定の関係の改訂を記録日時順に返す。"""
        ...
