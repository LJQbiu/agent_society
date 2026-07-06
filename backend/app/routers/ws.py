"""WebSocket路由 — WS endpoint + 状态查询 + Chat"""
import logging
import httpx
from datetime import datetime, timezone
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from app.utils.jwt import decode_token
from app.services.ws_manager import manager
from app.database import async_session
from app.models.agent import Agent
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)
router = APIRouter(tags=["websocket"])

# ─── Bridge routing: agent_id → bridge HTTP URL ───
BRIDGE_URLS = {
    "agent-jqagent-8d811ba0": "http://127.0.0.1:8001",
    "agent-kuafu-e861fb3a": "http://127.0.0.1:8002",
    "agent-nvwa-df28635b": "http://127.0.0.1:8003",
}

# ─── Agent status cache (for bridge gate) ───
FROZEN_STATUSES = {"frozen", "suspended", "revoked"}


async def _check_agent_status(agent_id_str: str) -> str:
    """查询agent状态，用于bridge路由前检查。返回 'active'|'frozen'|'suspended'|'revoked'|'unknown'"""
    async with async_session() as db:
        # agent_id_str 格式如 "agent-jqagent-8d811ba0"
        # 尝试从BRIDGE_URLS映射或直接查询
        result = await db.execute(
            select(Agent).where(Agent.agent_id_str == agent_id_str)
        )
        agent = result.scalar_one_or_none()
        if not agent:
            return "unknown"
        return agent.status


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
    """Chat WS — 与Agent对话（通过Bridge处理，支持工具调用）"""
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

            # ── Gate: check agent status before routing to bridge ──
            agent_status = await _check_agent_status(agent_id)
            if agent_status in FROZEN_STATUSES:
                status_labels = {"frozen": "已冻结", "suspended": "已暂停", "revoked": "已撤销"}
                reply = f"[Agent {agent_id} {status_labels.get(agent_status, agent_status)}，暂时无法回复]"
                resp_agent_id = agent_id
            # ── Route to bridge HTTP endpoint ──
            elif bridge_url := BRIDGE_URLS.get(agent_id):
                try:
                    async with httpx.AsyncClient(timeout=120.0) as client:
                        resp = await client.post(
                            f"{bridge_url}/api/chat/completion",
                            json={"messages": history, "agent_id": agent_id},
                        )
                        resp.raise_for_status()
                        result = resp.json()
                        reply = result.get("reply", "[Bridge返回空回复]")
                        resp_agent_id = result.get("agent_id", agent_id)
                except httpx.HTTPStatusError as e:
                    err_msg = f"Bridge HTTP错误: {e.response.status_code}"
                    logger.error(f"Chat bridge error: {err_msg}")
                    reply = f"[Agent回复失败: {err_msg}]"
                    resp_agent_id = agent_id
                except Exception as e:
                    err_msg = str(e)[:100]
                    logger.error(f"Chat bridge call failed: {err_msg}")
                    reply = f"[Agent回复失败: {err_msg}]"
                    resp_agent_id = agent_id
            else:
                reply = f"[未知的Agent: {agent_id}]"
                resp_agent_id = agent_id

            # 追加助手回复
            history.append({"role": "assistant", "content": reply})
            if len(history) > _MAX_HISTORY:
                history = history[-_MAX_HISTORY:]
                _chat_sessions[ws] = history

            await ws.send_json({
                "type": "reply",
                "content": reply,
                "agent_id": resp_agent_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
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
