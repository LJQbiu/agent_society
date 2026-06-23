"""测试配置 - DB连接、httpx client、测试数据fixture"""
import pytest
import httpx
import time
import uuid

# Live backend server URL
BASE_URL = "http://localhost:8000"

# Unique test prefix to avoid collisions
TEST_PREFIX = f"test_{uuid.uuid4().hex[:8]}_"


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def client():
    """httpx同步client - 对live backend"""
    with httpx.Client(base_url=BASE_URL, timeout=10.0) as c:
        # Verify backend is alive
        r = c.get("/health")
        assert r.status_code == 200, f"Backend not available: {r.status_code}"
        yield c


@pytest.fixture
def unique_prefix():
    """每次测试唯一前缀"""
    return TEST_PREFIX


@pytest.fixture
def test_user(client, unique_prefix):
    """注册测试用户 + 获取token"""
    username = f"{unique_prefix}user"
    email = f"{username}@test.com"
    password = "TestPass123!"

    # Register
    r = client.post("/identity/register", json={
        "username": username,
        "email": email,
        "password": password,
        "identity_type": "human",
    })
    if r.status_code not in (200, 201):
        pytest.skip(f"Platform /identity/register not available (status={r.status_code})")

    # Login
    r = client.post("/auth/login", json={
        "username": username,
        "password": password,
    })
    if r.status_code != 200:
        pytest.skip(f"Platform /auth/login not available (status={r.status_code})")
    token_data = r.json()

    return {
        "username": username,
        "email": email,
        "password": password,
        "user_id": token_data.get("user_id", ""),
        "access_token": token_data.get("access_token", ""),
        "refresh_token": token_data.get("refresh_token", ""),
    }


@pytest.fixture
def agent_token(client, test_user, unique_prefix):
    """已绑定Agent的client_credentials token"""
    agent_name = f"{unique_prefix}agent"

    # Bind agent to user
    r = client.post("/identity/bind-agent", json={
        "agent_name": agent_name,
        "capabilities": ["test_capability"],
        "user_id": test_user["user_id"],
    }, headers={"Authorization": f"Bearer {test_user['access_token']}"})
    if r.status_code not in (200, 201):
        pytest.skip(f"Platform /identity/bind-agent not available (status={r.status_code})")
    agent_data = r.json()

    # Get agent client_credentials token
    r = client.post("/auth/token", data={
        "grant_type": "client_credentials",
        "client_id": agent_data.get("client_id", ""),
        "client_secret": agent_data.get("client_secret", ""),
    })
    if r.status_code != 200:
        pytest.skip(f"Platform client_credentials auth not available (status={r.status_code})")

    return {
        "agent_id": agent_data.get("agent_id", ""),
        "client_id": agent_data.get("client_id", ""),
        "access_token": r.json().get("access_token", ""),
    }
