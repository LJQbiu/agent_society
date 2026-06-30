"""认证路由 - M0-b OAuth 2.1 + PKCE + httpOnly Cookie"""
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.config import settings
from app.schemas.auth import (
    HumanRegisterRequest, HumanRegisterResponse,
    HumanLoginRequest, TokenResponse,
    AuthorizeRequest, AuthorizeResponse,
    TokenRequest, BindAgentRequest, BindAgentResponse,
    AgentCredentialsRequest, AgentCredentialsResponse,
    RefreshTokenRequest, TokenPayload,
    ForgotPasswordRequest, ForgotPasswordResponse,
    ResetPasswordRequest, ResetPasswordResponse,
)
from app.services.auth_service import AuthService
from app.middleware.auth_middleware import get_current_user
from app.utils.jwt import decode_token
from app.utils.jwt import decode_token, create_token
from datetime import timedelta

router = APIRouter(prefix="/auth", tags=["auth"])

# === Cookie配置常量 ===
COOKIE_ACCESS_MAX_AGE = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60   # 秒
COOKIE_REFRESH_MAX_AGE = settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60  # 秒
COOKIE_PATH = "/"
COOKIE_SAMESITE = "lax"


def _set_auth_cookies(response: Response, result: TokenResponse) -> None:
    """在response上设置httpOnly access+refresh cookies"""
    response.set_cookie(
        key="access_token_cookie",
        value=result.access_token,
        httponly=True,
        samesite=COOKIE_SAMESITE,
        max_age=COOKIE_ACCESS_MAX_AGE,
        path=COOKIE_PATH,
    )
    response.set_cookie(
        key="refresh_token_cookie",
        value=result.refresh_token,
        httponly=True,
        samesite=COOKIE_SAMESITE,
        max_age=COOKIE_REFRESH_MAX_AGE,
        path=COOKIE_PATH,
    )


def _clear_auth_cookies(response: Response) -> None:
    """清除httpOnly auth cookies"""
    response.delete_cookie(key="access_token_cookie", path=COOKIE_PATH)
    response.delete_cookie(key="refresh_token_cookie", path=COOKIE_PATH)


# === 人类注册 ===
@router.post("/register", response_model=HumanRegisterResponse)
async def register(data: HumanRegisterRequest, db: AsyncSession = Depends(get_db)):
    """人类用户注册（bcrypt密码哈希）"""
    svc = AuthService(db)
    try:
        result = await svc.register_human(data)
        await db.commit()
        return result
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# === 人类登录 ===
@router.post("/login", response_model=TokenResponse)
async def login(data: HumanLoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    """人类用户登录 → access+refresh tokens + httpOnly cookies"""
    svc = AuthService(db)
    try:
        result = await svc.login_human(data)
        await db.commit()
        _set_auth_cookies(response, result)
        return result
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))


# === OAuth 2.1 授权端点 ===
@router.get("/authorize", response_model=AuthorizeResponse)
async def authorize(
    data: AuthorizeRequest = Depends(),
    current_user: TokenPayload = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """OAuth 2.1 授权码端点（PKCE S256强制）"""
    svc = AuthService(db)
    try:
        result = await svc.authorize(data, current_user.sub)
        await db.commit()
        return result
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# === OAuth 2.1 Token端点 ===
@router.post("/token", response_model=TokenResponse)
async def token(data: TokenRequest, db: AsyncSession = Depends(get_db)):
    """OAuth 2.1 Token端点（authorization_code / refresh_token / client_credentials）"""
    svc = AuthService(db)
    try:
        result = await svc.exchange_token(data)
        await db.commit()
        return result
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# === Refresh Token (httpOnly Cookie优先) ===
@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """refresh_token rotation — 从httpOnly cookie或body读取，发放新token+新cookie"""
    # 优先从cookie读取refresh_token
    refresh_token = request.cookies.get("refresh_token_cookie")
    client_id = "web-client"

    if not refresh_token:
        # 回退: 从body读取(兼容非浏览器API客户端)
        try:
            body = await request.json()
            refresh_token = body.get("refresh_token")
            client_id = body.get("client_id", "web-client")
        except Exception:
            pass

    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No refresh token provided (cookie or body)",
        )

    svc = AuthService(db)
    try:
        result = await svc._rotate_refresh_token(refresh_token, client_id)
        await db.commit()
        _set_auth_cookies(response, result)
        return result
    except ValueError as e:
        # Refresh失败 → 清除cookies强制重新登录
        _clear_auth_cookies(response)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# === 登出 ===
@router.post("/logout")
async def logout(response: Response):
    """清除httpOnly auth cookies → 登出"""
    _clear_auth_cookies(response)
    return {"message": "Logged out successfully"}


# === 密码重置 ===
@router.post("/forgot-password", response_model=ForgotPasswordResponse)
async def forgot_password(data: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    """忘记密码 - 生成重置token（开发环境直接返回，生产环境应发邮件）"""
    svc = AuthService(db)
    try:
        result = await svc.forgot_password(data)
        await db.commit()
        return result
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/reset-password", response_model=ResetPasswordResponse)
async def reset_password(data: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    """重置密码 - 使用重置token + 新密码"""
    svc = AuthService(db)
    try:
        result = await svc.reset_password(data)
        await db.commit()
        return result
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# === Agent绑定 ===
@router.post("/bind-agent", response_model=BindAgentResponse)
async def bind_agent(
    data: BindAgentRequest,
    current_user: TokenPayload = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Agent绑定到Human账户，创建OAuthClient"""
    # human_id从JWT token提取，无需客户端传入
    if not data.human_id:
        data.human_id = current_user.sub
    svc = AuthService(db)
    try:
        result = await svc.bind_agent(data)
        await db.commit()
        return result
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# === Agent获取credentials ===
@router.post("/agent-credentials", response_model=AgentCredentialsResponse)
async def agent_credentials(
    data: AgentCredentialsRequest,
    current_user: TokenPayload = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Agent通过client_credentials获取短期access_token"""
    svc = AuthService(db)
    try:
        result = await svc.get_agent_credentials(data)
        await db.commit()
        return result
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# === WebSocket Token发放 ===
@router.post("/ws-token")
async def get_ws_token(request: Request):
    """发放短期WebSocket连接token — 通过httpOnly Cookie认证

    流程: 前端通过/api/auth/ws-token代理调用此端点(携带httpOnly Cookie)
    → 后端验证Cookie中的access_token → 发放5分钟有效的WS专用token
    → 前端用此token作为query param连接 ws://backend/ws?token=xxx
    """
    # 从Cookie中读取access_token
    access_token = request.cookies.get("access_token_cookie")
    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No access token cookie — please login first",
        )

    # 验证access_token
    payload = decode_token(access_token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token",
        )

    # 创建短期WS token (5分钟有效期, 带ws标记)
    ws_token = create_token(
        data={"sub": payload["sub"], "role": payload.get("role", ""), "ws": True},
        expires_delta=timedelta(minutes=5),
    )

    return {"ws_token": ws_token, "expires_in": 300}


# === 获取当前JWT Token ===
@router.get("/my-token")
async def get_my_token(request: Request, user: TokenPayload = Depends(get_current_user)):
    """获取当前用户的JWT access_token — 通过httpOnly Cookie认证后返回raw JWT字符串

    用途: 用户在其他平台(如OpenClaw、GenericAgent等)接入Agent时，
    需要JWT作为Bearer Token调用本平台API。由于JWT存储在httpOnly Cookie中，
    浏览器JS无法直接读取，此端点提供安全方式获取。
    """
    access_token = request.cookies.get("access_token_cookie")
    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No access token cookie — please login first",
        )
    return {"access_token": access_token, "user_type": user.user_type, "sub": user.sub, "expires_at": user.exp}
