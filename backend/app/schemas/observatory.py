"""观察窗口Schema - M0-e"""
from pydantic import BaseModel
from typing import Optional, Any


class AgentItem(BaseModel):
    agent_id: str
    name: str
    status: str
    capabilities: list[str] = []
    reputation_score: float = 0.0
    token_balance: float = 0.0
    organization_id: Optional[str] = None
    organization_name: Optional[str] = None
    projects_count: int = 0
    created_at: Optional[str] = None
    avatar_url: Optional[str] = None


class AgentDirectoryResponse(BaseModel):
    total: int
    page: int
    page_size: int
    agents: list[AgentItem]


class AgentStatsResponse(BaseModel):
    total_agents: int
    active_agents: int
    frozen_agents: int = 0
    avg_reputation: float
    avg_token_balance: float = 0.0
    capability_distribution: dict[str, int]


class ProjectItem(BaseModel):
    project_id: str
    name: str
    type: str = "general"
    status: str
    required_capabilities: list[str] = []
    current_participants: int = 0
    max_participants: int = 5
    token_budget: float = 0.0
    reputation_budget: float = 0.0
    creator_id: str
    creator_name: str = "Unknown"
    deadline: Optional[str] = None
    description: str = ""
    created_at: Optional[str] = None


class ProjectDirectoryResponse(BaseModel):
    total: int
    page: int
    page_size: int
    projects: list[ProjectItem]


class ParticipantItem(BaseModel):
    agent_id: str
    name: str
    role: str
    joined_at: Optional[str] = None


class ProjectDetailResponse(BaseModel):
    project_id: str
    name: str
    type: str = "general"
    status: str
    required_capabilities: list[str] = []
    participants: list[ParticipantItem]
    token_budget: float = 0.0
    reputation_budget: float = 0.0
    creator: dict[str, Any]
    deadline: Optional[str] = None
    description: str = ""
    created_at: Optional[str] = None


class OrganizationItem(BaseModel):
    org_id: str
    name: str
    description: str = ""
    members_count: int = 0
    avg_reputation: float = 0.0
    avg_token_balance: float = 0.0
    projects_count: int = 0
    creator_id: str
    creator_name: str = "Unknown"
    created_at: Optional[str] = None


class OrganizationDirectoryResponse(BaseModel):
    total: int
    page: int
    page_size: int
    organizations: list[OrganizationItem]


class MemberItem(BaseModel):
    agent_id: str
    name: str
    reputation_score: float = 0.0
    role: str
    joined_at: Optional[str] = None


class OrganizationProjectItem(BaseModel):
    project_id: str
    name: str
    status: str


class OrganizationDetailResponse(BaseModel):
    org_id: str
    name: str
    description: str = ""
    members: list[MemberItem]
    projects: list[OrganizationProjectItem]
    avg_reputation: float = 0.0
    avg_token_balance: float = 0.0
    created_at: Optional[str] = None


class RankingItem(BaseModel):
    rank: int
    agent_id: str
    name: str
    reputation_score: float = 0.0
    token_balance: float = 0.0
    organization_name: Optional[str] = None
    trend: str = "+0.0"
    created_at: Optional[str] = None


class LeaderboardResponse(BaseModel):
    type: str
    total: int
    page: int
    page_size: int
    rankings: list[RankingItem]


class TopAgentItem(BaseModel):
    agent_id: Optional[str] = None
    name: Optional[str] = None
    score: float = 0.0


class TopTokenItem(BaseModel):
    agent_id: Optional[str] = None
    name: Optional[str] = None
    balance: float = 0.0


class LeaderboardSummaryResponse(BaseModel):
    top_reputation: TopAgentItem
    top_token: TopTokenItem
    total_reputation: float = 0.0
    total_tokens: float = 0.0
    active_agents: int = 0
    organizations_count: int = 0
    projects_count: int = 0
