"""システムベンダー認証・アカウント管理の参照系ユースケース。"""

from app.application.foundation.error_mappers import from_domain_error
from app.application.foundation.errors import ApplicationAuthenticationError
from app.application.vendor_auth.contracts import VendorUserListResult, VendorUserView
from app.application.vendor_auth.mappers import to_vendor_user_view
from app.application.vendor_auth.ports import VendorUserReadGateway
from app.domain.foundation.exceptions import DomainError
from app.domain.vendor_auth.identifiers import VendorUserId


class VendorUserQueryService:
    """ベンダーユーザーの参照系ユースケース。"""

    def __init__(self, *, read_gateway: VendorUserReadGateway) -> None:
        self._read_gateway = read_gateway

    def get_current_user(self, user_id: str) -> VendorUserView:
        """認証済み自身のユーザー情報を返す。"""
        try:
            parsed_id = VendorUserId.parse(user_id)
            user = self._read_gateway.get_by_id(parsed_id.value)
            if user is None:
                raise ApplicationAuthenticationError(
                    "認証情報が無効です。",
                    code="UNAUTHORIZED",
                )
            user.ensure_can_authenticate()
            return to_vendor_user_view(user)
        except DomainError as exc:
            raise from_domain_error(exc) from exc

    def list_vendor_users(self, actor_id: str) -> VendorUserListResult:
        """管理者権限でベンダーユーザー一覧を返す。"""
        try:
            parsed_id = VendorUserId.parse(actor_id)
            actor = self._read_gateway.get_by_id(parsed_id.value)
            if actor is None:
                raise ApplicationAuthenticationError(
                    "認証情報が無効です。",
                    code="UNAUTHORIZED",
                )
            actor.ensure_can_manage_vendor_users()
            users = self._read_gateway.list_all()
            views = tuple(to_vendor_user_view(user) for user in users)
            return VendorUserListResult(items=views, total=len(views))
        except DomainError as exc:
            raise from_domain_error(exc) from exc
