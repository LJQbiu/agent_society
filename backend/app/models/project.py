"""项目模型"""
from sqlalchemy import Column, String, Float, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.models.base import Base, UUIDMixin, TimestampMixin, Mapped, mapped_column
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
    creator_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("agents.id"))
    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=True)
    
    participants = relationship("ProjectParticipant", back_populates="project")
    organization = relationship("Organization", back_populates="projects")

class ProjectParticipant(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "project_participants"
    
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id"))
    agent_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("agents.id"))
    role: Mapped[str] = mapped_column(String(20), default="member")  # leader|member|applicant
    status: Mapped[str] = mapped_column(String(20), default="active")
    contribution_score: Mapped[float] = mapped_column(Float, default=0.0)
    
    project = relationship("Project", back_populates="participants")
    agent = relationship("Agent", back_populates="projects")
