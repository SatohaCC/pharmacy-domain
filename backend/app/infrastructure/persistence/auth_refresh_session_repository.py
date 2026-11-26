"""SQLAlchemy を用いた RefreshSessionRepository 実装。"""

from sqlalchemy import Connection, insert, select, update
from sqlalchemy.engine import RowMapping

from app.domain.auth.entities import RefreshSession
from app.domain.auth.identifiers import (
    RefreshSessionId,
    RefreshTokenFamilyId,
    TenantId,
    UserId,
)
from app.domain.auth.primitives import TokenHash
from app.domain.auth.value_objects import AffiliationType, AuthScope
from app.domain.foundation.primitives import AwareDatetime
from app.infrastructure.persistence.database import auth_refresh_sessions_table


def _row_to_refresh_session(row: RowMapping) -> RefreshSession:
    tenant_raw = row["tenant_id"]
    rotated_raw = row["rotated_at"]
    revoked_raw = row["revoked_at"]
    replaced_raw = row["replaced_by_session_id"]
    scope = AuthScope(
        scope_type=AffiliationType(str(row["scope_type"])),
        tenant_id=TenantId(str(tenant_raw)) if tenant_raw is not None else None,
    )
    return RefreshSession(
        id=RefreshSessionId(str(row["id"])),
        family_id=RefreshTokenFamilyId(str(row["family_id"])),
        user_id=UserId(str(row["user_id"])),
        scope=scope,
        token_hash=TokenHash(str(row["token_hash"])),
        issued_at=AwareDatetime.parse(str(row["issued_at"])),
        expires_at=AwareDatetime.parse(str(row["expires_at"])),
        rotated_at=AwareDatetime.parse(str(rotated_raw)) if rotated_raw is not None else None,
        revoked_at=AwareDatetime.parse(str(revoked_raw)) if revoked_raw is not None else None,
        replaced_by_session_id=(
            RefreshSessionId(str(replaced_raw)) if replaced_raw is not None else None
        ),
    )


class SqlAlchemyRefreshSessionRepository:
    """SQLAlchemy Core による RefreshSession 永続化リポジトリ。"""

    def __init__(self, connection: Connection) -> None:
        self._connection = connection

    def get_by_id(self, session_id: RefreshSessionId) -> RefreshSession | None:
        """セッション ID でリフレッシュセッションを取得する。"""
        stmt = select(auth_refresh_sessions_table).where(
            auth_refresh_sessions_table.c.id == session_id.value
        )
        row = self._connection.execute(stmt).mappings().first()
        return _row_to_refresh_session(row) if row is not None else None

    def add(self, session: RefreshSession) -> None:
        """新しいリフレッシュセッションを INSERT する。"""
        stmt = insert(auth_refresh_sessions_table).values(
            id=session.id.value,
            family_id=session.family_id.value,
            user_id=session.user_id.value,
            scope_type=session.scope.scope_type.value,
            tenant_id=session.scope.tenant_id.value if session.scope.tenant_id else None,
            token_hash=session.token_hash.value,
            issued_at=session.issued_at.value.isoformat(),
            expires_at=session.expires_at.value.isoformat(),
            rotated_at=session.rotated_at.value.isoformat() if session.rotated_at else None,
            revoked_at=session.revoked_at.value.isoformat() if session.revoked_at else None,
            replaced_by_session_id=(
                session.replaced_by_session_id.value if session.replaced_by_session_id else None
            ),
        )
        self._connection.execute(stmt)

    def save(self, session: RefreshSession) -> None:
        """リフレッシュセッションの更新を反映する。"""
        stmt = (
            update(auth_refresh_sessions_table)
            .where(auth_refresh_sessions_table.c.id == session.id.value)
            .values(
                rotated_at=session.rotated_at.value.isoformat() if session.rotated_at else None,
                revoked_at=session.revoked_at.value.isoformat() if session.revoked_at else None,
                replaced_by_session_id=(
                    session.replaced_by_session_id.value if session.replaced_by_session_id else None
                ),
            )
        )
        self._connection.execute(stmt)

    def revoke_family(self, family_id: RefreshTokenFamilyId, now: AwareDatetime) -> None:
        """同一ファミリーの全未失効セッションを即時失効させる。"""
        stmt = (
            update(auth_refresh_sessions_table)
            .where(
                auth_refresh_sessions_table.c.family_id == family_id.value,
                auth_refresh_sessions_table.c.revoked_at.is_(None),
            )
            .values(revoked_at=now.value.isoformat())
        )
        self._connection.execute(stmt)

    def revoke_all_for_user(self, user_id: UserId, now: AwareDatetime) -> None:
        """指定ユーザーの全未失効セッションを即時失効させる。"""
        stmt = (
            update(auth_refresh_sessions_table)
            .where(
                auth_refresh_sessions_table.c.user_id == user_id.value,
                auth_refresh_sessions_table.c.revoked_at.is_(None),
            )
            .values(revoked_at=now.value.isoformat())
        )
        self._connection.execute(stmt)
