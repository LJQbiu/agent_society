"""任务端点 - A2A标准 task_propose + task_execute"""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, Dict, Any
from mock_agent.responses import task_propose_response, task_execute_response

router = APIRouter()


class TaskProposeRequest(BaseModel):
    proposing_agent_id: str
    task_type: str = "analysis"
    description: str = ""
    parameters: Optional[Dict[str, Any]] = None


class TaskExecuteRequest(BaseModel):
    task_id: str
    executing_agent_id: str
    parameters: Optional[Dict[str, Any]] = None


def create_task_router(config):
    """为每个MockAgent创建任务路由"""
    r = APIRouter()
    _config = config
    _accepted_tasks = {}

    @r.post("/task/propose")
    async def propose_task(data: TaskProposeRequest):
        """提议任务 - MockAgent总是接受"""
        resp = task_propose_response(_config["agent_id"])
        _accepted_tasks[resp["task_id"]] = {
            "proposing_agent_id": data.proposing_agent_id,
            "task_type": data.task_type,
            "description": data.description,
            "parameters": data.parameters,
            "status": "accepted",
        }
        return resp

    @r.post("/task/execute")
    async def execute_task(data: TaskExecuteRequest):
        """执行任务 - MockAgent总是立即完成"""
        task_info = _accepted_tasks.get(data.task_id, {})
        return task_execute_response(_config["agent_id"], data.task_id)

    @r.get("/task/list")
    async def list_tasks():
        """查看已接受的任务列表"""
        return {
            "tasks": _accepted_tasks,
            "total": len(_accepted_tasks),
        }

    return r
