"""法人間関係と適用期間付き改訂履歴のテーブルを追加する。"""

import sqlalchemy as sa
from alembic import op

revision = "0002_corporate_relations"
down_revision = "0001_create_corporations"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """既存の法人を参照する関係と、その改訂履歴を作成する。"""
    op.create_table(
        "corporate_relations",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column(
            "source_corporation_id", sa.Text(), sa.ForeignKey("corporations.id"), nullable=False
        ),
        sa.Column(
            "target_corporation_id", sa.Text(), sa.ForeignKey("corporations.id"), nullable=False
        ),
        sa.Column("relation_type", sa.Text(), nullable=False),
        sa.CheckConstraint("source_corporation_id <> target_corporation_id"),
        sa.CheckConstraint("relation_type IN ('parent_child', 'affiliate', 'fc_vc')"),
    )
    op.create_index(
        "idx_corporate_relations_source", "corporate_relations", ["source_corporation_id"]
    )
    op.create_index(
        "idx_corporate_relations_target", "corporate_relations", ["target_corporation_id"]
    )
    op.create_table(
        "corporate_relation_revisions",
        sa.Column(
            "relation_id", sa.Text(), sa.ForeignKey("corporate_relations.id"), primary_key=True
        ),
        sa.Column("recorded_at", sa.Text(), primary_key=True),
        sa.Column("valid_from", sa.Date(), nullable=False),
        sa.Column("valid_to", sa.Date()),
        sa.Column("evidence", sa.Text(), nullable=False),
        sa.Column("confirmation_status", sa.Text(), nullable=False),
        sa.CheckConstraint("valid_to IS NULL OR valid_from < valid_to"),
        sa.CheckConstraint("confirmation_status IN ('unverified', 'verified')"),
    )


def downgrade() -> None:
    """関係の参照順に改訂履歴と関係テーブルを取り除く。"""
    op.drop_table("corporate_relation_revisions")
    op.drop_index("idx_corporate_relations_target", table_name="corporate_relations")
    op.drop_index("idx_corporate_relations_source", table_name="corporate_relations")
    op.drop_table("corporate_relations")
