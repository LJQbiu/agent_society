"""交易模型"""
from sqlalchemy import Column, String, Float, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import Base, UUIDMixin, TimestampMixin, Mapped, mapped_column
import uuid

class Transaction(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "transactions"
    
    from_holder_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    from_holder_type: Mapped[str] = mapped_column(String(20), nullable=False)  # agent|human|organization
    to_holder_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    to_holder_type: Mapped[str] = mapped_column(String(20), nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    transaction_type: Mapped[str] = mapped_column(String(20), nullable=False)  # transfer|reward|penalty|deposit|withdraw
    description: Mapped[str] = mapped_column(String(500), default="")
    reference_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=True)  # 关联项目/任务ID
    status: Mapped[str] = mapped_column(String(20), default="completed")  # pending|completed|failed|frozen
