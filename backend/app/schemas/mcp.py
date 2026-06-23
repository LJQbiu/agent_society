"""MCP Schema - M0-c 完整实现"""
from pydantic import BaseModel, Field
from typing import Optional, Any, List, Union


# === JSON-RPC 2.0 框架 ===
class JSONRPCRequest(BaseModel):
    jsonrpc: str = Field(default="2.0", pattern="^2\\.0$")
    method: str  # tools/list, tools/call, resources/list, resources/read
    params: Optional[Union[dict, list]] = None
    id: Optional[Union[int, str]] = None


class JSONRPCResponse(BaseModel):
    jsonrpc: str = "2.0"
    result: Optional[Any] = None
    error: Optional[dict] = None  # {"code": int, "message": str, "data": Any?}
    id: Optional[Union[int, str]] = None


class JSONRPCError(BaseModel):
    code: int
    message: str
    data: Optional[Any] = None


# === MCP 错误码 ===
class MCPErrorCode:
    # JSON-RPC standard
    PARSE_ERROR = -32700
    INVALID_REQUEST = -32600
    METHOD_NOT_FOUND = -32601
    INVALID_PARAMS = -32602
    INTERNAL_ERROR = -32603
    # Platform custom
    INSUFFICIENT_BALANCE = -32000
    TARGET_NOT_FOUND = -32001
    TARGET_FROZEN = -32002
    UNAUTHORIZED = -32003
    RATE_LIMITED = -32004


# === Tools ===
class MCPTool(BaseModel):
    name: str
    description: str
    inputSchema: dict  # JSON Schema for parameters


class MCPToolsListResponse(BaseModel):
    tools: List[MCPTool]


class MCPToolCallRequest(BaseModel):
    name: str
    arguments: dict


class MCPToolCallResult(BaseModel):
    content: List[dict]  # [{"type": "text", "text": "..."}]
    is_error: bool = False


class MCPToolCallResponse(BaseModel):
    result: Optional[MCPToolCallResult] = None
    error: Optional[dict] = None


# === Resources ===
class MCPResource(BaseModel):
    uri: str
    name: str
    description: str
    mimeType: str = "application/json"


class MCPResourcesListResponse(BaseModel):
    resources: List[MCPResource]


class MCPResourceContent(BaseModel):
    uri: str
    mimeType: str = "application/json"
    text: str  # JSON string of resource data


class MCPResourceReadResponse(BaseModel):
    contents: List[MCPResourceContent]


# === MCP Server Info ===
class MCPServerInfo(BaseModel):
    name: str
    version: str
    protocolVersion: str = "2024-11-05"
    capabilities: dict = {"tools": {"listChanged": False}, "resources": {"subscribe": False, "listChanged": False}}
