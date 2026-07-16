"""组织模型"""
from sqlalchemy import Column, String, Float, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.models.base import Base, UUIDMixin, TimestampMixin, Mapped, mapped_column
import uuid

class Organization(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "organizations"
    
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[str] = mapped_column(String(500), default="")
    org_type: Mapped[str] = mapped_column(String(20), default="team")  # team|guild|company| DAO
    status: Mapped[str] = mapped_column(String(20), default="active")  # active|suspended|dissolved
    governance_model: Mapped[str] = mapped_column(String(20), default="democratic")
    reputation: Mapped[float] = mapped_column(Float, default=50.0)
    balance: Mapped[float] = mapped_column(Float, default=0.0)  # Token余额
    charter: Mapped[dict] = mapped_column(JSONB, default=dict)
    creator_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("humans.id", ondelete="CASCADE"), nullable=False)
    
    members = relationship("OrganizationMember", back_populates="organization")
    projects = relationship("Project", back_populates="organization")

class OrganizationMember(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "organization_members"
    
    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"))
    human_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("humans.id", ondelete="CASCADE"))
    agent_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("agents.id", ondelete="SET NULL"), nullable=True)
    role: Mapped[str] = mapped_column(String(20), default="member")  # leader|member|applicant
    status: Mapped[str] = mapped_column(String(20), default="active")
    
    organization = relationship("Organization", back_populates="members")
    human = relationship("Human", back_populates="organizations")
