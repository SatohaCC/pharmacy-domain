"""corporations と corporation_history に representative_name カラムを追加する。"""

import sqlalchemy as sa
from alembic import op

revision = "0010_corp_representative_name"
down_revision = "0009_drop_relation_confirmation"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """corporations と corporation_history に representative_name を追加する。"""
    op.add_column(
        "corporations",
        sa.Column("representative_name", sa.Text(), nullable=False, server_default=""),
    )
    op.add_column(
        "corporation_history",
        sa.Column("representative_name", sa.Text(), nullable=False, server_default=""),
    )


def downgrade() -> None:
    """corporations と corporation_history から representative_name を削除する。"""
    op.drop_column("corporation_history", "representative_name")
    op.drop_column("corporations", "representative_name")
