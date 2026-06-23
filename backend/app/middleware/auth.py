"""认证中间件"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.utils.jwt import decode_token

security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
):
    """提取当前用户/Agent信息"""
    token = credentials.credentials
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    return payload

async def require_role(role: str):
    """角色验证依赖"""
    async def role_checker(current_user=Depends(get_current_user)):
        if current_user.get("role") != role and current_user.get("role") != "super_admin":
            raise HTTPException(status_code=403, detail=f"Requires {role} role")
        return current_user
    return role_checker
