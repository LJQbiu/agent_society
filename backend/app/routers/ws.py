"""WebSocket路由 — WS endpoint + 状态查询 + Chat (DB-backed)"""
import logging
import uuid
import httpx
from datetime import datetime, timezone
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.utils.jwt import decode_token
from app.services.ws_manager import manager
from app.database import async_session
from app.models.agent import Agent
from app.models.chat import ChatMessage

logger = logging.getLogger(__name__)
router = APIRouter(tags=["websocket"])

# ─── Agent status cache (for bridge gate) ───
FROZEN_STATUSES = {"frozen", "suspended", "revoked"}


async def _get_agent_info(agent_id_str: str) -> tuple[str | None, str]:
    """查询agent状态和bridge_url。返回 (bridge_url, status)"""
    async with async_session() as db:
        result = await db.execute(
            select(Agent).where(Agent.agent_id_str == agent_id_str)
        )
        agent = result.scalar_one_or_none()
        if not agent:
            return None, "unknown"
        return agent.bridge_url, agent.status


async def _save_chat(session_id: str, agent_id_str: str, user_id: str | None,
                     role: str, content: str, extra: dict | None = None):
    """持久化一条chat消息到DB"""
    async with async_session() as db:
        msg = ChatMessage(
            session_id=session_id,
            agent_id_str=agent_id_str,
            user_id=user_id or "anonymous",
            role=role,
            content=content,
            extra=extra,
        )
        db.add(msg)
        await db.commit()


async def _load_chat_history(session_id: str, limit: int = 20) -> list[dict]:
    """从DB加载指定session的最近N条chat历史"""
    async with async_session() as db:
        result = await db.execute(
            select(ChatMessage)
            .where(ChatMessage.session_id == session_id)
            .order_by(ChatMessage.created_at.desc())
            .limit(limit)
        )
        messages = result.scalars().all()
        # 按时间升序返回
        return [
            {"role": m.role, "content": m.content, "timestamp": m.created_at.isoformat()}
            for m in reversed(messages)
        ]


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
    """Chat WS — 与Agent对话（通过Bridge处理，支持工具调用，DB持久化）"""
    # 简化认证: 有token则验证, 无则用匿名
    user_id = "anonymous"
    agent_id = None  # 由客户端指定或DB查找首个active agent
    session_id = str(uuid.uuid4())  # 每次WS连接一个session

    if token:
        payload = decode_token(token)
        if payload:
            user_id = payload.get("sub", "anonymous")

    await ws.accept()

    # 加载已有历史（如果客户端提供session_id则恢复，否则新session）
    history = await _load_chat_history(session_id)

    await ws.send_json({
        "type": "connected",
        "session_id": session_id,
        "agent_id": agent_id,
        "message": "Chat连接已建立",
    })

    # 如果有历史，发送给客户端恢复
    if history:
        await ws.send_json({
            "type": "history",
            "messages": history,
            "session_id": session_id,
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

            # 如果仍未指定agent_id，尝试DB查找首个有bridge_url的active agent
            if not agent_id:
                async with async_session() as db:
                    result = await db.execute(
                        select(Agent)
                        .where(Agent.status == "active", Agent.bridge_url.isnot(None))
                        .limit(1)
                    )
                    default_agent = result.scalar_one_or_none()
                    if default_agent:
                        agent_id = default_agent.agent_id_str
                    else:
                        await ws.send_json({"type": "error", "message": "No available agent"})
                        continue

            # 追加用户消息到内存历史 + 持久化到DB
            history.append({"role": "user", "content": text})
            await _save_chat(session_id, agent_id, user_id, "user", text)

            # ── Gate: check agent status before routing to bridge ──
            bridge_url, agent_status = await _get_agent_info(agent_id)
            if agent_status in FROZEN_STATUSES:
                status_labels = {"frozen": "已冻结", "suspended": "已暂停", "revoked": "已撤销"}
                reply = f"[Agent {agent_id} {status_labels.get(agent_status, agent_status)}，暂时无法回复]"
                resp_agent_id = agent_id
            # ── Route to bridge HTTP endpoint ──
            elif bridge_url:
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
                reply = f"[未知的Agent或无bridge_url: {agent_id}]"
                resp_agent_id = agent_id

            # 追加助手回复到内存历史 + 持久化到DB
            history.append({"role": "assistant", "content": reply})
            # Keep in-memory history bounded
            if len(history) > 40:
                history = history[-40:]
            await _save_chat(session_id, agent_id, user_id, "assistant", reply)

            await ws.send_json({
                "type": "reply",
                "content": reply,
                "agent_id": resp_agent_id,
                "session_id": session_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
    except WebSocketDisconnect:
        logger.info(f"Chat WS disconnected: session={session_id}")
    except Exception:
        logger.error(f"Chat WS error: session={session_id}")


# === Chat历史查询端点 ===
@router.get("/ws/chat/history")
async def chat_history(session_id: str = Query(...), limit: int = Query(50)):
    """查询指定session的chat历史（REST端点，便于前端恢复对话）"""
    messages = await _load_chat_history(session_id, limit)
    return {"session_id": session_id, "messages": messages, "count": len(messages)}


# === WS状态查询端点 ===
@router.get("/ws/status")
async def ws_status():
    """查询WebSocket服务状态"""
    return {
        "online_users": manager.get_online_count(),
        "total_connections": manager.get_total_connections(),
    }
