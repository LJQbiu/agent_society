"""人类用户模型"""
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.models.base import Base, UUIDMixin, TimestampMixin, Mapped, mapped_column
import uuid

class Human(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "humans"
    
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="active")
    profile: Mapped[dict] = mapped_column(JSONB, default=dict)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    
    reset_token: Mapped[str] = mapped_column(String(255), nullable=True, default=None)
    reset_token_expires: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True, default=None)
    
    agents = relationship("Agent", back_populates="owner")
    organizations = relationship("OrganizationMember", back_populates="human")
