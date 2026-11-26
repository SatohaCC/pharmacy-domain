"""共通認証・アカウント管理の参照系ユースケース。"""

from app.application.auth.contracts import AuthUserListResult, AuthUserView
from app.application.auth.mappers import extract_role_names, to_auth_user_view
from app.application.auth.ports import AuthUserReadGateway
from app.application.foundation.error_mappers import from_domain_error
from app.application.foundation.errors import (
    ApplicationAuthenticationError,
    ApplicationAuthorizationError,
)
from app.application.foundation.ports import Clock
from app.domain.auth.entities import RoleAssignment
from app.domain.auth.identifiers import UserId
from app.domain.auth.value_objects import AffiliationType, AuthScope, RoleName
from app.domain.foundation.exceptions import DomainError


class AuthUserQueryService:
    """共通認証ユーザーの参照系ユースケース。"""

    def __init__(self, *, read_gateway: AuthUserReadGateway, clock: Clock) -> None:
        self._read_gateway = read_gateway
        self._clock = clock

    def get_current_user(self, user_id: str) -> AuthUserView:
        """認証済み自身のユーザー情報と最新有効ロールを返す。"""
        try:
            parsed_id = UserId.parse(user_id)
            user = self._read_gateway.get_by_id(parsed_id.value)
            if user is None:
                raise ApplicationAuthenticationError(
                    "認証情報が無効です。",
                    code="UNAUTHORIZED",
                )
            user.ensure_can_authenticate()
            now_dt = self._clock.now()
            assignments = self._read_gateway.list_active_roles_for_user(user.id.value, now_dt)
            return to_auth_user_view(user, assignments)
        except DomainError as exc:
            raise from_domain_error(exc) from exc

    def list_vendor_users(self, actor_id: str) -> AuthUserListResult:
        """ベンダー管理者権限でベンダー所属ユーザー一覧を返す。"""
        try:
            parsed_id = UserId.parse(actor_id)
            actor = self._read_gateway.get_by_id(parsed_id.value)
            if actor is None:
                raise ApplicationAuthenticationError(
                    "認証情報が無効です。",
                    code="UNAUTHORIZED",
                )
            try:
                actor.ensure_can_authenticate()
            except DomainError as exc:
                raise ApplicationAuthorizationError(
                    "この操作にはシステムベンダー管理者権限が必要です。",
                    code="VENDOR_ADMIN_REQUIRED",
                ) from exc

            now_dt = self._clock.now()
            actor_roles = self._read_gateway.list_active_roles_for_user(actor.id.value, now_dt)
            if (
                actor.affiliation != AuthScope.vendor()
                or RoleName.VENDOR_ADMIN not in extract_role_names(actor_roles)
            ):
                raise ApplicationAuthorizationError(
                    "この操作にはシステムベンダー管理者権限が必要です。",
                    code="VENDOR_ADMIN_REQUIRED",
                )

            users = self._read_gateway.list_by_affiliation(AffiliationType.VENDOR)
            all_assignments = self._read_gateway.list_active_roles_for_users(
                [user.id.value for user in users],
                now_dt,
            )
            by_user: dict[str, list[RoleAssignment]] = {}
            for assignment in all_assignments:
                by_user.setdefault(assignment.user_id.value, []).append(assignment)

            views = tuple(to_auth_user_view(user, by_user.get(user.id.value, ())) for user in users)
            return AuthUserListResult(items=views, total=len(views))
        except DomainError as exc:
            raise from_domain_error(exc) from exc
