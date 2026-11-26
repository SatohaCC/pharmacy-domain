"""SQLAlchemy を用いた共通認証ユーザー参照系 QueryPort 実装。"""

from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import Engine, select

from app.domain.auth.entities import RoleAssignment, User
from app.domain.auth.value_objects import AffiliationType
from app.domain.foundation.primitives import AwareDatetime
from app.infrastructure.persistence.auth_role_assignment_repository import row_to_role_assignment
from app.infrastructure.persistence.auth_user_repository import row_to_auth_user
from app.infrastructure.persistence.database import (
    auth_role_assignments_table,
    auth_users_table,
)


class SqlAlchemyAuthUserReadGateway:
    """AuthUserReadGateway の SQLAlchemy 実装。"""

    def __init__(self, engine: Engine) -> None:
        self._engine = engine

    def get_by_id(self, user_id: str) -> User | None:
        """ID でユーザーを取得する。"""
        stmt = select(auth_users_table).where(auth_users_table.c.id == user_id)
        with self._engine.connect() as connection:
            row = connection.execute(stmt).mappings().first()
            return row_to_auth_user(row) if row is not None else None

    def list_active_roles_for_user(self, user_id: str, now: datetime) -> Sequence[RoleAssignment]:
        """指定時点で有効なロール付与一覧を取得する。"""
        stmt = (
            select(auth_role_assignments_table)
            .where(
                auth_role_assignments_table.c.user_id == user_id,
                auth_role_assignments_table.c.revoked_at.is_(None),
            )
            .order_by(auth_role_assignments_table.c.granted_at.asc())
        )
        now_vo = AwareDatetime(now)
        with self._engine.connect() as connection:
            rows = connection.execute(stmt).mappings().all()
        return tuple(
            assignment
            for assignment in (row_to_role_assignment(row) for row in rows)
            if assignment.is_active_at(now_vo)
        )

    def list_by_affiliation(
        self,
        affiliation_type: AffiliationType,
        *,
        tenant_id: str | None = None,
    ) -> Sequence[User]:
        """指定所属のユーザー一覧を作成日時降順で取得する。"""
        stmt = select(auth_users_table).where(
            auth_users_table.c.affiliation_type == affiliation_type.value
        )
        if tenant_id is not None:
            stmt = stmt.where(auth_users_table.c.tenant_id == tenant_id)
        stmt = stmt.order_by(auth_users_table.c.created_at.desc())
        with self._engine.connect() as connection:
            rows = connection.execute(stmt).mappings().all()
            return tuple(row_to_auth_user(row) for row in rows)

    def list_active_roles_for_users(
        self, user_ids: Sequence[str], now: datetime
    ) -> Sequence[RoleAssignment]:
        """複数ユーザーの指定時点で有効なロール付与一覧を取得する。"""
        if not user_ids:
            return ()
        stmt = (
            select(auth_role_assignments_table)
            .where(
                auth_role_assignments_table.c.user_id.in_(list(user_ids)),
                auth_role_assignments_table.c.revoked_at.is_(None),
            )
            .order_by(auth_role_assignments_table.c.granted_at.asc())
        )
        now_vo = AwareDatetime(now)
        with self._engine.connect() as connection:
            rows = connection.execute(stmt).mappings().all()
        return tuple(
            assignment
            for assignment in (row_to_role_assignment(row) for row in rows)
            if assignment.is_active_at(now_vo)
        )
