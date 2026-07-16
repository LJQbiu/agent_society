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
    ChatMessageCreate, ChatMessageResponse, ChatMessageListResponse,
    TodoCreate, TodoUpdate, TodoClaimRequest, ProjectTodoResponse, TodoListResponse,
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
    service = ProjectService(db)
    return await service.list_project_a2a_messages(project_id, limit, offset)


# ---- Chat Message Endpoints ----

@router.post("/{project_id}/chat", response_model=ChatMessageResponse)
async def send_chat_message(
    project_id: str,
    req: ChatMessageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(get_current_user),
):
    """Send a chat message in a project (human or agent)"""
    service = ProjectService(db)
    try:
        return await service.send_chat_message(project_id, req, current_user)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{project_id}/chat", response_model=ChatMessageListResponse)
async def list_chat_messages(
    project_id: str,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    """List chat messages for a project"""
    service = ProjectService(db)
    return await service.list_chat_messages(project_id, limit, offset)


# ---- Project TODO Endpoints ----

@router.post("/{project_id}/todos", response_model=ProjectTodoResponse)
async def create_todo(
    project_id: str,
    req: TodoCreate,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(get_current_user),
):
    """Create a TODO - only project leader can create"""
    service = ProjectService(db)
    try:
        return await service.create_todo(project_id, req, current_user)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{project_id}/todos", response_model=TodoListResponse)
async def list_todos(
    project_id: str,
    db: AsyncSession = Depends(get_db),
):
    """List TODOs for a project"""
    service = ProjectService(db)
    return await service.list_todos(project_id)


@router.put("/{project_id}/todos/{todo_id}", response_model=ProjectTodoResponse)
async def update_todo(
    project_id: str,
    todo_id: str,
    req: TodoUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(get_current_user),
):
    """Update a TODO - leader or claimer can update"""
    service = ProjectService(db)
    try:
        return await service.update_todo(project_id, todo_id, req, current_user)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{project_id}/todos/{todo_id}")
async def delete_todo(
    project_id: str,
    todo_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(get_current_user),
):
    """Delete a TODO - only leader can delete"""
    service = ProjectService(db)
    try:
        return await service.delete_todo(project_id, todo_id, current_user)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{project_id}/todos/{todo_id}/claim", response_model=ProjectTodoResponse)
async def claim_todo(
    project_id: str,
    todo_id: str,
    req: TodoClaimRequest,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(get_current_user),
):
    """Claim a TODO - any active participant can claim an open TODO"""
    service = ProjectService(db)
    try:
        return await service.claim_todo(project_id, todo_id, req, current_user)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
