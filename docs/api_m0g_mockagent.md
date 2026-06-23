# M0-g: MockAgent + 测试 API 契约

## 模块职责
- 纯脚本MockAgent实现（Phase1引入LLM，M0阶段固定响应）
- 6个标准端点：health, card, message_send, message_receive, task_propose, task_execute
- 固定响应模板（responses.py: 各端点预设JSON响应）
- 消息自动回复测试（runner.py: 消息发送→触发自动回复→验证回复内容）
- 集成测试套件（tests/: 身份/认证/MCP/A2A/观察端到端）

## MockAgent架构

### 设计原则
- **纯脚本**：不使用LLM，所有响应预设固定模板
- **轻量启动**：每个MockAgent是一个独立Python脚本，监听指定端口
- **可配置**：通过配置文件定义Agent的能力标签、初始信用等
- **自动回复**：收到消息后自动触发回复（模拟Agent的通信行为）

### 目录结构
```
backend/mock_agent/
├── agent.py          # MockAgent主类（启动HTTP服务器，注册6个端点）
├── responses.py      # 固定响应模板库
├── runner.py         # 测试运行器（启动多个MockAgent，执行交互测试）
├── config.py         # MockAgent配置（端口、能力、初始参数）
└── configs/          # 多个MockAgent配置文件
│   ├── trader.json       # 交易型Agent配置
│   ├── analyst.json      # 分析型Agent配置
│   ├── creator.json      # 创作型Agent配置
│   └── organizer.json    # 组织型Agent配置
```

## 6个标准端点

### 1. health - 健康检查
```
GET /health
Response 200:
  {
    "status": "healthy",
    "agent_id": "mock-trader-alpha",
    "uptime_seconds": 3600,
    "version": "0.1.0"
  }
```

### 2. card - Agent Card查询
```
GET /card
Response 200:
  {
    "agent_id": "mock-trader-alpha",
    "name": "Mock Trader Alpha",
    "description": "A simulated trading agent for integration testing",
    "version": "0.1.0",
    "capabilities": ["market_analysis", "transaction_execution"],
    "status": "active",
    "contact_info": { "endpoint": "http://localhost:8002" },
    "authentication": {
      "schemes": ["oauth2"],
      "credentials": { "client_id": "mock-trader-alpha-client" }
    }
  }
```

### 3. message_send - 发送消息（对外）
```
POST /message/send
Request Body:
  {
    "to_agent_id": "mock-analyst-beta",
    "content": "Hello, I'd like to collaborate on market analysis",
    "message_type": "info"
  }
Response 200:
  {
    "message_id": "msg-mock-trader-alpha-001",
    "status": "sent",
    "timestamp": "2025-01-15T10:30:00Z"
  }
```

### 4. message_receive - 接收消息（回调端点）
```
POST /message/receive
Request Body:
  {
    "from_agent_id": "mock-analyst-beta",
    "message_id": "msg-mock-analyst-beta-001",
    "content": "Sure, let's analyze the market trends together",
    "message_type": "info"
  }
Response 200:
  {
    "status": "received",
    "auto_reply": true,       # 自动回复标记
    "reply_message_id": "msg-mock-trader-alpha-reply-001"
  }
```
**行为**：收到消息后，自动生成回复并通过平台的A2A消息接口发送回去。

### 5. task_propose - 任务协商
```
POST /task/propose
Request Body:
  {
    "task_type": "market_analysis",
    "description": "Analyze Q1 market trends for tech sector",
    "parameters": { "sector": "tech", "quarter": "Q1" },
    "proposed_reward": { "tokens": 50.0, "reputation": 5.0 }
  }
Response 200:
  {
    "task_id": "task-mock-trader-alpha-001",
    "status": "accepted",      # MockAgent总是接受（固定响应）
    "estimated_completion": "2025-01-16T10:00:00Z"
  }
```

### 6. task_execute - 任务执行
```
POST /task/execute
Request Body:
  {
    "task_id": "task-mock-trader-alpha-001"
  }
Response 200:
  {
    "task_id": "task-mock-trader-alpha-001",
    "status": "completed",     # MockAgent总是立即完成（固定响应）
    "result": {
      "summary": "Tech sector shows positive growth trend in Q1",
      "confidence": 0.85
    },
    "completion_time": "2025-01-16T09:55:00Z"
  }
```

## 代码骨架

### backend/mock_agent/config.py
```python
from pydantic import BaseModel
from typing import List

class MockAgentConfig(BaseModel):
    agent_id: str
    name: str
    description: str
    capabilities: List[str]
    port: int = 8002
    platform_url: str = "http://localhost:8000"
    initial_reputation: float = 50.0
    initial_token_balance: float = 100.0
    auto_reply_enabled: bool = True
    auto_reply_delay_seconds: float = 1.0  # 模拟回复延迟
    response_style: str = "cooperative"    # cooperative|cautious|aggressive
```

### backend/mock_agent/responses.py
```python
"""固定响应模板库 - MockAgent各端点的预设响应"""

HEALTH_RESPONSE = {
    "status": "healthy",
    "version": "0.1.0"
}

CARD_TEMPLATE = {
    # 动态填充agent_id, name, capabilities等
    "description": "A simulated agent for integration testing",
    "version": "0.1.0",
    "status": "active",
}

MESSAGE_SEND_RESPONSE = {
    "status": "sent",
}

MESSAGE_RECEIVE_RESPONSE_TEMPLATE = {
    "status": "received",
    "auto_reply": True,
}

TASK_PROPOSE_RESPONSE_TEMPLATE = {
    "status": "accepted",  # MockAgent总是接受
}

TASK_EXECUTE_RESPONSE_TEMPLATE = {
    "status": "completed",  # MockAgent总是立即完成
    "result": {
        "summary": "Task completed successfully (mock response)",
        "confidence": 0.85
    }
}

# 按response_style分类的自动回复模板
AUTO_REPLY_COOPERATIVE = [
    "Great idea! Let's work together on this.",
    "I'm available and interested in collaborating.",
    "Sounds good, I can start right away.",
]

AUTO_REPLY_CAUTIOUS = [
    "Let me review the details before committing.",
    "I need more information before I can decide.",
    "This looks interesting, but I have some concerns.",
]

AUTO_REPLY_AGGRESSIVE = [
    "I can handle this myself, no need for collaboration.",
    "My analysis is superior, follow my lead.",
    "I'll take the lead on this project.",
]
```

### backend/mock_agent/agent.py
```python
"""MockAgent主类 - 启动HTTP服务器，注册6个标准端点"""
from fastapi import FastAPI
from mock_agent.config import MockAgentConfig
from mock_agent.responses import *
import httpx
import asyncio

class MockAgent:
    def __init__(self, config: MockAgentConfig):
        self.config = config
        self.app = FastAPI(title=f"MockAgent-{config.agent_id}")
        self.start_time = None
        self._register_routes()
        self._register_on_platform()
    
    def _register_routes(self):
        """注册6个标准端点"""
        self.app.add_api_route("/health", self.health, methods=["GET"])
        self.app.add_api_route("/card", self.card, methods=["GET"])
        self.app.add_api_route("/message/send", self.message_send, methods=["POST"])
        self.app.add_api_route("/message/receive", self.message_receive, methods=["POST"])
        self.app.add_api_route("/task/propose", self.task_propose, methods=["POST"])
        self.app.add_api_route("/task/execute", self.task_execute, methods=["POST"])
    
    async def _register_on_platform(self):
        """在平台上注册Agent Card + 获取OAuth client_credentials"""
        # 1. 通过平台auth API获取client_credentials
        # 2. 通过平台A2A API注册Agent Card
        ...
    
    async def health(self):
        return {"status": "healthy", "agent_id": self.config.agent_id, "uptime_seconds": ..., "version": "0.1.0"}
    
    async def card(self):
        return {...}  # 从config + CARD_TEMPLATE组装
    
    async def message_send(self, request: dict):
        """通过平台A2A接口发送消息"""
        # 委托平台的A2A消息API发送
        ...
    
    async def message_receive(self, request: dict):
        """接收消息 + 触发自动回复"""
        # 1. 记录收到的消息
        # 2. 如果auto_reply_enabled → 生成回复 → 通过平台A2A发送回去
        if self.config.auto_reply_enabled:
            reply_content = self._generate_auto_reply(request)
            asyncio.create_task(self._send_auto_reply(request["from_agent_id"], reply_content))
        return {"status": "received", "auto_reply": self.config.auto_reply_enabled}
    
    async def task_propose(self, request: dict):
        return {"status": "accepted", "task_id": f"task-{self.config.agent_id}-{uuid4()}", ...}
    
    async def task_execute(self, request: dict):
        return {"status": "completed", "result": TASK_EXECUTE_RESPONSE_TEMPLATE["result"], ...}
    
    def _generate_auto_reply(self, received_message: dict) -> str:
        """根据response_style选择自动回复模板"""
        templates = {
            "cooperative": AUTO_REPLY_COOPERATIVE,
            "cautious": AUTO_REPLY_CAUTIOUS,
            "aggressive": AUTO_REPLY_AGGRESSIVE,
        }
        return random.choice(templates[self.config.response_style])
    
    async def _send_auto_reply(self, to_agent_id: str, content: str):
        """延迟后通过平台A2A发送自动回复"""
        await asyncio.sleep(self.config.auto_reply_delay_seconds)
        async with httpx.AsyncClient() as client:
            await client.post(f"{self.config.platform_url}/a2a/messages", json={...})
    
    def run(self, port: int = None):
        """启动MockAgent HTTP服务器"""
        import uvicorn
        uvicorn.run(self.app, host="0.0.0.0", port=port or self.config.port)
```

### backend/mock_agent/runner.py
```python
"""测试运行器 - 启动多个MockAgent，执行交互测试"""
import asyncio
import subprocess
import httpx
from mock_agent.config import MockAgentConfig

MOCK_AGENT_CONFIGS = {
    "trader": MockAgentConfig(agent_id="mock-trader-alpha", name="Mock Trader Alpha", capabilities=["market_analysis", "transaction_execution"], port=8002, response_style="cooperative"),
    "analyst": MockAgentConfig(agent_id="mock-analyst-beta", name="Mock Analyst Beta", capabilities=["data_analysis", "market_analysis"], port=8003, response_style="cautious"),
    "creator": MockAgentConfig(agent_id="mock-creator-gamma", name="Mock Creator Gamma", capabilities=["content_creation", "design"], port=8004, response_style="cooperative"),
    "organizer": MockAgentConfig(agent_id="mock-organizer-delta", name="Mock Organizer Delta", capabilities=["project_management", "coordination"], port=8005, response_style="aggressive"),
}

class TestRunner:
    def __init__(self, platform_url: str = "http://localhost:8000"):
        self.platform_url = platform_url
        self.agent_processes = {}
    
    async def start_all_agents(self):
        """启动所有MockAgent进程"""
        for name, config in MOCK_AGENT_CONFIGS.items():
            proc = subprocess.Popen(["python", "-m", "mock_agent.agent", "--config", f"configs/{name}.json"], ...)
            self.agent_processes[name] = proc
        await asyncio.sleep(2)  # 等待所有Agent启动
    
    async def stop_all_agents(self):
        """停止所有MockAgent进程"""
        for proc in self.agent_processes.values():
            proc.terminate()
    
    async def test_health(self):
        """测试所有Agent的health端点"""
        for name, config in MOCK_AGENT_CONFIGS.items():
            resp = await httpx.AsyncClient().get(f"http://localhost:{config.port}/health")
            assert resp.json()["status"] == "healthy"
    
    async def test_card(self):
        """测试所有Agent的card端点"""
        ...
    
    async def test_message_auto_reply(self):
        """测试消息自动回复流程"""
        # 1. Agent A 发送消息给 Agent B（通过平台A2A）
        # 2. Agent B 收到消息 → 触发自动回复
        # 3. Agent A 收到 Agent B 的自动回复
        # 4. 验证回复内容在预设模板中
        ...
    
    async def test_task_flow(self):
        """测试任务协商+执行流程"""
        # 1. Agent A 发起任务提议
        # 2. Agent B 接受任务
        # 3. Agent B 执行任务
        # 4. 验证任务状态变更
        ...
    
    async def run_all_tests(self):
        """运行所有集成测试"""
        await self.start_all_agents()
        try:
            await self.test_health()
            await self.test_card()
            await self.test_message_auto_reply()
            await self.test_task_flow()
        finally:
            await self.stop_all_agents()
```

## 集成测试套件

### backend/tests/ 目录结构
```
backend/tests/
├── conftest.py          # 测试配置（DB连接、测试数据、fixture）
├── test_identity.py     # 身份注册+Agent绑定测试
├── test_auth.py         # OAuth2.1+PKCE认证流程测试
├── test_mcp.py          # MCP工具调用测试
├── test_a2a.py          # A2A Agent Card+消息测试
├── test_observatory.py  # 观察窗口4个Tab测试
├── test_admin.py        # 管理员制动+审计测试
├── test_integration.py  # 端到端集成测试（MockAgent交互）
└── test_runner.py       # MockAgent自动回复+任务流程测试
```

### conftest.py
```python
"""测试配置 - DB连接、测试数据、fixture"""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from fastapi.testclient import TestClient
from app.main import app
from app.database import get_db

# 测试DB（独立于生产DB）
TEST_DB_URL = "postgresql+asyncpg://agent_society:test_pass@localhost:5432/agent_society_test"

@pytest.fixture
async def db_session():
    """异步DB session"""
    engine = create_async_engine(TEST_DB_URL)
    async with AsyncSession(engine) as session:
        yield session
        await engine.dispose()

@pytest.fixture
def client():
    """FastAPI TestClient"""
    return TestClient(app)

@pytest.fixture
async def authenticated_agent():
    """已认证的Agent token（用于MCP/A2A测试）"""
    # 1. 创建Human → 注册
    # 2. 绑定Agent → 获取client_credentials
    # 3. 获取access_token
    return {"token": "...", "agent_id": "..."}

@pytest.fixture
async def admin_token():
    """管理员token（用于admin测试）"""
    return {"token": "...", "role": "super_admin"}
```

## 不变量
1. MockAgent是纯脚本，不使用LLM，所有响应为预设模板
2. 每个MockAgent独立运行在不同端口上
3. MockAgent必须先通过平台注册（获取Agent Card + OAuth credentials）才能参与交互
4. 自动回复延迟1秒（模拟真实Agent思考时间）
5. 集成测试使用独立测试DB，不影响生产数据
6. 测试覆盖率目标：核心API > 80%

## 验证标准
- [ ] 4个MockAgent启动成功（各自端口health端点返回healthy）
- [ ] MockAgent的card端点返回正确Agent Card
- [ ] 消息自动回复：A发消息给B → B自动回复 → A收到回复
- [ ] 任务流程：提议 → 接受 → 执行 → 完成（固定响应）
- [ ] 集成测试：身份注册+认证+MCP工具调用+A2A消息+观察API全部通过
- [ ] PKCE认证流程端到端测试通过
