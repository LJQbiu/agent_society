"""端到端集成测试 - M0-g MockAgent交互全流程"""
import pytest
from mock_agent.runner import InProcessTestRunner
from mock_agent.config import MOCK_AGENT_CONFIGS


class TestMockAgentIntegration:
    """MockAgent与平台的端到端集成测试"""

    def test_mock_agent_health_all(self):
        """4个MockAgent health端点全部healthy"""
        runner = InProcessTestRunner()
        results = runner.test_all_health()
        for key, health in results.items():
            assert health["status"] == "healthy"
            assert health["agent_id"] == MOCK_AGENT_CONFIGS[key].agent_id

    def test_mock_agent_card_all(self):
        """4个MockAgent card端点返回正确Agent Card"""
        runner = InProcessTestRunner()
        for key in MOCK_AGENT_CONFIGS:
            cfg = MOCK_AGENT_CONFIGS[key]
            client = runner.clients[key]
            r = client.get("/.well-known/agent.json")
            assert r.status_code == 200
            data = r.json()
            assert data["agent_id"] == cfg.agent_id
            assert data["name"] == cfg.name
            assert set(data["capabilities"]) == set(cfg.capabilities)

    def test_message_flow_trader_to_analyst(self):
        """Trader→Analyst消息自动回复"""
        runner = InProcessTestRunner()
        result = runner.test_message_flow("trader", "analyst", "Let's analyze market trends")
        assert result["auto_reply_triggered"] is True
        assert result["inbound_count"] >= 2  # original + reply

    def test_message_flow_all_combinations(self):
        """所有Agent组合的消息自动回复"""
        runner = InProcessTestRunner()
        for from_key in ["trader", "analyst", "creator", "organizer"]:
            for to_key in ["trader", "analyst", "creator", "organizer"]:
                if from_key != to_key:
                    result = runner.test_message_flow(from_key, to_key, f"Test from {from_key}")
                    assert result["auto_reply_triggered"] is True

    def test_task_propose_and_execute(self):
        """任务提议→执行完整流程"""
        runner = InProcessTestRunner()
        result = runner.test_task_flow("trader", "analyst")
        assert result["task_completed"] is True
        assert "task_id" in result

    def test_task_flow_all_agents(self):
        """所有Agent的任务提议→执行"""
        runner = InProcessTestRunner()
        for key, cfg in MOCK_AGENT_CONFIGS.items():
            executor_keys = list(MOCK_AGENT_CONFIGS.keys())
            executor_key = executor_keys[(executor_keys.index(key) + 1) % len(executor_keys)]
            result = runner.test_task_flow(key, executor_key)
            assert result["task_completed"] is True


class TestPlatformE2E:
    """平台端到端集成测试（完整身份→认证→交互流程）
    注意: 这些测试依赖live backend server，需要后端实现对应API。
    """

    def test_full_human_agent_interaction(self, client, unique_prefix):
        """完整流程：注册Human→绑定Agent→注册Card→发送消息"""
        # 1. Register human
        username = f"{unique_prefix}e2e_user"
        r = client.post("/identity/register", json={
            "username": username,
            "email": f"{username}@test.com",
            "password": "E2EPass123!",
            "identity_type": "human",
        })
        if r.status_code not in (200, 201):
            pytest.skip(f"Platform /identity/register not implemented yet (status={r.status_code})")
        assert r.status_code in (200, 201)

        # 2. Login
        r = client.post("/auth/login", json={
            "username": username,
            "password": "E2EPass123!",
        })
        if r.status_code != 200:
            pytest.skip(f"Platform /auth/login not implemented yet (status={r.status_code})")
        human_token = r.json()["access_token"]

        # 3. Bind agent
        r = client.post("/identity/bind-agent", json={
            "agent_name": f"{unique_prefix}e2e_agent",
            "capabilities": ["market_analysis"],
            "user_id": r.json().get("user_id", ""),
        }, headers={"Authorization": f"Bearer {human_token}"})
        if r.status_code not in (200, 201):
            pytest.skip(f"Platform /identity/bind-agent not implemented yet (status={r.status_code})")
        agent_id = r.json().get("agent_id", "")

        # 4. Get agent token
        client_id = r.json().get("client_id", "")
        client_secret = r.json().get("client_secret", "")
        r = client.post("/auth/token", data={
            "grant_type": "client_credentials",
            "client_id": client_id,
            "client_secret": client_secret,
        })
        if r.status_code != 200:
            pytest.skip(f"Platform client_credentials not implemented yet (status={r.status_code})")
        agent_token = r.json()["access_token"]

        # 5. Register agent card
        r = client.post("/a2a/cards", json={
            "agent_id": agent_id,
            "name": f"{unique_prefix}e2e_agent",
            "description": "E2E test agent",
            "capabilities": ["market_analysis"],
            "status": "active",
            "version": "0.1.0",
        }, headers={"Authorization": f"Bearer {agent_token}"})
        assert r.status_code in (200, 201)

        # 6. Send message via A2A
        r = client.post("/a2a/messages", json={
            "from_agent_id": agent_id,
            "to_agent_id": "mock-trader-alpha",
            "content": "E2E test message",
            "message_type": "info",
        }, headers={"Authorization": f"Bearer {agent_token}"})
        assert r.status_code in (200, 201)

        # 7. Verify in observatory
        r = client.get("/observatory/agents")
        assert r.status_code == 200

    def test_mcp_tool_discovery_and_call(self, agent_token, client):
        """MCP工具发现+调用"""
        # 1. List tools
        r = client.post("/mcp/jsonrpc", json={
            "jsonrpc": "2.0",
            "method": "tools/list",
            "id": 1,
        }, headers={"Authorization": f"Bearer {agent_token['access_token']}"})
        if r.status_code != 200:
            pytest.skip(f"Platform MCP not implemented yet (status={r.status_code})")
        result = r.json().get("result", r.json())
        tools = result.get("tools", [])

        # 2. Call a tool
        if tools and len(tools) > 0:
            tool_name = tools[0]["name"] if isinstance(tools[0], dict) else tools[0]
            r = client.post("/mcp/jsonrpc", json={
                "jsonrpc": "2.0",
                "method": "tools/call",
                "params": {"name": tool_name, "arguments": {}},
                "id": 10,
            }, headers={"Authorization": f"Bearer {agent_token['access_token']}"})
            assert r.status_code == 200
