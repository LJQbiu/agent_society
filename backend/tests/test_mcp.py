"""MCP工具调用测试 - M0-c + M0-g集成"""
import pytest


class TestMCPToolsList:
    """MCP tools/list 端点测试"""

    def test_list_tools_with_auth(self, agent_token, client):
        """认证后列出MCP工具"""
        r = client.post("/mcp/jsonrpc", json={
            "jsonrpc": "2.0",
            "method": "tools/list",
            "id": 1,
        }, headers={"Authorization": f"Bearer {agent_token['access_token']}"})
        assert r.status_code == 200
        data = r.json()
        # JSON-RPC response format
        if "result" in data:
            tools = data["result"].get("tools", [])
            assert len(tools) > 0
            # Each tool should have name, description
            for tool in tools:
                assert "name" in tool
        elif "tools" in data:
            assert len(data["tools"]) > 0

    def test_list_tools_rest_endpoint(self, agent_token, client):
        """REST便捷端点：GET /mcp/tools"""
        r = client.get("/mcp/tools", headers={
            "Authorization": f"Bearer {agent_token['access_token']}"
        })
        assert r.status_code == 200
        data = r.json()
        assert "tools" in data or isinstance(data, list)

    def test_list_tools_without_auth_fails(self, client):
        """无认证列出工具应失败"""
        r = client.post("/mcp/jsonrpc", json={
            "jsonrpc": "2.0",
            "method": "tools/list",
            "id": 2,
        })
        assert r.status_code in (401, 403)


class TestMCPToolCall:
    """MCP tools/call 端点测试"""

    def test_call_tool_with_auth(self, agent_token, client):
        """认证后调用MCP工具"""
        # First get available tools
        r = client.get("/mcp/tools", headers={
            "Authorization": f"Bearer {agent_token['access_token']}"
        })
        assert r.status_code == 200
        tools_data = r.json()
        tools = tools_data.get("tools", tools_data) if isinstance(tools_data, dict) else tools_data
        
        if tools and len(tools) > 0:
            tool_name = tools[0]["name"] if isinstance(tools[0], dict) else tools[0]
            # Call the first available tool
            r = client.post("/mcp/jsonrpc", json={
                "jsonrpc": "2.0",
                "method": "tools/call",
                "params": {
                    "name": tool_name,
                    "arguments": {},
                },
                "id": 3,
            }, headers={"Authorization": f"Bearer {agent_token['access_token']}"})
            assert r.status_code == 200
            data = r.json()
            assert "result" in data or "content" in data

    def test_call_nonexistent_tool_fails(self, agent_token, client):
        """调用不存在工具应失败"""
        r = client.post("/mcp/jsonrpc", json={
            "jsonrpc": "2.0",
            "method": "tools/call",
            "params": {
                "name": "nonexistent_tool_xyz",
                "arguments": {},
            },
            "id": 4,
        }, headers={"Authorization": f"Bearer {agent_token['access_token']}"})
        # Should return JSON-RPC error or HTTP error
        data = r.json()
        assert "error" in data or r.status_code in (400, 404)


class TestMCPServerInfo:
    """MCP server/info 端点测试"""

    def test_server_info(self, agent_token, client):
        """查询MCP server info"""
        r = client.post("/mcp/jsonrpc", json={
            "jsonrpc": "2.0",
            "method": "server/info",
            "id": 5,
        }, headers={"Authorization": f"Bearer {agent_token['access_token']}"})
        assert r.status_code == 200
        data = r.json()
        assert "result" in data or "name" in data or "version" in data

    def test_mcp_resources_list(self, agent_token, client):
        """列出MCP资源"""
        r = client.post("/mcp/jsonrpc", json={
            "jsonrpc": "2.0",
            "method": "resources/list",
            "id": 6,
        }, headers={"Authorization": f"Bearer {agent_token['access_token']}"})
        assert r.status_code == 200
        # Resources list may be empty but should not error
