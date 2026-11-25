"""法人参照系（Query）のユースケース実装。"""

from datetime import UTC, date, datetime

from app.application.corporate.contracts import (
    CorporationHistoryItem,
    CorporationItem,
    CorporationListResult,
    ListCorporationsQuery,
)
from app.application.corporate.mappers import (
    parse_category,
    parse_status,
    to_application_error,
    to_corporation_history_item,
)
from app.application.corporate.ports import CorporationQueryGateway
from app.application.foundation.errors import ApplicationNotFoundError
from app.domain.corporate.exceptions import CorporationNotFoundError
from app.domain.corporate.history import CorporationHistory
from app.domain.corporate.identifiers import CorporationId
from app.domain.foundation.exceptions import DomainError, DomainValidationError
from app.domain.foundation.primitives import AwareDatetime


class CorporationQueryService:
    """法人の詳細取得・一覧検索を担う Query サービス。"""

    def __init__(self, *, query_gateway: CorporationQueryGateway) -> None:
        self._query_gateway = query_gateway

    def get_corporation(self, corporation_id: str) -> CorporationItem:
        """指定 ID の法人を取得する。"""
        try:
            parsed_id = CorporationId.parse(corporation_id)
        except DomainError as exc:
            raise to_application_error(exc) from exc

        item = self._query_gateway.get_corporation(parsed_id.value)
        if item is None:
            raise ApplicationNotFoundError(
                "指定された法人が見つかりません。",
                code="CORPORATION_NOT_FOUND",
                details={"resource": "corporation"},
            )
        return item

    def get_corporation_at(
        self, corporation_id: str, as_of: date, recorded_as_of: datetime | None = None
    ) -> CorporationHistoryItem:
        """有効日と記録日時の両方を指定して法人の状態を取得する。"""
        try:
            recorded = None
            if recorded_as_of is not None:
                try:
                    recorded = AwareDatetime(AwareDatetime(recorded_as_of).value.astimezone(UTC))
                except OverflowError as exc:
                    raise DomainValidationError(
                        "記録日時が UTC の表現範囲を超えています。"
                    ) from exc
            record = self._get_history(corporation_id).at(as_of, recorded)
        except DomainError as exc:
            raise to_application_error(exc) from exc
        if record is None:
            raise ApplicationNotFoundError(
                "指定時点に確認できる法人情報がありません。", code="CORPORATION_HISTORY_NOT_FOUND"
            )
        return to_corporation_history_item(record)

    def list_history(self, corporation_id: str) -> tuple[CorporationHistoryItem, ...]:
        """法人の履歴を記録順に取得する。"""
        try:
            history = self._get_history(corporation_id)
        except DomainError as exc:
            raise to_application_error(exc) from exc
        return tuple(to_corporation_history_item(record) for record in history.records)

    def _get_history(self, corporation_id: str) -> CorporationHistory:
        records = self._query_gateway.get_history(CorporationId.parse(corporation_id))
        if records is None:
            raise CorporationNotFoundError()
        return CorporationHistory(records)

    def list_corporations(self, query: ListCorporationsQuery) -> CorporationListResult:
        """条件に一致する法人一覧を取得する。"""
        normalized_category = (
            parse_category(query.category).value if query.category is not None else None
        )
        normalized_status = parse_status(query.status).value if query.status is not None else None
        normalized_query = query.query.strip() if query.query is not None else None
        if normalized_query == "":
            normalized_query = None

        return self._query_gateway.list_corporations(
            ListCorporationsQuery(
                category=normalized_category,
                status=normalized_status,
                query=normalized_query,
            )
        )
