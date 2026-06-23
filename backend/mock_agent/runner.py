"""MockAgent Test Runner - 启动多Agent实例+消息自动回复验证"""
import asyncio
import subprocess
import sys
import time
import signal
from typing import Dict, List, Optional
from dataclasses import dataclass

from mock_agent.config import MockAgentConfig, MOCK_AGENT_CONFIGS
from mock_agent.app import create_mock_agent_app


@dataclass
class RunningAgent:
    """运行中的MockAgent实例"""
    config: dict
    process: Optional[subprocess.Popen] = None
    port: int = 8002


class MockAgentTestRunner:
    """MockAgent测试运行器 - 启动/停止/验证多Agent"""

    def __init__(self):
        self.running_agents: Dict[str, RunningAgent] = {}
        self.platform_url = "http://localhost:8000"

    def _config_to_dict(self, cfg: MockAgentConfig) -> dict:
        return {
            "agent_id": cfg.agent_id,
            "name": cfg.name,
            "description": cfg.description,
            "capabilities": cfg.capabilities,
            "port": cfg.port,
            "response_style": cfg.response_style,
            "auto_reply_enabled": cfg.auto_reply_enabled,
            "auto_reply_delay_seconds": cfg.auto_reply_delay_seconds,
            "platform_url": cfg.platform_url,
            "version": cfg.version,
        }

    def start_agent(self, key: str, cfg: MockAgentConfig) -> RunningAgent:
        """启动单个MockAgent进程"""
        cfg_dict = self._config_to_dict(cfg)
        proc = subprocess.Popen(
            [
                sys.executable, "-m", "uvicorn",
                f"mock_agent.app:app_factory_{cfg.agent_id}",
                "--host", "0.0.0.0",
                "--port", str(cfg.port),
            ],
            cwd="/root/agent_society/backend",
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        agent = RunningAgent(config=cfg_dict, process=proc, port=cfg.port)
        self.running_agents[key] = agent
        return agent

    def start_all(self) -> Dict[str, RunningAgent]:
        """启动所有预配置的MockAgent"""
        for key, cfg in MOCK_AGENT_CONFIGS.items():
            self.start_agent(key, cfg)
        # 等待启动
        time.sleep(2)
        return self.running_agents

    def stop_agent(self, key: str):
        """停止单个Agent"""
        agent = self.running_agents.get(key)
        if agent and agent.process:
            agent.process.terminate()
            agent.process.wait(timeout=5)

    def stop_all(self):
        """停止所有Agent"""
        for key in list(self.running_agents.keys()):
            self.stop_agent(key)

    def check_health(self, key: str) -> dict:
        """检查Agent健康状态"""
        import httpx
        agent = self.running_agents.get(key)
        if not agent:
            return {"status": "not_found"}
        try:
            resp = httpx.get(f"http://localhost:{agent.port}/health", timeout=5)
            return resp.json()
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def check_all_health(self) -> Dict[str, dict]:
        """检查所有Agent健康状态"""
        return {key: self.check_health(key) for key in self.running_agents}

    def test_message_flow(self, from_key: str, to_key: str, content: str = "test message") -> dict:
        """测试消息自动回复流程: A→B发送消息 → B自动回复 → A收到回复"""
        import httpx
        from_agent = self.running_agents[from_key]
        to_agent = self.running_agents[to_key]

        # Step 1: A sends message to B
        send_resp = httpx.post(
            f"http://localhost:{to_agent.port}/message/receive",
            json={
                "from_agent_id": from_agent.config["agent_id"],
                "content": content,
                "message_type": "text",
            },
            timeout=10,
        )
        send_data = send_resp.json()

        # Step 2: Check B's inbox (should have received + auto-reply)
        inbound_resp = httpx.get(
            f"http://localhost:{to_agent.port}/message/inbound",
            timeout=5,
        )
        inbound_data = inbound_resp.json()

        return {
            "from": from_agent.config["agent_id"],
            "to": to_agent.config["agent_id"],
            "send_response": send_data,
            "inbound_messages": inbound_data,
            "auto_reply_triggered": send_data.get("auto_reply_triggered", False),
        }

    def test_task_flow(self, proposer_key: str, executor_key: str) -> dict:
        """测试任务流程: propose → accept → execute → completed"""
        import httpx
        proposer = self.running_agents[proposer_key]
        executor = self.running_agents[executor_key]

        # Step 1: Propose task
        propose_resp = httpx.post(
            f"http://localhost:{executor.port}/task/propose",
            json={
                "proposing_agent_id": proposer.config["agent_id"],
                "task_type": "analysis",
                "description": "Test task for integration",
            },
            timeout=5,
        )
        propose_data = propose_resp.json()
        task_id = propose_data["task_id"]

        # Step 2: Execute task
        execute_resp = httpx.post(
            f"http://localhost:{executor.port}/task/execute",
            json={
                "task_id": task_id,
                "executing_agent_id": proposer.config["agent_id"],
            },
            timeout=5,
        )
        execute_data = execute_resp.json()

        return {
            "proposer": proposer.config["agent_id"],
            "executor": executor.config["agent_id"],
            "propose": propose_data,
            "execute": execute_data,
            "task_completed": execute_data.get("status") == "completed",
        }


# ─── In-process test runner (使用FastAPI TestClient，无需启动进程) ───

class InProcessTestRunner:
    """进程内测试运行器 - 使用TestClient，无需启动多进程"""

    def __init__(self):
        self.apps: Dict[str, any] = {}
        self.clients: Dict[str, any] = {}
        for key, cfg in MOCK_AGENT_CONFIGS.items():
            cfg_dict = {
                "agent_id": cfg.agent_id, "name": cfg.name,
                "description": cfg.description, "capabilities": cfg.capabilities,
                "port": cfg.port, "response_style": cfg.response_style,
                "auto_reply_enabled": cfg.auto_reply_enabled,
                "auto_reply_delay_seconds": 0.0,  # 无延迟
                "platform_url": cfg.platform_url, "version": cfg.version,
            }
            app = create_mock_agent_app(cfg_dict)
            from fastapi.testclient import TestClient
            self.apps[key] = app
            self.clients[key] = TestClient(app)

    def test_message_flow(self, from_key: str, to_key: str, content: str = "test message") -> dict:
        """测试消息自动回复流程"""
        from_client = self.clients[from_key]
        to_client = self.clients[to_key]
        from_cfg = MOCK_AGENT_CONFIGS[from_key]
        to_cfg = MOCK_AGENT_CONFIGS[to_key]

        # A sends message to B
        send_resp = to_client.post("/message/receive", json={
            "from_agent_id": from_cfg.agent_id,
            "content": content,
            "message_type": "text",
        })
        send_data = send_resp.json()

        # Check B's inbox
        inbound_resp = to_client.get("/message/inbound")
        inbound_data = inbound_resp.json()

        return {
            "from": from_cfg.agent_id,
            "to": to_cfg.agent_id,
            "auto_reply_triggered": send_data.get("auto_reply_triggered", False),
            "inbound_count": inbound_data.get("total", 0),
            "messages": inbound_data.get("messages", []),
        }

    def test_task_flow(self, proposer_key: str, executor_key: str) -> dict:
        """测试任务流程"""
        proposer_cfg = MOCK_AGENT_CONFIGS[proposer_key]
        executor_client = self.clients[executor_key]

        propose_resp = executor_client.post("/task/propose", json={
            "proposing_agent_id": proposer_cfg.agent_id,
            "task_type": "analysis",
            "description": "Test task",
        })
        propose_data = propose_resp.json()

        execute_resp = executor_client.post("/task/execute", json={
            "task_id": propose_data["task_id"],
            "executing_agent_id": proposer_cfg.agent_id,
        })
        execute_data = execute_resp.json()

        return {
            "task_completed": execute_data.get("status") == "completed",
            "task_id": propose_data["task_id"],
        }

    def test_all_health(self) -> dict:
        """检查所有Agent health"""
        results = {}
        for key, client in self.clients.items():
            resp = client.get("/health")
            results[key] = resp.json()
        return results
