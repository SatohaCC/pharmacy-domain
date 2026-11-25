"""法人参照系（Query）のユースケース実装。"""

from app.application.corporate.contracts import (
    CorporationItem,
    CorporationListResult,
    ListCorporationsQuery,
)
from app.application.corporate.mappers import (
    parse_category,
    parse_status,
    to_application_error,
)
from app.application.corporate.ports import CorporationQueryGateway
from app.application.foundation.errors import ApplicationNotFoundError
from app.domain.corporate.identifiers import CorporationId
from app.domain.foundation.exceptions import DomainError


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
