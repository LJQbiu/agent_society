"""MCP协议服务 - M0-c 完整实现
平台作为MCP Server，Agent作为MCP Client
JSON-RPC 2.0协议框架 + 4个平台工具 + 3个资源URI
"""
import json
import uuid
from datetime import datetime
from typing import Optional, Any, Dict, List

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent import Agent
from app.models.transaction import Transaction
from app.models.project import Project, ProjectParticipant
from app.models.a2a import Message
from app.schemas.mcp import (
    JSONRPCRequest, JSONRPCResponse, JSONRPCError, MCPErrorCode,
    MCPTool, MCPToolCallResult, MCPToolCallRequest,
    MCPResource, MCPResourceContent, MCPServerInfo,
    MCPResourcesListResponse, MCPResourceReadResponse,
    MCPToolsListResponse,
)


# === 平台工具定义 ===
PLATFORM_TOOLS: List[MCPTool] = [
    MCPTool(
        name="query_credit",
        description="查询Agent信用余额和声誉信息",
        inputSchema={
            "type": "object",
            "properties": {
                "agent_id": {"type": "string", "description": "要查询的Agent ID (如agent-trader-alpha-7f2a)"},
            },
            "required": ["agent_id"],
        },
    ),
    MCPTool(
        name="transfer",
        description="执行Token转账给另一个Agent",
        inputSchema={
            "type": "object",
            "properties": {
                "to_agent_id": {"type": "string", "description": "目标Agent ID"},
                "amount": {"type": "number", "description": "转账金额，必须>0"},
                "description": {"type": "string", "description": "转账说明"},
            },
            "required": ["to_agent_id", "amount"],
        },
    ),
    MCPTool(
        name="send_message",
        description="向另一个Agent发送消息（委托A2A服务）",
        inputSchema={
            "type": "object",
            "properties": {
                "to_agent_id": {"type": "string", "description": "目标Agent ID"},
                "message_type": {"type": "string", "description": "消息类型: task_request|task_response|info|negotiation|greeting"},
                "text": {"type": "string", "description": "消息文本内容"},
                "priority": {"type": "string", "description": "优先级: normal|urgent|low", "default": "normal"},
            },
            "required": ["to_agent_id", "message_type", "text"],
        },
    ),
    MCPTool(
        name="list_projects",
        description="列出可用项目（可按状态和能力过滤）",
        inputSchema={
            "type": "object",
            "properties": {
                "status": {"type": "string", "description": "项目状态过滤: recruiting|active|suspended|completed"},
                "capability_filter": {"type": "string", "description": "能力关键词过滤"},
                "limit": {"type": "integer", "description": "返回上限", "default": 20},
            },
        },
    ),
]

# === 平台资源定义 ===
PLATFORM_RESOURCES: List[MCPResource] = [
    MCPResource(
        uri="agent:///{agent_id}/profile",
        name="Agent Profile",
        description="Agent's public profile and reputation",
        mimeType="application/json",
    ),
    MCPResource(
        uri="project:///list",
        name="Project List",
        description="Available projects",
        mimeType="application/json",
    ),
    MCPResource(
        uri="platform:///events",
        name="Platform Events",
        description="Real-time platform events (governance, transactions)",
        mimeType="application/json",
    ),
]


class MCPService:
    """MCP协议核心服务"""

    def __init__(self, db: AsyncSession):
        self.db = db

    # === JSON-RPC 路由 ===
    async def handle_rpc(self, request: JSONRPCRequest, caller_id: str, user_type: str = "agent") -> JSONRPCResponse:
        """路由JSON-RPC请求到对应处理器
        caller_id: token.sub (agent_uuid or human_uuid)
        user_type: 'agent' or 'human'
        """
        # For MCP, resolve agent_id from caller context
        agent_id = caller_id  # if user_type=agent, caller_id IS agent_id
        method_map = {
            "tools/list": self._tools_list,
            "tools/call": self._tools_call,
            "resources/list": self._resources_list,
            "resources/read": self._resources_read,
        }
        handler = method_map.get(request.method)
        if not handler:
            return JSONRPCResponse(
                jsonrpc="2.0",
                error={"code": MCPErrorCode.METHOD_NOT_FOUND, "message": f"Method not found: {request.method}"},
                id=request.id,
            )
        try:
            result = await handler(request.params or {}, agent_id)
            return JSONRPCResponse(jsonrpc="2.0", result=result, id=request.id)
        except MCPError as e:
            return JSONRPCResponse(jsonrpc="2.0", error={"code": e.code, "message": e.message}, id=request.id)
        except Exception as e:
            return JSONRPCResponse(jsonrpc="2.0", error={"code": MCPErrorCode.INTERNAL_ERROR, "message": str(e)}, id=request.id)

    # === Server Info ===
    def get_server_info(self) -> MCPServerInfo:
        return MCPServerInfo(
            name="Agent自治社区平台 MCP Server",
            version="0.1.0",
        )

    # === Public convenience methods (for REST endpoints) ===
    def list_tools(self) -> MCPToolsListResponse:
        """REST便捷方法：列出所有平台工具"""
        return MCPToolsListResponse(tools=PLATFORM_TOOLS)

    # === tools/list ===
    async def _tools_list(self, params: dict, agent_id: str) -> dict:
        return {"tools": [t.model_dump() for t in PLATFORM_TOOLS]}

    # === tools/call ===
    async def _tools_call(self, params: dict, agent_id: str) -> dict:
        if not params or "name" not in params:
            raise MCPError(MCPErrorCode.INVALID_PARAMS, "Missing 'name' in params")
        tool_name = params["name"]
        arguments = params.get("arguments", {})
        tool_handlers = {
            "query_credit": self._query_credit,
            "transfer": self._transfer,
            "send_message": self._send_message,
            "list_projects": self._list_projects,
        }
        handler = tool_handlers.get(tool_name)
        if not handler:
            raise MCPError(MCPErrorCode.METHOD_NOT_FOUND, f"Unknown tool: {tool_name}")
        result = await handler(arguments, agent_id)
        return result.model_dump()

    # === resources/list ===
    async def _resources_list(self, params: dict, agent_id: str) -> dict:
        # 替换模板中的{agent_id}
        resources = []
        for r in PLATFORM_RESOURCES:
            if "{agent_id}" in r.uri:
                resources.append(MCPResource(
                    uri=r.uri.replace("{agent_id}", agent_id),
                    name=r.name,
                    description=r.description,
                    mimeType=r.mimeType,
                ))
            else:
                resources.append(r)
        return {"resources": [r.model_dump() for r in resources]}

    # === resources/read ===
    async def _resources_read(self, params: dict, agent_id: str) -> dict:
        if not params or "uri" not in params:
            raise MCPError(MCPErrorCode.INVALID_PARAMS, "Missing 'uri' in params")
        uri = params["uri"]
        content = await self._resolve_resource(uri, agent_id)
        return {"contents": [c.model_dump() for c in content]}

    async def _resolve_resource(self, uri: str, agent_id: str) -> List[MCPResourceContent]:
        """解析资源URI并返回内容"""
        # agent:///{agent_id}/profile
        if uri.startswith("agent:///"):
            # agent:///agent_id/profile → split gives ["agent:", "", "", agent_id, "profile"]
            parts = uri.split("/")
            # agent_id is at index 3 (after "agent:", "", "")
            target_agent_id = parts[3] if len(parts) >= 4 else agent_id
            result = await self.db.execute(
                select(Agent).where(Agent.agent_id_str == target_agent_id)
            )
            agent = result.scalar_one_or_none()
            if not agent:
                raise MCPError(MCPErrorCode.TARGET_NOT_FOUND, f"Agent not found: {target_agent_id}")
            profile_data = {
                "agent_id": agent.agent_id_str,
                "name": agent.name,
                "status": agent.status,
                "reputation": agent.reputation,
                "trust_level": agent.trust_level,
                "balance": agent.balance,
                "capabilities": agent.capabilities,
                "description": agent.description,
            }
            return [MCPResourceContent(uri=uri, text=json.dumps(profile_data))]

        # project:///list
        elif uri == "project:///list":
            result = await self.db.execute(
                select(Project).where(Project.status == "recruiting").limit(20)
            )
            projects = result.scalars().all()
            project_data = [{
                "id": str(p.id),
                "name": p.name,
                "status": p.status,
                "budget": p.budget,
                "required_capabilities": p.required_capabilities,
                "max_participants": p.max_participants,
            } for p in projects]
            return [MCPResourceContent(uri=uri, text=json.dumps(project_data))]

        # platform:///events
        elif uri == "platform:///events":
            result = await self.db.execute(
                select(Transaction).order_by(Transaction.created_at.desc()).limit(20)
            )
            txns = result.scalars().all()
            events = [{
                "type": "transaction",
                "transaction_type": t.transaction_type,
                "amount": t.amount,
                "status": t.status,
                "description": t.description,
                "created_at": str(t.created_at),
            } for t in txns]
            return [MCPResourceContent(uri=uri, text=json.dumps(events))]

        else:
            raise MCPError(MCPErrorCode.INVALID_PARAMS, f"Unknown resource URI: {uri}")

    # === 工具实现 ===
    async def _query_credit(self, args: dict, caller_agent_id: str) -> MCPToolCallResult:
        """查询Agent信用余额和声誉"""
        target_agent_id = args.get("agent_id", caller_agent_id)
        result = await self.db.execute(
            select(Agent).where(Agent.agent_id_str == target_agent_id)
        )
        agent = result.scalar_one_or_none()
        if not agent:
            raise MCPError(MCPErrorCode.TARGET_NOT_FOUND, f"Agent not found: {target_agent_id}")
        credit_info = {
            "agent_id": agent.agent_id_str,
            "name": agent.name,
            "balance": agent.balance,
            "reputation": agent.reputation,
            "trust_level": agent.trust_level,
            "status": agent.status,
        }
        return MCPToolCallResult(content=[{"type": "text", "text": json.dumps(credit_info)}])

    async def _transfer(self, args: dict, caller_agent_id: str) -> MCPToolCallResult:
        """执行Token转账"""
        to_agent_id = args.get("to_agent_id")
        amount = args.get("amount", 0)
        description = args.get("description", "")

        if not to_agent_id:
            raise MCPError(MCPErrorCode.INVALID_PARAMS, "Missing to_agent_id")
        if amount <= 0:
            raise MCPError(MCPErrorCode.INVALID_PARAMS, "Amount must be > 0")

        # 查找源Agent
        result = await self.db.execute(
            select(Agent).where(Agent.agent_id_str == caller_agent_id)
        )
        from_agent = result.scalar_one_or_none()
        if not from_agent:
            raise MCPError(MCPErrorCode.TARGET_NOT_FOUND, f"Caller agent not found: {caller_agent_id}")
        if from_agent.status == "frozen":
            raise MCPError(MCPErrorCode.TARGET_FROZEN, f"Caller agent is frozen: {caller_agent_id}")
        if from_agent.balance < amount:
            raise MCPError(MCPErrorCode.INSUFFICIENT_BALANCE, f"Insufficient balance: {from_agent.balance} < {amount}")

        # 查找目标Agent
        result = await self.db.execute(
            select(Agent).where(Agent.agent_id_str == to_agent_id)
        )
        to_agent = result.scalar_one_or_none()
        if not to_agent:
            raise MCPError(MCPErrorCode.TARGET_NOT_FOUND, f"Target agent not found: {to_agent_id}")
        if to_agent.status == "frozen":
            raise MCPError(MCPErrorCode.TARGET_FROZEN, f"Target agent is frozen: {to_agent_id}")

        # 更新余额
        from_agent.balance -= amount
        to_agent.balance += amount

        # 创建交易记录
        txn = Transaction(
            from_holder_id=from_agent.id,
            from_holder_type="agent",
            to_holder_id=to_agent.id,
            to_holder_type="agent",
            amount=amount,
            transaction_type="transfer",
            description=description,
            status="completed",
        )
        self.db.add(txn)
        await self.db.commit()
        await self.db.refresh(from_agent)
        await self.db.refresh(to_agent)

        transfer_result = {
            "transaction_id": str(txn.id),
            "from": caller_agent_id,
            "to": to_agent_id,
            "amount": amount,
            "from_balance": from_agent.balance,
            "to_balance": to_agent.balance,
            "status": "completed",
        }
        return MCPToolCallResult(content=[{"type": "text", "text": json.dumps(transfer_result)}])

    async def _send_message(self, args: dict, caller_agent_id: str) -> MCPToolCallResult:
        """发送消息（委托A2A服务）"""
        to_agent_id = args.get("to_agent_id")
        message_type = args.get("message_type", "info")
        text = args.get("text", "")
        priority = args.get("priority", "normal")

        if not to_agent_id:
            raise MCPError(MCPErrorCode.INVALID_PARAMS, "Missing to_agent_id")
        if not text:
            raise MCPError(MCPErrorCode.INVALID_PARAMS, "Missing text")

        # 验证目标Agent存在
        result = await self.db.execute(
            select(Agent).where(Agent.agent_id_str == to_agent_id)
        )
        target_agent = result.scalar_one_or_none()
        if not target_agent:
            raise MCPError(MCPErrorCode.TARGET_NOT_FOUND, f"Target agent not found: {to_agent_id}")
        if target_agent.status == "frozen":
            raise MCPError(MCPErrorCode.TARGET_FROZEN, f"Target agent is frozen: {to_agent_id}")

        # 创建A2A消息
        message = Message(
            from_agent_id=caller_agent_id,
            to_agent_id=to_agent_id,
            message_type=message_type,
            content={"text": text},
            priority=priority,
            status="delivered",
        )
        self.db.add(message)
        await self.db.commit()
        await self.db.refresh(message)

        msg_result = {
            "message_id": str(message.id),
            "from": caller_agent_id,
            "to": to_agent_id,
            "message_type": message_type,
            "priority": priority,
            "status": "delivered",
            "created_at": str(message.created_at),
        }
        return MCPToolCallResult(content=[{"type": "text", "text": json.dumps(msg_result)}])

    async def _list_projects(self, args: dict, caller_agent_id: str) -> MCPToolCallResult:
        """列出可用项目"""
        status_filter = args.get("status")
        capability_filter = args.get("capability_filter")
        limit = min(args.get("limit", 20), 50)

        query = select(Project)
        if status_filter:
            query = query.where(Project.status == status_filter)
        if capability_filter:
            # JSONB contains查询
            query = query.where(Project.required_capabilities.contains([capability_filter]))
        query = query.limit(limit)

        result = await self.db.execute(query)
        projects = result.scalars().all()

        project_list = [{
            "id": str(p.id),
            "name": p.name,
            "description": p.description,
            "status": p.status,
            "budget": p.budget,
            "required_capabilities": p.required_capabilities,
            "max_participants": p.max_participants,
            "creator_id": str(p.creator_id),
        } for p in projects]
        return MCPToolCallResult(content=[{"type": "text", "text": json.dumps(project_list)}])

    # === REST端点方法（供router直接调用）===
    async def list_tools(self) -> dict:
        """GET /mcp/tools 返回工具列表"""
        return {"tools": [t.model_dump() for t in PLATFORM_TOOLS]}

    async def call_tool(self, request: MCPToolCallRequest) -> MCPToolCallResult:
        """POST /mcp/tools/call REST式调用"""
        tool_handlers = {
            "query_credit": self._query_credit,
            "transfer": self._transfer,
            "send_message": self._send_message,
            "list_projects": self._list_projects,
        }
        handler = tool_handlers.get(request.name)
        if not handler:
            raise MCPError(MCPErrorCode.METHOD_NOT_FOUND, f"Unknown tool: {request.name}")
        return await handler(request.arguments, "unknown")  # agent_id由router层注入

    async def list_resources(self) -> dict:
        """GET /mcp/resources"""
        return {"resources": [r.model_dump() for r in PLATFORM_RESOURCES]}

    async def read_resource(self, resource_uri: str, agent_id: str = "unknown") -> MCPResourceReadResponse:
        """GET /mcp/resources/{uri}"""
        contents = await self._resolve_resource(resource_uri, agent_id)
        return MCPResourceReadResponse(contents=contents)


class MCPError(Exception):
    """MCP协议错误"""
    def __init__(self, code: int, message: str):
        self.code = code
        self.message = message
        super().__init__(message)
