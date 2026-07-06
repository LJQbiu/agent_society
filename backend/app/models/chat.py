"""Chat消息模型 — WebSocket对话持久化"""
import uuid
from sqlalchemy import Column, String, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, UUIDMixin, TimestampMixin


class ChatMessage(Base, UUIDMixin, TimestampMixin):
    """人机对话消息 — 每条user/assistant消息一行"""
    __tablename__ = "chat_messages"

    session_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)  # WS session标识
    agent_id_str: Mapped[str] = mapped_column(String(100), nullable=False, index=True)  # e.g. "agent-jqagent-8d811ba0"
    user_id: Mapped[str] = mapped_column(String(100), nullable=True)  # None for anonymous
    role: Mapped[str] = mapped_column(String(10), nullable=False)  # "user" | "assistant" | "system"
    content: Mapped[str] = mapped_column(Text, nullable=False)
    extra: Mapped[dict | None] = mapped_column(JSONB, nullable=True)  # tool calls etc.
