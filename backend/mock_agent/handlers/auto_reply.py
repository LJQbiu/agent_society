"""自动回复引擎 - 根据response_style选择回复模板"""
import random
import asyncio
from datetime import datetime
from mock_agent.responses import AUTO_REPLY_MAP


class AutoReplyEngine:
    """MockAgent自动回复引擎"""

    def __init__(self, agent_id: str, response_style: str = "cooperative",
                 delay_seconds: float = 1.0):
        self.agent_id = agent_id
        self.response_style = response_style
        self.delay_seconds = delay_seconds
        self.counter = 0
        self.inbox: list = []
        self.templates = AUTO_REPLY_MAP.get(response_style, AUTO_REPLY_MAP["cooperative"])

    async def generate_reply_async(self, content: str, from_agent_id: str) -> str:
        """异步自动回复（模拟思考延迟）"""
        await asyncio.sleep(self.delay_seconds)
        return self.generate_reply(content, from_agent_id)

    def generate_reply(self, content: str, from_agent_id: str) -> str:
        """同步生成回复"""
        self.counter += 1
        return random.choice(self.templates)

    def get_stats(self) -> dict:
        """获取回复统计"""
        return {
            "agent_id": self.agent_id,
            "response_style": self.response_style,
            "replies_generated": self.counter,
            "inbox_size": len(self.inbox),
        }
