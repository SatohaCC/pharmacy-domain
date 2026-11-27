"""法人履歴と法人間関係改訂に変更者（recorded_by）カラムを追加する。"""

import sqlalchemy as sa
from alembic import op

revision = "0006_corporate_recorded_by"
down_revision = "0005_unified_auth_and_roles"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """corporation_history と corporate_relation_revisions に recorded_by を追加する。"""
    op.add_column("corporation_history", sa.Column("recorded_by", sa.Text(), nullable=True))
    op.add_column(
        "corporate_relation_revisions", sa.Column("recorded_by", sa.Text(), nullable=True)
    )


def downgrade() -> None:
    """recorded_by カラムを削除する。"""
    op.drop_column("corporate_relation_revisions", "recorded_by")
    op.drop_column("corporation_history", "recorded_by")
