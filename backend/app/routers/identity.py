"""身份注册路由 - M0-a SPEC 完整实现"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas.identity import *
from app.services.identity import IdentityService
from app.middleware.auth_middleware import get_current_user
from app.schemas.auth import TokenPayload

router = APIRouter(prefix="/identity", tags=["identity"])

@router.post("/register", response_model=HumanRegisterResponse)
async def register_human(data: HumanRegisterRequest, db: AsyncSession = Depends(get_db)):
    """人类用户注册"""
    try:
        return await IdentityService(db).register_human(data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.post("/register-agent", response_model=AgentRegisterResponse)
async def register_agent(
    data: AgentRegisterRequest,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(get_current_user),
):
    """Agent注册（需认证，owner_id自动从token填充）"""
    try:
        owner_id = current_user.sub
        return await IdentityService(db).register_agent(data, owner_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.post("/register-organization", response_model=OrganizationRegisterResponse)
async def register_organization(
    data: OrganizationRegisterRequest,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(get_current_user),
):
    """组织注册（需认证，creator_id自动从token填充）"""
    try:
        creator_id = current_user.sub
        return await IdentityService(db).register_organization(data, creator_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.get("/me", response_model=ProfileResponse)
async def get_my_profile(
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(get_current_user),
):
    """获取当前用户/Agent profile"""
    try:
        user_id = current_user.sub
        user_type = current_user.user_type
        return await IdentityService(db).get_profile(user_id, user_type)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

@router.get("/my-agents", response_model=MyAgentsResponse)
async def get_my_agents(
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(get_current_user),
):
    """获取当前用户的agent列表"""
    try:
        user_id = current_user.sub
        return await IdentityService(db).my_agents(user_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

@router.put("/me", response_model=ProfileResponse)
async def update_my_profile(
    data: ProfileUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(get_current_user),
):
    """更新profile"""
    try:
        user_id = current_user.sub
        user_type = current_user.user_type
        return await IdentityService(db).update_profile(user_id, user_type, data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

@router.put("/my-agents/{agent_id}/status", response_model=AgentStatusUpdateResponse)
async def update_agent_status(
    agent_id: str,
    data: AgentStatusUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(get_current_user),
):
    """更新Agent状态 - 叫停(frozen/suspended)或恢复(active)"""
    try:
        owner_id = current_user.sub
        return await IdentityService(db).update_agent_status(owner_id, agent_id, data.status)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN if "只能修改自己的" in str(e) else status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

@router.delete("/my-agents/{agent_id}", response_model=DeleteAgentResponse)
async def delete_my_agent(
    agent_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(get_current_user),
):
    """删除当前用户的agent（仅能删除自己的）"""
    try:
        owner_id = current_user.sub
        return await IdentityService(db).delete_agent(owner_id, agent_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN if "只能删除自己的" in str(e) else status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
