"""A2A Schema - M0-d 完整实现"""
from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import datetime


# === Agent Card ===

class AgentCardResponse(BaseModel):
    """Agent Card完整响应"""
    agent_id: str
    name: str
    description: str
    capabilities: list[str]
    status: str
    reputation: float
    trust_level: str
    endpoints: dict[str, Any]
    metadata: dict[str, Any] = Field(default_factory=dict)
    version: int = 1
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class AgentCardUpdate(BaseModel):
    """Agent更新自己的Card（仅允许description/capabilities/agent_name）"""
    agent_name: Optional[str] = None
    description: Optional[str] = None
    capabilities: Optional[list[str]] = None
    endpoints: Optional[dict[str, Any]] = None


class PlatformAgentCard(BaseModel):
    """/.well-known/agent.json 平台Agent Card"""
    agent_id: str = "platform-agent-society"
    name: str = "Agent自治社区平台"
    description: str = "A2A协议托管平台，提供Agent发现、消息通信、任务协商"
    capabilities: list[str] = ["agent-discovery", "message-relay", "task-negotiation", "reputation-tracking"]
    endpoints: dict[str, Any] = {
        "agent_card": "/.well-known/agent.json",
        "message": "/a2a/messages",
        "discover": "/a2a/agents/discover",
    }
    version: str = "0.1.0"


# === Agent Discovery ===

class DiscoverRequest(BaseModel):
    """Agent发现/搜索请求"""
    capability: Optional[str] = None
    status: Optional[str] = "active"
    search: Optional[str] = None
    trust_level: Optional[str] = None
    min_reputation: Optional[float] = None


class DiscoverResponse(BaseModel):
    """Agent发现/搜索响应"""
    agents: list[AgentCardResponse]
    total: int


# === Messages ===

class MessageSend(BaseModel):
    """消息发送请求"""
    from_agent_id: str
    to_agent_id: str
    content: dict[str, Any]  # {text, task_id?, parameters?}
    message_type: str = "text"  # text|task_request|task_response|info|negotiation
    priority: str = "normal"  # normal|urgent|low


class MessageResponse(BaseModel):
    """消息发送响应"""
    message_id: str
    from_agent_id: str
    to_agent_id: str
    message_type: str
    status: str = "delivered"
    created_at: str


class MessageListRequest(BaseModel):
    """消息列表查询请求"""
    direction: str = "inbound"  # inbound|outbound|all
    status: Optional[str] = None
    message_type: Optional[str] = None
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)


class MessageListResponse(BaseModel):
    """消息列表响应"""
    messages: list[MessageResponse]
    total: int
    page: int


class MessageStatusUpdate(BaseModel):
    """消息状态更新请求"""
    status: str  # read|processed|archived


class MessageStatusResponse(BaseModel):
    """消息状态更新响应"""
    message_id: str
    status: str
    timestamp: str


# === Agent Registration (隐式 - Agent创建时自动注册Card) ===

class AgentRegistration(BaseModel):
    """Agent Card初始注册数据"""
    agent_id: str
    name: str
    description: str
    capabilities: list[str]
    endpoints: dict[str, Any] = Field(default_factory=dict)
