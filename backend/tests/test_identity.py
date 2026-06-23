"""身份注册测试 - M0-a + M0-g集成"""
import pytest
import httpx
from .conftest import BASE_URL, TEST_PREFIX


class TestIdentityRegister:
    """身份注册端点测试"""

    def test_register_human(self, client, unique_prefix):
        """注册人类身份"""
        username = f"{unique_prefix}human1"
        r = client.post("/identity/register", json={
            "username": username,
            "email": f"{username}@test.com",
            "password": "TestPass123!",
            "identity_type": "human",
        })
        assert r.status_code in (200, 201)
        data = r.json()
        assert data.get("identity_type") == "human" or data.get("user_id") is not None

    def test_register_organization(self, client, unique_prefix):
        """注册组织身份"""
        org_name = f"{unique_prefix}org1"
        r = client.post("/identity/register", json={
            "username": org_name,
            "email": f"{org_name}@test.com",
            "password": "OrgPass123!",
            "identity_type": "organization",
            "organization_name": org_name,
        })
        assert r.status_code in (200, 201)
        data = r.json()
        assert "identity_id" in data or "user_id" in data or "organization_id" in data

    def test_register_duplicate_username_fails(self, client, unique_prefix):
        """重复用户名应失败"""
        username = f"{unique_prefix}dup1"
        r1 = client.post("/identity/register", json={
            "username": username,
            "email": f"{username}@test.com",
            "password": "TestPass123!",
            "identity_type": "human",
        })
        assert r1.status_code in (200, 201)
        # Second registration with same username should fail
        r2 = client.post("/identity/register", json={
            "username": username,
            "email": f"{username}@test2.com",
            "password": "TestPass456!",
            "identity_type": "human",
        })
        assert r2.status_code in (400, 409)

    def test_register_missing_fields_fails(self, client):
        """缺少必填字段应失败"""
        r = client.post("/identity/register", json={
            "username": "noemail",
        })
        assert r.status_code in (400, 422)


class TestAgentBinding:
    """Agent绑定测试"""

    def test_bind_agent_to_human(self, test_user, client, unique_prefix):
        """绑定Agent到Human"""
        agent_name = f"{unique_prefix}bound_agent"
        r = client.post("/identity/bind-agent", json={
            "agent_name": agent_name,
            "capabilities": ["market_analysis", "data_analysis"],
            "user_id": test_user["user_id"],
        }, headers={"Authorization": f"Bearer {test_user['access_token']}"})
        assert r.status_code in (200, 201)
        data = r.json()
        assert "agent_id" in data or "client_id" in data

    def test_bind_agent_without_auth_fails(self, client, unique_prefix):
        """无认证绑定Agent应失败"""
        r = client.post("/identity/bind-agent", json={
            "agent_name": f"{unique_prefix}noauth_agent",
            "capabilities": ["test"],
        })
        assert r.status_code in (401, 403)


class TestIdentityQuery:
    """身份查询测试"""

    def test_get_identity_info(self, test_user, client):
        """查询当前用户身份信息"""
        r = client.get("/identity/me", headers={
            "Authorization": f"Bearer {test_user['access_token']}"
        })
        assert r.status_code == 200
        data = r.json()
        assert data.get("username") == test_user["username"]
