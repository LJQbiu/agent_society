"""Organization service - CRUD operations"""
from sqlalchemy import select, update, delete
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.organization import Organization, OrganizationMember
from app.models.human import Human
from app.models.agent import Agent
from app.schemas.organization import (
    OrganizationCreate, OrganizationUpdate,
    OrganizationResponse, OrganizationMemberResponse,
    OrganizationListResponse, MemberListResponse, JoinRequest,
)
from uuid import UUID
from typing import Optional
from app.services.ws_manager import manager

class OrganizationService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_organization(self, req: OrganizationCreate, creator_id: str) -> Organization:
        """创建组织"""
        # Check name uniqueness
        existing = await self.db.execute(
            select(Organization).where(Organization.name == req.name)
        )
        if existing.scalar_one_or_none():
            raise ValueError(f"Organization name '{req.name}' already exists")

        org = Organization(
            name=req.name,
            description=req.description,
            org_type=req.org_type,
            governance_model=req.governance_model,
            charter=req.charter or {},
            creator_id=UUID(creator_id),
            reputation=50.0,
            balance=0.0,
        )
        self.db.add(org)
        try:
            await self.db.flush()
        except IntegrityError:
            await self.db.rollback()
            raise ValueError(f"Organization name '{req.name}' already exists (concurrent creation)")
        await self.db.refresh(org)

        # Creator becomes leader automatically
        member = OrganizationMember(
            organization_id=org.id,
            human_id=UUID(creator_id),
            role="leader",
            status="active",
        )
        self.db.add(member)
        await self.db.flush()
        return org

    async def get_organization(self, org_id: str) -> Organization:
        """获取组织详情"""
        result = await self.db.execute(
            select(Organization).where(Organization.id == UUID(org_id))
        )
        org = result.scalar_one_or_none()
        if not org:
            raise ValueError(f"Organization {org_id} not found")
        return org

    async def list_organizations(self, limit: int = 20, offset: int = 0) -> OrganizationListResponse:
        """列出组织"""
        result = await self.db.execute(
            select(Organization).offset(offset).limit(limit).order_by(Organization.created_at.desc())
        )
        orgs = result.scalars().all()
        count_result = await self.db.execute(select(Organization))
        total = len(count_result.scalars().all())
        return OrganizationListResponse(
            organizations=[OrganizationResponse.model_validate(o) for o in orgs],
            total=total, limit=limit, offset=offset,
        )

    async def update_organization(self, org_id: str, req: OrganizationUpdate, caller_id: str) -> Organization:
        """更新组织(仅leader)"""
        org = await self.get_organization(org_id)
        # Permission check: must be leader
        member_result = await self.db.execute(
            select(OrganizationMember).where(
                OrganizationMember.organization_id == UUID(org_id),
                OrganizationMember.human_id == UUID(caller_id),
                OrganizationMember.role == "leader",
            )
        )
        if not member_result.scalar_one_or_none():
            raise ValueError("Only the organization leader can update the organization")

        # Apply updates
        for field, value in req.model_dump(exclude_unset=True).items():
            setattr(org, field, value)
        await self.db.flush()
        await self.db.refresh(org)
        return org

    async def join_organization(self, org_id: str, req: JoinRequest, caller_id: str) -> OrganizationMember:
        """加入组织"""
        org = await self.get_organization(org_id)
        if org.status != "active":
            raise ValueError("Organization is not active")

        # Check if already a member
        existing = await self.db.execute(
            select(OrganizationMember).where(
                OrganizationMember.organization_id == UUID(org_id),
                OrganizationMember.human_id == UUID(caller_id),
            )
        )
        if existing.scalar_one_or_none():
            raise ValueError("Already a member or applicant of this organization")

        member = OrganizationMember(
            organization_id=UUID(org_id),
            human_id=UUID(caller_id),
            agent_id=req.agent_id,
            role="member",
            status="active",
        )
        self.db.add(member)
        await self.db.flush()
        await self.db.refresh(member)

        # WebSocket push: notify user about org membership
        try:
            await manager.send_to_user(
                caller_id,
                {
                    "type": "org_update",
                    "data": {
                        "org_id": str(member.organization_id),
                        "agent_id": str(member.agent_id),
                        "role": member.role,
                        "status": member.status,
                    }
                }
            )
        except Exception:
            pass
        return member

    async def list_members(self, org_id: str) -> MemberListResponse:
        """列出组织成员"""
        await self.get_organization(org_id)  # verify org exists
        result = await self.db.execute(
            select(OrganizationMember).where(
                OrganizationMember.organization_id == UUID(org_id),
            )
        )
        members = result.scalars().all()
        return MemberListResponse(
            members=[OrganizationMemberResponse.model_validate(m) for m in members],
            total=len(members),
        )
