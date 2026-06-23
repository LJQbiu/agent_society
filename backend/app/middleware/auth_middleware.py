"""认证中间件 - JWT验证 + 角色提取 + httpOnly Cookie支持"""
from fastapi import Depends, HTTPException, Request, status
from jose import jwt, JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.config import settings
from app.schemas.auth import TokenPayload
from app.database import get_db
from app.models.governance import Admin
from typing import List, Optional
import uuid


async def get_current_user(request: Request) -> TokenPayload:
    """提取并验证JWT token，从httpOnly cookie或Authorization header"""
    token = None
    # 1. 优先从Authorization header读取（支持API客户端/Agent）
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header[7:]
    # 2. 其次从httpOnly cookie读取（浏览器自动携带）
    if not token:
        token = request.cookies.get("access_token_cookie")
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        return TokenPayload(
            sub=payload["sub"],
            user_type=payload["user_type"],
            roles=payload.get("roles", []),
            scope=payload.get("scope"),
            exp=payload["exp"],
            iat=payload.get("iat", 0),
            jti=payload.get("jti", ""),
        )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_admin(
    user: TokenPayload = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Admin:
    """验证JWT为admin类型，从DB加载Admin模型实例"""
    if user.user_type != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    admin_id = uuid.UUID(user.sub)
    result = await db.execute(select(Admin).where(Admin.id == admin_id))
    admin = result.scalar_one_or_none()
    if not admin:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin account not found",
        )
    if not admin.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin account is disabled",
        )
    return admin


async def require_admin_or_super(admin: Admin = Depends(get_current_admin)) -> Admin:
    """要求admin或super_admin角色，返回Admin模型"""
    if admin.role not in ("admin", "super_admin", "auditor"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role required",
        )
    return admin


async def require_super_admin_model(admin: Admin = Depends(get_current_admin)) -> Admin:
    """要求super_admin角色，返回Admin模型"""
    if admin.role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super admin role required",
        )
    return admin


async def require_role(required_roles: List[str]):
    """角色检查依赖工厂"""
    async def _check_roles(user: TokenPayload = Depends(get_current_user)) -> TokenPayload:
        # admin角色拥有所有权限
        if "admin" in user.roles or "super_admin" in user.roles:
            return user
        # 检查是否拥有任一所需角色
        if not any(role in user.roles for role in required_roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Required role: {required_roles}",
            )
        return user
    return _check_roles


async def require_admin(user: TokenPayload = Depends(get_current_user)) -> TokenPayload:
    """要求admin角色"""
    if "admin" not in user.roles and "super_admin" not in user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role required",
        )
    return user


async def require_super_admin(user: TokenPayload = Depends(get_current_user)) -> TokenPayload:
    """要求super_admin角色"""
    if "super_admin" not in user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super admin role required",
        )
    return user
