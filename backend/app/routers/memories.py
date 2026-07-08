"""Agent记忆API — 跨会话持久化知识存储的CRUD + bridge检索端点"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from sqlalchemy.dialects.postgresql import JSONB
from app.database import get_db
from app.models.memory import AgentMemory
from app.models.agent import Agent
from pydantic import BaseModel, Field, ConfigDict
from uuid import UUID
from typing import Optional
from datetime import datetime


router = APIRouter(prefix="/memories", tags=["memories"])


# ═══════════════════════════════════════════════════════
# Pydantic Schemas
# ═══════════════════════════════════════════════════════

class MemoryCreate(BaseModel):
    agent_id: str
    project_id: Optional[str] = None
    category: str = Field(default="insight", pattern="^(core|insight|preference)$")
    content: str
    tags: list[str] = Field(default_factory=list)
    importance: int = Field(default=5, ge=1, le=10)
    source_session_id: Optional[str] = None


class MemoryUpdate(BaseModel):
    content: Optional[str] = None
    category: Optional[str] = Field(default=None, pattern="^(core|insight|preference)$")
    tags: Optional[list[str]] = None
    importance: Optional[int] = Field(default=None, ge=1, le=10)


class MemoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    agent_id: UUID
    project_id: Optional[UUID] = None
    category: str
    content: str
    tags: list[str]
    importance: int
    source_session_id: Optional[str]
    created_at: datetime
    updated_at: datetime


# ═══════════════════════════════════════════════════════
# CRUD Endpoints
# ═══════════════════════════════════════════════════════

@router.get("/agents/{agent_id}", response_model=list[MemoryOut])
async def list_memories(
    agent_id: str,
    category: Optional[str] = Query(default=None, pattern="^(core|insight|preference)$"),
    project_id: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """列出Agent的所有记忆，可选按category/project_id筛选"""
    stmt = select(AgentMemory).where(AgentMemory.agent_id == agent_id)
    if category:
        stmt = stmt.where(AgentMemory.category == category)
    if project_id:
        stmt = stmt.where(AgentMemory.project_id == project_id)
    stmt = stmt.order_by(AgentMemory.importance.desc(), AgentMemory.created_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/", response_model=MemoryOut, status_code=201)
async def create_memory(mem: MemoryCreate, db: AsyncSession = Depends(get_db)):
    """创建一条Agent记忆"""
    # Verify agent exists
    agent = await db.execute(select(Agent).where(Agent.id == mem.agent_id))
    if not agent.scalar_one_or_none():
        raise HTTPException(404, f"Agent {mem.agent_id} not found")
    
    memory = AgentMemory(
        agent_id=mem.agent_id,
        project_id=mem.project_id,
        category=mem.category,
        content=mem.content,
        tags=mem.tags,
        importance=mem.importance,
        source_session_id=mem.source_session_id,
    )
    db.add(memory)
    await db.flush()
    await db.refresh(memory)
    return memory


@router.put("/{memory_id}", response_model=MemoryOut)
async def update_memory(memory_id: str, update: MemoryUpdate, db: AsyncSession = Depends(get_db)):
    """更新一条记忆"""
    result = await db.execute(select(AgentMemory).where(AgentMemory.id == memory_id))
    memory = result.scalar_one_or_none()
    if not memory:
        raise HTTPException(404, f"Memory {memory_id} not found")
    
    if update.content is not None:
        memory.content = update.content
    if update.category is not None:
        memory.category = update.category
    if update.tags is not None:
        memory.tags = update.tags
    if update.importance is not None:
        memory.importance = update.importance
    
    await db.flush()
    await db.refresh(memory)
    return memory


@router.delete("/{memory_id}", status_code=204)
async def delete_memory(memory_id: str, db: AsyncSession = Depends(get_db)):
    """删除一条记忆"""
    result = await db.execute(select(AgentMemory).where(AgentMemory.id == memory_id))
    memory = result.scalar_one_or_none()
    if not memory:
        raise HTTPException(404, f"Memory {memory_id} not found")
    await db.delete(memory)
    await db.flush()


# ═══════════════════════════════════════════════════════
# Bridge专用: 获取需要注入system prompt的记忆
# ═══════════════════════════════════════════════════════

@router.get("/agents/{agent_id}/relevant", response_model=dict)
async def get_relevant_memories(
    agent_id: str,
    project_id: Optional[str] = Query(default=None),
    keywords: Optional[str] = Query(default=None, description="逗号分隔关键词，用于匹配L2/L3记忆"),
    db: AsyncSession = Depends(get_db),
):
    """获取Agent需要注入prompt的记忆：
    - L1核心记忆: category=core, 全量返回
    - L2见解/L3偏好: importance≥7 + (keyword或tag匹配), 限10条
    """
    # L1: 所有core记忆（全量注入）
    core_stmt = select(AgentMemory).where(
        and_(AgentMemory.agent_id == agent_id, AgentMemory.category == "core")
    ).order_by(AgentMemory.importance.desc())
    core_result = await db.execute(core_stmt)
    core_memories = core_result.scalars().all()

    # L2/L3: importance≥7 + optional keyword/tag matching
    dynamic_stmt = select(AgentMemory).where(
        and_(
            AgentMemory.agent_id == agent_id,
            AgentMemory.category.in_(["insight", "preference"]),
            AgentMemory.importance >= 7,
        )
    )
    if project_id:
        dynamic_stmt = dynamic_stmt.where(
            or_(AgentMemory.project_id == project_id, AgentMemory.project_id.is_(None))
        )
    if keywords:
        kw_list = [k.strip() for k in keywords.split(",") if k.strip()]
        # JSONB array contains any keyword — use @> (containment) per keyword + or_()
        keyword_conditions = [
            AgentMemory.tags.contains([kw]) for kw in kw_list
        ]
        dynamic_stmt = dynamic_stmt.where(or_(*keyword_conditions))
    dynamic_stmt = dynamic_stmt.order_by(AgentMemory.importance.desc()).limit(10)
    dynamic_result = await db.execute(dynamic_stmt)
    dynamic_memories = dynamic_result.scalars().all()

    return {
        "core": [MemoryOut.model_validate(m) for m in core_memories],
        "dynamic": [MemoryOut.model_validate(m) for m in dynamic_memories],
        "total_core": len(core_memories),
        "total_dynamic": len(dynamic_memories),
    }
