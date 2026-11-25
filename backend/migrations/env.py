from alembic import context
from sqlalchemy.engine import Connection

from app.infrastructure.config import load_settings
from app.infrastructure.persistence.database import (
    create_app_engine,
    database_url,
    metadata,
    migration_connection,
)


def run_with_connection(connection: Connection) -> None:
    """既存接続を使ってマイグレーションを実行する。"""
    context.configure(connection=connection, target_metadata=metadata)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations() -> None:
    """オンライン／オフラインモードに応じてマイグレーションを実行する。"""
    connection = context.config.attributes.get("connection")
    if connection is not None:
        run_with_connection(connection)
        return

    database_path = load_settings().database_path
    if context.is_offline_mode():
        context.configure(url=database_url(database_path), target_metadata=metadata)
        with context.begin_transaction():
            context.run_migrations()
        return

    engine = create_app_engine(database_path)
    try:
        with migration_connection(engine) as connection:
            run_with_connection(connection)
    finally:
        engine.dispose()


run_migrations()
