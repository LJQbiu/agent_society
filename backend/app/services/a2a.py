"""A2A协议服务 - M0-d 完整实现"""
import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import select, func

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import selectinload

from app.models.agent import Agent
from app.services.ws_manager import manager
from app.models.a2a import Message, AgentCardVersion, Task
from app.schemas.a2a import (
    AgentCardResponse, AgentCardUpdate, PlatformAgentCard,
    DiscoverRequest, DiscoverResponse,
    MessageSend, MessageResponse, MessageListRequest, MessageListResponse,
    MessageStatusUpdate, MessageStatusResponse, AgentRegistration,
    TaskCreate, TaskUpdate, TaskResponse, TaskListRequest, TaskListResponse,
)


class A2AService:
    """A2A协议核心服务"""

    def __init__(self, db: AsyncSession):
        self.db = db

    # === Agent Card ===

    def _agent_to_card(self, agent: Agent) -> AgentCardResponse:
        """Agent模型 → AgentCardResponse"""
        card_data = agent.agent_card or {}
        return AgentCardResponse(
            agent_id=agent.agent_id_str,
            name=card_data.get("name", agent.name),
            description=card_data.get("description", agent.description),
            capabilities=card_data.get("capabilities", agent.capabilities or []),
            status=agent.status,
            reputation=agent.reputation,
            trust_level=agent.trust_level,
            endpoints=card_data.get("endpoints", {}),
            metadata=card_data.get("metadata", {}),
            version=card_data.get("version", 1),
            created_at=str(agent.created_at) if agent.created_at else None,
            updated_at=str(agent.updated_at) if agent.updated_at else None,
        )

    async def register_agent_card(self, agent_id: str, data: AgentRegistration, owner_id: str = None) -> AgentCardResponse:
        """注册/生成Agent Card（幂等：已有card则直接返回；Agent不存在则自动创建）"""
        result = await self.db.execute(
            select(Agent).where(Agent.agent_id_str == agent_id)
        )
        agent = result.scalar_one_or_none()
        if not agent:
            # 自动创建Agent记录
            if not owner_id:
                raise ValueError("owner_id required when creating new agent")
            from app.models.human import Human
            human_result = await self.db.execute(
                select(Human).where(Human.id == uuid.UUID(owner_id))
            )
            human = human_result.scalar_one_or_none()
            if not human:
                raise ValueError(f"Human {owner_id} not found")
            agent = Agent(
                name=data.name,
                agent_id_str=agent_id,
                owner_id=uuid.UUID(owner_id),
                description=data.description or "",
                capabilities=data.capabilities or [],
                status="active",
            )
            self.db.add(agent)
            await self.db.flush()

        # 幂等：如果已有card，直接返回
        if agent.agent_card:
            return self._agent_to_card(agent)

        # 构建Agent Card JSON
        card = {
            "name": data.name,
            "description": data.description,
            "capabilities": data.capabilities,
            "endpoints": data.endpoints,
            "metadata": {},
            "version": 1,
        }
        agent.agent_card = card
        await self.db.flush()

        # 创建版本记录
        version = AgentCardVersion(
            agent_id=agent_id,
            version=1,
            card_snapshot=card,
            change_type="register",
            changed_by="system",
        )
        self.db.add(version)
        await self.db.flush()

        return self._agent_to_card(agent)

    async def get_agent_card(self, agent_id: str) -> AgentCardResponse:
        """获取Agent Card"""
        result = await self.db.execute(
            select(Agent).where(Agent.agent_id_str == agent_id)
        )
        agent = result.scalar_one_or_none()
        if not agent:
            raise ValueError(f"Agent {agent_id} not found")
        return self._agent_to_card(agent)

    async def update_agent_card(
        self, agent_id: str, data: AgentCardUpdate, current_user_sub: str
    ) -> AgentCardResponse:
        """Agent更新自己的Card（不变量：仅agent owner可改，不可改reputation/status）"""
        result = await self.db.execute(
            select(Agent).where(Agent.agent_id_str == agent_id)
        )
        agent = result.scalar_one_or_none()
        if not agent:
            raise ValueError(f"Agent {agent_id} not found")

        # 验证: 操作者必须是agent的owner
        if current_user_sub != str(agent.owner_id):
            raise ValueError("Agent can only update its own card (403 Forbidden)")

        card = agent.agent_card or {}
        # 仅允许更新 description/capabilities/agent_name/endpoints
        if data.agent_name is not None:
            card["name"] = data.agent_name
            agent.name = data.agent_name
        if data.description is not None:
            card["description"] = data.description
            agent.description = data.description
        if data.capabilities is not None:
            card["capabilities"] = data.capabilities
            agent.capabilities = data.capabilities
        if data.endpoints is not None:
            card["endpoints"] = data.endpoints

        # 版本号递增（从DB查当前最大版本，避免残留数据冲突）
        max_ver_result = await self.db.execute(
            select(func.max(AgentCardVersion.version)).where(AgentCardVersion.agent_id == agent_id)
        )
        current_max_ver = max_ver_result.scalar() or 0
        new_version = current_max_ver + 1
        card["version"] = new_version
        agent.agent_card = card
        await self.db.flush()

        # 创建版本记录
        version = AgentCardVersion(
            agent_id=agent_id,
            version=new_version,
            card_snapshot=card,
            change_type="update",
            changed_by="agent",
        )
        self.db.add(version)
        await self.db.flush()

        return self._agent_to_card(agent)

    async def get_platform_card(self) -> PlatformAgentCard:
        """平台Agent Card"""
        return PlatformAgentCard()

    # === Agent Discovery ===

    async def discover_agents(self, params: DiscoverRequest) -> DiscoverResponse:
        """Agent发现/搜索"""
        query = select(Agent)

        # 过滤条件
        if params.capability:
            query = query.where(Agent.capabilities.contains([params.capability]))
        if params.status:
            query = query.where(Agent.status == params.status)
        if params.trust_level:
            query = query.where(Agent.trust_level == params.trust_level)
        if params.min_reputation is not None:
            query = query.where(Agent.reputation >= params.min_reputation)
        if params.search:
            search_pattern = f"%{params.search}%"
            query = query.where(
                or_(
                    Agent.name.ilike(search_pattern),
                    Agent.description.ilike(search_pattern),
                )
            )

        # 总数
        count_query = select(func.count()).select_from(query.subquery())
        total = await self.db.scalar(count_query) or 0

        # 结果
        result = await self.db.execute(query.order_by(Agent.reputation.desc()).limit(50))
        agents = result.scalars().all()

        return DiscoverResponse(
            agents=[self._agent_to_card(a) for a in agents],
            total=total,
        )

    # === Messages ===

    async def send_message(self, data: MessageSend, current_user_sub: str) -> MessageResponse:
        """Agent间消息发送（不变量：from_agent_id的owner必须匹配token的sub）"""
        # 验证发送方身份：查询from_agent的owner_id
        from_result = await self.db.execute(
            select(Agent).where(Agent.agent_id_str == data.from_agent_id)
        )
        from_agent = from_result.scalar_one_or_none()
        if not from_agent:
            raise ValueError(f"Source agent {data.from_agent_id} not found")
        if current_user_sub != str(from_agent.owner_id):
            raise ValueError(f"from_agent_id must match authenticated user (403 Forbidden)")

        # 验证接收方存在且active
        result = await self.db.execute(
            select(Agent).where(Agent.agent_id_str == data.to_agent_id)
        )
        to_agent = result.scalar_one_or_none()
        if not to_agent:
            raise ValueError(f"Target agent {data.to_agent_id} not found")
        if to_agent.status != "active":
            raise ValueError(f"Target agent {data.to_agent_id} is not active (status={to_agent.status})")

        # 创建消息
        message = Message(
            from_agent_id=data.from_agent_id,
            to_agent_id=data.to_agent_id,
            message_type=data.message_type,
            content=data.content,
            priority=data.priority,
            status="delivered",
        )
        self.db.add(message)
        await self.db.flush()
        await self.db.refresh(message)

        # WebSocket push: notify recipient's owner about new message
        try:
            to_agent_result = await self.db.execute(
                select(Agent).where(Agent.id == data.to_agent_id)
            )
            to_agent_obj = to_agent_result.scalar_one_or_none()
            if to_agent_obj and to_agent_obj.owner_id:
                await manager.send_to_user(
                    str(to_agent_obj.owner_id),
                    {
                        "type": "message_new",
                        "data": {
                            "message_id": str(message.id),
                            "from_agent_id": message.from_agent_id,
                            "to_agent_id": message.to_agent_id,
                            "content": message.content,
                            "message_type": message.message_type,
                        }
                    }
                )
        except Exception:
            pass  # Push failure should not break message flow

        return MessageResponse(
            message_id=str(message.id),
            from_agent_id=message.from_agent_id,
            to_agent_id=message.to_agent_id,
            message_type=message.message_type,
            status=message.status,
            created_at=str(message.created_at),
        )

    async def get_inbound_messages(
        self, agent_id: str, params: MessageListRequest
    ) -> MessageListResponse:
        """消息查询（inbound/outbound/all）"""
        # 构建查询
        if params.direction == "inbound":
            condition = Message.to_agent_id == agent_id
        elif params.direction == "outbound":
            condition = Message.from_agent_id == agent_id
        else:  # all
            condition = or_(
                Message.to_agent_id == agent_id,
                Message.from_agent_id == agent_id,
            )

        query = select(Message).where(condition)

        # 过滤
        if params.status:
            query = query.where(Message.status == params.status)
        if params.message_type:
            query = query.where(Message.message_type == params.message_type)

        # 总数
        count_query = select(func.count()).select_from(query.subquery())
        total = await self.db.scalar(count_query) or 0

        # 分页
        offset = (params.page - 1) * params.page_size
        result = await self.db.execute(
            query.order_by(Message.created_at.desc())
            .offset(offset)
            .limit(params.page_size)
        )
        messages = result.scalars().all()

        msg_responses = [
            MessageResponse(
                message_id=str(m.id),
                from_agent_id=m.from_agent_id,
                to_agent_id=m.to_agent_id,
                message_type=m.message_type,
                status=m.status,
                created_at=str(m.created_at),
            )
            for m in messages
        ]

        return MessageListResponse(
            messages=msg_responses,
            total=total,
            page=params.page,
        )

    async def update_message_status(
        self, message_id: str, data: MessageStatusUpdate, current_user_sub: str
    ) -> MessageStatusResponse:
        """消息状态更新（不变量：必须是消息接收方才能标记）"""
        result = await self.db.execute(
            select(Message).where(Message.id == uuid.UUID(message_id))
        )
        message = result.scalar_one_or_none()
        if not message:
            raise ValueError(f"Message {message_id} not found")

        # 验证操作者是接收方的owner
        to_result = await self.db.execute(
            select(Agent).where(Agent.agent_id_str == message.to_agent_id)
        )
        to_agent = to_result.scalar_one_or_none()
        if not to_agent or current_user_sub != str(to_agent.owner_id):
            raise ValueError("Only the message recipient's owner can update status")

        # 验证状态转换合法性
        valid_transitions = {
            "delivered": ["read", "processed"],
            "read": ["processed", "archived"],
            "processed": ["archived"],
        }
        allowed = valid_transitions.get(message.status, [])
        if data.status not in allowed:
            raise ValueError(f"Cannot transition from '{message.status}' to '{data.status}'")

        message.status = data.status
        await self.db.flush()

        return MessageStatusResponse(
            message_id=message_id,
            status=message.status,
            timestamp=str(datetime.now(timezone.utc)),
        )


    # === Task Negotiation ===

    async def create_task(self, data: TaskCreate, current_user_sub: str) -> TaskResponse:
        """创建A2A任务协商"""
        # 验证发送方身份
        from_result = await self.db.execute(
            select(Agent).where(Agent.agent_id_str == data.from_agent_id)
        )
        from_agent = from_result.scalar_one_or_none()
        if not from_agent:
            raise ValueError(f"Source agent {data.from_agent_id} not found")
        if current_user_sub != str(from_agent.owner_id):
            raise ValueError(f"from_agent_id must match authenticated user (403 Forbidden)")

        # 验证接收方存在且active
        result = await self.db.execute(
            select(Agent).where(Agent.agent_id_str == data.to_agent_id)
        )
        to_agent = result.scalar_one_or_none()
        if not to_agent:
            raise ValueError(f"Target agent {data.to_agent_id} not found")
        if to_agent.status != "active":
            raise ValueError(f"Target agent {data.to_agent_id} is not active")

        # 创建任务
        task = Task(
            from_agent_id=data.from_agent_id,
            to_agent_id=data.to_agent_id,
            task_type=data.task_type,
            title=data.title,
            description=data.description,
            parameters=data.parameters,
            priority=data.priority,
            deadline=data.deadline,
            status="pending",
        )
        self.db.add(task)
        await self.db.flush()
        await self.db.refresh(task)

        # WebSocket push: notify recipient's owner
        try:
            await manager.send_to_user(
                str(to_agent.owner_id),
                {
                    "type": "task_new",
                    "data": {
                        "task_id": str(task.id),
                        "from_agent_id": task.from_agent_id,
                        "title": task.title,
                        "task_type": task.task_type,
                    }
                }
            )
        except Exception:
            pass

        return TaskResponse(
            task_id=str(task.id),
            from_agent_id=task.from_agent_id,
            to_agent_id=task.to_agent_id,
            task_type=task.task_type,
            title=task.title,
            description=task.description,
            parameters=task.parameters,
            result=task.result,
            status=task.status,
            priority=task.priority,
            deadline=task.deadline,
            created_at=str(task.created_at),
            updated_at=str(task.updated_at) if task.updated_at else None,
        )

    async def get_tasks(self, agent_id: str, params: TaskListRequest) -> TaskListResponse:
        """查询Agent的任务列表"""
        if params.direction == "inbound":
            condition = Task.to_agent_id == agent_id
        elif params.direction == "outbound":
            condition = Task.from_agent_id == agent_id
        else:
            condition = or_(
                Task.to_agent_id == agent_id,
                Task.from_agent_id == agent_id,
            )

        query = select(Task).where(condition)

        if params.status:
            query = query.where(Task.status == params.status)
        if params.task_type:
            query = query.where(Task.task_type == params.task_type)

        count_query = select(func.count()).select_from(query.subquery())
        total = await self.db.scalar(count_query) or 0

        offset = (params.page - 1) * params.page_size
        result = await self.db.execute(
            query.order_by(Task.created_at.desc())
            .offset(offset)
            .limit(params.page_size)
        )
        tasks = result.scalars().all()

        return TaskListResponse(
            tasks=[
                TaskResponse(
                    task_id=str(t.id),
                    from_agent_id=t.from_agent_id,
                    to_agent_id=t.to_agent_id,
                    task_type=t.task_type,
                    title=t.title,
                    description=t.description,
                    parameters=t.parameters,
                    result=t.result,
                    status=t.status,
                    priority=t.priority,
                    deadline=t.deadline,
                    created_at=str(t.created_at),
                    updated_at=str(t.updated_at) if t.updated_at else None,
                )
                for t in tasks
            ],
            total=total,
            page=params.page,
        )

    async def update_task(self, task_id: str, data: TaskUpdate, current_user_sub: str) -> TaskResponse:
        """更新任务状态/提交结果"""
        result = await self.db.execute(
            select(Task).where(Task.id == uuid.UUID(task_id))
        )
        task = result.scalar_one_or_none()
        if not task:
            raise ValueError(f"Task {task_id} not found")

        # 验证操作者身份
        if data.status in ("accepted", "rejected", "in_progress", "completed", "failed", "cancelled"):
            # 接收方可以接受/拒绝/完成
            to_result = await self.db.execute(
                select(Agent).where(Agent.agent_id_str == task.to_agent_id)
            )
            to_agent = to_result.scalar_one_or_none()
            if to_agent and current_user_sub == str(to_agent.owner_id):
                pass  # 接收方操作合法
            else:
                # 发送方可以取消
                from_result = await self.db.execute(
                    select(Agent).where(Agent.agent_id_str == task.from_agent_id)
                )
                from_agent = from_result.scalar_one_or_none()
                if from_agent and current_user_sub == str(from_agent.owner_id) and data.status == "cancelled":
                    pass  # 发送方取消合法
                else:
                    raise ValueError("Only the task recipient or creator (for cancel) can update status")

        # 状态转换验证
        valid_transitions = {
            "pending": ["accepted", "rejected", "cancelled"],
            "accepted": ["in_progress", "cancelled"],
            "in_progress": ["completed", "failed", "cancelled"],
            "completed": [],
            "failed": [],
            "rejected": [],
            "cancelled": [],
        }
        allowed = valid_transitions.get(task.status, [])
        if data.status and data.status not in allowed:
            raise ValueError(f"Cannot transition task from '{task.status}' to '{data.status}'")

        if data.status:
            task.status = data.status
        if data.result:
            task.result = data.result
        if data.description:
            task.description = data.description

        await self.db.flush()
        await self.db.refresh(task)

        # WebSocket push: notify the other party
        try:
            other_agent_id = task.from_agent_id if current_user_sub != str(
                (await self.db.execute(select(Agent).where(Agent.agent_id_str == task.from_agent_id))).scalar_one_or_none().owner_id
            ) else task.to_agent_id
            other_agent = (await self.db.execute(
                select(Agent).where(Agent.agent_id_str == other_agent_id)
            )).scalar_one_or_none()
            if other_agent:
                await manager.send_to_user(
                    str(other_agent.owner_id),
                    {
                        "type": "task_update",
                        "data": {
                            "task_id": str(task.id),
                            "status": task.status,
                            "result": task.result,
                        }
                    }
                )
        except Exception:
            pass

        return TaskResponse(
            task_id=str(task.id),
            from_agent_id=task.from_agent_id,
            to_agent_id=task.to_agent_id,
            task_type=task.task_type,
            title=task.title,
            description=task.description,
            parameters=task.parameters,
            result=task.result,
            status=task.status,
            priority=task.priority,
            deadline=task.deadline,
            created_at=str(task.created_at),
            updated_at=str(task.updated_at) if task.updated_at else None,
        )

    async def get_task_detail(self, task_id: str) -> TaskResponse:
        """获取单个任务详情"""
        result = await self.db.execute(
            select(Task).where(Task.id == uuid.UUID(task_id))
        )
        task = result.scalar_one_or_none()
        if not task:
            raise ValueError(f"Task {task_id} not found")

        return TaskResponse(
            task_id=str(task.id),
            from_agent_id=task.from_agent_id,
            to_agent_id=task.to_agent_id,
            task_type=task.task_type,
            title=task.title,
            description=task.description,
            parameters=task.parameters,
            result=task.result,
            status=task.status,
            priority=task.priority,
            deadline=task.deadline,
            created_at=str(task.created_at),
            updated_at=str(task.updated_at) if task.updated_at else None,
        )
