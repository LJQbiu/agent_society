"""Project service - CRUD operations"""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.project import Project, ProjectParticipant
from app.models.agent import Agent
from app.schemas.project import (
    ProjectCreate, ProjectUpdate, ProjectResponse,
    ProjectParticipantResponse, ProjectListResponse,
    ParticipantListResponse, JoinProjectRequest, StatusTransitionRequest,
)
from uuid import UUID, uuid4
from app.services.ws_manager import manager


class ProjectService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _resolve_agent_id(self, current_user) -> UUID:
        """Resolve agent_id from TokenPayload.
        If caller is human, use their first agent.
        If caller is agent, use the agent directly.
        """
        if current_user.user_type == "human":
            result = await self.db.execute(
                select(Agent).where(Agent.owner_id == UUID(current_user.sub)).limit(1)
            )
            agent = result.scalar_one_or_none()
            if not agent:
                raise ValueError("Human user must have at least one agent to act on projects")
            return agent.id
        elif current_user.user_type == "agent":
            result = await self.db.execute(
                select(Agent).where(Agent.id == UUID(current_user.sub))
            )
            agent = result.scalar_one_or_none()
            if not agent:
                raise ValueError("Agent not found")
            return agent.id
        else:
            raise ValueError("Invalid user type")

    async def _is_leader_or_owner(self, project_id: UUID, current_user) -> bool:
        """Check if caller is project leader agent, or human owner of the leader agent."""
        agent_id = await self._resolve_agent_id(current_user)
        # Direct check: is the resolved agent the leader?
        result = await self.db.execute(
            select(ProjectParticipant).where(
                ProjectParticipant.project_id == project_id,
                ProjectParticipant.agent_id == agent_id,
                ProjectParticipant.role == "leader",
            )
        )
        if result.scalar_one_or_none():
            return True
        # If human, check if they own the leader agent
        if current_user.user_type == "human":
            leader_result = await self.db.execute(
                select(ProjectParticipant).where(
                    ProjectParticipant.project_id == project_id,
                    ProjectParticipant.role == "leader",
                )
            )
            leader_participant = leader_result.scalar_one_or_none()
            if leader_participant:
                agent_result = await self.db.execute(
                    select(Agent).where(Agent.id == leader_participant.agent_id)
                )
                leader_agent = agent_result.scalar_one_or_none()
                if leader_agent and str(leader_agent.owner_id) == current_user.sub:
                    return True
        return False

    async def create_project(self, req: ProjectCreate, current_user) -> ProjectResponse:
        """Create project, auto-add creator agent as leader"""
        agent_id = await self._resolve_agent_id(current_user)

        project = Project(
            id=uuid4(),
            name=req.name,
            description=req.description,
            type=req.type,
            status="recruiting",
            budget=req.budget,
            reputation_budget=req.reputation_budget,
            required_capabilities=req.required_capabilities,
            max_participants=req.max_participants,
            creator_id=agent_id,
            organization_id=req.organization_id,
        )
        self.db.add(project)

        participant = ProjectParticipant(
            id=uuid4(),
            project_id=project.id,
            agent_id=agent_id,
            role="leader",
            status="active",
            contribution_score=0.0,
        )
        self.db.add(participant)

        await self.db.commit()
        await self.db.refresh(project)

        # WebSocket push: notify creator about new project
        try:
            # Resolve the human owner of the creator agent
            agent_result = await self.db.execute(
                select(Agent).where(Agent.id == agent_id)
            )
            agent_obj = agent_result.scalar_one_or_none()
            if agent_obj and agent_obj.owner_id:
                await manager.send_to_user(
                    str(agent_obj.owner_id),
                    {
                        "type": "project_created",
                        "data": {
                            "project_id": str(project.id),
                            "name": project.name,
                            "status": project.status,
                        }
                    }
                )
        except Exception:
            pass

        return ProjectResponse.model_validate(project)

    async def get_project(self, project_id: str) -> ProjectResponse:
        """Get project by ID"""
        result = await self.db.execute(
            select(Project).where(Project.id == UUID(project_id))
        )
        project = result.scalar_one_or_none()
        if not project:
            raise ValueError("Project not found")
        return ProjectResponse.model_validate(project)

    async def list_projects(self, limit: int = 20, offset: int = 0, status: str = None, owner_id: str = None) -> ProjectListResponse:
        """List projects with optional status/owner_id filter"""
        query = select(Project).offset(offset).limit(limit)
        if status:
            query = query.where(Project.status == status)
        if owner_id:
            # Filter projects where creator agent belongs to this human owner
            query = query.join(Agent, Project.creator_id == Agent.id).where(Agent.owner_id == UUID(owner_id))

        result = await self.db.execute(query)
        projects = result.scalars().all()

        count_query = select(Project)
        if status:
            count_query = count_query.where(Project.status == status)
        if owner_id:
            count_query = count_query.join(Agent, Project.creator_id == Agent.id).where(Agent.owner_id == UUID(owner_id))
        count_result = await self.db.execute(count_query)
        total = len(count_result.scalars().all())

        return ProjectListResponse(
            projects=[ProjectResponse.model_validate(p) for p in projects],
            total=total,
            limit=limit,
            offset=offset,
        )

    async def update_project(self, project_id: str, req: ProjectUpdate, current_user) -> ProjectResponse:
        """Update project - only leader (or human owner of leader) can update"""
        pid = UUID(project_id)
        if not await self._is_leader_or_owner(pid, current_user):
            raise ValueError("Only the project leader (or their human owner) can update the project")

        result = await self.db.execute(select(Project).where(Project.id == pid))
        project = result.scalar_one_or_none()
        if not project:
            raise ValueError("Project not found")

        update_data = req.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(project, key, value)

        await self.db.commit()
        await self.db.refresh(project)

        # WebSocket push: notify all active participants about project update
        try:
            participants_result = await self.db.execute(
                select(ProjectParticipant).where(
                    ProjectParticipant.project_id == pid,
                    ProjectParticipant.status == "active",
                )
            )
            participants = participants_result.scalars().all()
            for p in participants:
                agent_result = await self.db.execute(
                    select(Agent).where(Agent.id == p.agent_id)
                )
                agent_obj = agent_result.scalar_one_or_none()
                if agent_obj and agent_obj.owner_id:
                    await manager.send_to_user(
                        str(agent_obj.owner_id),
                        {
                            "type": "project_updated",
                            "data": {
                                "project_id": str(pid),
                                "name": project.name,
                            }
                        }
                    )
        except Exception:
            pass

        return ProjectResponse.model_validate(project)

    async def join_project(self, project_id: str, req: JoinProjectRequest, current_user) -> ProjectParticipantResponse:
        """Agent joins a project"""
        agent_id = await self._resolve_agent_id(current_user)
        # If request specifies a specific agent_id and caller is human owner of that agent
        if req.agent_id:
            if current_user.user_type == "human":
                # Verify the specified agent belongs to this human
                agent_result = await self.db.execute(
                    select(Agent).where(Agent.id == UUID(str(req.agent_id)))
                )
                agent = agent_result.scalar_one_or_none()
                if not agent or str(agent.owner_id) != current_user.sub:
                    raise ValueError("You can only join with your own agents")
                agent_id = UUID(str(req.agent_id))
            else:
                raise ValueError("Agents cannot specify another agent_id")

        pid = UUID(project_id)

        # Verify project exists and is recruiting
        result = await self.db.execute(select(Project).where(Project.id == pid))
        project = result.scalar_one_or_none()
        if not project:
            raise ValueError("Project not found")
        if project.status != "recruiting":
            raise ValueError("Project is not recruiting")

        # Check not already a participant
        existing = await self.db.execute(
            select(ProjectParticipant).where(
                ProjectParticipant.project_id == pid,
                ProjectParticipant.agent_id == agent_id,
            )
        )
        if existing.scalar_one_or_none():
            raise ValueError("Already a participant of this project")

        # Check max participants
        count_result = await self.db.execute(
            select(ProjectParticipant).where(
                ProjectParticipant.project_id == pid,
                ProjectParticipant.status == "active",
            )
        )
        active_count = len(count_result.scalars().all())
        if active_count >= project.max_participants:
            raise ValueError("Project has reached max participants")

        participant = ProjectParticipant(
            id=uuid4(),
            project_id=pid,
            agent_id=agent_id,
            role="member",
            status="active",
            contribution_score=0.0,
        )
        self.db.add(participant)
        await self.db.commit()
        await self.db.refresh(participant)

        # WebSocket push: notify all participants about new member joining
        try:
            participants_result = await self.db.execute(
                select(ProjectParticipant).where(
                    ProjectParticipant.project_id == pid,
                    ProjectParticipant.status == "active",
                )
            )
            participants = participants_result.scalars().all()
            for p in participants:
                agent_result = await self.db.execute(
                    select(Agent).where(Agent.id == p.agent_id)
                )
                agent_obj = agent_result.scalar_one_or_none()
                if agent_obj and agent_obj.owner_id:
                    await manager.send_to_user(
                        str(agent_obj.owner_id),
                        {
                            "type": "project_member_joined",
                            "data": {
                                "project_id": str(pid),
                                "agent_id": str(agent_id),
                            }
                        }
                    )
        except Exception:
            pass

        return ProjectParticipantResponse.model_validate(participant)

    async def leave_project(self, project_id: str, current_user) -> dict:
        """Agent leaves a project"""
        agent_id = await self._resolve_agent_id(current_user)
        result = await self.db.execute(
            select(ProjectParticipant).where(
                ProjectParticipant.project_id == UUID(project_id),
                ProjectParticipant.agent_id == agent_id,
                ProjectParticipant.status == "active",
            )
        )
        participant = result.scalar_one_or_none()
        if not participant:
            raise ValueError("Not an active participant of this project")

        if participant.role == "leader":
            raise ValueError("Leader cannot leave; must transfer leadership or dissolve project")

        participant.status = "left"
        await self.db.commit()
        return {"message": "Left project successfully"}

    async def transition_status(self, project_id: str, req: StatusTransitionRequest, current_user) -> ProjectResponse:
        """Transition project status"""
        pid = UUID(project_id)
        if not await self._is_leader_or_owner(pid, current_user):
            raise ValueError("Only the project leader can change project status")

        result = await self.db.execute(select(Project).where(Project.id == pid))
        project = result.scalar_one_or_none()
        if not project:
            raise ValueError("Project not found")

        valid_transitions = {
            "recruiting": ["active", "revoked"],
            "active": ["suspended", "completed", "revoked"],
            "suspended": ["active", "revoked"],
        }
        current = project.status
        allowed = valid_transitions.get(current, [])
        if req.new_status not in allowed:
            raise ValueError(f"Cannot transition from {current} to {req.new_status}")

        project.status = req.new_status
        await self.db.commit()
        await self.db.refresh(project)

        # WebSocket push: notify all participants about status change
        try:
            participants_result = await self.db.execute(
                select(ProjectParticipant).where(
                    ProjectParticipant.project_id == pid,
                    ProjectParticipant.status == "active",
                )
            )
            participants = participants_result.scalars().all()
            for p in participants:
                agent_result = await self.db.execute(
                    select(Agent).where(Agent.id == p.agent_id)
                )
                agent_obj = agent_result.scalar_one_or_none()
                if agent_obj and agent_obj.owner_id:
                    await manager.send_to_user(
                        str(agent_obj.owner_id),
                        {
                            "type": "project_status_change",
                            "data": {
                                "project_id": str(pid),
                                "new_status": req.new_status,
                                "previous_status": current,
                            }
                        }
                    )
        except Exception:
            pass

        return ProjectResponse.model_validate(project)

    async def list_participants(self, project_id: str) -> ParticipantListResponse:
        """List project participants"""
        result = await self.db.execute(
            select(ProjectParticipant).where(
                ProjectParticipant.project_id == UUID(project_id),
            )
        )
        participants = result.scalars().all()
        return ParticipantListResponse(
            participants=[ProjectParticipantResponse.model_validate(p) for p in participants],
            total=len(participants),
        )
