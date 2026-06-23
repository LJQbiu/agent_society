"""MockAgent自动回复+任务流程测试 - M0-g SPEC验证标准"""
import pytest
from mock_agent.runner import InProcessTestRunner
from mock_agent.config import MOCK_AGENT_CONFIGS
from mock_agent.responses import AUTO_REPLY_MAP


class TestAutoReply:
    """验证标准: 消息自动回复 A发消息给B → B自动回复 → A收到回复"""

    def test_auto_reply_triggered(self):
        """收到消息后自动回复被触发"""
        runner = InProcessTestRunner()
        result = runner.test_message_flow("trader", "analyst", "Hello")
        assert result["auto_reply_triggered"] is True
        assert result["inbound_count"] >= 2

    def test_auto_reply_content_matches_style(self):
        """自动回复内容匹配response_style"""
        for style in ["cooperative", "cautious", "aggressive"]:
            replies = AUTO_REPLY_MAP.get(style, [])
            assert len(replies) > 0
            for reply in replies:
                assert isinstance(reply, str)
                assert len(reply) > 0

    def test_auto_reply_cooperative_style(self):
        """cooperative风格自动回复"""
        runner = InProcessTestRunner()
        # trader is cooperative
        result = runner.test_message_flow("analyst", "trader", "Can we collaborate?")
        assert result["auto_reply_triggered"] is True
        inbound = result["messages"]
        if inbound and len(inbound) > 1:
            reply = inbound[-1]
            assert isinstance(reply.get("content"), str)

    def test_auto_reply_cautious_style(self):
        """cautious风格自动回复"""
        runner = InProcessTestRunner()
        # analyst is cautious
        result = runner.test_message_flow("trader", "analyst", "Let me share data")
        assert result["auto_reply_triggered"] is True

    def test_auto_reply_aggressive_style(self):
        """aggressive风格自动回复"""
        runner = InProcessTestRunner()
        # organizer is aggressive
        result = runner.test_message_flow("trader", "organizer", "Need coordination")
        assert result["auto_reply_triggered"] is True

    def test_all_agents_healthy(self):
        """验证标准: 4个MockAgent health端点返回healthy"""
        runner = InProcessTestRunner()
        results = runner.test_all_health()
        assert len(results) == 4
        for key, health in results.items():
            assert health["status"] == "healthy"

    def test_all_agents_card_valid(self):
        """验证标准: MockAgent的card端点返回正确Agent Card"""
        runner = InProcessTestRunner()
        for key, cfg in MOCK_AGENT_CONFIGS.items():
            client = runner.clients[key]
            r = client.get("/.well-known/agent.json")
            data = r.json()
            assert data["agent_id"] == cfg.agent_id
            assert data["name"] == cfg.name
            assert "capabilities" in data


class TestTaskFlow:
    """验证标准: 任务流程 提议 → 接受 → 执行 → 完成"""

    def test_task_propose_accepted(self):
        """任务提议总是被接受(MockAgent固定响应)"""
        runner = InProcessTestRunner()
        result = runner.test_task_flow("trader", "analyst")
        assert result["task_completed"] is True

    def test_task_execute_completed(self):
        """任务执行总是立即完成(MockAgent固定响应)"""
        runner = InProcessTestRunner()
        client = runner.clients["trader"]
        # Propose task
        r = client.post("/task/propose", json={
            "proposing_agent_id": "test-runner",
            "task_type": "analysis",
            "description": "Test task",
            "parameters": {},
        })
        assert r.status_code == 200
        task_id = r.json()["task_id"]

        # Execute task
        r = client.post("/task/execute", json={
            "task_id": task_id,
            "executing_agent_id": "test-runner",
        })
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "completed"
        assert "result" in data
        assert data["result"].get("confidence") >= 0

    def test_task_flow_all_styles(self):
        """不同response_style的Agent都能完成任务"""
        runner = InProcessTestRunner()
        for key in ["trader", "analyst", "creator", "organizer"]:
            cfg = MOCK_AGENT_CONFIGS[key]
            # Use a different agent as executor; pick another key from configs
            executor_keys = list(MOCK_AGENT_CONFIGS.keys())
            executor_key = executor_keys[(executor_keys.index(key) + 1) % len(executor_keys)]
            result = runner.test_task_flow(key, executor_key)
            assert result["task_completed"] is True
