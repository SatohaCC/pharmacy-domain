"""SQLAlchemy を用いた AuthUserRepository 実装。"""

from sqlalchemy import Connection, and_, func, insert, select, update
from sqlalchemy.engine import RowMapping
from sqlalchemy.exc import IntegrityError

from app.domain.auth.entities import User
from app.domain.auth.exceptions import DuplicateUserEmailError
from app.domain.auth.identifiers import TenantId, UserId
from app.domain.auth.primitives import PasswordHash, UserDisplayName, UserEmail
from app.domain.auth.value_objects import AffiliationType, AuthScope, UserStatus
from app.domain.foundation.primitives import AwareDatetime
from app.infrastructure.persistence.database import auth_users_table


def row_to_auth_user(row: RowMapping) -> User:
    """DB レコードを User エンティティへ復元する。"""
    affiliation_type = AffiliationType(str(row["affiliation_type"]))
    tenant_raw = row["tenant_id"]
    created_by_raw = row["created_by"]
    affiliation = AuthScope(
        scope_type=affiliation_type,
        tenant_id=TenantId(str(tenant_raw)) if tenant_raw is not None else None,
    )
    return User(
        id=UserId(str(row["id"])),
        email=UserEmail(str(row["email"])),
        display_name=UserDisplayName(str(row["display_name"])),
        affiliation=affiliation,
        status=UserStatus(str(row["status"])),
        password_hash=PasswordHash(str(row["password_hash"])),
        created_at=AwareDatetime.parse(str(row["created_at"])),
        updated_at=AwareDatetime.parse(str(row["updated_at"])),
        created_by=UserId(str(created_by_raw)) if created_by_raw is not None else None,
    )


class SqlAlchemyAuthUserRepository:
    """SQLAlchemy Core による User 永続化リポジトリ。"""

    def __init__(self, connection: Connection) -> None:
        self._connection = connection

    def count_by_affiliation(self, affiliation_type: AffiliationType) -> int:
        """指定所属種別の登録済みユーザー数を返す。"""
        stmt = (
            select(func.count())
            .select_from(auth_users_table)
            .where(auth_users_table.c.affiliation_type == affiliation_type.value)
        )
        return int(self._connection.execute(stmt).scalar_one())

    def get_by_id(self, user_id: UserId) -> User | None:
        """ID でユーザーを取得する。"""
        stmt = select(auth_users_table).where(auth_users_table.c.id == user_id.value)
        row = self._connection.execute(stmt).mappings().first()
        return row_to_auth_user(row) if row is not None else None

    def get_by_email_in_scope(self, email: UserEmail, scope: AuthScope) -> User | None:
        """指定スコープ内でメールアドレスが一致するユーザーを取得する。"""
        if scope.scope_type == AffiliationType.VENDOR:
            condition = and_(
                auth_users_table.c.affiliation_type == AffiliationType.VENDOR.value,
                auth_users_table.c.email == email.value,
            )
        else:
            assert scope.tenant_id is not None
            condition = and_(
                auth_users_table.c.affiliation_type == AffiliationType.TENANT.value,
                auth_users_table.c.tenant_id == scope.tenant_id.value,
                auth_users_table.c.email == email.value,
            )
        stmt = select(auth_users_table).where(condition)
        row = self._connection.execute(stmt).mappings().first()
        return row_to_auth_user(row) if row is not None else None

    def add(self, user: User) -> None:
        """新しいユーザーを INSERT する。"""
        stmt = insert(auth_users_table).values(
            id=user.id.value,
            email=user.email.value,
            display_name=user.display_name.value,
            affiliation_type=user.affiliation.scope_type.value,
            tenant_id=user.affiliation.tenant_id.value if user.affiliation.tenant_id else None,
            status=user.status.value,
            password_hash=user.password_hash.value,
            created_by=user.created_by.value if user.created_by is not None else None,
            created_at=user.created_at.value.isoformat(),
            updated_at=user.updated_at.value.isoformat(),
        )
        try:
            self._connection.execute(stmt)
        except IntegrityError as exc:
            raise DuplicateUserEmailError(
                "このメールアドレスのユーザーは既に登録されています。",
                code="DUPLICATE_VENDOR_EMAIL"
                if user.affiliation.scope_type == AffiliationType.VENDOR
                else "DUPLICATE_USER_EMAIL",
            ) from exc

    def save(self, user: User) -> None:
        """既存ユーザーの変更を保存する。"""
        stmt = (
            update(auth_users_table)
            .where(auth_users_table.c.id == user.id.value)
            .values(
                display_name=user.display_name.value,
                status=user.status.value,
                password_hash=user.password_hash.value,
                updated_at=user.updated_at.value.isoformat(),
            )
        )
        self._connection.execute(stmt)
