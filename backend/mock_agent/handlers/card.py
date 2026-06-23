"""Agent Card端点 - A2A标准"""
from fastapi import APIRouter
from mock_agent.responses import card_response

router = APIRouter()

def create_card_router(config):
    """为每个MockAgent创建card路由"""
    r = APIRouter()
    _config = config

    @r.get("/.well-known/agent.json")
    async def get_agent_card():
        """公开Agent Card - A2A协议发现端点"""
        return card_response(_config)

    @r.get("/card")
    async def get_card():
        """Agent Card查询端点"""
        return card_response(_config)

    return r
