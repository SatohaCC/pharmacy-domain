"""共通認証・スコープ付きロールテーブルを追加し既存ベンダー認証データを移行する。"""

import sqlalchemy as sa
from alembic import op

revision = "0005_unified_auth_and_roles"
down_revision = "0004_vendor_auth"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """auth_users / auth_role_assignments / auth_refresh_sessions を作成し既存データを移行する。"""
    op.create_table(
        "auth_users",
        sa.Column("id", sa.Text(), primary_key=True, nullable=False),
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column("display_name", sa.Text(), nullable=False),
        sa.Column("affiliation_type", sa.Text(), nullable=False),
        sa.Column("tenant_id", sa.Text(), sa.ForeignKey("corporations.id"), nullable=True),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column("created_by", sa.Text(), sa.ForeignKey("auth_users.id"), nullable=True),
        sa.Column("created_at", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.Text(), nullable=False),
        sa.CheckConstraint("affiliation_type IN ('vendor', 'tenant')"),
        sa.CheckConstraint(
            "(affiliation_type = 'vendor' AND tenant_id IS NULL) OR "
            "(affiliation_type = 'tenant' AND tenant_id IS NOT NULL)"
        ),
        sa.CheckConstraint("status IN ('active', 'disabled')"),
    )
    op.create_index("idx_auth_users_created_at", "auth_users", [sa.text("created_at DESC")])
    op.create_index(
        "uq_auth_users_vendor_email",
        "auth_users",
        ["email"],
        unique=True,
        sqlite_where=sa.text("affiliation_type = 'vendor'"),
    )
    op.create_index(
        "uq_auth_users_tenant_email",
        "auth_users",
        ["tenant_id", "email"],
        unique=True,
        sqlite_where=sa.text("affiliation_type = 'tenant'"),
    )

    op.create_table(
        "auth_role_assignments",
        sa.Column("id", sa.Text(), primary_key=True, nullable=False),
        sa.Column("user_id", sa.Text(), sa.ForeignKey("auth_users.id"), nullable=False),
        sa.Column("role", sa.Text(), nullable=False),
        sa.Column("scope_type", sa.Text(), nullable=False),
        sa.Column("tenant_id", sa.Text(), sa.ForeignKey("corporations.id"), nullable=True),
        sa.Column("valid_from", sa.Text(), nullable=False),
        sa.Column("valid_to", sa.Text(), nullable=True),
        sa.Column("revoked_at", sa.Text(), nullable=True),
        sa.Column("granted_by", sa.Text(), sa.ForeignKey("auth_users.id"), nullable=True),
        sa.Column("granted_at", sa.Text(), nullable=False),
        sa.CheckConstraint("scope_type IN ('vendor', 'tenant')"),
        sa.CheckConstraint(
            "(scope_type = 'vendor' AND tenant_id IS NULL AND "
            "role IN ('vendor_admin', 'vendor_member')) OR "
            "(scope_type = 'tenant' AND tenant_id IS NOT NULL AND "
            "role IN ('tenant_admin', 'pharmacist', 'clerk'))"
        ),
        sa.CheckConstraint("valid_to IS NULL OR valid_from < valid_to"),
    )
    op.create_index("idx_auth_role_assignments_user_id", "auth_role_assignments", ["user_id"])

    op.create_table(
        "auth_refresh_sessions",
        sa.Column("id", sa.Text(), primary_key=True, nullable=False),
        sa.Column("family_id", sa.Text(), nullable=False),
        sa.Column("user_id", sa.Text(), sa.ForeignKey("auth_users.id"), nullable=False),
        sa.Column("scope_type", sa.Text(), nullable=False),
        sa.Column("tenant_id", sa.Text(), sa.ForeignKey("corporations.id"), nullable=True),
        sa.Column("token_hash", sa.Text(), nullable=False),
        sa.Column("issued_at", sa.Text(), nullable=False),
        sa.Column("expires_at", sa.Text(), nullable=False),
        sa.Column("rotated_at", sa.Text(), nullable=True),
        sa.Column("revoked_at", sa.Text(), nullable=True),
        sa.Column("replaced_by_session_id", sa.Text(), nullable=True),
        sa.CheckConstraint("scope_type IN ('vendor', 'tenant')"),
        sa.CheckConstraint(
            "(scope_type = 'vendor' AND tenant_id IS NULL) OR "
            "(scope_type = 'tenant' AND tenant_id IS NOT NULL)"
        ),
    )
    op.create_index("idx_auth_refresh_sessions_family_id", "auth_refresh_sessions", ["family_id"])
    op.create_index("idx_auth_refresh_sessions_user_id", "auth_refresh_sessions", ["user_id"])

    # 既存の vendor_users / vendor_refresh_sessions データを新テーブルへ移行する。
    op.execute(
        sa.text(
            "INSERT INTO auth_users "
            "(id, email, display_name, affiliation_type, tenant_id, status, "
            "password_hash, created_by, created_at, updated_at) "
            "SELECT id, email, display_name, 'vendor', NULL, status, "
            "password_hash, created_by, created_at, updated_at FROM vendor_users"
        )
    )
    op.execute(
        sa.text(
            "INSERT INTO auth_role_assignments "
            "(id, user_id, role, scope_type, tenant_id, valid_from, valid_to, "
            "revoked_at, granted_by, granted_at) "
            "SELECT 'ra_' || id, id, "
            "CASE role WHEN 'admin' THEN 'vendor_admin' ELSE 'vendor_member' END, "
            "'vendor', NULL, created_at, NULL, NULL, created_by, created_at "
            "FROM vendor_users"
        )
    )
    op.execute(
        sa.text(
            "INSERT INTO auth_refresh_sessions "
            "(id, family_id, user_id, scope_type, tenant_id, token_hash, "
            "issued_at, expires_at, rotated_at, revoked_at, replaced_by_session_id) "
            "SELECT id, family_id, vendor_user_id, 'vendor', NULL, token_hash, "
            "issued_at, expires_at, rotated_at, revoked_at, replaced_by_session_id "
            "FROM vendor_refresh_sessions"
        )
    )

    op.drop_table("vendor_refresh_sessions")
    op.drop_table("vendor_users")


def downgrade() -> None:
    """旧 vendor_users / vendor_refresh_sessions へ復元する（ベンダーデータのみ）。"""
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

    op.execute(
        sa.text(
            "INSERT INTO vendor_users "
            "(id, email, display_name, role, status, password_hash, "
            "created_by, created_at, updated_at) "
            "SELECT u.id, u.email, u.display_name, "
            "CASE WHEN EXISTS ("
            "  SELECT 1 FROM auth_role_assignments r "
            "  WHERE r.user_id = u.id AND r.role = 'vendor_admin' AND r.revoked_at IS NULL"
            ") THEN 'admin' ELSE 'member' END, "
            "u.status, u.password_hash, u.created_by, u.created_at, u.updated_at "
            "FROM auth_users u WHERE u.affiliation_type = 'vendor'"
        )
    )
    op.execute(
        sa.text(
            "INSERT INTO vendor_refresh_sessions "
            "(id, family_id, vendor_user_id, token_hash, issued_at, expires_at, "
            "rotated_at, revoked_at, replaced_by_session_id) "
            "SELECT id, family_id, user_id, token_hash, issued_at, expires_at, "
            "rotated_at, revoked_at, replaced_by_session_id "
            "FROM auth_refresh_sessions WHERE scope_type = 'vendor'"
        )
    )

    op.drop_table("auth_refresh_sessions")
    op.drop_table("auth_role_assignments")
    op.drop_table("auth_users")
