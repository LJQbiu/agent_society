"""Project router - CRUD endpoints"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.database import get_db
from app.middleware.auth_middleware import get_current_user
from app.schemas.auth import TokenPayload
from app.services.project import ProjectService
from app.schemas.project import (
    ProjectCreate, ProjectUpdate, ProjectResponse,
    ProjectListResponse, ProjectParticipantResponse, JoinProjectRequest, StatusTransitionRequest,
    ParticipantListResponse,
)
from app.models.a2a import Message
from app.models.project import ProjectParticipant
from app.models.agent import Agent

router = APIRouter(prefix="/project", tags=["project"])


@router.post("/create", response_model=ProjectResponse)
async def create_project(
    req: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(get_current_user),
):
    """Create a new project"""
    service = ProjectService(db)
    try:
        return await service.create_project(req, current_user)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/list", response_model=ProjectListResponse)
async def list_projects(
    limit: int = 20, offset: int = 0, status: str = None,
    owner_id: str = None,
    db: AsyncSession = Depends(get_db),
):
    """List projects with optional status/owner_id filter. owner_id filters by human owner of creator agent."""
    service = ProjectService(db)
    return await service.list_projects(limit, offset, status, owner_id)


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: str, db: AsyncSession = Depends(get_db)):
    """Get project details"""
    service = ProjectService(db)
    try:
        return await service.get_project(project_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/{project_id}/update", response_model=ProjectResponse)
async def update_project(
    project_id: str,
    req: ProjectUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(get_current_user),
):
    """Update project. Only leader (or owner of leader) can update."""
    service = ProjectService(db)
    try:
        return await service.update_project(project_id, req, current_user)
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.post("/{project_id}/join", response_model=ProjectParticipantResponse)
async def join_project(
    project_id: str,
    req: JoinProjectRequest,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(get_current_user),
):
    """Join a project as a participant"""
    service = ProjectService(db)
    try:
        return await service.join_project(project_id, req, current_user)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{project_id}/leave")
async def leave_project(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(get_current_user),
):
    """Leave a project"""
    service = ProjectService(db)
    try:
        return await service.leave_project(project_id, current_user)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{project_id}/status", response_model=ProjectResponse)
async def transition_status(
    project_id: str,
    req: StatusTransitionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(get_current_user),
):
    """Transition project status. Only leader can change."""
    service = ProjectService(db)
    try:
        return await service.transition_status(project_id, req, current_user)
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.get("/{project_id}/participants", response_model=ParticipantListResponse)
async def list_participants(project_id: str, db: AsyncSession = Depends(get_db)):
    """List project participants"""
    service = ProjectService(db)
    return await service.list_participants(project_id)


@router.get("/{project_id}/messages")
async def list_project_messages(
    project_id: str,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    """List A2A conversation messages between project participant agents"""
    from uuid import UUID as UUIDType
    from sqlalchemy import text

    # 1. Get participant agent_ids, join with agents to get agent_id_str
    query = text("""
        SELECT a.agent_id_str, a.name
        FROM project_participants pp
        JOIN agents a ON pp.agent_id = a.id
        WHERE pp.project_id = :project_id
    """)
    result = await db.execute(query, {"project_id": UUIDType(project_id)})
    agent_map_rows = result.fetchall()

    if not agent_map_rows:
        return {"messages": [], "total": 0}

    # Build agent_id_str -> name mapping
    agent_id_strs = [row[0] for row in agent_map_rows]
    agent_names = {row[0]: row[1] for row in agent_map_rows}

    # 2. Query messages where BOTH from and to are project participants
    msg_query = text("""
        SELECT id, from_agent_id, to_agent_id, message_type, content, priority, status, created_at
        FROM messages
        WHERE from_agent_id IN :agent_ids AND to_agent_id IN :agent_ids
        ORDER BY created_at DESC
        LIMIT :limit OFFSET :offset
    """)
    # asyncpg doesn't support tuple params directly, use individual placeholders
    placeholders = ", ".join([f"'{aid}'" for aid in agent_id_strs])
    msg_query_str = f"""
        SELECT id, from_agent_id, to_agent_id, message_type, content, priority, status, created_at
        FROM messages
        WHERE from_agent_id IN ({placeholders}) AND to_agent_id IN ({placeholders})
        ORDER BY created_at DESC
        LIMIT {limit} OFFSET {offset}
    """
    result = await db.execute(text(msg_query_str))
    messages = result.fetchall()

    # 3. Get total count
    count_query_str = f"""
        SELECT COUNT(*)
        FROM messages
        WHERE from_agent_id IN ({placeholders}) AND to_agent_id IN ({placeholders})
    """
    count_result = await db.execute(text(count_query_str))
    total = count_result.scalar()

    # 4. Build response with agent names
    msg_list = []
    for m in messages:
        content = m[4] if m[4] else {}
        # Extract text from content JSONB
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
