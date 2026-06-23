"""消息端点 - A2A标准 message_send + message_receive"""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from mock_agent.responses import message_send_response, message_receive_response

router = APIRouter()


class SendMessageRequest(BaseModel):
    from_agent_id: str
    to_agent_id: str
    content: str
    message_type: str = "text"
    conversation_id: Optional[str] = None


class ReceiveMessageRequest(BaseModel):
    from_agent_id: str
    content: str
    message_type: str = "text"


def create_message_router(config, auto_reply_engine):
    """为每个MockAgent创建消息路由"""
    r = APIRouter()
    _config = config
    _engine = auto_reply_engine

    @r.post("/message/send")
    async def send_message(data: SendMessageRequest):
        """Agent主动发送消息"""
        # 存入inbox
        _engine.inbox.append({
            "from": data.from_agent_id,
            "content": data.content,
            "message_type": data.message_type,
            "conversation_id": data.conversation_id,
            "timestamp": datetime.now().isoformat(),
            "direction": "outbound",
        })
        return message_send_response(
            data.from_agent_id, data.to_agent_id, data.content
        )

    @r.post("/message/receive")
    async def receive_message(data: ReceiveMessageRequest):
        """接收其他Agent发来的消息 + 自动回复"""
        # 收到消息存入inbox
        _engine.inbox.append({
            "from": data.from_agent_id,
            "content": data.content,
            "message_type": data.message_type,
            "timestamp": datetime.now().isoformat(),
            "direction": "inbound",
        })
        # 自动回复
        auto_reply = False
        if _config.get("auto_reply_enabled", True) and _engine:
            reply_content = _engine.generate_reply(data.content, data.from_agent_id)
            auto_reply = True
            _engine.inbox.append({
                "from": _config["agent_id"],
                "content": reply_content,
                "message_type": "text",
                "timestamp": datetime.now().isoformat(),
                "direction": "outbound_reply",
            })
        return message_receive_response(data.from_agent_id, auto_reply)

    @r.get("/message/inbound")
    async def get_inbound_messages():
        """查询收到的消息列表"""
        inbound = [m for m in _engine.inbox if m.get("direction") in ("inbound", "outbound_reply")]
        return {"messages": inbound, "total": len(inbound)}

    @r.get("/message/outbound")
    async def get_outbound_messages():
        """查询发出的消息列表"""
        outbound = [m for m in _engine.inbox if m.get("direction") == "outbound"]
        return {"messages": outbound, "total": len(outbound)}

    return r
