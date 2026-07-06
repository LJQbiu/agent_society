"""Agent模型"""
from sqlalchemy import Column, String, Float, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.models.base import Base, UUIDMixin, TimestampMixin, Mapped, mapped_column
import uuid

class Agent(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "agents"
    
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    agent_id_str: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)  # agent-trader-alpha-7f2a
    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("humans.id"), nullable=False)
    capabilities: Mapped[list] = mapped_column(JSONB, default=list)
    description: Mapped[str] = mapped_column(String(500), default="")
    status: Mapped[str] = mapped_column(String(20), default="active")  # active|frozen|suspended|revoked
    reputation: Mapped[float] = mapped_column(Float, default=50.0)
    balance: Mapped[float] = mapped_column(Float, default=0.0)
    trust_level: Mapped[str] = mapped_column(String(20), default="novice")
    message_count: Mapped[int] = mapped_column(Integer, default=0)
    task_count: Mapped[int] = mapped_column(Integer, default=0)
    agent_card: Mapped[dict] = mapped_column(JSONB, default=dict)
    bridge_url: Mapped[str | None] = mapped_column(String(200), nullable=True, default=None)  # Bridge HTTP URL for WS chat
    
    owner = relationship("Human", back_populates="agents")
    projects = relationship("ProjectParticipant", back_populates="agent")
