"""Agent记忆模型 — 跨会话持久化知识存储"""
from sqlalchemy import Column, String, Text, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.models.base import Base, UUIDMixin, TimestampMixin, Mapped, mapped_column
import uuid


class AgentMemory(Base, UUIDMixin, TimestampMixin):
    """Agent持久记忆 — 3层分级: core/insight/preference"""
    __tablename__ = "agent_memories"

    agent_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("agents.id", ondelete="CASCADE"), nullable=False, index=True)
    project_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=True, index=True)
    # None = agent全局记忆; 有值 = 项目上下文记忆
    category: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    # core: 核心身份/使命 (每条消息注入)
    # insight: 对话中习得的重要认知 (关键词匹配注入)
    # preference: 用户偏好/习惯 (关键词匹配注入)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    tags: Mapped[list] = mapped_column(JSONB, default=list)  # 检索标签 e.g. ["项目目标","技术栈"]
    importance: Mapped[int] = mapped_column(Integer, default=5)  # 1-10, ≥7才动态注入
    source_session_id: Mapped[str | None] = mapped_column(String(100), nullable=True)  # 记忆来源session

    agent = relationship("Agent", back_populates="memories")
