"""PostgreSQL 向けに corporations / corporation_history の usage_status CHECK 制約を追加する。"""

from alembic import op

revision = "0008_usage_status_checks"
down_revision = "0007_corporate_usage_status"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """PostgreSQL 環境で usage_status CHECK 制約を追加する。"""
    if op.get_bind().dialect.name == "postgresql":
        op.create_check_constraint(
            "ck_corporations_usage_status",
            "corporations",
            "usage_status IN ('not_started', 'active', 'suspended')",
        )
        op.create_check_constraint(
            "ck_corporation_history_usage_status",
            "corporation_history",
            "usage_status IN ('not_started', 'active', 'suspended')",
        )


def downgrade() -> None:
    """PostgreSQL 環境の usage_status CHECK 制約を削除する。"""
    if op.get_bind().dialect.name == "postgresql":
        op.drop_constraint(
            "ck_corporation_history_usage_status",
            "corporation_history",
            type_="check",
        )
        op.drop_constraint(
            "ck_corporations_usage_status",
            "corporations",
            type_="check",
        )
