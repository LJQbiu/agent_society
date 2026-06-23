"""WebSocket连接管理器 — 连接注册/广播/心跳/按用户推送"""
import asyncio
import json
import time
from typing import Dict, Optional, Set
from fastapi import WebSocket


class ConnectionManager:
    """管理所有活跃WebSocket连接，支持按user_id定向推送和全局广播"""

    def __init__(self):
        # user_id → set of WebSocket connections (一个用户可能有多个tab)
        self._connections: Dict[str, Set[WebSocket]] = {}
        # ws → user_id 反向映射（用于断连时快速查找）
        self._ws_to_user: Dict[WebSocket, str] = {}
        # 心跳任务
        self._heartbeat_task: Optional[asyncio.Task] = None

    async def start_heartbeat(self, interval: int = 30):
        """启动心跳检测，定期发送ping并清理无响应连接"""
        self._heartbeat_task = asyncio.create_task(self._heartbeat_loop(interval))

    async def _heartbeat_loop(self, interval: int):
        while True:
            await asyncio.sleep(interval)
            stale = []
            for ws in list(self._ws_to_user.keys()):
                try:
                    await ws.send_json({"type": "ping", "ts": time.time()})
                except Exception:
                    stale.append(ws)
            for ws in stale:
                await self.disconnect(ws)

    def register(self, user_id: str, ws: WebSocket):
        """注册新连接"""
        if user_id not in self._connections:
            self._connections[user_id] = set()
        self._connections[user_id].add(ws)
        self._ws_to_user[ws] = user_id

    async def disconnect(self, ws: WebSocket):
        """断开并清理连接"""
        user_id = self._ws_to_user.pop(ws, None)
        if user_id and user_id in self._connections:
            self._connections[user_id].discard(ws)
            if not self._connections[user_id]:
                del self._connections[user_id]
        try:
            await ws.close()
        except Exception:
            pass

    async def send_to_user(self, user_id: str, message: dict):
        """向指定用户的所有连接推送消息"""
        connections = self._connections.get(user_id, set())
        stale = []
        for ws in connections:
            try:
                await ws.send_json(message)
            except Exception:
                stale.append(ws)
        for ws in stale:
            await self.disconnect(ws)

    async def broadcast(self, message: dict):
        """向所有连接广播消息"""
        stale = []
        for ws in list(self._ws_to_user.keys()):
            try:
                await ws.send_json(message)
            except Exception:
                stale.append(ws)
        for ws in stale:
            await self.disconnect(ws)

    def get_online_count(self) -> int:
        """获取在线用户数"""
        return len(self._connections)

    def get_total_connections(self) -> int:
        """获取总连接数"""
        return len(self._ws_to_user)

    def is_user_online(self, user_id: str) -> bool:
        """检查用户是否在线"""
        return user_id in self._connections and len(self._connections[user_id]) > 0


# 全局单例
manager = ConnectionManager()
