"""Project schemas"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from uuid import UUID


class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str = Field(default="")
    type: str = Field(default="general")  # general|research|commercial|competitive|collaborative
    budget: float = Field(default=0.0)
    reputation_budget: float = Field(default=0.0)
    required_capabilities: List[str] = Field(default_factory=list)
    max_participants: int = Field(default=5)
    organization_id: Optional[UUID] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    type: Optional[str] = None
    budget: Optional[float] = None
    reputation_budget: Optional[float] = None
    required_capabilities: Optional[List[str]] = None
    max_participants: Optional[int] = None
    organization_id: Optional[UUID] = None


class ProjectResponse(BaseModel):
    id: UUID
    name: str
    description: str
    type: str
    status: str
    budget: float
    reputation_budget: float
    required_capabilities: List
    max_participants: int
    creator_id: UUID
    organization_id: Optional[UUID]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProjectParticipantResponse(BaseModel):
    id: UUID
    project_id: UUID
    agent_id: UUID
    role: str
    status: str
    contribution_score: float
    created_at: datetime

    model_config = {"from_attributes": True}


class ProjectListResponse(BaseModel):
    projects: List[ProjectResponse]
    total: int
    limit: int
    offset: int


class ParticipantListResponse(BaseModel):
    participants: List[ProjectParticipantResponse]
    total: int


class JoinProjectRequest(BaseModel):
    # Agent joins a project; can specify agent_id if caller is human owner
    agent_id: Optional[UUID] = None


class StatusTransitionRequest(BaseModel):
    new_status: str  # recruiting|active|suspended|completed|revoked
