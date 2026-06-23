"""状态端点 - A2A标准"""
from fastapi import APIRouter
from datetime import datetime

router = APIRouter()


def create_status_router(config, start_time: float):
    """为每个MockAgent创建状态路由"""
    r = APIRouter()
    _start_time = start_time
    _current_status = "active"

    @r.get("/status")
    async def get_status():
        """获取Agent当前状态"""
        return {
            "status": _current_status,
            "agent_id": config["agent_id"],
            "uptime_seconds": round(datetime.now().timestamp() - _start_time, 1),
        }

    @r.put("/status/{status_type}")
    async def update_status(status_type: str):
        """更新Agent状态 (active/idle/offline/maintenance)"""
        valid_statuses = ["active", "idle", "offline", "maintenance"]
        if status_type not in valid_statuses:
            from fastapi import HTTPException
            raise HTTPException(400, f"Invalid status: {status_type}. Valid: {valid_statuses}")
        _current_status = status_type
        return {
            "status": status_type,
            "agent_id": config["agent_id"],
            "updated_at": datetime.now().isoformat(),
        }

    return r
