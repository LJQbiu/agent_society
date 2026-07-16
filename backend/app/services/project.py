"""Project service - CRUD operations"""
import asyncio
import logging
import re
from sqlalchemy import select
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.project import Project, ProjectParticipant, ProjectChatMessage, ProjectTodo
from app.models.agent import Agent
from app.models.human import Human
from app.database import async_session
from app.services.bridge_router import chat_completion
from app.schemas.project import (
    ProjectCreate, ProjectUpdate, ProjectResponse,
    ProjectParticipantResponse, ProjectListResponse,
    ParticipantListResponse, JoinProjectRequest, StatusTransitionRequest,
    ChatMessageCreate, ChatMessageResponse, ChatMessageListResponse,
    TodoCreate, TodoUpdate, TodoClaimRequest, ProjectTodoResponse, TodoListResponse,
)
from uuid import UUID, uuid4
from app.services.ws_manager import manager
from sqlalchemy import func as sa_func

_logger = logging.getLogger(__name__)


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

    async def _get_participant_owners(self, project_id: UUID, status: str = "active") -> dict:
        """Batch lookup: get all active participant agents' owner_ids for a project.
        Replaces N+1 pattern with a single query."""
        p_result = await self.db.execute(
            select(ProjectParticipant.agent_id).where(
                ProjectParticipant.project_id == project_id,
                ProjectParticipant.status == status,
            )
        )
        agent_ids = [row[0] for row in p_result.fetchall()]
        if not agent_ids:
            return {}
        a_result = await self.db.execute(
            select(Agent.id, Agent.owner_id).where(Agent.id.in_(agent_ids))
        )
        return {str(a.id): str(a.owner_id) for a in a_result.fetchall() if a.owner_id}

    async def create_project(self, req: ProjectCreate, current_user) -> ProjectResponse:
        """Create project, auto-add creator agent as leader"""
        agent_id = await self._resolve_agent_id(current_user)

        project = Project(
            id=uuid4(),
            name=req.name,
            description=req.description,
            type=req.type,
            status=req.status,
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
                select(Agent.id, Agent.owner_id).where(Agent.id == agent_id)
            )
            row = agent_result.one_or_none()
            if row and row.owner_id:
                await manager.send_to_user(
                    str(row.owner_id),
                    {
                        "type": "project_created",
                        "data": {
                            "project_id": str(project.id),
                            "name": project.name,
                            "status": project.status,
                        }
                    }
                )
        except Exception as e:
            _logger.warning("WS push failed for project_created: %s", e)

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
        count_result = await self.db.execute(select(sa_func.count()).select_from(count_query.subquery()))
        total = count_result.scalar() or 0

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
            owner_map = await self._get_participant_owners(pid)
            for uid in owner_map.values():
                await manager.send_to_user(
                    uid,
                    {
                        "type": "project_updated",
                        "data": {
                            "project_id": str(pid),
                            "name": project.name,
                        }
                    }
                )
        except Exception as e:
            _logger.warning("WS push failed for project_updated: %s", e)

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
            owner_map = await self._get_participant_owners(pid)
            for uid in owner_map.values():
                await manager.send_to_user(
                    uid,
                    {
                        "type": "project_member_joined",
                        "data": {
                            "project_id": str(pid),
                            "agent_id": str(agent_id),
                        }
                    }
                )
        except Exception as e:
            _logger.warning("WS push failed for project_member_joined: %s", e)

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
            owner_map = await self._get_participant_owners(pid)
            for uid in owner_map.values():
                await manager.send_to_user(
                    uid,
                    {
                        "type": "project_status_change",
                        "data": {
                            "project_id": str(pid),
                            "new_status": req.new_status,
                            "previous_status": current,
                        }
                    }
                )
        except Exception as e:
            _logger.warning("WS push failed for project_status_change: %s", e)

        return ProjectResponse.model_validate(project)

    async def list_participants(self, project_id: str) -> ParticipantListResponse:
        """List project participants with agent names"""
        result = await self.db.execute(
            select(ProjectParticipant, Agent.name).join(
                Agent, Agent.id == ProjectParticipant.agent_id, isouter=True
            ).where(
                ProjectParticipant.project_id == UUID(project_id),
            )
        )
        rows = result.all()
        participants = []
        for participant, agent_name in rows:
            resp = ProjectParticipantResponse.model_validate(participant)
            resp.agent_name = agent_name or "Unknown"
            participants.append(resp)
        return ParticipantListResponse(
            participants=participants,
            total=len(participants),
        )

    # ---- Chat Message Methods ----

    async def list_project_a2a_messages(self, project_id: str, limit: int = 50, offset: int = 0) -> dict:
        """List A2A conversation messages between project participant agents
        (moved from raw SQL in router to service layer to avoid SQL injection)"""
        from uuid import UUID as UUIDType
        from app.models.a2a import Message

        pid = UUIDType(project_id)

        # 1. Get participant agent_ids, join with agents to get agent_id_str
        p_result = await self.db.execute(
            select(ProjectParticipant).where(ProjectParticipant.project_id == pid)
        )
        participants = p_result.scalars().all()
        if not participants:
            return {"messages": [], "total": 0}

        agent_ids = [p.agent_id for p in participants]
        a_result = await self.db.execute(
            select(Agent).where(Agent.id.in_(agent_ids))
        )
        agents = a_result.scalars().all()
        if not agents:
            return {"messages": [], "total": 0}

        agent_id_strs = [a.agent_id_str for a in agents]
        agent_names = {a.agent_id_str: a.name for a in agents}

        # 2. Query messages where BOTH from and to are project participants (using ORM, not raw SQL)
        msg_query = select(Message).where(
            Message.from_agent_id.in_(agent_id_strs),
            Message.to_agent_id.in_(agent_id_strs),
        ).order_by(Message.created_at.desc()).limit(limit).offset(offset)

        result = await self.db.execute(msg_query)
        messages = result.scalars().all()

        # 3. Get total count
        count_query = select(func.count()).select_from(
            select(Message).where(
                Message.from_agent_id.in_(agent_id_strs),
                Message.to_agent_id.in_(agent_id_strs),
            ).subquery()
        )
        total = await self.db.scalar(count_query) or 0

        # 4. Build response with agent names
        msg_list = []
        for m in messages:
            content = m.content or {}
            text_content = content.get("text", "") if isinstance(content, dict) else str(content)
            msg_list.append({
                "message_id": str(m.id),
                "from_agent_id": m.from_agent_id,
                "from_agent_name": agent_names.get(m.from_agent_id, m.from_agent_id),
                "to_agent_id": m.to_agent_id,
                "to_agent_name": agent_names.get(m.to_agent_id, m.to_agent_id),
                "message_type": m.message_type,
                "content": content,
                "text": text_content,
                "priority": m.priority,
                "status": m.status,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            })

        return {"messages": msg_list, "total": total}

    async def send_chat_message(self, project_id: str, req: ChatMessageCreate, current_user) -> ChatMessageResponse:
        """Send a chat message in project (human or agent)"""
        pid = UUID(project_id)
        
        # Verify project exists
        result = await self.db.execute(select(Project).where(Project.id == pid))
        project = result.scalar_one_or_none()
        if not project:
            raise ValueError("Project not found")

        sender_id = None
        sender_name = None

        if req.sender_type == "human":
            # Human user - use their ID and username
            if current_user.user_type != "human":
                raise ValueError("Only human users can send messages as human")
            sender_id = UUID(current_user.sub)
            # Fetch human name
            human_result = await self.db.execute(select(Human).where(Human.id == sender_id))
            human_obj = human_result.scalar_one_or_none()
            sender_name = human_obj.username if human_obj else "Human"
        elif req.sender_type == "agent":
            # Agent user - use resolved agent_id
            sender_id = await self._resolve_agent_id(current_user)
            agent_result = await self.db.execute(select(Agent).where(Agent.id == sender_id))
            agent_obj = agent_result.scalar_one_or_none()
            sender_name = agent_obj.name if agent_obj else "Agent"
        else:
            raise ValueError(f"Invalid sender_type: {req.sender_type}")

        # Verify sender is a project participant (or human owner of participant)
        if req.sender_type == "agent":
            p_result = await self.db.execute(
                select(ProjectParticipant).where(
                    ProjectParticipant.project_id == pid,
                    ProjectParticipant.agent_id == sender_id,
                    ProjectParticipant.status == "active",
                )
            )
            if not p_result.scalar_one_or_none():
                raise ValueError("Only active participants can send messages")
        elif req.sender_type == "human":
            # Human must own at least one agent in the project
            agent_result = await self.db.execute(
                select(Agent).where(Agent.owner_id == sender_id)
            )
            agents = agent_result.scalars().all()
            agent_ids = [a.id for a in agents]
            if not agent_ids:
                raise ValueError("Human must have an agent in the project to chat")
            p_result = await self.db.execute(
                select(ProjectParticipant).where(
                    ProjectParticipant.project_id == pid,
                    ProjectParticipant.agent_id.in_(agent_ids),
                    ProjectParticipant.status == "active",
                )
            )
            if not p_result.scalars().first():
                raise ValueError("Human must have an active agent participant to chat")

        message = ProjectChatMessage(
            id=uuid4(),
            project_id=pid,
            sender_type=req.sender_type,
            sender_id=str(sender_id),
            sender_name=sender_name,
            content=req.content,
        )
        self.db.add(message)
        await self.db.commit()
        await self.db.refresh(message)

        # WebSocket push: notify all participants about new chat message
        try:
            owner_map = await self._get_participant_owners(pid)
            for uid in owner_map.values():
                await manager.send_to_user(
                    uid,
                    {
                        "type": "project_chat_message",
                        "data": {
                            "project_id": str(pid),
                            "sender_name": sender_name,
                            "content": req.content,
                        }
                    }
                )
        except Exception as e:
            _logger.warning("WS push failed for project_chat_message: %s", e)

        # Trigger multi-agent auto-reply dialogue (background task)
        if req.sender_type == "human":
            asyncio.create_task(_trigger_multi_agent_dialogue(str(pid)))

        return ChatMessageResponse.model_validate(message)

    async def list_chat_messages(self, project_id: str, limit: int = 50, offset: int = 0) -> ChatMessageListResponse:
        """List chat messages for a project - returns newest messages first (then reversed for display)"""
        # Count total
        from sqlalchemy import func
        total_result = await self.db.execute(
            select(func.count()).select_from(ProjectChatMessage).where(
                ProjectChatMessage.project_id == UUID(project_id),
            )
        )
        total = total_result.scalar() or 0

        # Fetch newest messages (desc order), then reverse for chronological display
        result = await self.db.execute(
            select(ProjectChatMessage).where(
                ProjectChatMessage.project_id == UUID(project_id),
            ).order_by(ProjectChatMessage.created_at.desc()).limit(limit).offset(offset)
        )
        messages = list(reversed(result.scalars().all()))

        return ChatMessageListResponse(
            messages=[ChatMessageResponse.model_validate(m) for m in messages],
            total=total,
        )

    # ---- Project TODO Methods ----

    async def create_todo(self, project_id: str, req: TodoCreate, current_user) -> ProjectTodoResponse:
        """Create a TODO - only leader can create"""
        pid = UUID(project_id)
        if not await self._is_leader_or_owner(pid, current_user):
            raise ValueError("Only the project leader can create TODOs")

        agent_id = await self._resolve_agent_id(current_user)

        todo = ProjectTodo(
            id=uuid4(),
            project_id=pid,
            title=req.title,
            description=req.description,
            priority=req.priority,
            status="open",
            created_by=agent_id,
        )
        self.db.add(todo)
        await self.db.commit()
        await self.db.refresh(todo)

        # WebSocket push: notify all participants about new TODO
        try:
            owner_map = await self._get_participant_owners(pid)
            for uid in owner_map.values():
                await manager.send_to_user(
                    uid,
                    {
                        "type": "project_todo_created",
                        "data": {
                            "project_id": str(pid),
                            "todo_id": str(todo.id),
                            "title": todo.title,
                            "priority": todo.priority,
                        }
                    }
                )
        except Exception as e:
            _logger.warning("WS push failed for project_todo_created: %s", e)

        return ProjectTodoResponse.model_validate(todo)

    async def list_todos(self, project_id: str) -> TodoListResponse:
        """List TODOs for a project with claimer names"""
        result = await self.db.execute(
            select(ProjectTodo, Agent.name).join(
                Agent, Agent.id == ProjectTodo.claimed_by, isouter=True
            ).where(
                ProjectTodo.project_id == UUID(project_id),
            ).order_by(ProjectTodo.created_at)
        )
        rows = result.all()
        todos = []
        for todo, claimer_name in rows:
            resp = ProjectTodoResponse.model_validate(todo)
            resp.claimed_by_name = claimer_name
            todos.append(resp)
        return TodoListResponse(todos=todos, total=len(todos))

    async def update_todo(self, project_id: str, todo_id: str, req: TodoUpdate, current_user) -> ProjectTodoResponse:
        """Update a TODO - leader or claimer can update"""
        pid = UUID(project_id)
        tid = UUID(todo_id)

        result = await self.db.execute(
            select(ProjectTodo).where(ProjectTodo.id == tid, ProjectTodo.project_id == pid)
        )
        todo = result.scalar_one_or_none()
        if not todo:
            raise ValueError("TODO not found")

        # Leader can always update; claimer can update status only
        is_leader = await self._is_leader_or_owner(pid, current_user)
        if not is_leader:
            agent_id = await self._resolve_agent_id(current_user)
            if todo.claimed_by != agent_id:
                raise ValueError("Only the leader or the claimer can update this TODO")

        update_data = req.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(todo, key, value)

        await self.db.commit()
        await self.db.refresh(todo)

        resp = ProjectTodoResponse.model_validate(todo)
        # Fetch claimer name if claimed
        if todo.claimed_by:
            claimer_result = await self.db.execute(select(Agent).where(Agent.id == todo.claimed_by))
            claimer = claimer_result.scalar_one_or_none()
            resp.claimed_by_name = claimer.name if claimer else None

        return resp

    async def delete_todo(self, project_id: str, todo_id: str, current_user) -> dict:
        """Delete a TODO - only leader can delete"""
        pid = UUID(project_id)
        tid = UUID(todo_id)

        result = await self.db.execute(
            select(ProjectTodo).where(ProjectTodo.id == tid, ProjectTodo.project_id == pid)
        )
        todo = result.scalar_one_or_none()
        if not todo:
            raise ValueError("TODO not found")

        is_leader = await self._is_leader_or_owner(pid, current_user)
        if not is_leader:
            raise ValueError("Only the project leader can delete a TODO")

        await self.db.delete(todo)
        await self.db.commit()
        return {"ok": True, "message": "TODO deleted"}

    async def claim_todo(self, project_id: str, todo_id: str, req: TodoClaimRequest, current_user) -> ProjectTodoResponse:
        """Claim a TODO - any active participant can claim an open TODO"""
        pid = UUID(project_id)
        tid = UUID(todo_id)

        result = await self.db.execute(
            select(ProjectTodo).where(ProjectTodo.id == tid, ProjectTodo.project_id == pid)
        )
        todo = result.scalar_one_or_none()
        if not todo:
            raise ValueError("TODO not found")

        if todo.status != "open":
            raise ValueError(f"Cannot claim TODO with status '{todo.status}'")

        # Verify claiming agent is an active participant and caller owns it
        agent_id = req.agent_id
        if current_user.user_type == "human":
            agent_verify = await self.db.execute(
                select(Agent.id).where(Agent.id == agent_id, Agent.owner_id == UUID(current_user.sub))
            )
            if not agent_verify.scalar_one_or_none():
                raise ValueError("You can only claim TODOs with your own agent")
        elif current_user.user_type == "agent":
            resolved = await self._resolve_agent_id(current_user)
            if agent_id != resolved:
                raise ValueError("You can only claim TODOs for yourself")

        p_result = await self.db.execute(
            select(ProjectParticipant).where(
                ProjectParticipant.project_id == pid,
                ProjectParticipant.agent_id == agent_id,
                ProjectParticipant.status == "active",
            )
        )
        if not p_result.scalar_one_or_none():
            raise ValueError("Agent must be an active participant to claim a TODO")

        todo.claimed_by = agent_id
        todo.status = "claimed"
        from datetime import datetime as dt
        todo.claimed_at = dt.utcnow()

        await self.db.commit()
        await self.db.refresh(todo)

        resp = ProjectTodoResponse.model_validate(todo)
        claimer_result = await self.db.execute(select(Agent).where(Agent.id == agent_id))
        claimer = claimer_result.scalar_one_or_none()
        resp.claimed_by_name = claimer.name if claimer else None

        # WebSocket push: notify all participants about TODO claimed
        try:
            owner_map = await self._get_participant_owners(pid)
            for uid in owner_map.values():
                await manager.send_to_user(
                    uid,
                    {
                        "type": "project_todo_claimed",
                        "data": {
                            "project_id": str(pid),
                            "todo_id": str(tid),
                            "claimed_by_name": resp.claimed_by_name,
                        }
                    }
                )
        except Exception as e:
            _logger.warning("WS push failed for project_todo_claimed: %s", e)

        return resp



# ─── Multi-Agent Auto-Reply Dialogue ───
_running_dialogues: set[str] = set()  # debounce: prevent overlapping tasks
_agent_last_seen: dict[str, dict[str, datetime]] = {}  # {project_id: {agent_id_str: last_seen_datetime}}

async def _trigger_multi_agent_dialogue(project_id: str, rounds: int = 3):
    """Background task: agents auto-reply with incremental message passing.
    
    Key change: Platform only sends incremental messages (since agent's last reply)
    + project_id. Each bridge maintains its own session history internally.
    """
    # Debounce: skip if dialogue already running for this project
    if project_id in _running_dialogues:
        _logger.info(f"Dialogue already running for project {project_id}, skipping")
        return
    _running_dialogues.add(project_id)
    try:
        async with async_session() as db:
            # Get project info
            proj_result = await db.execute(
                select(Project).where(Project.id == UUID(project_id))
            )
            project = proj_result.scalars().first()
            if not project:
                return

            # Get all active participants
            p_result = await db.execute(
                select(ProjectParticipant).where(
                    ProjectParticipant.project_id == UUID(project_id),
                    ProjectParticipant.status == "active",
                )
            )
            participants = p_result.scalars().all()
            if not participants:
                return

            # Get agent details for each participant
            agent_ids = [p.agent_id for p in participants]
            a_result = await db.execute(
                select(Agent).where(Agent.id.in_(agent_ids))
            )
            agents = a_result.scalars().all()
            if not agents:
                return

            # Initialize last_seen tracking for this project if needed
            if project_id not in _agent_last_seen:
                _agent_last_seen[project_id] = {}
            proj_last_seen = _agent_last_seen[project_id]

            # Multi-round dialogue
            agent_list = list(agents)
            for round_num in range(rounds):
                for agent in agent_list:
                    # ── Build incremental messages for this agent ──
                    # Get all messages since this agent's last_seen timestamp
                    last_seen_dt = proj_last_seen.get(agent.agent_id_str)
                    
                    if last_seen_dt:
                        # Fetch messages newer than last_seen
                        chat_result = await db.execute(
                            select(ProjectChatMessage).where(
                                ProjectChatMessage.project_id == UUID(project_id),
                                ProjectChatMessage.created_at > last_seen_dt,
                            ).order_by(ProjectChatMessage.created_at.asc())
                        )
                    else:
                        # First time this agent speaks — give it recent context (last 5 messages)
                        chat_result = await db.execute(
                            select(ProjectChatMessage).where(
                                ProjectChatMessage.project_id == UUID(project_id),
                            ).order_by(ProjectChatMessage.created_at.desc()).limit(5)
                        )
                    
                    incremental_msgs = chat_result.scalars().all()
                    if not incremental_msgs:
                        # No new messages — skip this agent this round
                        continue
                    
                    # Convert to bridge format (incremental messages with sender info)
                    bridge_messages = []
                    for msg in incremental_msgs:
                        bridge_messages.append({
                            "role": "user" if msg.sender_type != "agent" or msg.sender_id != agent.agent_id_str else "assistant",
                            "content": msg.content,
                            "sender_name": msg.sender_name,
                        })
                    
                    # Add turn prompt
                    bridge_messages.append({
                        "role": "user",
                        "content": f"现在轮到你（{agent.name}）发言，请回应上述讨论。",
                        "sender_name": "system",
                    })

                    # Call bridge with incremental messages + project_id
                    try:
                        reply_text = await chat_completion(
                            messages=bridge_messages,
                            agent_id=agent.agent_id_str,
                            project_id=project_id,
                        )
                    except Exception as e:
                        _logger.error(f"Bridge call failed for {agent.name}: {e}")
                        reply_text = f"[{agent.name}暂时无法回复]"

                    # Strip any self-referencing prefix
                    reply_text = re.sub(rf'^\[{agent.name}\]\s*:\s*', '', reply_text)
                    reply_text = re.sub(rf'^{agent.name}\s*:\s*', '', reply_text)

                    # Save agent's response as chat message
                    now_dt = datetime.now(timezone.utc)
                    chat_msg = ProjectChatMessage(
                        id=uuid4(),
                        project_id=UUID(project_id),
                        sender_type="agent",
                        sender_id=agent.agent_id_str,
                        sender_name=agent.name,
                        content=reply_text,
                        created_at=now_dt,
                    )
                    db.add(chat_msg)
                    await db.commit()
                    await db.refresh(chat_msg)

                    # Update this agent's last_seen
                    proj_last_seen[agent.agent_id_str] = chat_msg.created_at

                    # Push via WebSocket to all project participants
                    try:
                        all_p_result = await db.execute(
                            select(Agent.id, Agent.owner_id).where(Agent.id.in_(agent_ids))
                        )
                        owner_map = {str(a.id): str(a.owner_id) for a in all_p_result.fetchall() if a.owner_id}
                        for uid in owner_map.values():
                            await manager.send_to_user(
                                uid,
                                {
                                    "type": "project_chat_message",
                                    "data": {
                                        "project_id": project_id,
                                        "sender_name": agent.name,
                                        "sender_type": "agent",
                                        "content": reply_text,
                                    }
                                }
                            )
                    except Exception as e:
                        _logger.warning("WS push failed in dialogue: %s", e)

                    # Delay between agent responses
                    await asyncio.sleep(2)

            _logger.info(f"Multi-agent dialogue completed for project {project_id}: {rounds} rounds")

    except Exception as e:
        _logger.error(f"Multi-agent dialogue failed for project {project_id}: {e}")
    finally:
        _running_dialogues.discard(project_id)
