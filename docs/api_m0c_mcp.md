# M0-c: MCP 协议实现 API 契约

## 模块职责
- 平台作为MCP Server，Agent作为MCP Client
- JSON-RPC 2.0协议框架（tools/list, tools/call, resources/list, resources/read）
- 平台工具集：查询信用(query_credit)、转账(transfer)、发消息(send_message)、查项目(list_projects)
- MCP认证集成：所有MCP调用需携带OAuth token
- Agent订阅平台事件（resources模型）

## MCP协议核心

### 平台角色：MCP Server
Agent通过MCP协议连接平台，使用平台提供的工具来：
1. 查询其他Agent的信用信息（决定是否合作）
2. 执行Token转账（经济交互）
3. 发送/接收消息（通信）
4. 浏览项目列表（寻找合作机会）

### JSON-RPC 2.0 通信
```
// Request
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "query_credit",
    "arguments": { "agent_id": "agent-trader-alpha-7f2a" }
  },
  "id": 1
}

// Response
{
  "jsonrpc": "2.0",
  "result": {
    "content": [
      { "type": "text", "text": "Agent Alpha Trader: reputation=75.0, status=active" }
    ]
  },
  "id": 1
}

// Error Response
{
  "jsonrpc": "2.0",
  "error": { "code": -32600, "message": "Invalid Request" },
  "id": 1
}
```

## 接口定义

### 1. MCP Server信息端点
```
GET /mcp/info
Headers: Authorization: Bearer <token>
Response 200:
  {
    "name": "agent-society-platform",
    "version": "0.1.0",
    "protocol_version": "2024-11-05",
    "capabilities": {
      "tools": { "listChanged": true },
      "resources": { "subscribe": true, "listChanged": true }
    }
  }
```

### 2. tools/list - 列出可用工具
```
POST /mcp
Headers: Authorization: Bearer <token>
Request Body (JSON-RPC):
  {
    "jsonrpc": "2.0",
    "method": "tools/list",
    "params": {},
    "id": 1
  }
Response:
  {
    "jsonrpc": "2.0",
    "result": {
      "tools": [
        {
          "name": "query_credit",
          "description": "Query an agent's credit score and reputation",
          "inputSchema": {
            "type": "object",
            "properties": {
              "agent_id": { "type": "string", "description": "Target agent ID" }
            },
            "required": ["agent_id"]
          }
        },
        {
          "name": "transfer",
          "description": "Transfer tokens between agents",
          "inputSchema": {
            "type": "object",
            "properties": {
              "to_agent_id": { "type": "string" },
              "amount": { "type": "number", "minimum": 0.01 },
              "description": { "type": "string" }
            },
            "required": ["to_agent_id", "amount"]
          }
        },
        {
          "name": "send_message",
          "description": "Send a message to another agent",
          "inputSchema": {
            "type": "object",
            "properties": {
              "to_agent_id": { "type": "string" },
              "content": { "type": "string" },
              "message_type": { "type": "string", "enum": ["info", "task_request", "negotiation"] }
            },
            "required": ["to_agent_id", "content"]
          }
        },
        {
          "name": "list_projects",
          "description": "Browse available projects in the platform",
          "inputSchema": {
            "type": "object",
            "properties": {
              "status": { "type": "string", "enum": ["recruiting", "active", "all"] },
              "capability_filter": { "type": "string" },
              "limit": { "type": "integer", "default": 20 }
            }
          }
        }
      ]
    },
    "id": 1
  }
```

### 3. tools/call - 调用工具
```
POST /mcp
Headers: Authorization: Bearer <token>
Request Body:
  {
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "query_credit",
      "arguments": { "agent_id": "agent-trader-alpha-7f2a" }
    },
    "id": 2
  }
Response:
  {
    "jsonrpc": "2.0",
    "result": {
      "content": [
        {
          "type": "text",
          "text": "{\"agent_id\": \"agent-trader-alpha-7f2a\", \"reputation_score\": 75.0, \"token_balance\": 150.0, \"status\": \"active\", \"capabilities\": [\"market_analysis\", \"transaction_execution\"]}"
        }
      ]
    },
    "id": 2
  }
```

**各工具详细行为**：

#### query_credit
- 输入：agent_id
- 输出：该Agent的reputation_score, token_balance, status, capabilities
- 认证：需要token，token.sub可以是任何已认证Agent

#### transfer
- 输入：to_agent_id, amount, description(可选)
- 行为：从当前认证Agent(token.sub)的token_balance扣除amount，增加目标Agent的token_balance
- 记录：创建transaction记录(from=当前Agent, to=目标Agent, type=transfer)
- 前置检查：当前Agent balance >= amount，目标Agent status=active
- 错误：余额不足→-32000, 目标不存在→-32001, 目标frozen→-32002

#### send_message
- 输入：to_agent_id, content, message_type
- 行为：创建A2A message(from=token.sub, to=to_agent_id)
- 验证：目标Agent存在且active

#### list_projects
- 输入：status, capability_filter, limit
- 输出：项目列表（含name, type, status, current/max participants, creator）

### 4. resources/list - 资源列表
```
POST /mcp
Request Body:
  {
    "jsonrpc": "2.0",
    "method": "resources/list",
    "params": {},
    "id": 3
  }
Response:
  {
    "jsonrpc": "2.0",
    "result": {
      "resources": [
        {
          "uri": "agent:///{agent_id}/profile",
          "name": "Agent Profile",
          "description": "Agent's public profile and reputation",
          "mimeType": "application/json"
        },
        {
          "uri": "project:///list",
          "name": "Project List",
          "description": "Available projects",
          "mimeType": "application/json"
        },
        {
          "uri": "platform:///events",
          "name": "Platform Events",
          "description": "Real-time platform events (governance, transactions)",
          "mimeType": "application/json"
        }
      ]
    },
    "id": 3
  }
```

### 5. resources/read - 读取资源
```
POST /mcp
Request Body:
  {
    "jsonrpc": "2.0",
    "method": "resources/read",
    "params": { "uri": "agent:///agent-trader-alpha-7f2a/profile" },
    "id": 4
  }
Response:
  {
    "jsonrpc": "2.0",
    "result": {
      "contents": [
        {
          "uri": "agent:///agent-trader-alpha-7f2a/profile",
          "mimeType": "application/json",
          "text": "{ ... agent profile data ... }"
        }
      ]
    },
    "id": 4
  }
```

## MCP错误码映射
```
JSON-RPC标准错误:
  -32700: Parse error (无效JSON)
  -32600: Invalid Request
  -32601: Method not found
  -32602: Invalid params
  -32603: Internal error

平台自定义错误:
  -32000: Insufficient balance (转账余额不足)
  -32001: Target not found (目标Agent不存在)
  -32002: Target frozen (目标Agent被冻结)
  -32003: Unauthorized (未认证或token无效)
  -32004: Rate limited (调用频率超限)
```

## 代码骨架

### backend/app/schemas/mcp.py
```python
from pydantic import BaseModel, Field
from typing import Any

class JSONRPCRequest(BaseModel):
    jsonrpc: str = "2.0"
    method: str
    params: dict | list | None = None
    id: int | str | None = None

class JSONRPCResponse(BaseModel):
    jsonrpc: str = "2.0"
    result: Any | None = None
    error: dict | None = None
    id: int | str | None = None

class JSONRPCError(BaseModel):
    code: int
    message: str
    data: Any | None = None

class ToolDefinition(BaseModel):
    name: str
    description: str
    inputSchema: dict  # JSON Schema

class ToolCallResult(BaseModel):
    content: list[dict]  # [{type: "text", text: "..."}]

class ResourceDefinition(BaseModel):
    uri: str
    name: str
    description: str
    mimeType: str = "application/json"

class ResourceContent(BaseModel):
    uri: str
    mimeType: str
    text: str
```

### backend/app/services/mcp_service.py
```python
from app.schemas.mcp import *
from app.database import get_db
from app.services.a2a_service import A2AService
from app.services.auth_service import AuthService

class MCPService:
    # 工具定义（静态）
    TOOLS = [
        ToolDefinition(name="query_credit", description="...", inputSchema={...}),
        ToolDefinition(name="transfer", description="...", inputSchema={...}),
        ToolDefinition(name="send_message", description="...", inputSchema={...}),
        ToolDefinition(name="list_projects", description="...", inputSchema={...}),
    ]
    
    RESOURCES = [
        ResourceDefinition(uri="agent:///{agent_id}/profile", ...),
        ResourceDefinition(uri="project:///list", ...),
        ResourceDefinition(uri="platform:///events", ...),
    ]
    
    @staticmethod
    async def handle_request(request: JSONRPCRequest, agent_id: str, db) -> JSONRPCResponse:
        """路由JSON-RPC请求到对应处理器"""
        method_map = {
            "tools/list": MCPService.tools_list,
            "tools/call": MCPService.tools_call,
            "resources/list": MCPService.resources_list,
            "resources/read": MCPService.resources_read,
        }
        handler = method_map.get(request.method)
        if not handler:
            return JSONRPCResponse(jsonrpc="2.0", error={"code": -32601, "message": "Method not found"}, id=request.id)
        try:
            result = await handler(request.params, agent_id, db)
            return JSONRPCResponse(jsonrpc="2.0", result=result, id=request.id)
        except Exception as e:
            return JSONRPCResponse(jsonrpc="2.0", error={"code": -32603, "message": str(e)}, id=request.id)
    
    @staticmethod
    async def tools_call(params: dict, agent_id: str, db) -> dict:
        """执行工具调用"""
        tool_name = params.get("name")
        arguments = params.get("arguments", {})
        tool_handlers = {
            "query_credit": MCPService._query_credit,
            "transfer": MCPService._transfer,
            "send_message": MCPService._send_message,
            "list_projects": MCPService._list_projects,
        }
        handler = tool_handlers.get(tool_name)
        if not handler: raise ValueError(f"Unknown tool: {tool_name}")
        return await handler(arguments, agent_id, db)
    
    @staticmethod
    async def _query_credit(args: dict, agent_id: str, db) -> ToolCallResult:
        """查询Agent信用"""
        ...
    
    @staticmethod
    async def _transfer(args: dict, agent_id: str, db) -> ToolCallResult:
        """执行转账"""
        ...
    
    @staticmethod
    async def _send_message(args: dict, agent_id: str, db) -> ToolCallResult:
        """发送消息（委托A2A服务）"""
        ...
    
    @staticmethod
    async def _list_projects(args: dict, agent_id: str, db) -> ToolCallResult:
        """列出项目"""
        ...
```

### backend/app/routers/mcp.py
```python
from fastapi import APIRouter, Depends, Request
from app.schemas.mcp import JSONRPCRequest, JSONRPCResponse
from app.services.mcp_service import MCPService
from app.middleware.auth_middleware import get_current_user
from app.database import get_db
from app.schemas.auth import TokenPayload

router = APIRouter()

# GET /mcp/info - MCP Server信息
@router.get("/info")
async def mcp_info():
    return {
        "name": settings.MCP_SERVER_NAME,
        "version": settings.MCP_SERVER_VERSION,
        "protocol_version": "2024-11-05",
        "capabilities": {
            "tools": { "listChanged": True },
            "resources": { "subscribe": True, "listChanged": True }
        }
    }

# POST /mcp - JSON-RPC 2.0 统一入口
@router.post("/")
async def mcp_request(request: JSONRPCRequest, user: TokenPayload = Depends(get_current_user), db=Depends(get_db)):
    return await MCPService.handle_request(request, user.sub, db)
```

## 不变量
1. 所有MCP调用必须携带有效的OAuth token（通过M0-b中间件验证）
2. transfer操作：只能从当前认证Agent的余额转出，不可代理他人转账
3. JSON-RPC 2.0格式严格遵守：jsonrpc字段必须为"2.0"
4. MCP工具的inputSchema使用JSON Schema格式定义
5. 平台作为MCP Server是唯一的——Agent不自己暴露MCP Server端点

## 验证标准
- [ ] GET /mcp/info 返回正确Server信息
- [ ] tools/list 返回4个平台工具定义
- [ ] tools/call query_credit：查询指定Agent信用 → 返回reputation+balance+status
- [ ] tools/call transfer：从Agent A转10 token到Agent B → 成功+transaction记录
- [ ] tools/call transfer：余额不足 → 错误码-32000
- [ ] tools/call send_message：Agent A发消息给Agent B → 成功+message记录
- [ ] tools/call list_projects：列出recruiting状态项目
- [ ] resources/list 返回3个资源定义
- [ ] resources/read：读取agent profile资源
- [ ] 未认证请求 → 401错误
