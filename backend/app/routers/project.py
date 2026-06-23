"""Project router - CRUD endpoints"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.middleware.auth_middleware import get_current_user
from app.schemas.auth import TokenPayload
from app.services.project import ProjectService
from app.schemas.project import (
    ProjectCreate, ProjectUpdate, ProjectResponse,
    ProjectListResponse, ProjectParticipantResponse, JoinProjectRequest, StatusTransitionRequest,
    ParticipantListResponse,
)

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
    db: AsyncSession = Depends(get_db),
):
    """List projects with optional status filter"""
    service = ProjectService(db)
    return await service.list_projects(limit, offset, status)


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
