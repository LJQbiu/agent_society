"""MockAgent - FastAPI模拟Agent，支持动态配置多实例"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from mock_agent.config import MockAgentConfig, MOCK_AGENT_CONFIGS
from mock_agent.handlers.card import create_card_router
from mock_agent.handlers.message import create_message_router
from mock_agent.handlers.status import create_status_router
from mock_agent.handlers.task import create_task_router
from mock_agent.handlers.auto_reply import AutoReplyEngine
from mock_agent.responses import health_response


def create_mock_agent_app(config: dict) -> FastAPI:
    """从配置创建MockAgent FastAPI实例"""
    agent_id = config["agent_id"]
    app = FastAPI(title=f"MockAgent-{agent_id}", version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    start_time = datetime.now().timestamp()
    auto_reply = AutoReplyEngine(
        agent_id=agent_id,
        response_style=config.get("response_style", "cooperative"),
        delay_seconds=config.get("auto_reply_delay_seconds", 1.0),
    )

    # 注册6个A2A标准端点路由
    app.include_router(create_card_router(config))
    app.include_router(create_message_router(config, auto_reply))
    app.include_router(create_status_router(config, start_time))
    app.include_router(create_task_router(config))

    # Health端点
    @app.get("/health")
    async def health():
        return health_response(agent_id, start_time, config.get("version", "0.1.0"))

    # 存储引擎引用供外部访问
    app.state.auto_reply = auto_reply
    app.state.config = config
    app.state.start_time = start_time

    return app


# 默认实例（用trader配置）
_default_config = MOCK_AGENT_CONFIGS["trader"]
# 转换dataclass为dict
_default_config_dict = {
    "agent_id": _default_config.agent_id,
    "name": _default_config.name,
    "description": _default_config.description,
    "capabilities": _default_config.capabilities,
    "port": _default_config.port,
    "response_style": _default_config.response_style,
    "auto_reply_enabled": _default_config.auto_reply_enabled,
    "auto_reply_delay_seconds": _default_config.auto_reply_delay_seconds,
    "platform_url": _default_config.platform_url,
    "version": _default_config.version,
}

app = create_mock_agent_app(_default_config_dict)
