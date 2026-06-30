"""管理员制动Schema - M0-h"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from uuid import UUID

# ===== 初始化+认证 =====

class AdminInitRequest(BaseModel):
    super_admin_username: str = Field(min_length=3, max_length=50)
    super_admin_email: str
    super_admin_password: str = Field(min_length=8)

class AdminInitResponse(BaseModel):
    admin_id: str
    username: str
    role: str = "super_admin"
    message: str

class AdminLoginRequest(BaseModel):
    username: str
    password: str

class AdminLoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    admin_id: str
    role: str
    username: str

class CreateAdminRequest(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: str
    password: str = Field(min_length=8)
    role: str = Field(default="auditor", pattern="^(admin|auditor)$")

class CreateAdminResponse(BaseModel):
    admin_id: str
    username: str
    role: str
    created_by: str

# ===== Agent制动 =====

class FreezeAgentRequest(BaseModel):
    reason: str = Field(min_length=1)
    duration_hours: Optional[int] = None  # None=永久冻结，有值=定时解冻

class FreezeAgentResponse(BaseModel):
    agent_id: str
    previous_status: str
    new_status: str = "frozen"
    reason: str
    audit_id: str
    auto_unfreeze_at: Optional[datetime] = None

class UnfreezeAgentRequest(BaseModel):
    reason: str = Field(min_length=1)

class UnfreezeAgentResponse(BaseModel):
    agent_id: str
    previous_status: str
    new_status: str = "active"
    reason: str
    audit_id: str

class RevokeAgentRequest(BaseModel):
    reason: str = Field(min_length=1)

class RevokeAgentResponse(BaseModel):
    agent_id: str
    previous_status: str
    new_status: str = "revoked"
    reason: str
    audit_id: str

# ===== Project制动 =====

class SuspendProjectRequest(BaseModel):
    reason: str = Field(min_length=1)

class SuspendProjectResponse(BaseModel):
    project_id: str
    previous_status: str
    new_status: str = "suspended"
    reason: str
    audit_id: str

class ResumeProjectRequest(BaseModel):
    reason: str = Field(min_length=1)

class ResumeProjectResponse(BaseModel):
    project_id: str
    previous_status: str
    new_status: str = "active"
    reason: str
    audit_id: str

# ===== Organization制动 =====

class SuspendOrgRequest(BaseModel):
    reason: str = Field(min_length=1)

class SuspendOrgResponse(BaseModel):
    org_id: str
    previous_status: str
    new_status: str = "suspended"
    reason: str
    audit_id: str

class ResumeOrgRequest(BaseModel):
    reason: str = Field(min_length=1)

class ResumeOrgResponse(BaseModel):
    org_id: str
    previous_status: str
    new_status: str = "active"
    reason: str
    audit_id: str

# ===== Token账户制动 =====

class FreezeAccountRequest(BaseModel):
    reason: str = Field(min_length=1)

class FreezeAccountResponse(BaseModel):
    account_holder_id: str
    holder_type: str  # human | agent
    previous_status: str
    new_status: str = "frozen"
    current_balance: float
    reason: str
    audit_id: str

# ===== 审计日志 =====

class AuditLogEvent(BaseModel):
    event_id: str
    event_type: str
    actor_id: str
    actor_role: str
    target_id: str
    target_type: str
    details: dict
    created_at: datetime

class AuditLogResponse(BaseModel):
    events: list[AuditLogEvent]
    total: int
    page: int
    page_size: int

# ===== 紧急制动（POST /admin/brake） =====

class BrakeRequest(BaseModel):
    scope: str = Field(pattern="^(all|agents|projects|organizations|accounts)$")
    reason: str = Field(min_length=1)

class BrakeResponse(BaseModel):
    scope: str
    frozen_count: int
    reason: str
    audit_id: str
    message: str

# ===== 别名（router友好命名） =====
AdminTokenResponse = AdminLoginResponse
AdminCreateRequest = CreateAdminRequest
AdminCreateResponse = CreateAdminResponse
FreezeRequest = FreezeAgentRequest
FreezeResponse = FreezeAgentResponse
UnfreezeRequest = UnfreezeAgentRequest
UnfreezeResponse = UnfreezeAgentResponse
RevokeRequest = RevokeAgentRequest
RevokeResponse = RevokeAgentResponse

class UnfreezeAccountRequest(BaseModel):
    reason: str = Field(min_length=1)

class UnfreezeAccountResponse(BaseModel):
    account_holder_id: str
    holder_type: str
    previous_status: str
    new_status: str = "active"
    current_balance: float
    reason: str
    audit_id: str

# ===== 清理/删除（Admin Dashboard） =====

class PurgeRequest(BaseModel):
    """批量清理请求"""
    scope: str = Field(pattern="^(projects|organizations|agents|all)$")
    filter: str = Field(default="test", pattern="^(test|inactive|all)$")  # test=名称含test, inactive=非active状态, all=全部
    confirm: bool = Field(default=False)  # 安全确认

class PurgeResponse(BaseModel):
    scope: str
    filter: str
    deleted_projects: int = 0
    deleted_organizations: int = 0
    deleted_agents: int = 0
    audit_id: str
    message: str

class DeleteProjectResponse(BaseModel):
    project_id: str
    project_name: str
    audit_id: str
    message: str

class DeleteOrganizationResponse(BaseModel):
    org_id: str
    org_name: str
    audit_id: str
    message: str

class DeleteAgentResponse(BaseModel):
    agent_id: str
    agent_name: str
    audit_id: str
    message: str

class ProjectListItem(BaseModel):
    id: str
    name: str
    type: str
    status: str
    budget: float
    creator_id: str
    created_at: Optional[datetime] = None

class OrganizationListItem(BaseModel):
    id: str
    name: str
    org_type: str
    status: str
    reputation: float
    creator_id: str
    created_at: Optional[datetime] = None

class AgentListItem(BaseModel):
    id: str
    agent_id_str: str
    name: str
    status: str
    owner_id: str
    capabilities: list = []
    created_at: Optional[datetime] = None

class AdminDashboardStats(BaseModel):
    total_projects: int
    total_organizations: int
    total_agents: int
    total_humans: int
    total_messages: int
    active_projects: int
    active_organizations: int
    active_agents: int

class AdminDashboardResponse(BaseModel):
    stats: AdminDashboardStats
    recent_projects: list[ProjectListItem] = []
    recent_organizations: list[OrganizationListItem] = []
    recent_agents: list[AgentListItem] = []

class ListProjectsResponse(BaseModel):
    projects: list[ProjectListItem]
    total: int
    page: int
    page_size: int

class ListOrganizationsResponse(BaseModel):
    organizations: list[OrganizationListItem]
    total: int
    page: int
    page_size: int

class ListAgentsResponse(BaseModel):
    agents: list[AgentListItem]
    total: int
    page: int
    page_size: int
