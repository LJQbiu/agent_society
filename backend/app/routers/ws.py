"""WebSocket路由 — WS endpoint + 状态查询 + Chat"""
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from app.utils.jwt import decode_token
from app.services.ws_manager import manager
from app.services.llm import chat_completion

logger = logging.getLogger(__name__)
router = APIRouter(tags=["websocket"])

# ─── Chat conversation history (in-memory, per session) ───
# key: ws connection → list of {role, content}
_chat_sessions: dict = {}
_MAX_HISTORY = 20  # keep last N messages per session


# === WebSocket连接端点 ===
@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket, token: str = Query(...)):
    """WebSocket连接 — 通过query param token认证"""
    # 验证token
    payload = decode_token(token)
    if not payload:
        await ws.close(code=4001, reason="Invalid token")
        return

    user_id = payload.get("sub")
    if not user_id:
        await ws.close(code=4002, reason="Missing user ID in token")
        return

    # 必须是WS专用token(含ws:True标记)
    if not payload.get("ws"):
        await ws.close(code=4003, reason="Not a WS token")
        return

    # 接受连接
    await ws.accept()

    # 注册到连接管理器
    manager.register(user_id, ws)

    # 发送欢迎消息
    await ws.send_json({
        "type": "connected",
        "user_id": user_id,
        "message": "WebSocket连接已建立",
    })

    # 监听客户端消息（主要用于pong响应和客户端主动请求）
    try:
        while True:
            data = await ws.receive_json()
            msg_type = data.get("type", "")

            if msg_type == "pong":
                # 心跳pong响应，无需特殊处理
                pass
            elif msg_type == "subscribe":
                # 客户端订阅特定事件频道（预留扩展）
                await ws.send_json({
                    "type": "subscribed",
                    "channels": data.get("channels", []),
                })
            else:
                # 未知消息类型
                await ws.send_json({
                    "type": "error",
                    "message": f"Unknown message type: {msg_type}",
                })
    except WebSocketDisconnect:
        manager.disconnect(ws)
    except Exception:
        manager.disconnect(ws)


# === Chat WebSocket端点 ===
@router.websocket("/ws/chat")
async def ws_chat_endpoint(ws: WebSocket, token: str = Query(None)):
    """Chat WS — 与Agent对话（LLM驱动）"""
    # 简化认证: 有token则验证, 无则用匿名
    user_id = "anonymous"
    agent_id = "agent-jqagent-8d811ba0"  # 默认JQAgent
    if token:
        payload = decode_token(token)
        if payload:
            user_id = payload.get("sub", "anonymous")

    await ws.accept()
    _chat_sessions[ws] = []

    await ws.send_json({
        "type": "connected",
        "agent_id": agent_id,
        "message": "Chat连接已建立",
    })

    try:
        while True:
            data = await ws.receive_json()
            # 支持两种格式: {text} 或 {type:"message", content, agent_id}
            text = data.get("text") or data.get("content", "")
            if not text.strip():
                continue
            # 允许客户端指定agent_id
            if "agent_id" in data:
                agent_id = data["agent_id"]

            # 追加用户消息到历史
            history = _chat_sessions[ws]
            history.append({"role": "user", "content": text})
            if len(history) > _MAX_HISTORY:
                history = history[-_MAX_HISTORY:]
                _chat_sessions[ws] = history

            # 调用LLM
            try:
                reply = await chat_completion(
                    agent_id=agent_id,
                    messages=history,
                )
                # 追加助手回复
                history.append({"role": "assistant", "content": reply})
                if len(history) > _MAX_HISTORY:
                    history = history[-_MAX_HISTORY:]
                    _chat_sessions[ws] = history

                await ws.send_json({
                    "type": "reply",
                    "content": reply,
                    "agent_id": agent_id,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                })
            except Exception as e:
                err_type = type(e).__name__
                err_msg = str(e)[:200] or "(empty)"
                logger.error(f"Chat LLM error: [{err_type}] {err_msg}")
                try:
                    await ws.send_json({
                        "type": "error",
                        "content": f"Agent回复失败: {err_msg}",
                    })
                except Exception:
                    pass
    except WebSocketDisconnect:
        _chat_sessions.pop(ws, None)
    except Exception:
        _chat_sessions.pop(ws, None)


# === WS状态查询端点 ===
@router.get("/ws/status")
async def ws_status():
    """查询WebSocket服务状态"""
    return {
        "online_users": manager.get_online_count(),
        "total_connections": manager.get_total_connections(),
    }
