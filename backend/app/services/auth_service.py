"""认证服务 - M0-b OAuth 2.1 + PKCE 核心实现"""
import uuid
import hashlib
import base64
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from jose import jwt, JWTError

from app.config import settings
from app.models.human import Human
from app.models.agent import Agent
from app.models.governance import OAuthClient, AuthorizationCode, RefreshToken
from app.schemas.auth import (
    HumanRegisterRequest, HumanRegisterResponse,
    HumanLoginRequest, TokenResponse, TokenPayload,
    AuthorizeRequest, AuthorizeResponse,
    TokenRequest, BindAgentRequest, BindAgentResponse,
    AgentCredentialsRequest, AgentCredentialsResponse,
    ForgotPasswordRequest, ForgotPasswordResponse,
    ResetPasswordRequest, ResetPasswordResponse,
)


def _hash_password(password: str) -> str:
    """bcrypt哈希密码"""
    import bcrypt
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def _verify_password(password: str, hashed: str) -> bool:
    """bcrypt验证密码"""
    import bcrypt
    return bcrypt.checkpw(password.encode(), hashed.encode())


def _generate_code_challenge_verifier() -> Tuple[str, str]:
    """生成PKCE code_verifier + code_challenge(S256)"""
    verifier = base64.urlsafe_b64encode(secrets.token_bytes(32)).rstrip(b'=').decode()
    challenge = base64.urlsafe_b64encode(
        hashlib.sha256(verifier.encode()).digest()
    ).rstrip(b'=').decode()
    return verifier, challenge


def _create_access_token(user_id: str, user_type: str, roles: list = None, scope: str = None) -> Tuple[str, int]:
    """创建JWT access_token"""
    now = datetime.now(timezone.utc)
    exp = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    jti = str(uuid.uuid4())
    payload = {
        "sub": user_id,
        "user_type": user_type,
        "roles": roles or [],
        "scope": scope,
        "exp": int(exp.timestamp()),
        "iat": int(now.timestamp()),
        "jti": jti,
    }
    token = jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")
    return token, int(exp.timestamp()) - int(now.timestamp())


def _create_refresh_token(user_id: str, user_type: str) -> str:
    """创建refresh_token (opaque)"""
    return secrets.token_urlsafe(48)


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # === 人类注册 ===
    async def register_human(self, data: HumanRegisterRequest) -> HumanRegisterResponse:
        # 检查username唯一性
        result = await self.db.execute(select(Human).where(Human.username == data.username))
        if result.scalar_one_or_none():
            raise ValueError(f"Username '{data.username}' already exists")
        # 检查email唯一性
        result = await self.db.execute(select(Human).where(Human.email == data.email))
        if result.scalar_one_or_none():
            raise ValueError(f"Email '{data.email}' already exists")

        human = Human(
            username=data.username,
            email=data.email,
            password_hash=_hash_password(data.password),
            status="active",
        )
        self.db.add(human)
        await self.db.flush()
        await self.db.refresh(human)
        return HumanRegisterResponse(user_id=str(human.id), username=human.username)

    # === 人类登录 ===
    async def login_human(self, data: HumanLoginRequest) -> TokenResponse:
        result = await self.db.execute(select(Human).where(Human.username == data.username))
        human = result.scalar_one_or_none()
        if not human or not _verify_password(data.password, human.password_hash):
            raise ValueError("Invalid username or password")
        if not human.is_active:
            raise ValueError("Account is deactivated")

        access_token, expires_in = _create_access_token(str(human.id), "human", ["user"])
        refresh_token_str = _create_refresh_token(str(human.id), "human")

        # 存储refresh_token
        rt = RefreshToken(
            token=refresh_token_str,
            user_id=human.id,
            user_type="human",
            expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        )
        self.db.add(rt)
        await self.db.flush()

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token_str,
            expires_in=expires_in,
        )

    # === OAuth 2.1 授权端点 ===
    async def authorize(self, data: AuthorizeRequest, current_user_id: str) -> AuthorizeResponse:
        """生成authorization_code（PKCE S256强制）"""
        if data.code_challenge_method != "S256":
            raise ValueError("OAuth 2.1 requires code_challenge_method=S256, 'plain' is forbidden")
        if data.response_type != "code":
            raise ValueError("OAuth 2.1 only supports response_type=code, implicit grant is forbidden")

        # 验证client_id + redirect_uri精确匹配
        result = await self.db.execute(select(OAuthClient).where(OAuthClient.client_id == data.client_id))
        client = result.scalar_one_or_none()
        if not client:
            raise ValueError(f"Unknown client_id: {data.client_id}")
        if data.redirect_uri not in client.redirect_uris:
            raise ValueError("redirect_uri must exactly match one of the registered values")

        # 生成authorization_code
        auth_code = secrets.token_urlsafe(32)
        ac = AuthorizationCode(
            code=auth_code,
            client_id=data.client_id,
            redirect_uri=data.redirect_uri,
            code_challenge=data.code_challenge,
            user_id=uuid.UUID(current_user_id),
            user_type="human",
            scope=data.scope,
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),  # ≤10分钟
        )
        self.db.add(ac)
        await self.db.flush()

        return AuthorizeResponse(code=auth_code, state=data.state)

    # === OAuth 2.1 Token端点 ===
    async def exchange_token(self, data: TokenRequest) -> TokenResponse:
        """authorization_code交换 → access+refresh tokens"""
        if data.grant_type == "authorization_code":
            return await self._exchange_auth_code(data)
        elif data.grant_type == "refresh_token":
            return await self._rotate_refresh_token(data.refresh_token, data.client_id)
        elif data.grant_type == "client_credentials":
            return await self._client_credentials(data)
        else:
            raise ValueError(f"Unsupported grant_type: {data.grant_type}")

    async def _exchange_auth_code(self, data: TokenRequest) -> TokenResponse:
        """authorization_code + PKCE验证 → tokens"""
        result = await self.db.execute(
            select(AuthorizationCode).where(AuthorizationCode.code == data.code)
        )
        auth_code = result.scalar_one_or_none()
        if not auth_code:
            raise ValueError("Invalid authorization code")
        if auth_code.is_used:
            raise ValueError("Authorization code already used (one-time use required)")
        if auth_code.expires_at < datetime.now(timezone.utc):
            raise ValueError("Authorization code expired")
        if auth_code.client_id != data.client_id:
            raise ValueError("client_id mismatch")
        if auth_code.redirect_uri != data.redirect_uri:
            raise ValueError("redirect_uri mismatch")

        # PKCE S256验证
        expected_challenge = base64.urlsafe_b64encode(
            hashlib.sha256(data.code_verifier.encode()).digest()
        ).rstrip(b'=').decode()
        if auth_code.code_challenge != expected_challenge:
            raise ValueError("PKCE code_challenge verification failed")

        # 标记code已使用
        auth_code.is_used = True
        await self.db.flush()

        # 创建tokens
        access_token, expires_in = _create_access_token(
            str(auth_code.user_id), auth_code.user_type, scope=auth_code.scope
        )
        refresh_token_str = _create_refresh_token(str(auth_code.user_id), auth_code.user_type)
        rt = RefreshToken(
            token=refresh_token_str,
            user_id=auth_code.user_id,
            user_type=auth_code.user_type,
            expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        )
        self.db.add(rt)
        await self.db.flush()

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token_str,
            expires_in=expires_in,
        )

    async def _rotate_refresh_token(self, refresh_token: str, client_id: str) -> TokenResponse:
        """refresh_token rotation：旧token失效+发放新token，重用检测→撤销所有token"""
        result = await self.db.execute(
            select(RefreshToken).where(RefreshToken.token == refresh_token)
        )
        rt = result.scalar_one_or_none()
        if not rt:
            # 重用检测：token不存在意味着已被rotation撤销 → 撤销该用户所有token
            raise ValueError("Refresh token reuse detected - all tokens for this user revoked")

        if rt.is_revoked:
            # 重用检测：已撤销的token被再次使用 → 撤销该用户所有refresh_tokens
            await self.db.execute(
                update(RefreshToken)
                .where(RefreshToken.user_id == rt.user_id)
                .values(is_revoked=True)
            )
            await self.db.flush()
            raise ValueError("Refresh token reuse detected - all tokens for this user revoked")

        if rt.expires_at < datetime.now(timezone.utc):
            raise ValueError("Refresh token expired")

        # 撤销旧token
        rt.is_revoked = True
        await self.db.flush()

        # 发放新tokens
        access_token, expires_in = _create_access_token(str(rt.user_id), rt.user_type)
        new_refresh_token_str = _create_refresh_token(str(rt.user_id), rt.user_type)
        new_rt = RefreshToken(
            token=new_refresh_token_str,
            user_id=rt.user_id,
            user_type=rt.user_type,
            expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        )
        self.db.add(new_rt)
        await self.db.flush()

        return TokenResponse(
            access_token=access_token,
            refresh_token=new_refresh_token_str,
            expires_in=expires_in,
        )

    async def _client_credentials(self, data: TokenRequest) -> TokenResponse:
        """client_credentials flow for agents"""
        result = await self.db.execute(
            select(OAuthClient).where(OAuthClient.client_id == data.client_id)
        )
        client = result.scalar_one_or_none()
        if not client:
            raise ValueError(f"Unknown client_id: {data.client_id}")
        if not _verify_password(data.client_secret, client.client_secret_hash):
            raise ValueError("Invalid client_secret")

        # Agent client_credentials → short-lived access_token only (no refresh_token)
        # 查询Agent获取agent_id_str，用于JWT sub格式 "agent:{agent_id_str}"
        agent = None
        if client.owner_id:
            result2 = await self.db.execute(select(Agent).where(Agent.id == client.owner_id))
            agent = result2.scalar_one_or_none()
        sub = f"agent:{agent.agent_id_str}" if agent else (str(client.owner_id) if client.owner_id else client.client_id)
        access_token, expires_in = _create_access_token(
            sub,
            "agent",
            scope="agent_api",
        )
        return TokenResponse(
            access_token=access_token,
            refresh_token="",  # client_credentials不发放refresh_token
            expires_in=expires_in,
        )

    # === Agent绑定 ===
    async def bind_agent(self, data: BindAgentRequest) -> BindAgentResponse:
        """将Agent绑定到Human账户，创建OAuthClient"""
        # 支持UUID或agent_id_str查找
        agent = None
        try:
            result = await self.db.execute(select(Agent).where(Agent.id == uuid.UUID(data.agent_id)))
            agent = result.scalar_one_or_none()
        except ValueError:
            pass  # 不是UUID格式，尝试agent_id_str
        if not agent:
            result = await self.db.execute(select(Agent).where(Agent.agent_id_str == data.agent_id))
            agent = result.scalar_one_or_none()
        if not agent:
            raise ValueError(f"Agent '{data.agent_id}' not found")

        # 检查OAuthClient是否已存在（避免IntegrityError）
        existing = await self.db.execute(
            select(OAuthClient).where(OAuthClient.owner_id == agent.id)
        )
        if existing.scalar_one_or_none():
            raise ValueError(f"Agent '{data.agent_id}' already bound to a Human account")

        # 创建OAuthClient
        client_id = f"agent-{str(agent.id)}"
        client_secret = secrets.token_urlsafe(32)
        oc = OAuthClient(
            client_id=client_id,
            client_secret_hash=_hash_password(client_secret),
            client_name=f"Agent {agent.name}",
            redirect_uris=[],  # Agent用client_credentials，无需redirect
            owner_id=agent.id,
        )
        self.db.add(oc)
        await self.db.flush()

        # 更新Agent.owner_id + 激活Agent
        agent.owner_id = uuid.UUID(data.human_id)
        agent.status = "active"  # 绑定后自动激活，使其可接收A2A消息
        await self.db.flush()

        return BindAgentResponse(
            agent_id=str(agent.id),
            human_id=data.human_id,
            client_id=client_id,
            client_secret=client_secret,
            status="bound",
        )

    # === Agent获取credentials ===
    async def get_agent_credentials(self, data: AgentCredentialsRequest) -> AgentCredentialsResponse:
        """Agent通过client_credentials获取短期access_token"""
        result = await self.db.execute(
            select(OAuthClient).where(OAuthClient.owner_id == uuid.UUID(data.agent_id))
        )
        client = result.scalar_one_or_none()
        if not client:
            raise ValueError(f"Agent '{data.agent_id}' has no OAuthClient (not bound yet)")

        # 生成一次性client_secret（短期凭证）
        client_secret = secrets.token_urlsafe(32)
        client.client_secret_hash = _hash_password(client_secret)
        await self.db.flush()

        # 创建access_token
        access_token, expires_in = _create_access_token(
            str(client.owner_id), "agent", scope="agent_api"
        )

        return AgentCredentialsResponse(
            client_id=client.client_id,
            client_secret=client_secret,
            access_token=access_token,
            expires_in=expires_in,
        )

    # === 密码重置 ===
    async def forgot_password(self, data: ForgotPasswordRequest) -> ForgotPasswordResponse:
        """生成密码重置token（无MTA，直接返回token供前端使用）"""
        if not data.username and not data.email:
            raise ValueError("请提供用户名或邮箱")

        # 查找用户
        human = None
        if data.username:
            result = await self.db.execute(select(Human).where(Human.username == data.username))
            human = result.scalar_one_or_none()
        if not human and data.email:
            result = await self.db.execute(select(Human).where(Human.email == data.email))
            human = result.scalar_one_or_none()

        if not human:
            raise ValueError("找不到该用户")

        if not human.is_active:
            raise ValueError("该账号已被禁用")

        # 生成重置token，1小时有效期
        reset_token = secrets.token_urlsafe(32)
        human.reset_token = reset_token
        human.reset_token_expires = datetime.now(timezone.utc) + timedelta(hours=1)
        await self.db.flush()

        return ForgotPasswordResponse(
            message="密码重置token已生成，请在1小时内使用",
            reset_token=reset_token,
        )

    async def reset_password(self, data: ResetPasswordRequest) -> ResetPasswordResponse:
        """使用重置token更新密码"""
        result = await self.db.execute(select(Human).where(Human.reset_token == data.reset_token))
        human = result.scalar_one_or_none()

        if not human:
            raise ValueError("无效的重置token")

        if human.reset_token_expires < datetime.now(timezone.utc):
            # 清除过期token
            human.reset_token = None
            human.reset_token_expires = None
            await self.db.flush()
            raise ValueError("重置token已过期，请重新申请")

        # 更新密码
        human.password_hash = _hash_password(data.new_password)
        # 清除重置token
        human.reset_token = None
        human.reset_token_expires = None
        await self.db.flush()

        return ResetPasswordResponse(
            message="密码已成功重置",
            username=human.username,
        )
