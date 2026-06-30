"""认证Schema - M0-b OAuth 2.1 + PKCE"""
from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List
from enum import Enum


# === 人类注册/登录 ===
class HumanRegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_]+$")
    email: EmailStr
    password: str = Field(min_length=8)


class HumanRegisterResponse(BaseModel):
    user_id: str
    username: str


class HumanLoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "Bearer"
    expires_in: int


class TokenPayload(BaseModel):
    sub: str  # user_id
    user_type: str  # human | agent | admin
    roles: List[str] = []
    scope: Optional[str] = None
    exp: int
    iat: int
    jti: str


# === OAuth 2.1 + PKCE ===
class AuthorizeRequest(BaseModel):
    """授权端点请求参数"""
    response_type: str = "code"  # OAuth2.1只支持code
    client_id: str
    redirect_uri: str
    scope: Optional[str] = None
    state: str  # CSRF防护，必填
    code_challenge: str  # PKCE必填
    code_challenge_method: str = "S256"  # OAuth2.1只支持S256


class AuthorizeResponse(BaseModel):
    """授权码响应"""
    code: str
    state: str


class TokenRequest(BaseModel):
    """Token端点请求"""
    grant_type: str  # authorization_code | refresh_token | client_credentials
    code: Optional[str] = None
    redirect_uri: Optional[str] = None
    code_verifier: Optional[str] = None  # PKCE验证
    refresh_token: Optional[str] = None
    client_id: str
    client_secret: Optional[str] = None


class RefreshTokenRequest(BaseModel):
    refresh_token: str
    client_id: str


# === Agent绑定 ===
class BindAgentRequest(BaseModel):
    agent_id: str
    human_id: Optional[str] = None  # 从token自动填充，无需客户端传入


class BindAgentResponse(BaseModel):
    agent_id: str
    human_id: str
    client_id: str
    client_secret: str = ""
    status: str = "bound"


class AgentCredentialsRequest(BaseModel):
    agent_id: str


class AgentCredentialsResponse(BaseModel):
    client_id: str
    client_secret: str
    access_token: str
    expires_in: int


# === 密码重置 ===
class ForgotPasswordRequest(BaseModel):
    """忘记密码请求 - 提供用户名或邮箱"""
    username: Optional[str] = None
    email: Optional[EmailStr] = None


class ForgotPasswordResponse(BaseModel):
    """忘记密码响应 - 返回重置token(无MTA时直接返回)"""
    message: str
    reset_token: str  # 开发环境直接返回token，生产环境应通过邮件发送


class ResetPasswordRequest(BaseModel):
    """重置密码请求"""
    reset_token: str
    new_password: str = Field(min_length=8)


class ResetPasswordResponse(BaseModel):
    """重置密码响应"""
    message: str
    username: str
