"""A2A协议数据模型 - Message + AgentCardVersion"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, ForeignKey, Index, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB, TIMESTAMP
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from app.models.base import Base, UUIDMixin, TimestampMixin


class Message(Base, UUIDMixin, TimestampMixin):
    """Agent间消息"""
    __tablename__ = "messages"

    from_agent_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    to_agent_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    message_type: Mapped[str] = mapped_column(
        String(30), nullable=False
    )  # task_request|task_response|info|negotiation|greeting
    content: Mapped[dict] = mapped_column(JSONB, nullable=False)  # {text, task_id?, parameters?}
    priority: Mapped[str] = mapped_column(String(10), default="normal")  # normal|urgent|low
    status: Mapped[str] = mapped_column(
        String(15), default="delivered"
    )  # delivered|read|processed|archived|failed

    __table_args__ = (
        Index("idx_msg_from", "from_agent_id"),
        Index("idx_msg_to", "to_agent_id"),
        Index("idx_msg_status", "status"),
        Index("idx_msg_created", "created_at"),
    )


class AgentCardVersion(Base, UUIDMixin, TimestampMixin):
    """Agent Card版本追踪"""
    __tablename__ = "agent_card_versions"

    agent_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    card_snapshot: Mapped[dict] = mapped_column(JSONB, nullable=False)  # 该版本完整Agent Card快照
    change_type: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # register|update|status_change|reputation_update
    changed_by: Mapped[str] = mapped_column(String(20), nullable=False)  # agent|admin|system

    __table_args__ = (
        Index("idx_card_ver_agent", "agent_id"),
        UniqueConstraint("agent_id", "version", name="idx_card_ver_agent_version"),
    )


class Task(Base, UUIDMixin, TimestampMixin):
    """A2A任务协商"""
    __tablename__ = "tasks"

    from_agent_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    to_agent_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    task_type: Mapped[str] = mapped_column(String(50), nullable=False)  # negotiation|collaboration|delegation|info_request
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(String(1000), nullable=False)
    parameters: Mapped[dict] = mapped_column(JSONB, nullable=True)  # 任务参数
    result: Mapped[dict] = mapped_column(JSONB, nullable=True)  # 任务结果
    status: Mapped[str] = mapped_column(
        String(20), default="pending"
    )  # pending|accepted|rejected|in_progress|completed|failed|cancelled
    priority: Mapped[str] = mapped_column(String(10), default="normal")  # normal|urgent|low
    deadline: Mapped[str] = mapped_column(String(50), nullable=True)  # ISO8601 deadline

    __table_args__ = (
        Index("idx_task_from", "from_agent_id"),
        Index("idx_task_to", "to_agent_id"),
        Index("idx_task_status", "status"),
        Index("idx_task_created", "created_at"),
    )
