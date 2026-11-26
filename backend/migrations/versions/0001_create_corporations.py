"""法人テーブルとインデックスを初期化する。"""

import sqlalchemy as sa
from alembic import op

revision = "0001_create_corporations"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    """法人テーブルを作成する。"""
    op.create_table(
        "corporations",
        sa.Column("id", sa.Text, primary_key=True, nullable=False),
        sa.Column("category", sa.Text, nullable=False),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("corporate_number", sa.Text, nullable=True),
        sa.Column("address", sa.Text, nullable=False),
        sa.Column("status", sa.Text, nullable=False),
        sa.Column("created_at", sa.Text, nullable=False),
        sa.Column("updated_at", sa.Text, nullable=False),
        sa.CheckConstraint("category IN ('corporation', 'individual')"),
        sa.CheckConstraint("status IN ('active', 'dissolved', 'merged_out')"),
        sa.CheckConstraint("NOT (category = 'individual' AND corporate_number IS NOT NULL)"),
    )
    op.create_index("idx_corporations_created_at", "corporations", [sa.text("created_at DESC")])
    op.create_index(
        "uq_corporations_corporate_number",
        "corporations",
        ["corporate_number"],
        unique=True,
        sqlite_where=sa.text("corporate_number IS NOT NULL"),
        postgresql_where=sa.text("corporate_number IS NOT NULL"),
    )


def downgrade() -> None:
    """法人テーブルを削除する。"""
    op.drop_index("uq_corporations_corporate_number", table_name="corporations")
    op.drop_index("idx_corporations_created_at", table_name="corporations")
    op.drop_table("corporations")
