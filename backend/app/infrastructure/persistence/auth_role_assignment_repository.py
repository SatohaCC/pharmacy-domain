"""SQLAlchemy を用いた RoleAssignmentRepository 実装。"""

from collections.abc import Sequence

from sqlalchemy import Connection, insert, select, update
from sqlalchemy.engine import RowMapping

from app.domain.auth.entities import RoleAssignment
from app.domain.auth.identifiers import RoleAssignmentId, TenantId, UserId
from app.domain.auth.value_objects import AffiliationType, AuthScope, RoleName
from app.domain.foundation.primitives import AwareDatetime
from app.infrastructure.persistence.database import auth_role_assignments_table


def row_to_role_assignment(row: RowMapping) -> RoleAssignment:
    """DB レコードを RoleAssignment エンティティへ復元する。"""
    tenant_raw = row["tenant_id"]
    valid_to_raw = row["valid_to"]
    revoked_raw = row["revoked_at"]
    granted_by_raw = row["granted_by"]
    scope = AuthScope(
        scope_type=AffiliationType(str(row["scope_type"])),
        tenant_id=TenantId(str(tenant_raw)) if tenant_raw is not None else None,
    )
    return RoleAssignment(
        id=RoleAssignmentId(str(row["id"])),
        user_id=UserId(str(row["user_id"])),
        role=RoleName(str(row["role"])),
        scope=scope,
        valid_from=AwareDatetime.parse(str(row["valid_from"])),
        valid_to=AwareDatetime.parse(str(valid_to_raw)) if valid_to_raw is not None else None,
        revoked_at=AwareDatetime.parse(str(revoked_raw)) if revoked_raw is not None else None,
        granted_by=UserId(str(granted_by_raw)) if granted_by_raw is not None else None,
        granted_at=AwareDatetime.parse(str(row["granted_at"])),
    )


class SqlAlchemyRoleAssignmentRepository:
    """SQLAlchemy Core による RoleAssignment 永続化リポジトリ。"""

    def __init__(self, connection: Connection) -> None:
        self._connection = connection

    def list_active_for_user(self, user_id: UserId, now: AwareDatetime) -> Sequence[RoleAssignment]:
        """指定時点で有効なロール付与一覧を返す。"""
        stmt = (
            select(auth_role_assignments_table)
            .where(
                auth_role_assignments_table.c.user_id == user_id.value,
                auth_role_assignments_table.c.revoked_at.is_(None),
            )
            .order_by(auth_role_assignments_table.c.granted_at.asc())
        )
        rows = self._connection.execute(stmt).mappings().all()
        assignments = [row_to_role_assignment(row) for row in rows]
        return tuple(item for item in assignments if item.is_active_at(now))

    def list_active_for_users(
        self, user_ids: Sequence[UserId], now: AwareDatetime
    ) -> Sequence[RoleAssignment]:
        """複数ユーザーの指定時点で有効なロール付与一覧を返す。"""
        if not user_ids:
            return ()
        stmt = (
            select(auth_role_assignments_table)
            .where(
                auth_role_assignments_table.c.user_id.in_([uid.value for uid in user_ids]),
                auth_role_assignments_table.c.revoked_at.is_(None),
            )
            .order_by(auth_role_assignments_table.c.granted_at.asc())
        )
        rows = self._connection.execute(stmt).mappings().all()
        assignments = [row_to_role_assignment(row) for row in rows]
        return tuple(item for item in assignments if item.is_active_at(now))

    def add(self, assignment: RoleAssignment) -> None:
        """新しいロール付与を INSERT する。"""
        stmt = insert(auth_role_assignments_table).values(
            id=assignment.id.value,
            user_id=assignment.user_id.value,
            role=assignment.role.value,
            scope_type=assignment.scope.scope_type.value,
            tenant_id=(assignment.scope.tenant_id.value if assignment.scope.tenant_id else None),
            valid_from=assignment.valid_from.value.isoformat(),
            valid_to=assignment.valid_to.value.isoformat() if assignment.valid_to else None,
            revoked_at=assignment.revoked_at.value.isoformat() if assignment.revoked_at else None,
            granted_by=assignment.granted_by.value if assignment.granted_by else None,
            granted_at=assignment.granted_at.value.isoformat(),
        )
        self._connection.execute(stmt)

    def save(self, assignment: RoleAssignment) -> None:
        """ロール付与の失効・有効期間変更を反映する。"""
        stmt = (
            update(auth_role_assignments_table)
            .where(auth_role_assignments_table.c.id == assignment.id.value)
            .values(
                valid_to=assignment.valid_to.value.isoformat() if assignment.valid_to else None,
                revoked_at=(
                    assignment.revoked_at.value.isoformat() if assignment.revoked_at else None
                ),
            )
        )
        self._connection.execute(stmt)

    def revoke_all_for_user(self, user_id: UserId, now: AwareDatetime) -> None:
        """指定ユーザーの未失効ロール付与をすべて即時失効させる。"""
        stmt = (
            update(auth_role_assignments_table)
            .where(
                auth_role_assignments_table.c.user_id == user_id.value,
                auth_role_assignments_table.c.revoked_at.is_(None),
            )
            .values(revoked_at=now.value.isoformat())
        )
        self._connection.execute(stmt)
