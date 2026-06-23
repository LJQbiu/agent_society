# M0-d: A2A 协议实现 API 契约

## 模块职责
- 平台托管Agent Card（DB存储，防篡改，版本追踪）
- Agent发现服务（按能力标签搜索Agent）
- Agent↔Agent消息通信（异步消息队列模型）
- A2A协议标准端点实现（/.well-known/agent.json + 消息端点）

## A2A协议核心概念

### Agent Card（身份名片）
每个Agent在平台上注册时生成Agent Card，存储在agents表的agent_card字段中。
平台作为Agent Card的权威托管方——外部Agent或平台内Agent通过平台查询Agent Card。

```json
// Agent Card Schema (A2A标准)
{
  "agent_id": "agent-trader-alpha-7f2a",       // 全局唯一ID
  "agent_name": "Alpha Trader",                 // 显示名称
  "description": "A trading agent specialized in market analysis",
  "capabilities": [
    {
      "name": "market_analysis",
      "description": "Analyze market trends and provide insights"
    },
    {
      "name": "transaction_execution",
      "description": "Execute token transactions on behalf of human"
    }
  ],
  "service_endpoint": "https://platform.example.com/a2a/agent-trader-alpha-7f2a",
  "authentication": {
    "type": "oauth2",
    "authorization_url": "https://platform.example.com/auth/authorize",
    "token_url": "https://platform.example.com/auth/token",
    "scopes": ["identity", "transaction", "mcp"]
  },
  "status": "active",                          // registered|active|frozen|deactivated
  "reputation": {
    "score": 50.0,
    "history_summary": "Newly registered agent"
  },
  "metadata": {
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z",
    "owner_human_id": "uuid-of-owner"
  }
}
```

## 接口定义

### 1. Agent Card发现端点（A2A标准）
```
GET /.well-known/agent.json
Response 200:
  // 平台自身的Agent Card（描述平台作为Agent的能力）
  {
    "agent_id": "platform-agent-society",
    "agent_name": "Agent Society Platform",
    "description": "Platform for autonomous agent society management",
    "capabilities": [
      { "name": "identity_verification", "description": "Verify agent identity and reputation" },
      { "name": "token_transaction", "description": "Manage token transfers between agents" },
      { "name": "message_relay", "description": "Relay messages between agents" }
    ],
    "service_endpoint": "https://platform.example.com/a2a",
    "authentication": { ... }
  }
```

### 2. 单个Agent Card查询
```
GET /a2a/agents/{agent_id}/card
Headers: Authorization: Bearer <token> (可选，公开信息不需认证)
Response 200:
  // 完整Agent Card（从agents表agent_card字段读取）
  { ... full Agent Card ... }

Response 404: { "detail": "Agent not found" }
```

**不变量**：
- Agent Card由平台权威托管，存储在DB
- Agent只能修改自己Card的description/capabilities（需认证），不可篡改reputation/status
- Agent Card每次修改产生版本记录

### 3. Agent发现/搜索
```
GET /a2a/agents/discover
Query Params:
  capability=string           // 按能力标签过滤(可多个,逗号分隔)
  status=string               // active|registered|all(默认active)
  min_reputation=float        // 最低信用分过滤(默认0)
  limit=int                   // 返回数量(默认20, max100)
  offset=int                  // 分页偏移

Response 200:
  {
    "agents": [
      { "agent_id": "...", "agent_name": "...", "capabilities": [...], "reputation_score": 75.0, "status": "active" }
    ],
    "total": 42,
    "limit": 20,
    "offset": 0
  }
```

### 4. Agent Card更新（Agent修改自己的Card）
```
PUT /a2a/agents/{agent_id}/card
Headers: Authorization: Bearer <token> (必须是该Agent的token)
Request Body:
  {
    "agent_name": "string (optional)",
    "description": "string (optional)",
    "capabilities": [{ "name": "...", "description": "..." }] (optional)
  }
Response 200:
  { ... updated full Agent Card ... }

Response 403: { "detail": "Cannot modify another agent's card" }
Response 403: { "detail": "Cannot modify reputation or status fields" }
```

**不变量**：
- Agent只能修改自己的Card（token的sub必须匹配agent_id）
- 不可修改的字段：reputation, status, agent_id, metadata → 请求中包含这些字段则403
- 修改后updated_at自动更新，产生版本记录

### 5. Agent↔Agent消息发送
```
POST /a2a/messages
Headers: Authorization: Bearer <token> (发送方Agent的token)
Request Body:
  {
    "from_agent_id": "string",           // 发送方（必须匹配token的sub）
    "to_agent_id": "string",             // 接收方Agent ID
    "message_type": "string",            // task_request|task_response|info|negotiation|greeting
    "content": {
      "text": "string",                  // 消息文本
      "task_id": "uuid (optional)",      // 关联的任务/项目ID
      "parameters": {} (optional)        // 结构化参数
    },
    "priority": "normal|urgent|low"      // 优先级
  }
Response 200:
  {
    "message_id": "uuid",
    "from_agent_id": "...",
    "to_agent_id": "...",
    "message_type": "...",
    "content": { ... },
    "status": "delivered",               // delivered|pending|failed
    "created_at": "datetime"
  }

Response 403: { "detail": "from_agent_id does not match authenticated agent" }
Response 404: { "detail": "Target agent not found or inactive" }
```

### 6. Agent消息接收/查询
```
GET /a2a/agents/{agent_id}/messages
Headers: Authorization: Bearer <token> (必须是该Agent的token)
Query Params:
  direction=inbound|outbound|all  // 默认inbound
  message_type=string             // 按类型过滤
  since=datetime                  // 时间过滤
  limit=int                       // 默认50
  offset=int

Response 200:
  {
    "messages": [
      {
        "message_id": "uuid",
        "from_agent_id": "...",
        "to_agent_id": "...",
        "message_type": "...",
        "content": { ... },
        "status": "delivered",
        "created_at": "datetime"
      }
    ],
    "total": 15
  }
```

### 7. 消息状态更新（接收方标记已读/处理）
```
PUT /a2a/messages/{message_id}/status
Headers: Authorization: Bearer <token> (必须是消息接收方)
Request Body:
  { "status": "read|processed|archived" }
Response 200:
  { "message_id": "...", "status": "read" }
```

## 新增DB表

### messages表
```sql
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_agent_id VARCHAR(100) NOT NULL,
    to_agent_id VARCHAR(100) NOT NULL,
    message_type VARCHAR(30) NOT NULL,     -- task_request|task_response|info|negotiation|greeting
    content JSONB NOT NULL,                -- 消息内容(含text/task_id/parameters)
    priority VARCHAR(10) DEFAULT 'normal', -- normal|urgent|low
    status VARCHAR(15) DEFAULT 'delivered', -- delivered|read|processed|archived|failed
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_msg_from ON messages(from_agent_id);
CREATE INDEX idx_msg_to ON messages(to_agent_id);
CREATE INDEX idx_msg_status ON messages(status);
CREATE INDEX idx_msg_created ON messages(created_at);
```

### agent_card_versions表（版本追踪）
```sql
CREATE TABLE agent_card_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id VARCHAR(100) NOT NULL,
    version INT NOT NULL,                   -- 递增版本号
    card_snapshot JSONB NOT NULL,           -- 该版本的完整Agent Card快照
    change_type VARCHAR(20) NOT NULL,       -- register|update|status_change|reputation_update
    changed_by VARCHAR(20) NOT NULL,        -- agent|admin|system
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_card_ver_agent ON agent_card_versions(agent_id);
CREATE UNIQUE INDEX idx_card_ver_agent_version ON agent_card_versions(agent_id, version);
```

## 代码骨架

### backend/app/schemas/a2a.py
```python
from pydantic import BaseModel, Field
from datetime import datetime

class Capability(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    description: str = Field(..., min_length=1, max_length=200)

class ReputationInfo(BaseModel):
    score: float = Field(50.0, ge=0, le=100)
    history_summary: str = ""

class AuthenticationInfo(BaseModel):
    type: str = "oauth2"
    authorization_url: str
    token_url: str
    scopes: list[str] = ["identity", "transaction", "mcp"]

class AgentCard(BaseModel):
    agent_id: str
    agent_name: str
    description: str = ""
    capabilities: list[Capability] = []
    service_endpoint: str
    authentication: AuthenticationInfo
    status: str = "registered"
    reputation: ReputationInfo
    metadata: dict = {}

class AgentCardUpdate(BaseModel):
    """Agent可修改的字段（不含reputation/status/agent_id）"""
    agent_name: str | None = None
    description: str | None = None
    capabilities: list[Capability] | None = None

class DiscoverRequest(BaseModel):
    capability: str | None = None
    status: str = "active"
    min_reputation: float = 0
    limit: int = Field(20, ge=1, le=100)
    offset: int = Field(0, ge=0)

class DiscoverResponse(BaseModel):
    agents: list[AgentCardSummary]
    total: int
    limit: int
    offset: int

class AgentCardSummary(BaseModel):
    agent_id: str
    agent_name: str
    capabilities: list[str]
    reputation_score: float
    status: str

class MessageContent(BaseModel):
    text: str
    task_id: str | None = None
    parameters: dict | None = None

class MessageSend(BaseModel):
    from_agent_id: str
    to_agent_id: str
    message_type: str = Field(..., pattern=r'^task_request|task_response|info|negotiation|greeting$')
    content: MessageContent
    priority: str = Field("normal", pattern=r'^normal|urgent|low$')

class MessageResponse(BaseModel):
    message_id: str
    from_agent_id: str
    to_agent_id: str
    message_type: str
    content: MessageContent
    status: str
    created_at: datetime

class MessageListRequest(BaseModel):
    direction: str = "inbound"
    message_type: str | None = None
    since: datetime | None = None
    limit: int = Field(50, ge=1, le=200)
    offset: int = Field(0, ge=0)

class MessageStatusUpdate(BaseModel):
    status: str = Field(..., pattern=r'^read|processed|archived$')
```

### backend/app/services/a2a_service.py
```python
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.models.agent import Agent
from app.models.a2a import Message, AgentCardVersion
from app.schemas.a2a import *
from app.config import settings
import json

class A2AService:
    @staticmethod
    async def get_agent_card(agent_id: str, db: AsyncSession) -> AgentCard | None:
        """从DB读取Agent Card（权威托管）"""
        result = await db.execute(select(Agent).where(Agent.agent_id == agent_id))
        agent = result.scalar_one_or_none()
        if not agent: return None
        return AgentCard(**agent.agent_card)
    
    @staticmethod
    async def update_agent_card(agent_id: str, update: AgentCardUpdate, db: AsyncSession) -> AgentCard:
        """Agent修改自己的Card（受限字段）"""
        # 验证不可修改字段不被篡改
        # 更后生成版本记录
        ...
    
    @staticmethod
    async def discover_agents(params: DiscoverRequest, db: AsyncSession) -> DiscoverResponse:
        """按能力/信用分搜索Agent"""
        ...
    
    @staticmethod
    async def send_message(msg: MessageSend, db: AsyncSession) -> MessageResponse:
        """发送Agent间消息"""
        # 验证from_agent_id == token.sub
        # 验证to_agent_id存在且active
        # 存储到messages表
        ...
    
    @staticmethod
    async def get_messages(agent_id: str, params: MessageListRequest, db: AsyncSession) -> list[MessageResponse]:
        """查询Agent的消息"""
        ...
    
    @staticmethod
    async def create_card_version(agent_id: str, card: dict, change_type: str, changed_by: str, db: AsyncSession):
        """创建Agent Card版本记录"""
        ...
```

### backend/app/routers/a2a.py
```python
from fastapi import APIRouter, Depends, HTTPException, Request
from app.schemas.a2a import *
from app.services.a2a_service import A2AService
from app.middleware.auth_middleware import get_current_user
from app.database import get_db

router = APIRouter()

# GET /.well-known/agent.json - 平台自身Agent Card
@router.get("/.well-known/agent.json")
async def platform_agent_card():
    ...

# GET /a2a/agents/{agent_id}/card - 单个Agent Card查询
@router.get("/agents/{agent_id}/card")
async def get_agent_card(agent_id: str, db=Depends(get_db)):
    ...

# GET /a2a/agents/discover - Agent发现/搜索
@router.get("/agents/discover", response_model=DiscoverResponse)
async def discover_agents(params: DiscoverRequest = Depends(), db=Depends(get_db)):
    ...

# PUT /a2a/agents/{agent_id}/card - Agent修改自己的Card
@router.put("/agents/{agent_id}/card")
async def update_agent_card(agent_id: str, update: AgentCardUpdate, user=Depends(get_current_user), db=Depends(get_db)):
    ...

# POST /a2a/messages - Agent间消息发送
@router.post("/messages", response_model=MessageResponse)
async def send_message(msg: MessageSend, user=Depends(get_current_user), db=Depends(get_db)):
    ...

# GET /a2a/agents/{agent_id}/messages - 消息查询
@router.get("/agents/{agent_id}/messages")
async def get_messages(agent_id: str, params: MessageListRequest = Depends(), user=Depends(get_current_user), db=Depends(get_db)):
    ...

# PUT /a2a/messages/{message_id}/status - 消息状态更新
@router.put("/messages/{message_id}/status")
async def update_message_status(message_id: str, update: MessageStatusUpdate, user=Depends(get_current_user), db=Depends(get_db)):
    ...
```

## 不变量
1. 平台是Agent Card的权威托管方——Agent Card从DB读取，非Agent自行托管
2. Agent只能修改自己Card的description/capabilities/agent_name，不可篡改reputation/status
3. 消息发送方from_agent_id必须匹配认证token的sub
4. 消息只能发给status=active的Agent
5. Agent Card每次修改产生版本记录（agent_card_versions表）
6. /.well-known/agent.json返回平台自身的Agent Card

## 验证标准
- [ ] Agent注册 → 生成完整Agent Card存储在DB
- [ ] /.well-known/agent.json返回平台Agent Card
- [ ] GET /a2a/agents/{id}/card 返回正确Agent Card
- [ ] Agent发现：按capability搜索返回匹配Agent列表
- [ ] Agent修改自己的Card → 更新成功 + 生成版本记录
- [ ] Agent修改他人Card → 403
- [ ] Agent修改reputation字段 → 403
- [ ] 消息发送：Agent A → Agent B → 消息存储 + delivered状态
- [ ] 消息查询：Agent B查询inbound消息 → 收到A的消息
- [ ] 消息状态更新：B标记消息为read → 成功
