"""法人履歴を追加し、既存法人の確認できる最新状態を取り込む。"""

import sqlalchemy as sa
from alembic import op

revision = "0003_corporation_history"
down_revision = "0002_corporate_relations"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """既存行を保持し、最後に確認できる日から履歴を開始する。"""
    op.create_table(
        "corporation_history",
        sa.Column("sequence", sa.Integer(), primary_key=True),
        sa.Column("corporation_id", sa.Text(), sa.ForeignKey("corporations.id"), nullable=False),
        sa.Column("valid_from", sa.Date(), nullable=False),
        sa.Column("valid_to", sa.Date()),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("corporate_number", sa.Text()),
        sa.Column("address", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("recorded_at", sa.Text(), nullable=False),
        sa.Column("kind", sa.Text(), nullable=False),
        sa.Column("evidence", sa.Text()),
        sa.Column("surviving_corporation_id", sa.Text(), sa.ForeignKey("corporations.id")),
        sa.CheckConstraint("valid_to IS NULL OR valid_from < valid_to"),
        sa.CheckConstraint("status IN ('active', 'dissolved', 'merged_out')"),
        sa.CheckConstraint(
            "surviving_corporation_id IS NULL OR surviving_corporation_id <> corporation_id"
        ),
    )
    op.create_index(
        "idx_corporation_history_records", "corporation_history", ["corporation_id", "sequence"]
    )
    dialect_name = op.get_bind().dialect.name
    valid_from_expr = (
        "(CAST(updated_at AS timestamptz) AT TIME ZONE 'Asia/Tokyo')::date"
        if dialect_name == "postgresql"
        else "date(updated_at, '+9 hours')"
    )
    op.execute(
        sa.text(
            "INSERT INTO corporation_history "
            "(corporation_id, valid_from, name, corporate_number, address, status, "
            "recorded_at, kind) "
            f"SELECT id, {valid_from_expr}, name, corporate_number, address, status, "
            "updated_at, 'legacy' FROM corporations"
        )
    )


def downgrade() -> None:
    """法人行を保持し、履歴テーブルを削除する。"""
    op.drop_table("corporation_history")
