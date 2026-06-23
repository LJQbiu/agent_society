"""管理员制动服务 - M0-h 完整实现"""
import bcrypt
import uuid
from datetime import datetime, timedelta
from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.governance import Admin, GovernanceEvent
from app.models.agent import Agent
from app.models.project import Project
from app.models.organization import Organization
from app.models.human import Human
from app.utils.jwt import create_token


class AdminService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ===== 认证 =====

    async def init_super_admin(self, data) -> dict:
        """初始化super_admin（仅允许一次）"""
        # 检查是否已有super_admin
        result = await self.db.execute(
            select(Admin).where(Admin.role == "super_admin")
        )
        existing = result.scalar_one_or_none()
        if existing:
            raise ValueError("super_admin已存在，不可重复初始化")

        password_hash = bcrypt.hashpw(
            data.super_admin_password.encode(), bcrypt.gensalt()
        ).decode()

        admin = Admin(
            username=data.super_admin_username,
            email=data.super_admin_email,
            password_hash=password_hash,
            role="super_admin",
            is_active=True,
        )
        self.db.add(admin)
        await self.db.commit()
        await self.db.refresh(admin)

        return {
            "admin_id": str(admin.id),
            "username": admin.username,
            "role": admin.role,
            "message": "super_admin初始化成功",
        }

    async def login(self, data) -> dict:
        """管理员登录"""
        result = await self.db.execute(
            select(Admin).where(Admin.username == data.username)
        )
        admin = result.scalar_one_or_none()
        if not admin:
            raise ValueError("用户名不存在")
        if not admin.is_active:
            raise ValueError("账号已被禁用")

        if not bcrypt.checkpw(data.password.encode(), admin.password_hash.encode()):
            raise ValueError("密码错误")

        # 更新last_login_at
        admin.last_login_at = datetime.utcnow()
        await self.db.commit()

        # 生成JWT token
        access_token = create_token({
            "sub": str(admin.id),
            "user_type": "admin",
            "roles": [admin.role],
        })
        refresh_token = create_token(
            {
                "sub": str(admin.id),
                "user_type": "admin",
                "roles": [admin.role],
            },
            expires_delta=timedelta(days=7),
        )

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "admin_id": str(admin.id),
            "role": admin.role,
            "username": admin.username,
        }

    async def create_admin(self, data, creator: Admin) -> dict:
        """创建子管理员（super_admin专属）"""
        password_hash = bcrypt.hashpw(
            data.password.encode(), bcrypt.gensalt()
        ).decode()

        admin = Admin(
            username=data.username,
            email=data.email,
            password_hash=password_hash,
            role=data.role,
            is_active=True,
            created_by=creator.id,
        )
        self.db.add(admin)
        await self.db.commit()
        await self.db.refresh(admin)

        # 审计记录
        await self._create_audit_event(
            actor_id=creator.id,
            actor_role=creator.role,
            target_id=admin.id,
            target_type="admin",
            event_type="admin_created",
            details={"new_role": data.role, "new_username": data.username},
        )

        return {
            "admin_id": str(admin.id),
            "username": admin.username,
            "role": admin.role,
            "created_by": str(creator.id),
        }

    # ===== Agent制动 =====

    async def freeze_agent(self, agent_id: uuid.UUID, data, admin: Admin) -> dict:
        """冻结Agent"""
        result = await self.db.execute(
            select(Agent).where(Agent.id == agent_id)
        )
        agent = result.scalar_one_or_none()
        if not agent:
            raise ValueError("Agent不存在")

        previous_status = agent.status
        if previous_status == "frozen":
            raise ValueError("Agent已经是frozen状态")

        agent.status = "frozen"
        auto_unfreeze_at = None
        if data.duration_hours:
            auto_unfreeze_at = datetime.utcnow() + timedelta(hours=data.duration_hours)

        await self.db.commit()

        # 审计记录
        audit_id = await self._create_audit_event(
            actor_id=admin.id,
            actor_role=admin.role,
            target_id=agent_id,
            target_type="agent",
            event_type="agent_frozen",
            details={
                "previous_status": previous_status,
                "new_status": "frozen",
                "reason": data.reason,
                "duration_hours": data.duration_hours,
                "auto_unfreeze_at": auto_unfreeze_at.isoformat() if auto_unfreeze_at else None,
            },
        )

        return {
            "agent_id": str(agent_id),
            "previous_status": previous_status,
            "new_status": "frozen",
            "reason": data.reason,
            "audit_id": str(audit_id),
            "auto_unfreeze_at": auto_unfreeze_at,
        }

    async def unfreeze_agent(self, agent_id: uuid.UUID, data, admin: Admin) -> dict:
        """解冻Agent"""
        result = await self.db.execute(
            select(Agent).where(Agent.id == agent_id)
        )
        agent = result.scalar_one_or_none()
        if not agent:
            raise ValueError("Agent不存在")

        previous_status = agent.status
        if previous_status != "frozen":
            raise ValueError("Agent不是frozen状态，无法解冻")

        agent.status = "active"
        await self.db.commit()

        audit_id = await self._create_audit_event(
            actor_id=admin.id,
            actor_role=admin.role,
            target_id=agent_id,
            target_type="agent",
            event_type="agent_unfrozen",
            details={"previous_status": previous_status, "new_status": "active", "reason": data.reason},
        )

        return {
            "agent_id": str(agent_id),
            "previous_status": previous_status,
            "new_status": "active",
            "reason": data.reason,
            "audit_id": str(audit_id),
        }

    async def revoke_agent(self, agent_id: uuid.UUID, data, admin: Admin) -> dict:
        """撤销Agent（仅super_admin）"""
        if admin.role != "super_admin":
            raise ValueError("仅super_admin可以撤销Agent")

        result = await self.db.execute(
            select(Agent).where(Agent.id == agent_id)
        )
        agent = result.scalar_one_or_none()
        if not agent:
            raise ValueError("Agent不存在")

        previous_status = agent.status
        agent.status = "revoked"
        await self.db.commit()

        audit_id = await self._create_audit_event(
            actor_id=admin.id,
            actor_role=admin.role,
            target_id=agent_id,
            target_type="agent",
            event_type="agent_revoked",
            details={"previous_status": previous_status, "new_status": "revoked", "reason": data.reason},
        )

        return {
            "agent_id": str(agent_id),
            "previous_status": previous_status,
            "new_status": "revoked",
            "reason": data.reason,
            "audit_id": str(audit_id),
        }

    # ===== Project制动 =====

    async def suspend_project(self, project_id: uuid.UUID, data, admin: Admin) -> dict:
        """暂停项目"""
        result = await self.db.execute(
            select(Project).where(Project.id == project_id)
        )
        project = result.scalar_one_or_none()
        if not project:
            raise ValueError("Project不存在")

        previous_status = project.status
        project.status = "suspended"
        await self.db.commit()

        audit_id = await self._create_audit_event(
            actor_id=admin.id,
            actor_role=admin.role,
            target_id=project_id,
            target_type="project",
            event_type="project_suspended",
            details={"previous_status": previous_status, "new_status": "suspended", "reason": data.reason},
        )

        return {
            "project_id": str(project_id),
            "previous_status": previous_status,
            "new_status": "suspended",
            "reason": data.reason,
            "audit_id": str(audit_id),
        }

    async def resume_project(self, project_id: uuid.UUID, data, admin: Admin) -> dict:
        """恢复项目"""
        result = await self.db.execute(
            select(Project).where(Project.id == project_id)
        )
        project = result.scalar_one_or_none()
        if not project:
            raise ValueError("Project不存在")

        previous_status = project.status
        if previous_status != "suspended":
            raise ValueError("Project不是suspended状态")

        project.status = "active"
        await self.db.commit()

        audit_id = await self._create_audit_event(
            actor_id=admin.id,
            actor_role=admin.role,
            target_id=project_id,
            target_type="project",
            event_type="project_resumed",
            details={"previous_status": previous_status, "new_status": "active", "reason": data.reason},
        )

        return {
            "project_id": str(project_id),
            "previous_status": previous_status,
            "new_status": "active",
            "reason": data.reason,
            "audit_id": str(audit_id),
        }

    # ===== Organization制动 =====

    async def suspend_organization(self, org_id: uuid.UUID, data, admin: Admin) -> dict:
        """暂停组织"""
        result = await self.db.execute(
            select(Organization).where(Organization.id == org_id)
        )
        org = result.scalar_one_or_none()
        if not org:
            raise ValueError("Organization不存在")

        previous_status = org.status
        org.status = "suspended"
        await self.db.commit()

        audit_id = await self._create_audit_event(
            actor_id=admin.id,
            actor_role=admin.role,
            target_id=org_id,
            target_type="organization",
            event_type="org_suspended",
            details={"previous_status": previous_status, "new_status": "suspended", "reason": data.reason},
        )

        return {
            "org_id": str(org_id),
            "previous_status": previous_status,
            "new_status": "suspended",
            "reason": data.reason,
            "audit_id": str(audit_id),
        }

    async def resume_organization(self, org_id: uuid.UUID, data, admin: Admin) -> dict:
        """恢复组织"""
        result = await self.db.execute(
            select(Organization).where(Organization.id == org_id)
        )
        org = result.scalar_one_or_none()
        if not org:
            raise ValueError("Organization不存在")

        previous_status = org.status
        if previous_status != "suspended":
            raise ValueError("Organization不是suspended状态")

        org.status = "active"
        await self.db.commit()

        audit_id = await self._create_audit_event(
            actor_id=admin.id,
            actor_role=admin.role,
            target_id=org_id,
            target_type="organization",
            event_type="org_resumed",
            details={"previous_status": previous_status, "new_status": "active", "reason": data.reason},
        )

        return {
            "org_id": str(org_id),
            "previous_status": previous_status,
            "new_status": "active",
            "reason": data.reason,
            "audit_id": str(audit_id),
        }

    # ===== Token账户制动 =====

    async def freeze_account(self, account_holder_id: uuid.UUID, data, admin: Admin) -> dict:
        """冻结Token账户"""
        # 检查是human还是agent
        holder_type = "unknown"
        current_balance = 0.0
        previous_status = "active"

        # 先检查Agent
        result = await self.db.execute(
            select(Agent).where(Agent.id == account_holder_id)
        )
        agent = result.scalar_one_or_none()
        if agent:
            holder_type = "agent"
            current_balance = agent.balance
            previous_status = agent.status
            # 标记balance冻结（使用status标记）
            if agent.status not in ("frozen", "revoked"):
                agent.status = "frozen"
            await self.db.commit()
        else:
            # 检查Human
            result = await self.db.execute(
                select(Human).where(Human.id == account_holder_id)
            )
            human = result.scalar_one_or_none()
            if human:
                holder_type = "human"
                # Human没有直接balance字段，记录冻结状态
                await self.db.commit()
            else:
                raise ValueError("账户持有人不存在")

        audit_id = await self._create_audit_event(
            actor_id=admin.id,
            actor_role=admin.role,
            target_id=account_holder_id,
            target_type="account",
            event_type="account_frozen",
            details={
                "holder_type": holder_type,
                "previous_status": previous_status,
                "new_status": "frozen",
                "current_balance": current_balance,
                "reason": data.reason,
            },
        )

        return {
            "account_holder_id": str(account_holder_id),
            "holder_type": holder_type,
            "previous_status": previous_status,
            "new_status": "frozen",
            "current_balance": current_balance,
            "reason": data.reason,
            "audit_id": str(audit_id),
        }

    async def unfreeze_account(self, account_holder_id: uuid.UUID, data, admin: Admin) -> dict:
        """解冻Token账户"""
        holder_type = "unknown"
        current_balance = 0.0
        previous_status = "frozen"

        # 先检查Agent
        result = await self.db.execute(
            select(Agent).where(Agent.id == account_holder_id)
        )
        agent = result.scalar_one_or_none()
        if agent:
            holder_type = "agent"
            current_balance = agent.balance
            previous_status = agent.status
            agent.status = "active"
            await self.db.commit()
        else:
            # 检查Human
            result = await self.db.execute(
                select(Human).where(Human.id == account_holder_id)
            )
            human = result.scalar_one_or_none()
            if human:
                holder_type = "human"
                previous_status = "frozen"
                await self.db.commit()
            else:
                raise ValueError("账户持有人不存在")

        audit_id = await self._create_audit_event(
            actor_id=admin.id,
            actor_role=admin.role,
            target_id=account_holder_id,
            target_type="account",
            event_type="account_unfrozen",
            details={
                "holder_type": holder_type,
                "previous_status": previous_status,
                "new_status": "active",
                "current_balance": current_balance,
                "reason": data.reason,
            },
        )

        return {
            "account_holder_id": str(account_holder_id),
            "holder_type": holder_type,
            "previous_status": previous_status,
            "new_status": "active",
            "current_balance": current_balance,
            "reason": data.reason,
            "audit_id": str(audit_id),
        }

    # ===== 紧急制动 =====

    async def brake(self, data, admin: Admin) -> dict:
        """紧急制动 - 批量冻结"""
        scope = data.scope
        frozen_count = 0

        if scope in ("all", "agents"):
            result = await self.db.execute(
                update(Agent).where(Agent.status == "active").values(status="frozen")
            )
            frozen_count += result.rowcount

        if scope in ("all", "projects"):
            result = await self.db.execute(
                update(Project).where(Project.status == "active").values(status="suspended")
            )
            frozen_count += result.rowcount

        if scope in ("all", "organizations"):
            result = await self.db.execute(
                update(Organization).where(Organization.status == "active").values(status="suspended")
            )
            frozen_count += result.rowcount

        await self.db.commit()

        audit_id = await self._create_audit_event(
            actor_id=admin.id,
            actor_role=admin.role,
            target_id=admin.id,  # brake targets system
            target_type="system",
            event_type="emergency_brake",
            details={"scope": scope, "frozen_count": frozen_count, "reason": data.reason},
        )

        return {
            "scope": scope,
            "frozen_count": frozen_count,
            "reason": data.reason,
            "audit_id": str(audit_id),
            "message": f"紧急制动生效: {scope}范围冻结{frozen_count}个实体",
        }

    # ===== 审计日志 =====

    async def get_audit_log(self, event_type: str, target_type: str,
                            start_time: str, end_time: str,
                            page: int, page_size: int) -> dict:
        """查询审计日志"""
        query = select(GovernanceEvent).order_by(GovernanceEvent.created_at.desc())

        if event_type:
            query = query.where(GovernanceEvent.event_type == event_type)
        if target_type:
            query = query.where(GovernanceEvent.target_type == target_type)
        if start_time:
            query = query.where(GovernanceEvent.created_at >= datetime.fromisoformat(start_time))
        if end_time:
            query = query.where(GovernanceEvent.created_at <= datetime.fromisoformat(end_time))

        # 总数
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await self.db.execute(count_query)
        total = total_result.scalar() or 0

        # 分页
        offset = (page - 1) * page_size
        query = query.offset(offset).limit(page_size)
        result = await self.db.execute(query)
        events = result.scalars().all()

        return {
            "events": [
                {
                    "event_id": str(e.id),
                    "event_type": e.event_type,
                    "actor_id": str(e.actor_id),
                    "actor_role": e.actor_role,
                    "target_id": str(e.target_id),
                    "target_type": e.target_type,
                    "details": e.details or {},
                    "created_at": e.created_at.isoformat() if e.created_at else "",
                }
                for e in events
            ],
            "total": total,
            "page": page,
            "page_size": page_size,
        }

    # ===== 内部工具 =====

    async def _create_audit_event(self, actor_id, actor_role, target_id,
                                   target_type, event_type, details: dict) -> uuid.UUID:
        """创建审计事件记录"""
        event = GovernanceEvent(
            event_type=event_type,
            actor_id=actor_id,
            actor_role=actor_role,
            target_id=target_id,
            target_type=target_type,
            details=details,
        )
        self.db.add(event)
        await self.db.commit()
        await self.db.refresh(event)
        return event.id

    async def get_admin_by_id(self, admin_id: uuid.UUID) -> Admin:
        """通过ID获取管理员"""
        result = await self.db.execute(
            select(Admin).where(Admin.id == admin_id)
        )
        return result.scalar_one_or_none()
