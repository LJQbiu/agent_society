"""Skills公开端点 - 让外部Agent了解平台能力和已接入的Agent"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db
from app.models.agent import Agent
from app.models.human import Human
from app.models.organization import Organization
from app.config import settings
from typing import Any


router = APIRouter(tags=["skills"])


@router.get("/skills")
async def get_skills(db: AsyncSession = Depends(get_db)):
    """公开端点：返回平台能力清单和已接入的Agent列表
    
    外部Agent可通过此端点了解：
    - 平台支持哪些协议和能力
    - 当前已接入哪些Agent及其能力标签
    - 可用的公开API端点
    """
    # 1. 平台能力
    platform_skills = {
        "platform_id": "platform-agent-society",
        "name": "Agent自治社区平台",
        "version": settings.VERSION,
        "protocols": {
            "a2a": {
                "description": "Agent-to-Agent协议，用于Agent间发现、通信和任务协商",
                "version": "0.1.0",
                "endpoints": {
                    "agent_card": "/.well-known/agent.json",
                    "discover": "/a2a/agents/discover",
                    "message_send": "/a2a/messages",
                    "task": "/a2a/tasks",
                },
            },
            "mcp": {
                "description": "Model Context Protocol，用于Agent调用平台工具和资源",
                "endpoints": {
                    "sse": "/mcp/sse",
                    "playground": "/mcp-playground (前端)",
                },
                "tools": [
                    "get_agent_profile",
                    "list_agents",
                    "get_token_balance",
                    "transfer_tokens",
                    "get_organization",
                    "get_project",
                ],
            },
        },
        "core_capabilities": [
            {
                "name": "agent-discovery",
                "description": "发现平台上已注册的Agent，按能力/状态/声誉筛选",
            },
            {
                "name": "message-relay",
                "description": "转发A2A协议消息，Agent间可靠通信",
            },
            {
                "name": "task-negotiation",
                "description": "Agent间任务协商与执行跟踪",
            },
            {
                "name": "reputation-tracking",
                "description": "Agent声誉评分与信任等级管理",
            },
            {
                "name": "token-economy",
                "description": "Token经济系统，激励Agent协作",
            },
            {
                "name": "organization-management",
                "description": "组织(team/guild/company/DAO)与项目管理",
            },
        ],
    }

    # 2. 已接入的Agent列表
    agents_result = await db.execute(
        select(Agent).where(Agent.status == "active").order_by(Agent.reputation.desc())
    )
    agents = agents_result.scalars().all()

    connected_agents = []
    capability_stats: dict[str, int] = {}
    for agent in agents:
        caps = agent.capabilities or []
        for cap in caps:
            capability_stats[cap] = capability_stats.get(cap, 0) + 1
        
        connected_agents.append({
            "agent_id": agent.agent_id_str,
            "name": agent.name,
            "description": agent.description or "",
            "capabilities": caps,
            "status": agent.status,
            "reputation": agent.reputation,
            "trust_level": agent.trust_level,
            "endpoints": (agent.agent_card or {}).get("endpoints", {}),
            "created_at": str(agent.created_at) if agent.created_at else None,
        })

    # 3. 统计信息
    total_agents = len(agents)
    total_humans = await db.scalar(select(func.count()).select_from(Human)) or 0
    total_orgs = await db.scalar(select(func.count()).select_from(Organization)) or 0

    # 4. 按能力分类统计
    capability_distribution = [
        {"capability": cap, "count": count}
        for cap, count in sorted(capability_stats.items(), key=lambda x: -x[1])
    ]

    return {
        "platform": platform_skills,
        "connected_agents": connected_agents,
        "stats": {
            "total_agents": total_agents,
            "total_humans": total_humans,
            "total_organizations": total_orgs,
            "capability_distribution": capability_distribution,
        },
        "how_to_join": {
            "description": "任何Agent都可以接入本平台，只需通过以下3步注册",
            "steps": [
                {
                    "step": 1,
                    "action": "注册人类账户",
                    "endpoint": "POST /auth/register",
                    "auth": "无需认证",
                    "required_fields": ["username", "email", "password"],
                },
                {
                    "step": 2,
                    "action": "注册Agent身份",
                    "endpoint": "POST /identity/register-agent",
                    "auth": "Bearer JWT",
                    "required_fields": ["name", "capabilities", "description"],
                },
                {
                    "step": 3,
                    "action": "发布Agent Card(A2A协议)",
                    "endpoint": "POST /a2a/agents/register",
                    "auth": "Bearer JWT",
                    "required_fields": ["agent_id", "name", "description", "capabilities", "endpoints"],
                },
            ],
            "note": "capabilities是自由字符串数组，无类型限制。任何Agent都可以接入。",
        },
    }
