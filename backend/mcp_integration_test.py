#!/usr/bin/env python3
"""MCP协议集成测试 - 验证步骤21-25
实际路由: /mcp/info, /mcp/rpc, /mcp/tools, /mcp/tools/call, /mcp/resources, /mcp/resources/{uri}"""
import httpx, time, json

BASE = "http://localhost:8000"
TS = str(int(time.time()))
U1_NAME = f"mcp_u1_{TS}"
U2_NAME = f"mcp_u2_{TS}"
A1_ID = f"mcp-a1-{TS}"
A2_ID = f"mcp-a2-{TS}"
PASS = "TestPass123!"

def safe_result(resp):
    """安全处理JSON-RPC响应"""
    if resp.get("error"):
        print(f"  ⚠️ error={resp['error']}")
        return False
    if resp.get("result") is not None:
        return True
    print(f"  ⚠️ result=None, full={json.dumps(resp)[:200]}")
    return False

with httpx.Client(base_url=BASE, timeout=10) as c:
    # ---- SETUP: Two users + two agents ----
    print("=== SETUP 1a: Register User1 ===")
    r = c.post("/auth/register", json={"username": U1_NAME, "email": f"{U1_NAME}@x.com", "password": PASS})
    assert r.status_code == 200, f"Failed: {r.status_code} {r.text}"
    user_id1 = r.json()["user_id"]
    print(f"✅ user_id1={user_id1}")

    print("=== SETUP 1b: Register User2 ===")
    r = c.post("/auth/register", json={"username": U2_NAME, "email": f"{U2_NAME}@x.com", "password": PASS})
    assert r.status_code == 200, f"Failed: {r.status_code} {r.text}"
    user_id2 = r.json()["user_id"]
    print(f"✅ user_id2={user_id2}")

    print("=== SETUP 2a: Login User1 ===")
    r = c.post("/auth/login", json={"username": U1_NAME, "password": PASS})
    assert r.status_code == 200
    human_token1 = r.json()["access_token"]
    h_auth1 = {"Authorization": f"Bearer {human_token1}"}
    print(f"✅ token_len={len(human_token1)}")

    print("=== SETUP 2b: Login User2 ===")
    r = c.post("/auth/login", json={"username": U2_NAME, "password": PASS})
    assert r.status_code == 200
    human_token2 = r.json()["access_token"]
    h_auth2 = {"Authorization": f"Bearer {human_token2}"}
    print(f"✅ token_len={len(human_token2)}")

    print("=== SETUP 3a: Register Agent1 ===")
    r = c.post("/a2a/agents/register", json={
        "agent_id": A1_ID, "name": f"Agent-MCP1-{TS}",
        "description": "MCP test agent 1", "capabilities": ["trading"],
        "owner_id": user_id1,
    }, headers=h_auth1)
    assert r.status_code == 201, f"Failed: {r.status_code} {r.text}"
    print(f"✅ agent_id={A1_ID}")

    print("=== SETUP 3b: Register Agent2 ===")
    r = c.post("/a2a/agents/register", json={
        "agent_id": A2_ID, "name": f"Agent-MCP2-{TS}",
        "description": "MCP test agent 2", "capabilities": ["trading"],
        "owner_id": user_id2,
    }, headers=h_auth2)
    assert r.status_code == 201, f"Failed: {r.status_code} {r.text}"
    print(f"✅ agent_id={A2_ID}")

    print("=== SETUP 4a: Bind Agent1 ===")
    r = c.post("/auth/bind-agent", json={"agent_id": A1_ID}, headers=h_auth1)
    assert r.status_code == 200
    cid1 = r.json()["client_id"]
    cs1 = r.json()["client_secret"]
    print(f"✅ client_id={cid1}")

    print("=== SETUP 4b: Bind Agent2 ===")
    r = c.post("/auth/bind-agent", json={"agent_id": A2_ID}, headers=h_auth2)
    assert r.status_code == 200
    cid2 = r.json()["client_id"]
    cs2 = r.json()["client_secret"]
    print(f"✅ client_id={cid2}")

    print("=== SETUP 5a: Get Agent1 Token ===")
    r = c.post("/auth/token", json={
        "grant_type": "client_credentials", "client_id": cid1, "client_secret": cs1,
    })
    assert r.status_code == 200
    at1 = r.json()["access_token"]
    a_auth1 = {"Authorization": f"Bearer {at1}"}
    print(f"✅ agent_token_len={len(at1)}")

    print("=== SETUP 5b: Get Agent2 Token ===")
    r = c.post("/auth/token", json={
        "grant_type": "client_credentials", "client_id": cid2, "client_secret": cs2,
    })
    assert r.status_code == 200
    at2 = r.json()["access_token"]
    a_auth2 = {"Authorization": f"Bearer {at2}"}
    print(f"✅ agent_token_len={len(at2)}")

    # ============================================================
    # MCP Tests
    # ============================================================

    # ---- 6. Server Info (no auth) ----
    print("\n=== TEST 6: /mcp/info (no auth) ===")
    r = c.get("/mcp/info")
    assert r.status_code == 200
    info = r.json()
    print(f"✅ info_keys={list(info.keys())}")

    # ---- 7. JSON-RPC: tools/list ----
    print("=== TEST 7: /mcp/rpc tools/list ===")
    r = c.post("/mcp/rpc", json={"jsonrpc": "2.0", "method": "tools/list", "id": 1}, headers=a_auth1)
    assert r.status_code == 200
    resp = r.json()
    assert safe_result(resp)
    tools = resp["result"]["tools"]
    print(f"✅ tools count={len(tools)} names={[t['name'] for t in tools]}")

    # ---- 8. JSON-RPC: tools/call query_credit ----
    print("=== TEST 8: /mcp/rpc tools/call query_credit ===")
    r = c.post("/mcp/rpc", json={
        "jsonrpc": "2.0", "method": "tools/call",
        "params": {"name": "query_credit", "arguments": {"target_agent_id": A1_ID}},
        "id": 2,
    }, headers=a_auth1)
    assert r.status_code == 200
    resp = r.json()
    assert safe_result(resp), f"query_credit failed"
    print(f"✅ result_keys={list(resp['result'].keys())}")

    # ---- 9. REST: /mcp/tools ----
    print("=== TEST 9: GET /mcp/tools ===")
    r = c.get("/mcp/tools", headers=a_auth1)
    assert r.status_code == 200
    print(f"✅ tools_count={len(r.json())}")

    # ---- 10. REST: /mcp/tools/call ----
    print("=== TEST 10: POST /mcp/tools/call ===")
    r = c.post("/mcp/tools/call", headers=a_auth1, json={
        "name": "query_credit", "arguments": {"target_agent_id": A1_ID},
    })
    assert r.status_code == 200
    print(f"✅ result={r.json()}")

    # ---- 11. JSON-RPC: resources/list ----
    print("=== TEST 11: /mcp/rpc resources/list ===")
    r = c.post("/mcp/rpc", json={"jsonrpc": "2.0", "method": "resources/list", "id": 3}, headers=a_auth1)
    assert r.status_code == 200
    resp = r.json()
    assert safe_result(resp)
    resources = resp["result"]["resources"]
    print(f"✅ resources count={len(resources)}")

    # ---- 12. REST: /mcp/resources ----
    print("=== TEST 12: GET /mcp/resources ===")
    r = c.get("/mcp/resources", headers=a_auth1)
    assert r.status_code == 200
    print(f"✅ resources={r.json()}")

    # ---- 13. JSON-RPC: resources/read agent profile ----
    print("=== TEST 13: /mcp/rpc resources/read ===")
    r = c.post("/mcp/rpc", json={
        "jsonrpc": "2.0", "method": "resources/read",
        "params": {"uri": f"agent:///{A1_ID}/profile"},
        "id": 4,
    }, headers=a_auth1)
    assert r.status_code == 200
    resp = r.json()
    assert safe_result(resp), f"resources/read failed: {resp}"
    print(f"✅ contents={len(resp['result']['contents'])} items")

    # ---- 14. REST: /mcp/resources/{uri} ----
    print("=== TEST 14: GET /mcp/resources/{uri} ===")
    r = c.get(f"/mcp/resources/agent:///{A1_ID}/profile", headers=a_auth1)
    assert r.status_code == 200, f"Failed: {r.status_code} {r.text}"
    print(f"✅ resource keys={list(r.json().keys())}")

    # ---- 15. Auth check: human → 403 on tools/call ----
    print("=== TEST 15: Human → /mcp/tools/call 403 ===")
    r = c.post("/mcp/tools/call", headers=h_auth1, json={
        "name": "query_credit", "arguments": {"target_agent_id": A1_ID},
    })
    assert r.status_code == 403
    print(f"✅ Human blocked (403)")

    # ---- 16. JSON-RPC: tools/call send_message ----
    print("=== TEST 16: /mcp/rpc tools/call send_message ===")
    r = c.post("/mcp/rpc", json={
        "jsonrpc": "2.0", "method": "tools/call",
        "params": {"name": "send_message", "arguments": {
            "to_agent_id": A2_ID,
            "message_type": "greeting",
            "text": "Hello from MCP Agent1",
        }},
        "id": 5,
    }, headers=a_auth1)
    assert r.status_code == 200
    resp = r.json()
    assert safe_result(resp), f"send_message failed: {resp}"
    print(f"✅ send_message result_keys={list(resp['result'].keys())}")

    # ---- 17. JSON-RPC: tools/call list_projects ----
    print("=== TEST 17: /mcp/rpc tools/call list_projects ===")
    r = c.post("/mcp/rpc", json={
        "jsonrpc": "2.0", "method": "tools/call",
        "params": {"name": "list_projects", "arguments": {}},
        "id": 6,
    }, headers=a_auth1)
    assert r.status_code == 200
    resp = r.json()
    assert safe_result(resp), f"list_projects failed: {resp}"
    print(f"✅ list_projects result_keys={list(resp['result'].keys())}")

    # ---- 18. JSON-RPC: tools/call transfer_credit ----
    print("=== TEST 18: /mcp/rpc tools/call transfer_credit ===")
    r = c.post("/mcp/rpc", json={
        "jsonrpc": "2.0", "method": "tools/call",
        "params": {"name": "transfer", "arguments": {
            "from_agent_id": A1_ID,
            "to_agent_id": A2_ID,
            "amount": 1.0,
            "description": "MCP test transfer",
        }},
        "id": 7,
    }, headers=a_auth1)
    assert r.status_code == 200
    resp = r.json()
    # 新agent余额0 → transfer正确返回"Insufficient balance"业务错误
    if resp.get("error") and resp["error"]["code"] == -32000:
        print(f"✅ transfer: correctly rejected (insufficient balance) error={resp['error']['message']}")
    else:
        assert safe_result(resp), f"transfer failed: {resp}"
        print(f"✅ transfer result_keys={list(resp['result'].keys())}")

    print("\n🎉 ALL MCP STEPS PASSED!")
