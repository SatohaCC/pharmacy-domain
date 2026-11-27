"""法人と法人履歴にシステム利用状態（usage_status）カラムを追加する。"""

import sqlalchemy as sa
from alembic import op

revision = "0007_corporate_usage_status"
down_revision = "0006_corporate_recorded_by"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """corporations と corporation_history に usage_status を追加する。"""
    op.add_column(
        "corporations",
        sa.Column("usage_status", sa.Text(), nullable=False, server_default="not_started"),
    )
    op.add_column(
        "corporation_history",
        sa.Column("usage_status", sa.Text(), nullable=False, server_default="not_started"),
    )


def downgrade() -> None:
    """usage_status カラムを削除する。"""
    op.drop_column("corporation_history", "usage_status")
    op.drop_column("corporations", "usage_status")
