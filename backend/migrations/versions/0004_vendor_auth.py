"""システムベンダーユーザーおよびリフレッシュセッションテーブルを追加する。"""

import sqlalchemy as sa
from alembic import op

revision = "0004_vendor_auth"
down_revision = "0003_corporation_history"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """vendor_users と vendor_refresh_sessions テーブルを作成する。"""
    op.create_table(
        "vendor_users",
        sa.Column("id", sa.Text(), primary_key=True, nullable=False),
        sa.Column("email", sa.Text(), nullable=False, unique=True),
        sa.Column("display_name", sa.Text(), nullable=False),
        sa.Column("role", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column("created_by", sa.Text(), sa.ForeignKey("vendor_users.id"), nullable=True),
        sa.Column("created_at", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.Text(), nullable=False),
        sa.CheckConstraint("role IN ('admin', 'member')"),
        sa.CheckConstraint("status IN ('active', 'disabled')"),
    )
    op.create_index("idx_vendor_users_created_at", "vendor_users", [sa.text("created_at DESC")])

    op.create_table(
        "vendor_refresh_sessions",
        sa.Column("id", sa.Text(), primary_key=True, nullable=False),
        sa.Column("family_id", sa.Text(), nullable=False),
        sa.Column("vendor_user_id", sa.Text(), sa.ForeignKey("vendor_users.id"), nullable=False),
        sa.Column("token_hash", sa.Text(), nullable=False),
        sa.Column("issued_at", sa.Text(), nullable=False),
        sa.Column("expires_at", sa.Text(), nullable=False),
        sa.Column("rotated_at", sa.Text(), nullable=True),
        sa.Column("revoked_at", sa.Text(), nullable=True),
        sa.Column("replaced_by_session_id", sa.Text(), nullable=True),
    )
    op.create_index(
        "idx_vendor_refresh_sessions_family_id",
        "vendor_refresh_sessions",
        ["family_id"],
    )
    op.create_index(
        "idx_vendor_refresh_sessions_user_id",
        "vendor_refresh_sessions",
        ["vendor_user_id"],
    )


def downgrade() -> None:
    """vendor_refresh_sessions と vendor_users テーブルを削除する。"""
    op.drop_table("vendor_refresh_sessions")
    op.drop_table("vendor_users")
