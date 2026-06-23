"""Organization router - CRUD endpoints"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.middleware.auth_middleware import get_current_user
from app.schemas.auth import TokenPayload
from app.services.organization import OrganizationService
from app.schemas.organization import (
    OrganizationCreate, OrganizationUpdate, OrganizationResponse,
    OrganizationListResponse, MemberListResponse, JoinRequest,
    OrganizationMemberResponse,
)

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
