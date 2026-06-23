"""观察窗口路由 - M0-e SPEC"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas.observatory import *
from app.services.observatory import ObservatoryService

router = APIRouter(prefix="/observatory", tags=["observatory"])

@router.get("/agents", response_model=AgentDirectoryResponse)
async def agent_directory(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str = Query(""),
    capability: str = Query(""),
    status: str = Query("active"),
    sort_by: str = Query("reputation"),
    sort_order: str = Query("desc"),
    db: AsyncSession = Depends(get_db)
):
    svc = ObservatoryService(db)
    return await svc.list_agents(page, page_size, search, capability, status, sort_by, sort_order)

@router.get("/agents/stats", response_model=AgentStatsResponse)
async def agent_stats(db: AsyncSession = Depends(get_db)):
    svc = ObservatoryService(db)
    return await svc.get_agent_stats()

@router.get("/projects", response_model=ProjectDirectoryResponse)
async def project_directory(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str = Query(""),
    status: str = Query("all"),
    type: str = Query(""),
    capability: str = Query(""),
    sort_by: str = Query("created_at"),
    sort_order: str = Query("desc"),
    db: AsyncSession = Depends(get_db)
):
    svc = ObservatoryService(db)
    return await svc.list_projects(page, page_size, search, status, type, capability, sort_by, sort_order)

@router.get("/projects/{project_id}", response_model=ProjectDetailResponse)
async def project_detail(project_id: str, db: AsyncSession = Depends(get_db)):
    svc = ObservatoryService(db)
    return await svc.get_project_detail(project_id)

@router.get("/organizations", response_model=OrganizationDirectoryResponse)
async def organization_directory(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str = Query(""),
    org_type: str = Query(""),
    status: str = Query("active"),
    sort_by: str = Query("members_count"),
    sort_order: str = Query("desc"),
    db: AsyncSession = Depends(get_db)
):
    svc = ObservatoryService(db)
    return await svc.list_organizations(page, page_size, search, org_type, status, sort_by, sort_order)

@router.get("/organizations/{org_id}", response_model=OrganizationDetailResponse)
async def organization_detail(org_id: str, db: AsyncSession = Depends(get_db)):
    svc = ObservatoryService(db)
    return await svc.get_organization_detail(org_id)

@router.get("/leaderboard", response_model=LeaderboardResponse)
async def leaderboard(
    type: str = Query("reputation"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=50),
    organization: str = Query(""),
    time_range: str = Query("all"),
    db: AsyncSession = Depends(get_db)
):
    svc = ObservatoryService(db)
    return await svc.get_leaderboard(type, page, page_size, organization, time_range)

@router.get("/leaderboard/summary", response_model=LeaderboardSummaryResponse)
async def leaderboard_summary(db: AsyncSession = Depends(get_db)):
    svc = ObservatoryService(db)
    return await svc.get_leaderboard_summary()
