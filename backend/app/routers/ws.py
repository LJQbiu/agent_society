"""WebSocket路由 — WS endpoint + 状态查询"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from app.utils.jwt import decode_token
from app.services.ws_manager import manager

router = APIRouter(tags=["websocket"])


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


# === WS状态查询端点 ===
@router.get("/ws/status")
async def ws_status():
    """查询WebSocket服务状态"""
    return {
        "online_users": manager.get_online_count(),
        "total_connections": manager.get_total_connections(),
    }
