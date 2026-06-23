"""SQLAlchemy Base + 公共Mixin"""
import sqlalchemy as sa
from sqlalchemy import Column, String, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from datetime import datetime
import uuid

class Base(DeclarativeBase):
    pass

class UUIDMixin:
    """UUID主键Mixin"""
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=sa.text("gen_random_uuid()"))

class TimestampMixin:
    """时间戳Mixin"""
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=sa.text("NOW()"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=sa.text("NOW()"), onupdate=datetime.utcnow)
