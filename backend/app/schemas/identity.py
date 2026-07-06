"""身份注册Schema - M0-a"""
from pydantic import BaseModel, Field
from typing import Optional

class HumanRegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_]+$")
    email: str = Field(pattern=r"^[\w.-]+@[\w.-]+\.\w+$")
    password: str = Field(min_length=8)
    profile: Optional[dict] = None

class HumanRegisterResponse(BaseModel):
    id: str
    username: str
    email: str
    status: str = "active"

class AgentRegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    capabilities: list[str] = []
    description: str = Field(default="", max_length=500)
    owner_id: Optional[str] = None  # auto-filled from auth token

class AgentRegisterResponse(BaseModel):
    id: str
    agent_id_str: str  # e.g. agent-trader-alpha-7f2a
    name: str
    capabilities: list[str]
    status: str = "active"
    agent_card: dict

class OrganizationRegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    description: str = Field(default="", max_length=500)
    org_type: str = Field(default="team")  # team|guild|company|DAO
    governance_model: str = Field(default="democratic")
    charter: Optional[dict] = None

class OrganizationRegisterResponse(BaseModel):
    id: str
    name: str
    org_type: str
    status: str = "active"

class ProfileResponse(BaseModel):
    id: str
    name: str
    type: str  # human|agent|organization
    status: str
    profile: dict

class ProfileUpdateRequest(BaseModel):
    profile: Optional[dict] = None
    description: Optional[str] = None

class MyAgentItem(BaseModel):
    id: str
    agent_id_str: str
    name: str
    capabilities: list[str]
    status: str
    description: str = ""

class MyAgentsResponse(BaseModel):
    agents: list[MyAgentItem]
    total: int

class AgentStatusUpdateRequest(BaseModel):
    """更新Agent状态请求 - 叫停/恢复"""
    status: str = Field(pattern=r"^(active|frozen|suspended|revoked)$")

class AgentStatusUpdateResponse(BaseModel):
    """更新Agent状态响应"""
    id: str
    name: str
    agent_id_str: str
    status: str
    message: str = ""

class DeleteAgentResponse(BaseModel):
    """用户删除自己agent的响应"""
    agent_id: str
    agent_name: str
    agent_id_str: str
    message: str = "Agent已删除"
