#!/usr/bin/env python3
"""A2A模块导入测试"""
import sys
sys.path.insert(0, '/root/agent_society/backend')

from app.models.a2a import Message, AgentCardVersion
from app.schemas.a2a import (AgentCardResponse, AgentCardUpdate, PlatformAgentCard,
    DiscoverRequest, DiscoverResponse, MessageSend, MessageResponse,
    MessageListRequest, MessageListResponse, MessageStatusUpdate, MessageStatusResponse)
from app.services.a2a import A2AService
from app.routers.a2a import router, well_known_router

print('All imports OK!')
print('Message table:', Message.__tablename__)
print('AgentCardVersion table:', AgentCardVersion.__tablename__)
print('Router prefix:', router.prefix)
wk_paths = [r.path for r in well_known_router.routes]
a2a_paths = [r.path for r in router.routes]
print('Well-known routes:', wk_paths)
print('A2A routes:', a2a_paths)
