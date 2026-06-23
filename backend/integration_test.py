#!/usr/bin/env python3
"""Full integration test - auth + A2A + message flow"""
import httpx, time

BASE = "http://localhost:8000"
TS = str(int(time.time()))

# Two users & agents for cross-agent messaging
U1_NAME, U2_NAME = f"itest_u1_{TS}", f"itest_u2_{TS}"
A1_ID, A2_ID = f"itest-a1-{TS}", f"itest-a2-{TS}"

with httpx.Client(base_url=BASE, timeout=10) as c:
    # === Step 1: Register User 1 ===
    print("=== STEP 1: Register User 1 ===")
    r1 = c.post("/auth/register", json={"username": U1_NAME, "email": f"{U1_NAME}@x.com", "password": "TestPass123!"})
    print(r1.status_code, r1.json())
    assert r1.status_code == 200

    # === Step 2: Register User 2 ===
    print("=== STEP 2: Register User 2 ===")
    r2 = c.post("/auth/register", json={"username": U2_NAME, "email": f"{U2_NAME}@x.com", "password": "TestPass123!"})
    print(r2.status_code, r2.json())
    assert r2.status_code == 200

    # === Step 3: Login User 1 ===
    print("=== STEP 3: Login User 1 ===")
    l1 = c.post("/auth/login", json={"username": U1_NAME, "password": "TestPass123!"})
    print(l1.status_code, "token_len=", len(l1.json().get("access_token","")))
    human1_token = l1.json().get("access_token","")
    assert human1_token

    # === Step 4: Login User 2 ===
    print("=== STEP 4: Login User 2 ===")
    l2 = c.post("/auth/login", json={"username": U2_NAME, "password": "TestPass123!"})
    print(l2.status_code, "token_len=", len(l2.json().get("access_token","")))
    human2_token = l2.json().get("access_token","")
    assert human2_token

    # === Step 5: Register Agent 1 Card ===
    print("=== STEP 5: Register Agent 1 Card ===")
    a1 = c.post("/a2a/agents/register", json={
        "agent_id": A1_ID, "name": f"Agent1-{TS}",
        "description": "Testing agent 1", "capabilities": ["trading"],
        "owner_id": r1.json()["user_id"]
    }, headers={"Authorization": f"Bearer {human1_token}"})
    print(a1.status_code, a1.json())
    assert a1.status_code == 201

    # === Step 6: Register Agent 2 Card ===
    print("=== STEP 6: Register Agent 2 Card ===")
    a2 = c.post("/a2a/agents/register", json={
        "agent_id": A2_ID, "name": f"Agent2-{TS}",
        "description": "Testing agent 2", "capabilities": ["analysis"],
        "owner_id": r2.json()["user_id"]
    }, headers={"Authorization": f"Bearer {human2_token}"})
    print(a2.status_code, a2.json())
    assert a2.status_code == 201

    # === Step 7: Bind Agent 1 ===
    print("=== STEP 7: Bind Agent 1 ===")
    b1 = c.post("/auth/bind-agent", json={"agent_id": A1_ID},
                headers={"Authorization": f"Bearer {human1_token}"})
    print(b1.status_code, b1.json())
    assert b1.status_code == 200
    a1_client_id = b1.json().get("client_id","")
    a1_client_secret = b1.json().get("client_secret","")

    # === Step 8: Bind Agent 2 ===
    print("=== STEP 8: Bind Agent 2 ===")
    b2 = c.post("/auth/bind-agent", json={"agent_id": A2_ID},
                headers={"Authorization": f"Bearer {human2_token}"})
    print(b2.status_code, b2.json())
    assert b2.status_code == 200
    a2_client_id = b2.json().get("client_id","")
    a2_client_secret = b2.json().get("client_secret","")

    # === Step 9: Get Agent 1 Token ===
    print("=== STEP 9: Agent 1 Token (client_credentials) ===")
    t1 = c.post("/auth/token", json={
        "grant_type": "client_credentials",
        "client_id": a1_client_id, "client_secret": a1_client_secret
    })
    print(t1.status_code, "agent1_token_len=", len(t1.json().get("access_token","")))
    agent1_token = t1.json().get("access_token","")
    assert agent1_token

    # === Step 10: Get Agent 2 Token ===
    print("=== STEP 10: Agent 2 Token (client_credentials) ===")
    t2 = c.post("/auth/token", json={
        "grant_type": "client_credentials",
        "client_id": a2_client_id, "client_secret": a2_client_secret
    })
    print(t2.status_code, "agent2_token_len=", len(t2.json().get("access_token","")))
    agent2_token = t2.json().get("access_token","")
    assert agent2_token

    # === Step 11: Send Message (Agent 1 → Agent 2) ===
    print("=== STEP 11: Send Message A1→A2 ===")
    msg = c.post("/a2a/messages", json={
        "from_agent_id": A1_ID, "to_agent_id": A2_ID,
        "content": {"text": "Hello from Agent 1!"},
        "message_type": "text", "priority": "normal"
    }, headers={"Authorization": f"Bearer {agent1_token}"})
    print(msg.status_code, msg.json())
    assert msg.status_code == 201

    # === Step 12: Get Agent 2 Inbound Messages ===
    print("=== STEP 12: Get Agent 2 Inbound Messages ===")
    msgs = c.get(f"/a2a/messages/{A2_ID}", headers={"Authorization": f"Bearer {agent2_token}"})
    print(msgs.status_code, msgs.json())
    assert msgs.status_code == 200

    # === Step 13: Verify Agent Cards ===
    print("=== STEP 13: Verify Agent Cards ===")
    card1 = c.get(f"/a2a/agents/{A1_ID}/card")
    print(card1.status_code, card1.json()["agent_id"], card1.json()["status"])
    card2 = c.get(f"/a2a/agents/{A2_ID}/card")
    print(card2.status_code, card2.json()["agent_id"], card2.json()["status"])

print("\n✅ ALL 13 STEPS PASSED!")
