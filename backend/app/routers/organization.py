"""Organization router - CRUD endpoints"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.database import get_db
from app.middleware.auth_middleware import get_current_user
from app.schemas.auth import TokenPayload
from app.services.organization import OrganizationService
from app.schemas.organization import (
    OrganizationCreate, OrganizationUpdate, OrganizationResponse,
    OrganizationListResponse, MemberListResponse, JoinRequest,
    OrganizationMemberResponse,
)
from app.models.a2a import Message
from app.models.organization import OrganizationMember
from app.models.agent import Agent

router = APIRouter(prefix="/organization", tags=["Organization"])


@router.post("/create", response_model=OrganizationResponse)
async def create_organization(
    req: OrganizationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(get_current_user),
):
    service = OrganizationService(db)
    try:
        org = await service.create_organization(req, current_user.sub)
        await db.commit()
        return OrganizationResponse.model_validate(org)
    except ValueError as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/list", response_model=OrganizationListResponse)
async def list_organizations(
    limit: int = 20, offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    service = OrganizationService(db)
    return await service.list_organizations(limit, offset)


@router.get("/{org_id}", response_model=OrganizationResponse)
async def get_organization(org_id: str, db: AsyncSession = Depends(get_db)):
    service = OrganizationService(db)
    try:
        org = await service.get_organization(org_id)
        return OrganizationResponse.model_validate(org)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/{org_id}/update", response_model=OrganizationResponse)
async def update_organization(
    org_id: str,
    req: OrganizationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(get_current_user),
):
    service = OrganizationService(db)
    try:
        org = await service.update_organization(org_id, req, current_user.sub)
        await db.commit()
        return OrganizationResponse.model_validate(org)
    except ValueError as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{org_id}/join", response_model=OrganizationMemberResponse)
async def join_organization(
    org_id: str,
    req: JoinRequest,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(get_current_user),
):
    service = OrganizationService(db)
    try:
        member = await service.join_organization(org_id, req, current_user.sub)
        await db.commit()
        return OrganizationMemberResponse.model_validate(member)
    except ValueError as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{org_id}/members", response_model=MemberListResponse)
async def list_members(org_id: str, db: AsyncSession = Depends(get_db)):
    service = OrganizationService(db)
    return await service.list_members(org_id)


@router.get("/{org_id}/messages")
async def list_organization_messages(
    org_id: str,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    """Get A2A conversation messages between agents in this organization"""
    # Get agent_id_str values from org members who have agents
    stmt = select(Agent.agent_id_str, Agent.name).join(
        OrganizationMember, OrganizationMember.agent_id == Agent.id
    ).where(OrganizationMember.organization_id == org_id)
    result = await db.execute(stmt)
    agent_pairs = result.all()
    
    if not agent_pairs:
        return {"messages": [], "total": 0}
    
    agent_id_strs = [p[0] for p in agent_pairs]
    agent_names = {p[0]: p[1] for p in agent_pairs}
    
    # Query messages where both sender and receiver are in this org
    msg_stmt = select(
        Message.message_id, Message.from_agent_id, Message.to_agent_id,
        Message.message_type, Message.content, Message.priority,
        Message.status, Message.created_at
    ).where(
        and_(
            Message.from_agent_id.in_(agent_id_strs),
            Message.to_agent_id.in_(agent_id_strs),
        )
    ).order_by(Message.created_at.desc()).limit(limit)
    
    messages = await db.execute(msg_stmt)
    msg_rows = messages.all()
    
    # Count total
    count_stmt = select(Message.message_id).where(
        and_(
            Message.from_agent_id.in_(agent_id_strs),
            Message.to_agent_id.in_(agent_id_strs),
        )
    )
    total_result = await db.execute(count_stmt)
    total = len(total_result.all())
    
    msg_list = []
    for m in msg_rows:
        content = m[4] or {}
        text_content = content.get("text", "") if isinstance(content, dict) else str(content)
        msg_list.append({
            "message_id": str(m[0]),
            "from_agent_id": m[1],
            "from_agent_name": agent_names.get(m[1], m[1]),
            "to_agent_id": m[2],
            "to_agent_name": agent_names.get(m[2], m[2]),
            "message_type": m[3],
            "content": content,
            "text": text_content,
            "priority": m[5],
            "status": m[6],
            "created_at": m[7].isoformat() if m[7] else None,
        })

    return {"messages": msg_list, "total": total}
