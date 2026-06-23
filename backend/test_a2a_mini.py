#!/usr/bin/env python3
"""完整A2A端点验证 - raw SQL插入测试数据+JWT+HTTP测试"""
import sys, json, time, urllib.request, asyncio
sys.path.insert(0, '/root/agent_society/backend')

from app.config import settings
from app.database import engine
from jose import jwt
import sqlalchemy as sa

AGENT_ID_STR = "agent-test-a2a-001"

# === Step 0: 插入测试Human + Agent (raw SQL) ===
async def setup_test_data():
    async with engine.begin() as conn:
        # 检查是否已存在
        result = await conn.execute(sa.text("SELECT id FROM humans WHERE username='test_human_a2a'"))
        human = result.scalar_one_or_none()
        if not human:
            await conn.execute(sa.text(
                "INSERT INTO humans (id, username, email, password_hash, status, is_active, profile) "
                "VALUES (gen_random_uuid(), 'test_human_a2a', 'test@a2a.local', 'dummy_hash', 'active', true, '{}'::jsonb)"
            ))
            print("Created human")
        else:
            print("Using existing human:", human)

        # 检查agent
        result = await conn.execute(
            sa.text("SELECT id FROM agents WHERE agent_id_str = :aid").bindparams(aid=AGENT_ID_STR)
        )
        agent = result.scalar_one_or_none()
        if not agent:
            await conn.execute(
                sa.text(
                    "INSERT INTO agents (id, agent_id_str, name, description, capabilities, status, reputation, trust_level, "
                    "message_count, task_count, agent_card, owner_id) "
                    "VALUES (gen_random_uuid(), :aid, 'Test Agent A2A', 'A2A test agent', "
                    "'[\"message-relay\", \"task-negotiation\"]'::jsonb, 'active', 0.0, 'novice', 0, 0, '{}'::jsonb, "
                    "(SELECT id FROM humans WHERE username='test_human_a2a'))"
                ).bindparams(aid=AGENT_ID_STR)
            )
            print("Created agent: str=" + AGENT_ID_STR)
        else:
            print("Using existing agent:", agent)

# === Step 1: 生成JWT Token ===
def make_token():
    # service expects sub format: "agent:<agent_id_str>"
    token_data = {
        "sub": f"agent:{AGENT_ID_STR}",
        "user_type": "agent",
        "roles": ["agent"],
        "scope": "a2a:full",
        "exp": int(time.time()) + 3600,
        "iat": int(time.time()),
        "jti": "test-jti-a2a-001",
    }
    token = jwt.encode(token_data, settings.SECRET_KEY, algorithm="HS256")
    print(f"TOKEN: {token[:50]}...")
    return token

# === HTTP helper ===
def req(method, path, data=None, token=None):
    url = f"http://localhost:8000{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = json.dumps(data).encode() if data else None
    r = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        resp = urllib.request.urlopen(r)
        return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        try:
            body = json.loads(e.read())
        except:
            body = {"raw": str(e)}
        return e.code, body

# === Main ===
async def main():
    await setup_test_data()
    token = make_token()

    print("\n=== A2A Endpoint Validation ===")

    # 1. Platform card (no auth)
    code1, body1 = req("GET", "/.well-known/agent.json")
    print(f"1. Platform Card: {code1}", json.dumps(body1, indent=2, ensure_ascii=False)[:300])

    # 2. Register Agent Card (auth required)
    code2, body2 = req("POST", "/a2a/agents/register", {
        "agent_id": AGENT_ID_STR,
        "name": "Test Agent A2A Registered",
        "description": "A2A test agent - registered card",
        "capabilities": ["message-relay", "task-negotiation", "code-review"],
        "endpoints": {"message": "http://localhost:8000/a2a/messages", "task": "http://localhost:8000/a2a/tasks"},
    }, token)
    print(f"2. Register: {code2}", json.dumps(body2, indent=2, ensure_ascii=False)[:300])

    # 3. Get Agent Card (no auth)
    code3, body3 = req("GET", f"/a2a/agents/{AGENT_ID_STR}/card")
    print(f"3. Get Card: {code3}", json.dumps(body3, indent=2, ensure_ascii=False)[:300])

    # 4. Update Agent Card (auth required, must match agent:<str>)
    code4, body4 = req("PUT", f"/a2a/agents/{AGENT_ID_STR}/card", {
        "description": "Updated A2A test agent",
        "capabilities": ["message-relay", "task-negotiation", "code-review", "debug"],
    }, token)
    print(f"4. Update Card: {code4}", json.dumps(body4, indent=2, ensure_ascii=False)[:300])

    # 5. Discover (no auth)
    code5, body5 = req("GET", "/a2a/agents/discover?capability=message-relay&page=1&page_size=10")
    print(f"5. Discover: {code5}", json.dumps(body5, indent=2, ensure_ascii=False)[:300])

    # 6. Send Message (auth required) - POST /a2a/messages
    code6, body6 = req("POST", "/a2a/messages", {
        "from_agent_id": AGENT_ID_STR,
        "to_agent_id": AGENT_ID_STR,  # self-message for test
        "content": {"text": "Hello from A2A test!"},
        "message_type": "text",
    }, token)
    print(f"6. Send Message: {code6}", json.dumps(body6, indent=2, ensure_ascii=False)[:300])

    # 7. Get Messages (auth) - GET /a2a/messages/{agent_id}
    code7, body7 = req("GET", f"/a2a/messages/{AGENT_ID_STR}", None, token)
    print(f"7. Get Messages: {code7}", json.dumps(body7, indent=2, ensure_ascii=False)[:300])

    # 8. Update Message Status (auth) - PUT /a2a/messages/{message_id}/status
    msg_id = body6.get("message_id", "dummy-msg-id") if code6 in [200, 201] else "dummy-msg-id"
    code8, body8 = req("PUT", f"/a2a/messages/{msg_id}/status", {"status": "read"}, token)
    print(f"8. Update Status: {code8}", json.dumps(body8, indent=2, ensure_ascii=False)[:300])

    # Summary
    codes = [code1, code2, code3, code4, code5, code6, code7, code8]
    passed = sum(1 for c in codes if c in [200, 201])
    print(f"\n=== Result: {passed}/8 endpoints passed ===")

asyncio.run(main())
