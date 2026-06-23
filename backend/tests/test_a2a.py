"""A2A Agent Card + 消息测试 - M0-d + M0-g集成"""
import pytest


class TestAgentCard:
    """Agent Card注册+查询测试"""

    def test_register_agent_card(self, agent_token, client, unique_prefix):
        """注册Agent Card"""
        r = client.post("/a2a/cards", json={
            "agent_id": agent_token["agent_id"],
            "name": f"{unique_prefix}test_agent",
            "description": "Test agent for integration",
            "capabilities": ["test_capability"],
            "status": "active",
            "version": "0.1.0",
        }, headers={"Authorization": f"Bearer {agent_token['access_token']}"})
        assert r.status_code in (200, 201)
        data = r.json()
        assert data.get("agent_id") == agent_token["agent_id"] or "card_id" in data

    def test_get_agent_card(self, agent_token, client):
        """查询Agent Card"""
        # First register a card
        r = client.post("/a2a/cards", json={
            "agent_id": agent_token["agent_id"],
            "name": "query_test_agent",
            "description": "Agent for card query test",
            "capabilities": ["market_analysis"],
            "status": "active",
            "version": "0.1.0",
        }, headers={"Authorization": f"Bearer {agent_token['access_token']}"})
        assert r.status_code in (200, 201)

        # Then query it
        r = client.get(f"/a2a/cards/{agent_token['agent_id']}")
        assert r.status_code == 200
        data = r.json()
        assert data.get("agent_id") == agent_token["agent_id"]

    def test_discover_agents(self, client):
        """发现Agent目录"""
        r = client.get("/a2a/cards")
        assert r.status_code == 200
        data = r.json()
        # Should return list or paginated response
        assert isinstance(data, list) or "cards" in data or "items" in data

    def test_discover_by_capability(self, client):
        """按能力筛选Agent"""
        r = client.get("/a2a/cards", params={"capability": "market_analysis"})
        assert r.status_code == 200
        data = r.json()
        agents = data if isinstance(data, list) else data.get("cards", data.get("items", []))
        for agent in agents:
            caps = agent.get("capabilities", [])
            assert "market_analysis" in caps


class TestA2AMessaging:
    """A2A消息发送+接收测试"""

    def test_send_message(self, agent_token, client, unique_prefix):
        """发送A2A消息"""
        # Register card first
        client.post("/a2a/cards", json={
            "agent_id": agent_token["agent_id"],
            "name": f"{unique_prefix}sender",
            "description": "Sender agent",
            "capabilities": ["test"],
            "status": "active",
            "version": "0.1.0",
        }, headers={"Authorization": f"Bearer {agent_token['access_token']}"})

        # Send message
        r = client.post("/a2a/messages", json={
            "from_agent_id": agent_token["agent_id"],
            "to_agent_id": "mock-analyst-beta",
            "content": "Hello from integration test",
            "message_type": "info",
        }, headers={"Authorization": f"Bearer {agent_token['access_token']}"})
        assert r.status_code in (200, 201)
        data = r.json()
        assert data.get("status") == "sent" or "message_id" in data

    def test_get_messages(self, agent_token, client):
        """查询Agent的消息列表"""
        r = client.get(f"/a2a/messages/{agent_token['agent_id']}", headers={
            "Authorization": f"Bearer {agent_token['access_token']}"
        })
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) or "messages" in data

    def test_message_without_auth_fails(self, client):
        """无认证发送消息应失败"""
        r = client.post("/a2a/messages", json={
            "from_agent_id": "test",
            "to_agent_id": "test",
            "content": "no auth",
            "message_type": "info",
        })
        assert r.status_code in (401, 403)
