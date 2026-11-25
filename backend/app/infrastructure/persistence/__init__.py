"""永続化アダプターパッケージ。"""

from app.infrastructure.persistence.corporation_query import SqlAlchemyCorporationQueryPort
from app.infrastructure.persistence.corporation_repository import (
    SqlAlchemyCorporationRepository,
)
from app.infrastructure.persistence.database import (
    corporations_table,
    create_app_engine,
    database_url,
    metadata,
    migration_connection,
)
from app.infrastructure.persistence.unit_of_work import (
    SqlAlchemyCorporationUnitOfWork,
    SqlAlchemyCorporationUnitOfWorkFactory,
)

__all__ = [
    "SqlAlchemyCorporationQueryPort",
    "SqlAlchemyCorporationRepository",
    "SqlAlchemyCorporationUnitOfWork",
    "SqlAlchemyCorporationUnitOfWorkFactory",
    "corporations_table",
    "create_app_engine",
    "database_url",
    "metadata",
    "migration_connection",
]
