"""观察窗口服务 - M0-e Observatory API"""
from sqlalchemy import select, func, desc, asc, case
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.models.agent import Agent
from app.models.human import Human
from app.models.organization import Organization, OrganizationMember
from app.models.project import Project, ProjectParticipant
from app.models.transaction import Transaction
from datetime import datetime, timedelta
import uuid


# 排序字段白名单
AGENT_SORT_WHITELIST = {"reputation": Agent.reputation, "token_balance": Agent.balance, "created_at": Agent.created_at}
PROJECT_SORT_WHITELIST = {"created_at": Project.created_at, "token_budget": Project.budget}
ORG_SORT_WHITELIST = {"created_at": Organization.created_at, "avg_reputation": Organization.reputation}
LEADERBOARD_TYPE_WHITELIST = {"reputation", "token", "combined"}
TIME_RANGE_WHITELIST = {"all", "month", "week"}


class ObservatoryService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ─── Agent Directory ───

    async def list_agents(self, page: int = 1, page_size: int = 20,
                           search: str = "", capability: str = "",
                           status: str = "active", sort_by: str = "reputation",
                           sort_order: str = "desc") -> dict:
        """Agent目录查询：分页+搜索+过滤+排序"""
        page_size = min(page_size, 100)
        query = select(Agent)

        if search:
            query = query.where(Agent.name.ilike(f"%{search}%"))
        if capability:
            query = query.where(Agent.capabilities.contains([capability]))
        if status != "all":
            query = query.where(Agent.status == status)

        # Sort by whitelisted column
        sort_col = AGENT_SORT_WHITELIST.get(sort_by, Agent.reputation)
        query = query.order_by(desc(sort_col) if sort_order == "desc" else asc(sort_col))

        # Count total
        count_q = select(func.count()).select_from(query.subquery())
        total = await self.db.scalar(count_q) or 0

        # Paginate
        result_q = query.offset((page - 1) * page_size).limit(page_size)
        rows = await self.db.scalars(result_q)
        agents = rows.all()

        # Build response with project count + org info via subqueries
        agent_ids = [a.id for a in agents]

        # Batch query: project counts for all agents
        proj_counts_raw = await self.db.execute(
            select(ProjectParticipant.agent_id, func.count(ProjectParticipant.id)) \
            .where(ProjectParticipant.agent_id.in_(agent_ids)) \
            .where(ProjectParticipant.status == "active") \
            .group_by(ProjectParticipant.agent_id)
        )
        proj_count_map = {str(row[0]): row[1] for row in proj_counts_raw.fetchall()}

        # Batch query: org memberships for all agents
        org_memberships_raw = await self.db.execute(
            select(OrganizationMember.agent_id, Organization.name, Organization.id) \
            .join(Organization, OrganizationMember.organization_id == Organization.id) \
            .where(OrganizationMember.agent_id.in_(agent_ids)) \
            .where(OrganizationMember.status == "active")
        )
        org_map = {}
        for row in org_memberships_raw.fetchall():
            # Keep first org found for each agent
            if str(row[0]) not in org_map:
                org_map[str(row[0])] = {"id": str(row[2]), "name": row[1]}

        agent_list = []
        for a in agents:
            aid = str(a.id)
            org_info = org_map.get(aid, {})
            agent_list.append({
                "agent_id": a.agent_id_str or aid,
                "name": a.name,
                "status": a.status,
                "capabilities": a.capabilities or [],
                "reputation_score": a.reputation or 0.0,
                "token_balance": a.balance or 0.0,
                "organization_id": org_info.get("id"),
                "organization_name": org_info.get("name"),
                "projects_count": proj_count_map.get(aid, 0),
                "created_at": a.created_at.isoformat() if a.created_at else None,
                "avatar_url": None,  # Phase1 feature
            })

        return {
            "total": total,
            "page": page,
            "page_size": page_size,
            "agents": agent_list,
        }

    async def get_agent_stats(self) -> dict:
        """Agent目录统计概览"""
        total_agents = await self.db.scalar(select(func.count(Agent.id))) or 0
        active_agents = await self.db.scalar(
            select(func.count(Agent.id)).where(Agent.status == "active")
        ) or 0
        frozen_agents = await self.db.scalar(
            select(func.count(Agent.id)).where(Agent.status == "frozen")
        ) or 0
        avg_reputation = await self.db.scalar(
            select(func.avg(Agent.reputation)).where(Agent.status == "active")
        ) or 0.0
        avg_balance = await self.db.scalar(
            select(func.avg(Agent.balance)).where(Agent.status == "active")
        ) or 0.0

        # Capability distribution
        cap_dist_raw = await self.db.scalars(
            select(Agent.capabilities).where(Agent.status == "active")
        )
        cap_dist = {}
        for caps in cap_dist_raw.all():
            if caps:
                for c in caps:
                    cap_dist[c] = cap_dist.get(c, 0) + 1

        return {
            "total_agents": total_agents,
            "active_agents": active_agents,
            "frozen_agents": frozen_agents,
            "avg_reputation": float(avg_reputation),
            "avg_token_balance": float(avg_balance),
            "capability_distribution": cap_dist,
        }

    # ─── Project Market ───

    async def list_projects(self, page: int = 1, page_size: int = 20,
                             search: str = "", status: str = "all",
                             type: str = "", capability: str = "",
                             sort_by: str = "created_at",
                             sort_order: str = "desc") -> dict:
        """项目市场查询"""
        page_size = min(page_size, 100)
        query = select(Project)

        if search:
            query = query.where(Project.name.ilike(f"%{search}%"))
        if status != "all":
            query = query.where(Project.status == status)
        if type:
            query = query.where(Project.type == type)
        if capability:
            query = query.where(Project.required_capabilities.contains([capability]))

        # Sort - participants count needs subquery, others are direct columns
        if sort_by == "participants":
            participants_sub = select(
                ProjectParticipant.project_id,
                func.count(ProjectParticipant.id).label("pcnt")
            ).where(ProjectParticipant.status == "active").group_by(ProjectParticipant.project_id).subquery()
            query = query.outerjoin(participants_sub, Project.id == participants_sub.c.project_id)
            query = query.order_by(desc(participants_sub.c.pcnt) if sort_order == "desc" else asc(participants_sub.c.pcnt))
        else:
            sort_col = PROJECT_SORT_WHITELIST.get(sort_by, Project.created_at)
            query = query.order_by(desc(sort_col) if sort_order == "desc" else asc(sort_col))

        count_q = select(func.count()).select_from(query.subquery())
        total = await self.db.scalar(count_q) or 0

        result_q = query.offset((page - 1) * page_size).limit(page_size)
        rows = await self.db.scalars(result_q)
        projects = rows.all()

        project_list = []

        # Batch: participant counts per project
        proj_ids = [p.id for p in projects]
        p_count_raw = await self.db.execute(
            select(ProjectParticipant.project_id, func.count(ProjectParticipant.id)) \
            .where(ProjectParticipant.project_id.in_(proj_ids)) \
            .where(ProjectParticipant.status == "active") \
            .group_by(ProjectParticipant.project_id)
        )
        p_count_map = {str(row[0]): row[1] for row in p_count_raw.fetchall()}

        # Batch: creator names
        creator_ids = [p.creator_id for p in projects if p.creator_id]
        creators_raw = await self.db.execute(
            select(Agent.id, Agent.name).where(Agent.id.in_(creator_ids))
        )
        creator_name_map = {str(row[0]): row[1] for row in creators_raw.fetchall()}

        for p in projects:
            pid = str(p.id)
            project_list.append({
                "project_id": pid,
                "name": p.name,
                "type": p.type or "general",
                "status": p.status,
                "required_capabilities": p.required_capabilities or [],
                "current_participants": p_count_map.get(pid, 0),
                "max_participants": p.max_participants or 5,
                "token_budget": p.budget or 0.0,
                "reputation_budget": p.reputation_budget or 0.0,
                "creator_id": str(p.creator_id) if p.creator_id else None,
                "creator_name": creator_name_map.get(str(p.creator_id)) if p.creator_id else "Unknown",
                "deadline": None,  # Phase1: add deadline field
                "description": p.description or "",
                "created_at": p.created_at.isoformat() if p.created_at else None,
            })

        return {
            "total": total,
            "page": page,
            "page_size": page_size,
            "projects": project_list,
        }

    async def get_project_detail(self, project_id: str) -> dict:
        """项目详情（含参与者列表）"""
        try:
            pid = uuid.UUID(project_id)
        except ValueError:
            return {"error": "Invalid project_id format"}

        project = await self.db.get(Project, pid)
        if not project:
            return {"error": "Project not found"}

        # Participants
        participants_rows = await self.db.scalars(
            select(ProjectParticipant, Agent.name) \
            .join(Agent, ProjectParticipant.agent_id == Agent.id) \
            .where(ProjectParticipant.project_id == pid) \
            .where(ProjectParticipant.status == "active")
        )
        participants = []
        for pp in participants_rows.all():
            participants.append({
                "agent_id": str(pp[0].agent_id),
                "name": pp[1],
                "joined_at": pp[0].created_at.isoformat() if pp[0].created_at else None,
                "role": pp[0].role,
            })

        # Creator
        creator = await self.db.get(Agent, project.creator_id)

        return {
            "project_id": str(project.id),
            "name": project.name,
            "type": project.type or "general",
            "status": project.status,
            "required_capabilities": project.required_capabilities or [],
            "participants": participants,
            "token_budget": project.budget or 0.0,
            "reputation_budget": project.reputation_budget or 0.0,
            "creator": {
                "agent_id": str(project.creator_id),
                "name": creator.name if creator else "Unknown",
            },
            "deadline": None,
            "description": project.description or "",
            "created_at": project.created_at.isoformat() if project.created_at else None,
        }

    # ─── Organization Square ───

    async def list_organizations(self, page: int = 1, page_size: int = 20,
                                  search: str = "", org_type: str = "",
                                  status: str = "active",
                                  sort_by: str = "members_count",
                                  sort_order: str = "desc") -> dict:
        """组织广场查询"""
        page_size = min(page_size, 100)

        # Base query with member count subquery
        member_count_sub = select(
            OrganizationMember.organization_id,
            func.count(OrganizationMember.id).label("mcnt")
        ).where(OrganizationMember.status == "active").group_by(OrganizationMember.organization_id).subquery()

        # Avg reputation subquery for org members
        avg_rep_sub = select(
            OrganizationMember.organization_id,
            func.avg(Agent.reputation).label("avg_rep"),
            func.avg(Agent.balance).label("avg_bal")
        ).join(Agent, OrganizationMember.agent_id == Agent.id) \
        .where(OrganizationMember.status == "active") \
        .group_by(OrganizationMember.organization_id).subquery()

        # Project count subquery
        proj_count_sub = select(
            Project.organization_id,
            func.count(Project.id).label("projcnt")
        ).group_by(Project.organization_id).subquery()

        query = select(
            Organization,
            member_count_sub.c.mcnt,
            avg_rep_sub.c.avg_rep,
            avg_rep_sub.c.avg_bal,
            proj_count_sub.c.projcnt
        ).outerjoin(member_count_sub, Organization.id == member_count_sub.c.organization_id) \
         .outerjoin(avg_rep_sub, Organization.id == avg_rep_sub.c.organization_id) \
         .outerjoin(proj_count_sub, Organization.id == proj_count_sub.c.organization_id)

        if search:
            query = query.where(Organization.name.ilike(f"%{search}%"))
        if org_type:
            query = query.where(Organization.org_type == org_type)
        if status != "all":
            query = query.where(Organization.status == status)

        # Sort
        if sort_by == "members_count":
            sort_col = member_count_sub.c.mcnt
        elif sort_by == "avg_reputation":
            sort_col = avg_rep_sub.c.avg_rep
        else:
            sort_col = Organization.created_at
        query = query.order_by(desc(sort_col) if sort_order == "desc" else asc(sort_col))

        # Count (need separate count query on base orgs)
        count_base = select(func.count(Organization.id))
        if search:
            count_base = count_base.where(Organization.name.ilike(f"%{search}%"))
        if org_type:
            count_base = count_base.where(Organization.org_type == org_type)
        if status != "all":
            count_base = count_base.where(Organization.status == status)
        total = await self.db.scalar(count_base) or 0

        # Paginate
        result_q = query.offset((page - 1) * page_size).limit(page_size)
        rows = await self.db.execute(result_q)

        org_list = []
        for row in rows.all():
            org = row[0]
            creator = await self.db.get(Agent, org.creator_id)
            org_list.append({
                "org_id": str(org.id),
                "name": org.name,
                "description": org.description or "",
                "members_count": row[1] or 0,
                "avg_reputation": float(row[2] or 0.0),
                "avg_token_balance": float(row[3] or 0.0),
                "projects_count": row[4] or 0,
                "creator_id": str(org.creator_id),
                "creator_name": creator.name if creator else "Unknown",
                "created_at": org.created_at.isoformat() if org.created_at else None,
            })

        return {
            "total": total,
            "page": page,
            "page_size": page_size,
            "organizations": org_list,
        }

    async def get_organization_detail(self, org_id: str) -> dict:
        """组织详情（含成员列表+关联项目）"""
        try:
            oid = uuid.UUID(org_id)
        except ValueError:
            return {"error": "Invalid org_id format"}

        org = await self.db.get(Organization, oid)
        if not org:
            return {"error": "Organization not found"}

        # Members with agent/human info (LEFT JOIN to include human members without agent_id)
        members_rows = await self.db.execute(
            select(
                OrganizationMember,
                Agent.name.label("agent_name"),
                Agent.reputation.label("agent_rep"),
                Agent.balance.label("agent_bal"),
                Human.username.label("human_name"),
            )
            .outerjoin(Agent, OrganizationMember.agent_id == Agent.id)
            .outerjoin(Human, OrganizationMember.human_id == Human.id)
            .where(OrganizationMember.organization_id == oid)
            .where(OrganizationMember.status == "active")
        )
        members = []
        total_rep = 0.0
        total_bal = 0.0
        for m_row in members_rows.all():
            om = m_row[0]
            agent_name = m_row.agent_name
            agent_rep = m_row.agent_rep
            agent_bal = m_row.agent_bal
            human_name = m_row.human_name
            # Name: prefer agent name, fallback to human username
            display_name = agent_name or human_name or str(om.human_id)
            member_type = "agent" if om.agent_id else "human"
            members.append({
                "agent_id": str(om.agent_id) if om.agent_id else None,
                "human_id": str(om.human_id),
                "member_type": member_type,
                "name": display_name,
                "reputation_score": agent_rep or 0.0,
                "role": om.role,
                "joined_at": om.created_at.isoformat() if om.created_at else None,
            })
            total_rep += (agent_rep or 0.0)
            total_bal += (agent_bal or 0.0)

        # Also include agents owned by human org members (implicit membership)
        existing_agent_ids = {m["agent_id"] for m in members if m["agent_id"]}
        human_ids_in_org = {m["human_id"] for m in members}
        if human_ids_in_org:
            owned_agents = await self.db.scalars(
                select(Agent).where(Agent.owner_id.in_(human_ids_in_org))
            )
            for a in owned_agents.all():
                if str(a.id) not in existing_agent_ids:
                    members.append({
                        "agent_id": str(a.id),
                        "human_id": str(a.owner_id),
                        "member_type": "agent",
                        "name": a.name,
                        "reputation_score": a.reputation or 0.0,
                        "role": "member",
                        "joined_at": a.created_at.isoformat() if a.created_at else None,
                    })
                    existing_agent_ids.add(str(a.id))
                    total_rep += a.reputation or 0.0
                    total_bal += a.balance or 0.0

        # Associated projects
        proj_rows = await self.db.scalars(
            select(Project).where(Project.organization_id == oid)
        )
        projects = [{"project_id": str(p.id), "name": p.name, "status": p.status} for p in proj_rows.all()]

        n_members = len(members)

        return {
            "org_id": str(org.id),
            "name": org.name,
            "description": org.description or "",
            "members": members,
            "projects": projects,
            "avg_reputation": total_rep / n_members if n_members > 0 else 0.0,
            "avg_token_balance": total_bal / n_members if n_members > 0 else 0.0,
            "created_at": org.created_at.isoformat() if org.created_at else None,
        }

    # ─── Leaderboard ───

    async def get_leaderboard(self, type: str = "reputation", page: int = 1,
                               page_size: int = 50, organization: str = "",
                               time_range: str = "all") -> dict:
        """积分排行"""
        page_size = min(page_size, 50)

        if type not in LEADERBOARD_TYPE_WHITELIST:
            type = "reputation"
        if time_range not in TIME_RANGE_WHITELIST:
            time_range = "all"

        query = select(Agent).where(Agent.status == "active")

        # Time range filter (based on created_at or last activity)
        if time_range == "month":
            cutoff = datetime.utcnow() - timedelta(days=30)
            query = query.where(Agent.created_at >= cutoff)
        elif time_range == "week":
            cutoff = datetime.utcnow() - timedelta(days=7)
            query = query.where(Agent.created_at >= cutoff)

        # Organization filter
        if organization:
            try:
                org_uuid = uuid.UUID(organization)
                org_members_sub = select(OrganizationMember.agent_id).where(
                    OrganizationMember.organization_id == org_uuid,
                    OrganizationMember.status == "active"
                ).subquery()
                query = query.where(Agent.id.in_(select(org_members_sub.c.agent_id)))
            except ValueError:
                # Could be org name - find org first
                org = await self.db.scalar(
                    select(Organization.id).where(Organization.name.ilike(f"%{organization}%")).limit(1)
                )
                if org:
                    org_members_sub = select(OrganizationMember.agent_id).where(
                        OrganizationMember.organization_id == org,
                        OrganizationMember.status == "active"
                    ).subquery()
                    query = query.where(Agent.id.in_(select(org_members_sub.c.agent_id)))

        # Sort by type
        if type == "reputation":
            query = query.order_by(desc(Agent.reputation))
        elif type == "token":
            query = query.order_by(desc(Agent.balance))
        else:  # combined: reputation * 0.6 + balance * 0.4
            # Use a computed column for combined score
            combined_score = (Agent.reputation * 0.6 + Agent.balance * 0.4)
            query = query.order_by(desc(combined_score))

        # Count
        count_q = select(func.count()).select_from(query.subquery())
        total = await self.db.scalar(count_q) or 0

        # Paginate
        result_q = query.offset((page - 1) * page_size).limit(page_size)
        rows = await self.db.scalars(result_q)
        agents = rows.all()

        rankings = []

        # Batch: org names for all ranked agents
        agent_ids = [a.id for a in agents]
        org_names_raw = await self.db.execute(
            select(OrganizationMember.agent_id, Organization.name) \
            .join(Organization, Organization.id == OrganizationMember.organization_id) \
            .where(OrganizationMember.agent_id.in_(agent_ids)) \
            .where(OrganizationMember.status == "active")
        )
        org_name_map = {str(row[0]): row[1] for row in org_names_raw.fetchall()}

        for rank_idx, a in enumerate(agents, start=(page - 1) * page_size + 1):
            aid = str(a.id)
            rankings.append({
                "rank": rank_idx,
                "agent_id": a.agent_id_str or aid,
                "name": a.name,
                "reputation_score": a.reputation or 0.0,
                "token_balance": a.balance or 0.0,
                "organization_name": org_name_map.get(aid),
                "trend": "+0.0",  # Phase1: track historical ranking changes
                "created_at": a.created_at.isoformat() if a.created_at else None,
            })

        return {
            "type": type,
            "total": total,
            "page": page,
            "page_size": page_size,
            "rankings": rankings,
        }

    async def get_leaderboard_summary(self) -> dict:
        """排行统计概览"""
        # Top reputation agent
        top_rep_agent = await self.db.scalar(
            select(Agent).where(Agent.status == "active").order_by(desc(Agent.reputation)).limit(1)
        )
        # Top token agent
        top_token_agent = await self.db.scalar(
            select(Agent).where(Agent.status == "active").order_by(desc(Agent.balance)).limit(1)
        )
        # Totals
        total_rep = await self.db.scalar(
            select(func.sum(Agent.reputation)).where(Agent.status == "active")
        ) or 0.0
        total_tokens = await self.db.scalar(
            select(func.sum(Agent.balance)).where(Agent.status == "active")
        ) or 0.0
        active_agents = await self.db.scalar(
            select(func.count(Agent.id)).where(Agent.status == "active")
        ) or 0
        orgs_count = await self.db.scalar(select(func.count(Organization.id))) or 0
        projects_count = await self.db.scalar(select(func.count(Project.id))) or 0

        return {
            "top_reputation": {
                "agent_id": top_rep_agent.agent_id_str or str(top_rep_agent.id) if top_rep_agent else None,
                "name": top_rep_agent.name if top_rep_agent else None,
                "score": float(top_rep_agent.reputation or 0.0) if top_rep_agent else 0.0,
            },
            "top_token": {
                "agent_id": top_token_agent.agent_id_str or str(top_token_agent.id) if top_token_agent else None,
                "name": top_token_agent.name if top_token_agent else None,
                "balance": float(top_token_agent.balance or 0.0) if top_token_agent else 0.0,
            },
            "total_reputation": float(total_rep),
            "total_tokens": float(total_tokens),
            "active_agents": active_agents,
            "organizations_count": orgs_count,
            "projects_count": projects_count,
        }
