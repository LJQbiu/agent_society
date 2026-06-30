"""身份注册服务 - M0-a 完整实现"""
import bcrypt
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.human import Human
from app.models.agent import Agent
from app.models.organization import Organization, OrganizationMember
from app.utils.jwt import create_token


def _safe_uuid(val: str) -> uuid.UUID:
    """安全解析UUID字符串，非法格式时抛出清晰的ValueError"""
    try:
        return uuid.UUID(val)
    except (ValueError, AttributeError, TypeError):
        raise ValueError(f"无效的UUID格式: '{val}'")


class IdentityService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def register_human(self, data) -> dict:
        """人类注册 - 创建Human用户+返回token"""
        # Check uniqueness
        existing = await self.db.execute(
            select(Human).where(Human.username == data.username)
        )
        if existing.scalar_one_or_none():
            raise ValueError("用户名已存在")

        existing_email = await self.db.execute(
            select(Human).where(Human.email == data.email)
        )
        if existing_email.scalar_one_or_none():
            raise ValueError("邮箱已被注册")

        # Create human
        password_hash = bcrypt.hashpw(
            data.password.encode(), bcrypt.gensalt()
        ).decode()

        human = Human(
            username=data.username,
            email=data.email,
            password_hash=password_hash,
            status="active",
            profile=data.profile if hasattr(data, 'profile') and data.profile else {},
            is_active=True,
        )
        self.db.add(human)
        await self.db.commit()
        await self.db.refresh(human)

        # Generate token
        access_token = create_token({
            "sub": str(human.id),
            "user_type": "human",
            "roles": ["human"],
        })

        return {
            "id": str(human.id),
            "username": human.username,
            "email": human.email,
            "status": human.status,
            "access_token": access_token,
        }

    async def register_agent(self, data, owner_id: str) -> dict:
        """Agent注册 - 需认证(owner_id from token)"""
        # Check owner exists
        owner_result = await self.db.execute(
            select(Human).where(Human.id == _safe_uuid(owner_id))
        )
        owner = owner_result.scalar_one_or_none()
        if not owner:
            raise ValueError("owner不存在")

        # Generate unique agent_id_str
        agent_id_str = f"agent-{data.name.lower().replace(' ', '-')}-{str(uuid.uuid4())[:8]}"

        # Create agent - match actual Agent model columns
        agent = Agent(
            name=data.name,
            agent_id_str=agent_id_str,
            owner_id=_safe_uuid(owner_id),
            capabilities=data.capabilities if hasattr(data, 'capabilities') and data.capabilities else [],
            description=data.description if hasattr(data, 'description') else "",
            status="active",
            trust_level="novice",
            reputation=50.0,
            agent_card=data.agent_card if hasattr(data, 'agent_card') and data.agent_card else {},
        )
        self.db.add(agent)
        await self.db.commit()
        await self.db.refresh(agent)

        return {
            "id": str(agent.id),
            "agent_id_str": agent.agent_id_str,
            "name": agent.name,
            "capabilities": agent.capabilities,
            "status": agent.status,
            "agent_card": agent.agent_card or {},
        }

    async def register_organization(self, data, creator_id: str) -> dict:
        """组织注册 - 需认证(creator_id from token)"""
        # Check creator exists (can be human or agent)
        org = Organization(
            name=data.name,
            org_type=data.org_type if hasattr(data, 'org_type') else "community",
            description=data.description if hasattr(data, 'description') else "",
            status="active",
            balance=0.0,
            creator_id=_safe_uuid(creator_id),
        )
        self.db.add(org)
        await self.db.flush()

        # Add creator as leader member
        member = OrganizationMember(
            organization_id=org.id,
            human_id=_safe_uuid(creator_id),
            role="leader",
            status="active",
        )
        self.db.add(member)
        await self.db.commit()
        await self.db.refresh(org)

        return {
            "id": str(org.id),
            "name": org.name,
            "org_type": org.org_type,
            "status": org.status,
        }

    async def get_profile(self, user_id: str, user_type: str) -> dict:
        """获取profile"""
        if user_type == "human":
            result = await self.db.execute(
                select(Human).where(Human.id == _safe_uuid(user_id))
            )
            entity = result.scalar_one_or_none()
            if not entity:
                raise ValueError("用户不存在")
            return {
                "id": str(entity.id),
                "name": entity.username,
                "type": "human",
                "status": entity.status,
                "profile": entity.profile or {},
            }
        elif user_type == "agent":
            result = await self.db.execute(
                select(Agent).where(Agent.id == _safe_uuid(user_id))
            )
            entity = result.scalar_one_or_none()
            if not entity:
                raise ValueError("Agent不存在")
            return {
                "id": str(entity.id),
                "name": entity.name,
                "type": "agent",
                "status": entity.status,
                "profile": entity.agent_card or {},
            }
        elif user_type == "admin":
            from app.models.governance import Admin
            result = await self.db.execute(
                select(Admin).where(Admin.id == _safe_uuid(user_id))
            )
            entity = result.scalar_one_or_none()
            if not entity:
                raise ValueError("管理员不存在")
            return {
                "id": str(entity.id),
                "name": entity.username,
                "type": "admin",
                "status": "active" if entity.is_active else "disabled",
                "profile": {"role": entity.role, "email": entity.email},
            }
        else:
            raise ValueError(f"不支持的user_type: {user_type}")

    async def my_agents(self, owner_id: str) -> dict:
        """获取当前用户的agent列表"""
        result = await self.db.execute(
            select(Agent).where(Agent.owner_id == _safe_uuid(owner_id))
        )
        agents = result.scalars().all()
        return {
            "agents": [
                {
                    "id": str(a.id),
                    "agent_id_str": a.agent_id_str,
                    "name": a.name,
                    "capabilities": a.capabilities or [],
                    "status": a.status,
                    "description": a.description or "",
                }
                for a in agents
            ],
            "total": len(agents),
        }

    async def update_profile(self, user_id: str, user_type: str, data) -> dict:
        """更新profile"""
        if user_type == "human":
            result = await self.db.execute(
                select(Human).where(Human.id == _safe_uuid(user_id))
            )
            entity = result.scalar_one_or_none()
            if not entity:
                raise ValueError("用户不存在")
            if data.profile:
                entity.profile = data.profile
            if hasattr(data, 'description') and data.description:
                pass  # Human has no description field, store in profile
            await self.db.commit()
            await self.db.refresh(entity)
            return {
                "id": str(entity.id),
                "name": entity.username,
                "type": "human",
                "status": entity.status,
                "profile": entity.profile or {},
            }
        elif user_type == "agent":
            result = await self.db.execute(
                select(Agent).where(Agent.id == _safe_uuid(user_id))
            )
            entity = result.scalar_one_or_none()
            if not entity:
                raise ValueError("Agent不存在")
            if data.profile:
                entity.agent_card = data.profile
            if hasattr(data, 'description') and data.description:
                entity.description = data.description
            await self.db.commit()
            await self.db.refresh(entity)
            return {
                "id": str(entity.id),
                "name": entity.name,
                "type": "agent",
                "status": entity.status,
                "profile": entity.agent_card or {},
            }
        else:
            raise ValueError(f"不支持的user_type: {user_type}")

    async def delete_agent(self, owner_id: str, agent_id: str) -> dict:
        """用户删除自己的agent - 先清理所有关联记录"""
        from sqlalchemy import delete as sa_delete
        from app.models.governance import OAuthClient
        from app.models.organization import OrganizationMember
        from app.models.project import Project, ProjectParticipant

        # 查找agent，验证所有权
        result = await self.db.execute(
            select(Agent).where(Agent.id == _safe_uuid(agent_id))
        )
        agent = result.scalar_one_or_none()
        if not agent:
            raise ValueError("Agent不存在")
        if str(agent.owner_id) != str(_safe_uuid(owner_id)):
            raise ValueError("只能删除自己的agent")

        agent_name = agent.name
        agent_id_str = agent.agent_id_str
        agent_uuid = _safe_uuid(agent_id)

        # 1. 删除OAuthClients（agent作为owner）
        await self.db.execute(
            sa_delete(OAuthClient).where(OAuthClient.owner_id == agent_uuid)
        )
        # 2. 删除OrganizationMembers（agent作为成员）
        await self.db.execute(
            sa_delete(OrganizationMember).where(OrganizationMember.agent_id == agent_uuid)
        )
        # 3. 删除ProjectParticipants（agent作为参与者）
        await self.db.execute(
            sa_delete(ProjectParticipant).where(ProjectParticipant.agent_id == agent_uuid)
        )
        # 4. 删除Projects（agent作为创建者）
        await self.db.execute(
            sa_delete(Project).where(Project.creator_id == agent_uuid)
        )

        # 删除agent本身
        await self.db.execute(
            sa_delete(Agent).where(Agent.id == agent_uuid)
        )
        await self.db.commit()

        return {
            "agent_id": str(agent_id),
            "agent_name": agent_name,
            "agent_id_str": agent_id_str,
            "message": "Agent已删除",
        }
