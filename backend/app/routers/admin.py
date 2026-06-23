"""管理员制动路由 - M0-h SPEC 完整实现"""
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from app.database import get_db
from app.schemas.admin import (
    AdminInitRequest, AdminInitResponse,
    AdminLoginRequest, AdminTokenResponse,
    AdminCreateRequest, AdminCreateResponse,
    FreezeRequest, FreezeResponse,
    UnfreezeRequest, UnfreezeResponse,
    RevokeRequest, RevokeResponse,
    SuspendProjectRequest, SuspendProjectResponse,
    ResumeProjectRequest, ResumeProjectResponse,
    SuspendOrgRequest, SuspendOrgResponse,
    ResumeOrgRequest, ResumeOrgResponse,
    FreezeAccountRequest, FreezeAccountResponse,
    UnfreezeAccountRequest, UnfreezeAccountResponse,
    BrakeRequest, BrakeResponse,
    AuditLogResponse,
)
from app.services.admin import AdminService
from app.models.governance import Admin
from app.middleware.auth_middleware import get_current_admin, require_admin_or_super, require_super_admin_model

router = APIRouter(prefix="/admin", tags=["admin"])

# ===== 初始化+认证（无需auth） =====

@router.post("/init", response_model=AdminInitResponse, status_code=201)
async def admin_init(data: AdminInitRequest, db: AsyncSession = Depends(get_db)):
    """超级管理员初始化（仅首次可用）"""
    try:
        return await AdminService(db).init_super_admin(data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))

@router.post("/login", response_model=AdminTokenResponse)
async def admin_login(data: AdminLoginRequest, db: AsyncSession = Depends(get_db)):
    """管理员登录"""
    try:
        return await AdminService(db).login(data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))

# ===== Admin管理（需super_admin） =====

@router.post("/admins", response_model=AdminCreateResponse, status_code=201)
async def create_admin(
    data: AdminCreateRequest,
    admin: Admin = Depends(require_super_admin_model),
    db: AsyncSession = Depends(get_db),
):
    """创建admin/auditor（仅super_admin）"""
    return await AdminService(db).create_admin(data, admin)

# ===== Agent制动 =====

@router.post("/agents/{agent_id}/freeze", response_model=FreezeResponse)
async def freeze_agent(
    agent_id: UUID,
    data: FreezeRequest,
    admin: Admin = Depends(require_admin_or_super),
    db: AsyncSession = Depends(get_db),
):
    """冻结Agent"""
    try:
        return await AdminService(db).freeze_agent(agent_id, data, admin)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.post("/agents/{agent_id}/unfreeze", response_model=UnfreezeResponse)
async def unfreeze_agent(
    agent_id: UUID,
    data: UnfreezeRequest,
    admin: Admin = Depends(require_admin_or_super),
    db: AsyncSession = Depends(get_db),
):
    """解冻Agent"""
    try:
        return await AdminService(db).unfreeze_agent(agent_id, data, admin)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.post("/agents/{agent_id}/revoke", response_model=RevokeResponse)
async def revoke_agent(
    agent_id: UUID,
    data: RevokeRequest,
    admin: Admin = Depends(require_super_admin_model),
    db: AsyncSession = Depends(get_db),
):
    """撤销Agent（仅super_admin）"""
    try:
        return await AdminService(db).revoke_agent(agent_id, data, admin)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

# ===== Project制动 =====

@router.post("/projects/{project_id}/suspend", response_model=SuspendProjectResponse)
async def suspend_project(
    project_id: UUID,
    data: SuspendProjectRequest,
    admin: Admin = Depends(require_admin_or_super),
    db: AsyncSession = Depends(get_db),
):
    """暂停项目"""
    try:
        return await AdminService(db).suspend_project(project_id, data, admin)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.post("/projects/{project_id}/resume", response_model=ResumeProjectResponse)
async def resume_project(
    project_id: UUID,
    data: ResumeProjectRequest,
    admin: Admin = Depends(require_admin_or_super),
    db: AsyncSession = Depends(get_db),
):
    """恢复项目"""
    try:
        return await AdminService(db).resume_project(project_id, data, admin)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

# ===== Organization制动 =====

@router.post("/organizations/{org_id}/suspend", response_model=SuspendOrgResponse)
async def suspend_organization(
    org_id: UUID,
    data: SuspendOrgRequest,
    admin: Admin = Depends(require_admin_or_super),
    db: AsyncSession = Depends(get_db),
):
    """暂停组织"""
    try:
        return await AdminService(db).suspend_organization(org_id, data, admin)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.post("/organizations/{org_id}/resume", response_model=ResumeOrgResponse)
async def resume_organization(
    org_id: UUID,
    data: ResumeOrgRequest,
    admin: Admin = Depends(require_admin_or_super),
    db: AsyncSession = Depends(get_db),
):
    """恢复组织"""
    try:
        return await AdminService(db).resume_organization(org_id, data, admin)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

# ===== Token账户制动 =====

@router.post("/accounts/{account_id}/freeze", response_model=FreezeAccountResponse)
async def freeze_account(
    account_id: UUID,
    data: FreezeAccountRequest,
    admin: Admin = Depends(require_admin_or_super),
    db: AsyncSession = Depends(get_db),
):
    """冻结Token账户"""
    try:
        return await AdminService(db).freeze_account(account_id, data, admin)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.post("/accounts/{account_id}/unfreeze", response_model=UnfreezeAccountResponse)
async def unfreeze_account(
    account_id: UUID,
    data: UnfreezeAccountRequest,
    admin: Admin = Depends(require_admin_or_super),
    db: AsyncSession = Depends(get_db),
):
    """解冻Token账户"""
    try:
        return await AdminService(db).unfreeze_account(account_id, data, admin)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

# ===== 紧急制动 =====

@router.post("/brake", response_model=BrakeResponse)
async def emergency_brake(
    data: BrakeRequest,
    admin: Admin = Depends(require_super_admin_model),
    db: AsyncSession = Depends(get_db),
):
    """紧急制动（仅super_admin）- 批量冻结"""
    return await AdminService(db).brake(data, admin)

# ===== 审计日志 =====

@router.get("/audit", response_model=AuditLogResponse)
async def get_audit_log(
    event_type: str = Query(None),
    target_type: str = Query(None),
    start_time: str = Query(None),
    end_time: str = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    admin: Admin = Depends(require_admin_or_super),
    db: AsyncSession = Depends(get_db),
):
    """审计日志查询（admin+auditor可访问）"""
    return await AdminService(db).get_audit_log(
        event_type, target_type, start_time, end_time, page, page_size
    )
