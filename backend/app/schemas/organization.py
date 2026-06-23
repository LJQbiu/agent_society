"""Organization schemas"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from uuid import UUID

# Alias to avoid Pydantic v2 conflict with SQLAlchemy model name
OrgCreateRequest = None  # placeholder, defined below

class OrganizationCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str = Field(default="", max_length=500)
    org_type: str = Field(default="team", pattern="^(team|guild|company|DAO)$")
    governance_model: str = Field(default="democratic")
    charter: Optional[dict] = None

class OrganizationUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    org_type: Optional[str] = Field(None, pattern="^(team|guild|company|DAO)$")
    governance_model: Optional[str] = None
    charter: Optional[dict] = None

class OrganizationResponse(BaseModel):
    id: UUID
    name: str
    description: str
    org_type: str
    status: str
    governance_model: str
    reputation: float
    balance: float
    charter: dict
    creator_id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}

class OrganizationMemberResponse(BaseModel):
    id: UUID
    organization_id: UUID
    human_id: UUID
    agent_id: Optional[UUID] = None
    role: str
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}

class JoinRequest(BaseModel):
    agent_id: Optional[UUID] = None  # Optional: join with specific agent

class OrganizationListResponse(BaseModel):
    organizations: List[OrganizationResponse]
    total: int
    limit: int
    offset: int

class MemberListResponse(BaseModel):
    members: List[OrganizationMemberResponse]
    total: int
