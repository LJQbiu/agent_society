"""MCP协议路由 - M0-c 完整实现
JSON-RPC 2.0统一端点 + REST便捷端点 + Server Info + Auth集成
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.middleware.auth_middleware import get_current_user
from app.schemas.auth import TokenPayload
from app.schemas.mcp import (
    JSONRPCRequest, JSONRPCResponse,
    MCPToolsListResponse, MCPToolCallRequest,
    MCPResourcesListResponse, MCPResourceReadResponse,
    MCPServerInfo,
)
from app.services.mcp import MCPService, MCPError, MCPErrorCode

router = APIRouter(prefix="/mcp", tags=["mcp"])


def _extract_caller_id(user: TokenPayload) -> str:
    """从TokenPayload提取调用者ID
    - user_type=agent → sub是"agent:{agent_id_str}", 需strip前缀
    - user_type=human → sub是human_id, 需MCPService内部查关联agent
    """
    sub = user.sub
    if user.user_type == "agent" and sub.startswith("agent:"):
        return sub[len("agent:"):]
    return sub


def _require_agent_id(user: TokenPayload) -> str:
    """MCP tools/call要求agent身份"""
    if user.user_type != "agent":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="MCP tool calls require agent identity (user_type=agent)",
        )
    sub = user.sub
    if sub.startswith("agent:"):
        return sub[len("agent:"):]
    return sub


# === MCP Server Info (无需认证) ===
@router.get("/info", response_model=MCPServerInfo)
async def mcp_server_info():
    """MCP Server信息（协议版本、能力声明）"""
    return MCPService(None).get_server_info()


# === JSON-RPC 2.0 统一端点（核心）===
@router.post("/rpc", response_model=JSONRPCResponse)
async def mcp_rpc(
    request: JSONRPCRequest,
    user: TokenPayload = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """MCP JSON-RPC 2.0 统一端点 - 需OAuth认证"""
    caller_id = _extract_caller_id(user)
    user_type = user.user_type
    service = MCPService(db)
    return await service.handle_rpc(request, caller_id, user_type)


# === REST便捷端点 ===
@router.get("/tools", response_model=MCPToolsListResponse)
async def list_tools(
    user: TokenPayload = Depends(get_current_user),
):
    """列出平台可用MCP工具"""
    from app.services.mcp import PLATFORM_TOOLS
    return MCPToolsListResponse(tools=PLATFORM_TOOLS)


@router.post("/tools/call")
async def call_tool(
    data: MCPToolCallRequest,
    user: TokenPayload = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """调用指定MCP工具 - 需agent身份"""
    agent_id = _require_agent_id(user)
    service = MCPService(db)
    try:
        result = await service.handle_rpc(
            JSONRPCRequest(
                method="tools/call",
                params={"name": data.name, "arguments": data.arguments},
            ),
            agent_id,
            "agent",
        )
        if result.error:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result.error)
        return result.result
    except MCPError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"code": e.code, "message": e.message})


@router.get("/resources", response_model=MCPResourcesListResponse)
async def list_resources(
    user: TokenPayload = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """列出平台可用资源URI"""
    caller_id = _extract_caller_id(user)
    user_type = user.user_type
    service = MCPService(db)
    result = await service.handle_rpc(
        JSONRPCRequest(method="resources/list"),
        caller_id,
        user_type,
    )
    if result.error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result.error)
    return result.result


@router.get("/resources/{resource_uri:path}")
async def read_resource(
    resource_uri: str,
    user: TokenPayload = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """读取指定资源URI的内容"""
    caller_id = _extract_caller_id(user)
    user_type = user.user_type
    service = MCPService(db)
    result = await service.handle_rpc(
        JSONRPCRequest(method="resources/read", params={"uri": resource_uri}),
        caller_id,
        user_type,
    )
    if result.error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result.error)
    return result.result
