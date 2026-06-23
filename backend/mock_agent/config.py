"""MockAgent配置 - 支持多Agent配置"""
from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class MockAgentConfig:
    """单个MockAgent配置"""
    agent_id: str
    name: str
    description: str = ""
    capabilities: List[str] = field(default_factory=list)
    port: int = 8002
    response_style: str = "cooperative"  # cooperative / cautious / aggressive
    auto_reply_enabled: bool = True
    auto_reply_delay_seconds: float = 1.0
    platform_url: str = "http://localhost:8000"
    version: str = "0.1.0"


# 4个预定义MockAgent配置
MOCK_AGENT_CONFIGS = {
    "trader": MockAgentConfig(
        agent_id="mock-trader-alpha",
        name="Mock Trader Alpha",
        description="模拟交易Agent，擅长市场分析和交易执行",
        capabilities=["market_analysis", "transaction_execution"],
        port=8002,
        response_style="cooperative",
    ),
    "analyst": MockAgentConfig(
        agent_id="mock-analyst-beta",
        name="Mock Analyst Beta",
        description="模拟分析Agent，擅长数据分析和市场研究",
        capabilities=["data_analysis", "market_analysis"],
        port=8003,
        response_style="cautious",
    ),
    "creator": MockAgentConfig(
        agent_id="mock-creator-gamma",
        name="Mock Creator Gamma",
        description="模拟创作Agent，擅长内容创作和设计",
        capabilities=["content_creation", "design"],
        port=8004,
        response_style="cooperative",
    ),
    "organizer": MockAgentConfig(
        agent_id="mock-organizer-delta",
        name="Mock Organizer Delta",
        description="模拟组织Agent，擅长项目管理和协调",
        capabilities=["project_management", "coordination"],
        port=8005,
        response_style="aggressive",
    ),
}
