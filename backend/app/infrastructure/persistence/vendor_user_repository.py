"""SQLAlchemy を用いた VendorUserRepository 実装。"""

from sqlalchemy import Connection, func, insert, select, update
from sqlalchemy.engine import RowMapping
from sqlalchemy.exc import IntegrityError

from app.domain.foundation.primitives import AwareDatetime
from app.domain.vendor_auth.entities import VendorUser
from app.domain.vendor_auth.exceptions import DuplicateVendorEmailError
from app.domain.vendor_auth.identifiers import VendorUserId
from app.domain.vendor_auth.primitives import (
    PasswordHash,
    VendorDisplayName,
    VendorEmail,
)
from app.domain.vendor_auth.value_objects import VendorRole, VendorUserStatus
from app.infrastructure.persistence.database import vendor_users_table


def row_to_vendor_user(row: RowMapping) -> VendorUser:
    """DB レコードを VendorUser エンティティへ復元する。"""
    created_by_raw = row["created_by"]
    return VendorUser(
        id=VendorUserId(str(row["id"])),
        email=VendorEmail(str(row["email"])),
        display_name=VendorDisplayName(str(row["display_name"])),
        role=VendorRole(str(row["role"])),
        status=VendorUserStatus(str(row["status"])),
        password_hash=PasswordHash(str(row["password_hash"])),
        created_at=AwareDatetime.parse(str(row["created_at"])),
        updated_at=AwareDatetime.parse(str(row["updated_at"])),
        created_by=VendorUserId(str(created_by_raw)) if created_by_raw is not None else None,
    )


class SqlAlchemyVendorUserRepository:
    """SQLAlchemy Core による VendorUser 永続化リポジトリ。"""

    def __init__(self, connection: Connection) -> None:
        self._connection = connection

    def count_all(self) -> int:
        """登録済みベンダーユーザーの総数を返す。"""
        stmt = select(func.count()).select_from(vendor_users_table)
        count = self._connection.execute(stmt).scalar_one()
        return int(count)

    def get_by_id(self, user_id: VendorUserId) -> VendorUser | None:
        """ID でベンダーユーザーを取得する。"""
        stmt = select(vendor_users_table).where(vendor_users_table.c.id == user_id.value)
        row = self._connection.execute(stmt).mappings().first()
        return row_to_vendor_user(row) if row is not None else None

    def get_by_email(self, email: VendorEmail) -> VendorUser | None:
        """メールアドレスでベンダーユーザーを取得する。"""
        stmt = select(vendor_users_table).where(vendor_users_table.c.email == email.value)
        row = self._connection.execute(stmt).mappings().first()
        return row_to_vendor_user(row) if row is not None else None

    def add(self, user: VendorUser) -> None:
        """新しいベンダーユーザーを INSERT する。"""
        stmt = insert(vendor_users_table).values(
            id=user.id.value,
            email=user.email.value,
            display_name=user.display_name.value,
            role=user.role.value,
            status=user.status.value,
            password_hash=user.password_hash.value,
            created_by=user.created_by.value if user.created_by is not None else None,
            created_at=user.created_at.value.isoformat(),
            updated_at=user.updated_at.value.isoformat(),
        )
        try:
            self._connection.execute(stmt)
        except IntegrityError as exc:
            raise DuplicateVendorEmailError(
                "このメールアドレスのベンダーユーザーは既に登録されています。",
                code="DUPLICATE_VENDOR_EMAIL",
            ) from exc

    def save(self, user: VendorUser) -> None:
        """既存ベンダーユーザーの更新を反映する。"""
        stmt = (
            update(vendor_users_table)
            .where(vendor_users_table.c.id == user.id.value)
            .values(
                display_name=user.display_name.value,
                role=user.role.value,
                status=user.status.value,
                password_hash=user.password_hash.value,
                updated_at=user.updated_at.value.isoformat(),
            )
        )
        self._connection.execute(stmt)
