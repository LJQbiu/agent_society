"""认证测试 - M0-b OAuth2.1+PKCE + M0-g集成"""
import pytest
import hashlib
import base64
import secrets


class TestHumanAuth:
    """人类用户认证流程"""

    def test_register_and_login(self, client, unique_prefix):
        """注册 + 登录完整流程"""
        username = f"{unique_prefix}authuser"
        r = client.post("/identity/register", json={
            "username": username,
            "email": f"{username}@test.com",
            "password": "AuthPass123!",
            "identity_type": "human",
        })
        assert r.status_code in (200, 201)

        r = client.post("/auth/login", json={
            "username": username,
            "password": "AuthPass123!",
        })
        assert r.status_code == 200
        data = r.json()
        assert "access_token" in data
        assert data.get("token_type") == "bearer" or data.get("token_type") == "Bearer"

    def test_login_wrong_password_fails(self, client, unique_prefix):
        """错误密码登录应失败"""
        username = f"{unique_prefix}wrongpass"
        client.post("/identity/register", json={
            "username": username,
            "email": f"{username}@test.com",
            "password": "RightPass123!",
            "identity_type": "human",
        })
        r = client.post("/auth/login", json={
            "username": username,
            "password": "WrongPass456!",
        })
        assert r.status_code in (401, 403)

    def test_login_nonexistent_user_fails(self, client):
        """不存在用户登录应失败"""
        r = client.post("/auth/login", json={
            "username": "nonexistent_xyz",
            "password": "anything",
        })
        assert r.status_code in (401, 403)

    def test_token_refresh(self, test_user, client):
        """Token刷新流程"""
        r = client.post("/auth/refresh", json={
            "refresh_token": test_user["refresh_token"],
        })
        assert r.status_code == 200
        data = r.json()
        assert "access_token" in data


class TestPKCEFlow:
    """OAuth 2.1 PKCE授权码流程"""

    def _generate_pkce_pair(self):
        """生成PKCE code_verifier + code_challenge"""
        verifier = secrets.token_urlsafe(32)
        challenge = base64.urlsafe_b64encode(
            hashlib.sha256(verifier.encode()).digest()
        ).rstrip(b'=').decode()
        return verifier, challenge

    def test_pkce_authorize_and_token(self, test_user, client, unique_prefix):
        """PKCE授权码流程：authorize → callback → token"""
        verifier, challenge = self._generate_pkce_pair()
        agent_name = f"{unique_prefix}pkce_agent"

        # 1. Bind agent to get client_id
        r = client.post("/identity/bind-agent", json={
            "agent_name": agent_name,
            "capabilities": ["test"],
            "user_id": test_user["user_id"],
        }, headers={"Authorization": f"Bearer {test_user['access_token']}"})
        assert r.status_code in (200, 201)
        agent_data = r.json()

        # 2. PKCE authorize request
        r = client.get("/auth/authorize", params={
            "client_id": agent_data.get("client_id", ""),
            "redirect_uri": "http://localhost:3000/callback",
            "response_type": "code",
            "code_challenge": challenge,
            "code_challenge_method": "S256",
            "scope": "agent:communicate",
        }, headers={"Authorization": f"Bearer {test_user['access_token']}"})
        assert r.status_code in (200, 302)
        # Extract code from response (location header or body)
        if r.status_code == 302:
            location = r.headers.get("location", "")
            code = location.split("code=")[1].split("&")[0] if "code=" in location else ""
        else:
            code = r.json().get("code", r.json().get("authorization_code", ""))

        # 3. Token exchange with code + verifier
        r = client.post("/auth/token", data={
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": "http://localhost:3000/callback",
            "client_id": agent_data.get("client_id", ""),
            "code_verifier": verifier,
        })
        assert r.status_code == 200
        data = r.json()
        assert "access_token" in data


class TestClientCredentials:
    """Agent client_credentials认证"""

    def test_client_credentials_flow(self, agent_token):
        """Agent通过client_credentials获取token"""
        assert agent_token["access_token"]
        # Token should be valid for API calls
        # (already verified in fixture - this is a sanity check)


class TestAuthMiddleware:
    """认证中间件测试"""

    def test_access_protected_endpoint_without_token(self, client):
        """无token访问受保护端点"""
        r = client.get("/identity/me")
        assert r.status_code in (401, 403)

    def test_access_protected_endpoint_with_invalid_token(self, client):
        """无效token访问受保护端点"""
        r = client.get("/identity/me", headers={
            "Authorization": "Bearer invalid_token_xyz"
        })
        assert r.status_code in (401, 403)

    def test_access_protected_endpoint_with_valid_token(self, test_user, client):
        """有效token访问受保护端点"""
        r = client.get("/identity/me", headers={
            "Authorization": f"Bearer {test_user['access_token']}"
        })
        assert r.status_code == 200
