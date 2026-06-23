"""001 - 6张核心表 + pgcrypto扩展"""
from alembic import op
import sqlalchemy as sa

revision = "001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # pgcrypto扩展（用于加密存储）
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")

    # Humans表
    op.create_table("humans",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("username", sa.String(50), unique=True, nullable=False),
        sa.Column("email", sa.String(255), unique=True, nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("status", sa.String(20), default="active"),
        sa.Column("profile", sa.JSON),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )

    # Agents表
    op.create_table("agents",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("agent_id_str", sa.String(100), unique=True, nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("role", sa.String(50), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("capabilities", sa.JSON, default=[]),
        sa.Column("status", sa.String(20), default="active"),
        sa.Column("reputation", sa.Float, default=0),
        sa.Column("trust_level", sa.String(20), default="unverified"),
        sa.Column("owner_id", sa.String(36), sa.ForeignKey("humans.id")),
        sa.Column("encrypted_config", sa.LargeBinary),
        sa.Column("card_data", sa.JSON),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index("ix_agents_role", "agents", ["role"])
    op.create_index("ix_agents_status", "agents", ["status"])

    # Organizations表
    op.create_table("organizations",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(100), unique=True, nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("org_type", sa.String(50), nullable=False),
        sa.Column("status", sa.String(20), default="active"),
        sa.Column("founder_id", sa.String(36), sa.ForeignKey("humans.id")),
        sa.Column("config", sa.JSON),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )

    # Projects表
    op.create_table("projects",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("status", sa.String(20), default="open"),
        sa.Column("budget", sa.Float, default=0),
        sa.Column("required_capabilities", sa.JSON, default=[]),
        sa.Column("creator_id", sa.String(36), sa.ForeignKey("humans.id")),
        sa.Column("deadline", sa.DateTime),
        sa.Column("result_type", sa.String(50)),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )

    # Transactions表
    op.create_table("transactions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("from_id", sa.String(36), nullable=False),
        sa.Column("to_id", sa.String(36), nullable=False),
        sa.Column("amount", sa.Float, nullable=False),
        sa.Column("tx_type", sa.String(50), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("metadata", sa.JSON),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )

    # GovernanceEvents表
    op.create_table("governance_events",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("event_type", sa.String(50), nullable=False),
        sa.Column("actor_id", sa.String(36), nullable=False),
        sa.Column("actor_type", sa.String(20), nullable=False),
        sa.Column("target_id", sa.String(36)),
        sa.Column("details", sa.JSON),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )


def downgrade():
    op.drop_table("governance_events")
    op.drop_table("transactions")
    op.drop_table("projects")
    op.drop_table("organizations")
    op.drop_table("agents")
    op.drop_table("humans")
    op.execute("DROP EXTENSION IF EXISTS pgcrypto")
