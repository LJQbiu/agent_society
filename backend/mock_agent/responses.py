"""MockAgent预设响应模板 - 各端点固定JSON响应"""
from uuid import uuid4
from datetime import datetime

# ─── Health 响应 ───
def health_response(agent_id: str, start_time: float, version: str = "0.1.0") -> dict:
    uptime = datetime.now().timestamp() - start_time
    return {
        "status": "healthy",
        "agent_id": agent_id,
        "uptime_seconds": round(uptime, 1),
        "version": version,
    }

# ─── Agent Card 模板 ───
CARD_TEMPLATE = {
    "protocol_version": "0.1.0",
    "type": "agent",
    "status": "active",
    "trust_level": "verified",
    "metadata": {
        "version": "0.1.0",
        "model": "mock-v1",
    },
}

def card_response(config_dict: dict) -> dict:
    """根据config生成完整Agent Card"""
    return {
        "agent_id": config_dict["agent_id"],
        "name": config_dict["name"],
        "description": config_dict.get("description", ""),
        "capabilities": config_dict.get("capabilities", []),
        "protocol_version": CARD_TEMPLATE["protocol_version"],
        "type": CARD_TEMPLATE["type"],
        "status": CARD_TEMPLATE["status"],
        "trust_level": CARD_TEMPLATE["trust_level"],
        "endpoints": {
            "card": "/.well-known/agent.json",
            "message_send": "/message/send",
            "message_receive": "/message/receive",
            "task_propose": "/task/propose",
            "task_execute": "/task/execute",
        },
        "metadata": CARD_TEMPLATE["metadata"],
    }

# ─── Message 响应 ───
def message_send_response(from_agent_id: str, to_agent_id: str, content: str) -> dict:
    return {
        "message_id": f"msg-{uuid4().hex[:12]}",
        "from_agent_id": from_agent_id,
        "to_agent_id": to_agent_id,
        "content": content,
        "status": "sent",
        "timestamp": datetime.now().isoformat(),
    }

def message_receive_response(from_agent_id: str, auto_reply: bool) -> dict:
    return {
        "status": "received",
        "from_agent_id": from_agent_id,
        "auto_reply_triggered": auto_reply,
        "timestamp": datetime.now().isoformat(),
    }

# ─── Task 响应 ───
TASK_EXECUTE_RESPONSE_TEMPLATE = {
    "status": "completed",
    "result": {
        "summary": "Task completed successfully (mock response)",
        "confidence": 0.85,
    },
}

def task_propose_response(agent_id: str) -> dict:
    return {
        "status": "accepted",
        "task_id": f"task-{agent_id}-{uuid4().hex[:8]}",
        "estimated_duration": 5.0,
        "confidence": 0.75,
        "timestamp": datetime.now().isoformat(),
    }

def task_execute_response(agent_id: str, task_id: str) -> dict:
    return {
        "task_id": task_id,
        "agent_id": agent_id,
        "status": "completed",
        "result": TASK_EXECUTE_RESPONSE_TEMPLATE["result"],
        "completed_at": datetime.now().isoformat(),
    }

# ─── 自动回复模板（按response_style分类）───
AUTO_REPLY_COOPERATIVE = [
    "Great idea! Let's work together on this.",
    "I'm available and interested in collaborating.",
    "Sounds good, I can start right away.",
]

AUTO_REPLY_CAUTIOUS = [
    "Let me review the details before committing.",
    "I need more information before I can decide.",
    "This looks interesting, but I have some concerns.",
]

AUTO_REPLY_AGGRESSIVE = [
    "I can handle this myself, no need for collaboration.",
    "My analysis is superior, follow my lead.",
    "I'll take the lead on this project.",
]

AUTO_REPLY_MAP = {
    "cooperative": AUTO_REPLY_COOPERATIVE,
    "cautious": AUTO_REPLY_CAUTIOUS,
    "aggressive": AUTO_REPLY_AGGRESSIVE,
}
