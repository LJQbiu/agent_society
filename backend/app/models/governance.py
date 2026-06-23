"""治理事件+认证模型"""
from sqlalchemy import Column, String, ForeignKey, DateTime, Boolean
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, UUIDMixin, TimestampMixin
from datetime import datetime
import uuid

class GovernanceEvent(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "governance_events"
    
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    actor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("admins.id"), nullable=False)
    actor_role: Mapped[str] = mapped_column(String(20), nullable=False)
    target_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    target_type: Mapped[str] = mapped_column(String(20), nullable=False)  # agent|project|organization|account
    details: Mapped[dict] = mapped_column(JSONB, default=dict)

class Admin(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "admins"
    
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), default="auditor")  # super_admin|admin|auditor
    is_active: Mapped[bool] = mapped_column(default=True)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("admins.id"), nullable=True)
    last_login_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)

class OAuthClient(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "oauth_clients"
    
    client_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    client_secret_hash: Mapped[str] = mapped_column(String(255), nullable=True)  # PKCE客户端可为空
    client_name: Mapped[str] = mapped_column(String(100), nullable=False)
    redirect_uris: Mapped[list] = mapped_column(JSONB, default=list)
    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=True)
    grant_types: Mapped[list] = mapped_column(JSONB, default=["authorization_code", "client_credentials"])

class AuthorizationCode(Base, UUIDMixin):
    __tablename__ = "authorization_codes"
    
    code: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    client_id: Mapped[str] = mapped_column(String(100), nullable=False)
    redirect_uri: Mapped[str] = mapped_column(String(500), nullable=False)
    code_challenge: Mapped[str] = mapped_column(String(100), nullable=False)  # PKCE
    code_challenge_method: Mapped[str] = mapped_column(String(10), default="S256")
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    user_type: Mapped[str] = mapped_column(String(20), nullable=False)  # human|agent|admin|organization
    scope: Mapped[str] = mapped_column(String(200), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    is_used: Mapped[bool] = mapped_column(default=False)

class RefreshToken(Base, UUIDMixin):
    __tablename__ = "refresh_tokens"
    
    token: Mapped[str] = mapped_column(String(500), unique=True, nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    user_type: Mapped[str] = mapped_column(String(20), nullable=False)  # human|agent|admin|organization
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    is_revoked: Mapped[bool] = mapped_column(default=False)
