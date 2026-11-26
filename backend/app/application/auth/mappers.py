"""共通認証ドメインモデルと公開契約 DTO の変換マッパー。"""

from collections.abc import Sequence

from app.application.auth.contracts import (
    AuthPrincipal,
    AuthUserView,
    RoleNameLiteral,
)
from app.domain.auth.entities import RoleAssignment, User
from app.domain.auth.value_objects import RoleName


def _to_role_literals(assignments: Sequence[RoleAssignment]) -> tuple[RoleNameLiteral, ...]:
    seen: list[RoleNameLiteral] = []
    for assignment in assignments:
        role_val: RoleNameLiteral = assignment.role.value  # type: ignore[assignment]
        if role_val not in seen:
            seen.append(role_val)
    return tuple(seen)


def _to_role_literals_from_names(roles: Sequence[RoleName]) -> tuple[RoleNameLiteral, ...]:
    return tuple(role.value for role in roles)  # type: ignore[misc]


def to_auth_user_view(user: User, assignments: Sequence[RoleAssignment]) -> AuthUserView:
    """User と有効ロール付与一覧を公開用 AuthUserView へ変換する。"""
    return AuthUserView(
        id=user.id.value,
        email=user.email.value,
        display_name=user.display_name.value,
        affiliation_type=user.affiliation.scope_type.value,  # type: ignore[arg-type]
        tenant_id=user.affiliation.tenant_id.value if user.affiliation.tenant_id else None,
        roles=_to_role_literals(assignments),
        status=user.status.value,  # type: ignore[arg-type]
        created_at=user.created_at.value,
        updated_at=user.updated_at.value,
    )


def to_auth_principal(user: User, assignments: Sequence[RoleAssignment]) -> AuthPrincipal:
    """User と最新有効ロール一覧を認証主体 AuthPrincipal へ変換する。"""
    return AuthPrincipal(
        user_id=user.id.value,
        email=user.email.value,
        display_name=user.display_name.value,
        scope_type=user.affiliation.scope_type.value,  # type: ignore[arg-type]
        tenant_id=user.affiliation.tenant_id.value if user.affiliation.tenant_id else None,
        roles=_to_role_literals(assignments),
    )


def extract_role_names(assignments: Sequence[RoleAssignment]) -> tuple[RoleName, ...]:
    """有効ロール付与一覧から重複なしの RoleName タプルを抽出する。"""
    seen: list[RoleName] = []
    for assignment in assignments:
        if assignment.role not in seen:
            seen.append(assignment.role)
    return tuple(seen)
