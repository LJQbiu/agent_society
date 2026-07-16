"""项目模型"""
from sqlalchemy import Column, String, Float, ForeignKey, Integer, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.models.base import Base, UUIDMixin, TimestampMixin, Mapped, mapped_column
from datetime import datetime
import uuid

class Project(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "projects"
    
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(String(500), default="")
    type: Mapped[str] = mapped_column(String(20), default="general")  # general|research|commercial|competitive|collaborative
    status: Mapped[str] = mapped_column(String(20), default="recruiting")  # recruiting|active|suspended|completed|revoked
    budget: Mapped[float] = mapped_column(Float, default=0.0)
    reputation_budget: Mapped[float] = mapped_column(Float, default=0.0)
    required_capabilities: Mapped[list] = mapped_column(JSONB, default=list)
    max_participants: Mapped[int] = mapped_column(Integer, default=5)
    creator_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("agents.id", ondelete="SET NULL"), nullable=True)
    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True)
    
    participants = relationship("ProjectParticipant", back_populates="project")
    organization = relationship("Organization", back_populates="projects")
    chat_messages = relationship("ProjectChatMessage", back_populates="project", order_by="ProjectChatMessage.created_at")
    todos = relationship("ProjectTodo", back_populates="project", order_by="ProjectTodo.created_at")

class ProjectParticipant(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "project_participants"
    
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"))
    agent_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("agents.id", ondelete="CASCADE"))
    role: Mapped[str] = mapped_column(String(20), default="member")  # leader|member|applicant
    status: Mapped[str] = mapped_column(String(20), default="active")
    contribution_score: Mapped[float] = mapped_column(Float, default=0.0)
    
    project = relationship("Project", back_populates="participants")
    agent = relationship("Agent", back_populates="projects")

class ProjectChatMessage(Base, UUIDMixin, TimestampMixin):
    """项目聊天消息 - 人类与Agent之间的对话"""
    __tablename__ = "project_chat_messages"
    
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"))
    sender_type: Mapped[str] = mapped_column(String(10), nullable=False)  # human|agent
    sender_id: Mapped[str] = mapped_column(String(100), nullable=False)  # agent_id or user_id
    sender_name: Mapped[str] = mapped_column(String(100), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    
    project = relationship("Project", back_populates="chat_messages")

class ProjectTodo(Base, UUIDMixin, TimestampMixin):
    """项目TODO - 可被参与者认领的任务"""
    __tablename__ = "project_todos"
    
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id"))
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(String(1000), default="")
    priority: Mapped[str] = mapped_column(String(10), default="medium")  # high|medium|low
    status: Mapped[str] = mapped_column(String(20), default="open")  # open|claimed|in_progress|completed|cancelled
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("agents.id", ondelete="SET NULL"), nullable=True)
    claimed_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("agents.id", ondelete="SET NULL"), nullable=True)
    claimed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    
    project = relationship("Project", back_populates="todos")
    claimer = relationship("Agent", foreign_keys=[claimed_by])
