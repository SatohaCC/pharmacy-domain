"""corporate_relation_revisions から confirmation_status カラムを削除する。"""

import sqlalchemy as sa
from alembic import op

revision = "0009_drop_relation_confirmation"
down_revision = "0008_usage_status_checks"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """corporate_relation_revisions.confirmation_status を削除する。"""
    if op.get_bind().dialect.name == "postgresql":
        op.drop_column("corporate_relation_revisions", "confirmation_status")
    else:
        with op.batch_alter_table(
            "corporate_relation_revisions",
            table_args=(sa.CheckConstraint("valid_to IS NULL OR valid_from < valid_to"),),
        ) as batch_op:
            batch_op.drop_column("confirmation_status")


def downgrade() -> None:
    """corporate_relation_revisions.confirmation_status を復元する。"""
    op.add_column(
        "corporate_relation_revisions",
        sa.Column("confirmation_status", sa.Text(), nullable=False, server_default="unverified"),
    )
    if op.get_bind().dialect.name == "postgresql":
        op.create_check_constraint(
            "ck_corporate_relation_revisions_confirmation_status",
            "corporate_relation_revisions",
            "confirmation_status IN ('unverified', 'verified')",
        )
