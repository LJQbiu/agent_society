#!/usr/bin/env python3
"""生成测试JWT token + A2A完整端点验证"""
import sys, json, time
sys.path.insert(0, '/root/agent_society/backend')

from app.config import settings
from jose import jwt

# 生成admin token
token_data = {
    "sub": "test-admin-001",
    "user_type": "admin",
    "roles": ["admin"],
    "scope": "a2a:full",
    "exp": int(time.time()) + 3600,
    "iat": int(time.time()),
    "jti": "test-jti-001"
}
token = jwt.encode(token_data, settings.SECRET_KEY, algorithm="HS256")
print("TOKEN:", token)

# 测试认证端点
import urllib.request

base = "http://localhost:8000"
headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

def req(method, path, data=None):
    url = base + path
    if data:
        data = json.dumps(data).encode()
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        resp = urllib.request.urlopen(r)
        return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())

# 1. Register agent
code, body = req("POST", "/a2a/agents/register", {
    "name": "Test Agent A2A",
    "description": "A2A测试Agent",
    "capabilities": ["message-relay", "task-negotiation"],
    "endpoints": {"message": "http://localhost:9001/a2a/messages"}
})
print(f"1. Register: {code}", json.dumps(body, indent=2, ensure_ascii=False))

if code == 200:
    agent_id = body.get("agent_id", "")
    # 2. Get agent card
    code2, body2 = req("GET", f"/a2a/agents/{agent_id}/card")
    print(f"2. Get Card: {code2}", json.dumps(body2, indent=2, ensure_ascii=False))
    
    # 3. Update agent card
    code3, body3 = req("PUT", f"/a2a/agents/{agent_id}/card", {
        "agent_name": "Updated Test Agent",
        "description": "Updated A2A agent",
        "capabilities": ["message-relay"]
    })
    print(f"3. Update Card: {code3}", json.dumps(body3, indent=2, ensure_ascii=False))
    
    # 4. Discover (no auth needed)
    r4 = urllib.request.Request(base + "/a2a/agents/discover")
    resp4 = urllib.request.urlopen(r4)
    body4 = json.loads(resp4.read())
    print(f"4. Discover: {resp4.status}", json.dumps(body4, indent=2, ensure_ascii=False))
    
    # 5. Send message
    code5, body5 = req("POST", "/a2a/messages", {
        "from_agent_id": agent_id,
        "to_agent_id": agent_id,  # self-message for test
        "content": {"type": "text", "text": "Hello A2A!"},
        "message_type": "task_request"
    })
    print(f"5. Send Message: {code5}", json.dumps(body5, indent=2, ensure_ascii=False))
    
    if code5 == 200:
        msg_id = body5.get("message_id", "")
        # 6. Get messages
        code6, body6 = req("GET", f"/a2a/messages/{agent_id}?limit=10&offset=0")
        print(f"6. Get Messages: {code6}", json.dumps(body6, indent=2, ensure_ascii=False))
        
        # 7. Update message status
        code7, body7 = req("PUT", f"/a2a/messages/{msg_id}/status", {
            "status": "delivered"
        })
        print(f"7. Update Status: {code7}", json.dumps(body7, indent=2, ensure_ascii=False))
