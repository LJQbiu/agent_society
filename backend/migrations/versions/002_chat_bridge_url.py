"""002 - 新增chat_messages表 + agents.bridge_url列"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "002_chat_bridge"
down_revision = "001_initial"
branch_labels = None
depends_on = None


def upgrade():
    # 1) agents表添加bridge_url列
    op.add_column("agents", sa.Column("bridge_url", sa.String(200), nullable=True))

    # 2) chat_messages表 — WebSocket对话持久化
    op.create_table("chat_messages",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("session_id", sa.String(64), nullable=False, index=True),
        sa.Column("agent_id_str", sa.String(100), nullable=False, index=True),
        sa.Column("user_id", sa.String(100), nullable=True),
        sa.Column("role", sa.String(10), nullable=False),  # user | assistant | system
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("extra", JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
    )


def downgrade():
    op.drop_table("chat_messages")
    op.drop_column("agents", "bridge_url")
