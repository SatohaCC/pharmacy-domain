"""タスクテーブルと作成日時インデックスを初期化する。"""

import sqlalchemy as sa
from alembic import op

revision = "0001_create_tasks"
down_revision = None
branch_labels = None
depends_on = None

_INDEX_NAME = "idx_tasks_created_at"
_INDEX_SQL = f"CREATE INDEX {_INDEX_NAME} ON tasks (created_at DESC)"
_STATUS_CHECK = "status IN ('open', 'done')"
_PRIORITY_CHECK = "priority IN ('low', 'medium', 'high')"


def _has_legacy_table() -> bool:
    if op.get_context().as_sql:
        return False

    connection = op.get_bind()
    inspector = sa.inspect(connection)
    if not inspector.has_table("tasks"):
        return False

    columns = inspector.get_columns("tasks")
    expected_columns = {
        "id",
        "title",
        "description",
        "status",
        "priority",
        "created_at",
        "updated_at",
    }
    pk = inspector.get_pk_constraint("tasks")["constrained_columns"]
    checks = {
        " ".join(check["sqltext"].split()) for check in inspector.get_check_constraints("tasks")
    }
    if (
        {column["name"] for column in columns} != expected_columns
        or pk != ["id"]
        or checks != {_STATUS_CHECK, _PRIORITY_CHECK}
        or any(
            not isinstance(column["type"], sa.Text)
            or (column["name"] != "id" and column["nullable"])
            for column in columns
        )
    ):
        raise RuntimeError("既存の tasks テーブルが初期スキーマと一致しません。")

    try:
        connection.exec_driver_sql("SELECT rowid FROM tasks LIMIT 0")
    except sa.exc.OperationalError as error:
        raise RuntimeError("既存の tasks テーブルに rowid がありません。") from error

    return True


def _create_tasks_index() -> None:
    if not op.get_context().as_sql:
        sql = op.get_bind().scalar(
            sa.text(
                "SELECT sql FROM sqlite_master WHERE type = 'index' AND name = :name COLLATE NOCASE"
            ),
            {"name": _INDEX_NAME},
        )
        if sql is not None:
            if " ".join(sql.split()).lower() != _INDEX_SQL.lower():
                raise RuntimeError("既存のタスクインデックスが初期スキーマと一致しません。")
            return
    op.create_index(_INDEX_NAME, "tasks", [sa.text("created_at DESC")])


def upgrade() -> None:
    """既存 DB の tasks を引き継ぎ、空の DB ではテーブルを作成する。"""
    if not _has_legacy_table():
        op.create_table(
            "tasks",
            sa.Column("id", sa.Text, primary_key=True, nullable=True),
            sa.Column("title", sa.Text, nullable=False),
            sa.Column("description", sa.Text, nullable=False),
            sa.Column("status", sa.Text, nullable=False),
            sa.Column("priority", sa.Text, nullable=False),
            sa.Column("created_at", sa.Text, nullable=False),
            sa.Column("updated_at", sa.Text, nullable=False),
            sa.CheckConstraint(_STATUS_CHECK),
            sa.CheckConstraint(_PRIORITY_CHECK),
        )
    _create_tasks_index()


def downgrade() -> None:
    """初期マイグレーションで管理するタスクテーブルを削除する。"""
    op.drop_index(_INDEX_NAME, table_name="tasks")
    op.drop_table("tasks")
