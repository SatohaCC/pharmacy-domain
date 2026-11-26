"""SQLAlchemy を用いたベンダーユーザー参照系 QueryPort 実装。"""

from collections.abc import Sequence

from sqlalchemy import Engine, select

from app.domain.vendor_auth.entities import VendorUser
from app.infrastructure.persistence.database import vendor_users_table
from app.infrastructure.persistence.vendor_user_repository import row_to_vendor_user


class SqlAlchemyVendorUserReadGateway:
    """VendorUserReadGateway の SQLAlchemy 実装。"""

    def __init__(self, engine: Engine) -> None:
        self._engine = engine

    def get_by_id(self, user_id: str) -> VendorUser | None:
        """ID でベンダーユーザーを取得する。"""
        stmt = select(vendor_users_table).where(vendor_users_table.c.id == user_id)
        with self._engine.connect() as connection:
            row = connection.execute(stmt).mappings().first()
            return row_to_vendor_user(row) if row is not None else None

    def list_all(self) -> Sequence[VendorUser]:
        """登録済みベンダーユーザー一覧を作成日時降順で返す。"""
        stmt = select(vendor_users_table).order_by(vendor_users_table.c.created_at.desc())
        with self._engine.connect() as connection:
            rows = connection.execute(stmt).mappings().all()
            return tuple(row_to_vendor_user(row) for row in rows)
