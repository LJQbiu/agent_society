"""A2A协议路由 - M0-d 完整实现"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas.a2a import (
    AgentCardResponse, AgentCardUpdate, PlatformAgentCard,
    DiscoverRequest, DiscoverResponse,
    MessageSend, MessageResponse, MessageListRequest, MessageListResponse,
    MessageStatusUpdate, MessageStatusResponse, AgentRegistration,
)
from app.services.a2a import A2AService
from app.middleware.auth_middleware import get_current_user, require_admin

router = APIRouter(prefix="/a2a", tags=["a2a"])
well_known_router = APIRouter(tags=["a2a"])


# === Platform Agent Card (/.well-known/agent.json) ===

@well_known_router.get("/.well-known/agent.json", response_model=PlatformAgentCard)
async def get_platform_card():
    """平台Agent Card - A2A协议标准端点（根路径）"""
    return await A2AService(None).get_platform_card()


# === Agent Card CRUD ===

@router.post("/agents/register", response_model=AgentCardResponse, status_code=status.HTTP_201_CREATED)
async def register_agent_card(
    data: AgentRegistration,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """注册Agent Card（Agent创建时自动调用，自动创建Agent记录）"""
    service = A2AService(db)
    # 从current_user提取owner_id (sub是纯UUID, user_type标识角色)
    owner_id = None
    if current_user and current_user.user_type == "human":
        owner_id = current_user.sub
    try:
        return await service.register_agent_card(data.agent_id, data, owner_id=owner_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/agents/{agent_id}/card", response_model=AgentCardResponse)
async def get_agent_card(
    agent_id: str,
    db: AsyncSession = Depends(get_db),
):
    """查询指定Agent的Card"""
    service = A2AService(db)
    try:
        return await service.get_agent_card(agent_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/agents/{agent_id}/card", response_model=AgentCardResponse)
async def update_agent_card(
    agent_id: str,
    data: AgentCardUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Agent更新自己的Card（不变量：仅自己可改，不可改reputation/status）"""
    service = A2AService(db)
    try:
        return await service.update_agent_card(agent_id, data, current_user.sub)
    except ValueError as e:
        if "403" in str(e):
            raise HTTPException(status_code=403, detail=str(e))
        raise HTTPException(status_code=404, detail=str(e))


# === Agent Discovery ===

@router.get("/agents/discover", response_model=DiscoverResponse)
async def discover_agents(
    params: DiscoverRequest = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """Agent发现/搜索"""
    service = A2AService(db)
    return await service.discover_agents(params)


# === Messages ===

@router.post("/messages", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def send_message(
    data: MessageSend,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Agent间消息发送（不变量：from_agent_id必须匹配token的sub）"""
    service = A2AService(db)
    try:
        return await service.send_message(data, current_user.sub)
    except ValueError as e:
        if "match" in str(e):
            raise HTTPException(status_code=403, detail=str(e))
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/messages/{agent_id}", response_model=MessageListResponse)
async def get_messages(
    agent_id: str,
    direction: str = "inbound",
    message_type: str = None,
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """查询Agent的消息（inbound/outbound/all）"""
    service = A2AService(db)
    params = MessageListRequest(
        direction=direction,
        message_type=message_type,
        page=page,
        page_size=page_size,
    )
    return await service.get_inbound_messages(agent_id, params)


@router.put("/messages/{message_id}/status", response_model=MessageStatusResponse)
async def update_message_status(
    message_id: str,
    data: MessageStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """消息状态更新（不变量：必须是接收方）"""
    service = A2AService(db)
    try:
        return await service.update_message_status(message_id, data, current_user.sub)
    except ValueError as e:
        if "recipient" in str(e):
            raise HTTPException(status_code=403, detail=str(e))
        if "transition" in str(e):
            raise HTTPException(status_code=400, detail=str(e))
        raise HTTPException(status_code=404, detail=str(e))
