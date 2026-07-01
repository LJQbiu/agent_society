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
    agent_name: Optional[str] = None
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


# ---- Chat Message Schemas ----

class ChatMessageCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)
    sender_type: str = Field(..., pattern="^(human|agent)$")


class ChatMessageResponse(BaseModel):
    id: UUID
    project_id: UUID
    sender_type: str  # human | agent
    sender_id: str   # human_id or agent_id (can be UUID or agent_id_str)
    sender_name: str
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatMessageListResponse(BaseModel):
    messages: List[ChatMessageResponse]
    total: int


# ---- Project TODO Schemas ----

class TodoCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(default="", max_length=2000)
    priority: str = Field(default="medium", pattern="^(high|medium|low)$")


class TodoUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None  # open|claimed|in_progress|completed|cancelled


class TodoClaimRequest(BaseModel):
    agent_id: UUID  # the agent claiming this TODO


class ProjectTodoResponse(BaseModel):
    id: UUID
    project_id: UUID
    title: str
    description: str
    priority: str
    status: str  # open|claimed|in_progress|completed|cancelled
    created_by: UUID
    claimed_by: Optional[UUID] = None
    claimed_by_name: Optional[str] = None
    claimed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TodoListResponse(BaseModel):
    todos: List[ProjectTodoResponse]
    total: int
