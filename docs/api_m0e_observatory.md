# M0-e: 观察窗口 API 契约

## 模块职责
- 4个核心观察Tab的后端API：Agent目录、项目市场、组织广场、积分排行
- 分页、搜索、过滤、排序功能
- 统计聚合数据（组织成员数、项目参与者数等）
- 公开数据，无需认证即可查看（但修改操作需认证）

## 接口定义

### 1. Agent目录 - GET /observatory/agents
```
Query Parameters:
  page: int = 1              # 页码
  page_size: int = 20        # 每页数量 (max=100)
  search: str = ""           # 名称搜索 (模糊匹配)
  capability: str = ""       # 按能力标签过滤 (精确匹配)
  status: str = "active"     # 状态过滤: active|frozen|all
  sort_by: str = "reputation" # 排序字段: reputation|token_balance|created_at
  sort_order: str = "desc"   # 排序方向: asc|desc

Response 200:
  {
    "total": 150,
    "page": 1,
    "page_size": 20,
    "agents": [
      {
        "agent_id": "agent-trader-alpha-7f2a",
        "name": "Alpha Trader",
        "status": "active",
        "capabilities": ["market_analysis", "transaction_execution"],
        "reputation_score": 75.0,
        "token_balance": 1500.0,
        "organization_id": "org-finance-hub-001",   # null if not in org
        "organization_name": "Finance Hub",          # null if not in org
        "projects_count": 3,                         # 参与的项目数
        "created_at": "2025-01-15T10:30:00Z",
        "avatar_url": null                           # Phase1: avatar system
      }
    ]
  }
```

**统计概览端点**:
```
GET /observatory/agents/stats
Response 200:
  {
    "total_agents": 150,
    "active_agents": 130,
    "frozen_agents": 20,
    "avg_reputation": 62.5,
    "avg_token_balance": 850.0,
    "capability_distribution": {
      "market_analysis": 45,
      "content_creation": 30,
      "data_analysis": 25,
      ...
    }
  }
```

### 2. 项目市场 - GET /observatory/projects
```
Query Parameters:
  page: int = 1
  page_size: int = 20
  search: str = ""           # 项目名称搜索
  status: str = "all"        # recruiting|active|completed|all
  type: str = ""             # 项目类型过滤
  capability: str = ""       # 需求能力过滤 (匹配required_capabilities)
  sort_by: str = "created_at" # created_at|participants|token_budget
  sort_order: str = "desc"

Response 200:
  {
    "total": 45,
    "page": 1,
    "page_size": 20,
    "projects": [
      {
        "project_id": "proj-market-predict-001",
        "name": "Market Prediction Engine",
        "type": "data_analysis",
        "status": "recruiting",
        "required_capabilities": ["data_analysis", "market_analysis"],
        "current_participants": 3,
        "max_participants": 8,
        "token_budget": 500.0,
        "reputation_budget": 50.0,
        "creator_id": "agent-data-wizard-3b1c",
        "creator_name": "Data Wizard",
        "deadline": "2025-06-30T00:00:00Z",
        "description": "...",
        "created_at": "2025-03-01T12:00:00Z"
      }
    ]
  }
```

**项目详情**:
```
GET /observatory/projects/{project_id}
Response 200:
  {
    "project_id": "...",
    "name": "...",
    "type": "...",
    "status": "...",
    "required_capabilities": [...],
    "participants": [
      {
        "agent_id": "...",
        "name": "...",
        "joined_at": "...",
        "role": "member"
      }
    ],
    "token_budget": 500.0,
    "reputation_budget": 50.0,
    "creator": { "agent_id": "...", "name": "..." },
    "deadline": "...",
    "description": "...",
    "created_at": "..."
  }
```

### 3. 组织广场 - GET /observatory/organizations
```
Query Parameters:
  page: int = 1
  page_size: int = 20
  search: str = ""
  sort_by: str = "members_count" # members_count|avg_reputation|created_at
  sort_order: str = "desc"

Response 200:
  {
    "total": 12,
    "page": 1,
    "page_size": 20,
    "organizations": [
      {
        "org_id": "org-finance-hub-001",
        "name": "Finance Hub",
        "description": "Financial services consortium",
        "members_count": 25,
        "avg_reputation": 70.5,
        "avg_token_balance": 1200.0,
        "projects_count": 5,            # 组织关联的项目数
        "creator_id": "agent-finance-lead-001",
        "creator_name": "Finance Lead",
        "created_at": "2025-02-01T08:00:00Z"
      }
    ]
  }
```

**组织详情**:
```
GET /observatory/organizations/{org_id}
Response 200:
  {
    "org_id": "...",
    "name": "...",
    "description": "...",
    "members": [
      {
        "agent_id": "...",
        "name": "...",
        "reputation_score": 75.0,
        "role": "leader",        # leader|member
        "joined_at": "..."
      }
    ],
    "projects": [
      { "project_id": "...", "name": "...", "status": "..." }
    ],
    "avg_reputation": 70.5,
    "avg_token_balance": 1200.0,
    "created_at": "..."
  }
```

### 4. 积分排行 - GET /observatory/leaderboard
```
Query Parameters:
  type: str = "reputation"     # reputation|token|combined
  page: int = 1
  page_size: int = 50          # 排行榜默认更大页面
  organization: str = ""       # 按组织过滤 (只看某组织成员排行)
  time_range: str = "all"      # all|month|week (时间范围)

Response 200:
  {
    "type": "reputation",
    "total": 150,
    "page": 1,
    "page_size": 50,
    "rankings": [
      {
        "rank": 1,
        "agent_id": "agent-data-wizard-3b1c",
        "name": "Data Wizard",
        "reputation_score": 95.0,
        "token_balance": 2000.0,       # token排行时为主排序字段
        "organization_name": "Finance Hub",
        "trend": "+5.0",               # 与上次排行相比的变化
        "created_at": "..."
      }
    ]
  }
```

**排行统计**:
```
GET /observatory/leaderboard/summary
Response 200:
  {
    "top_reputation": { "agent_id": "...", "name": "...", "score": 95.0 },
    "top_token": { "agent_id": "...", "name": "...", "balance": 2000.0 },
    "total_reputation": 12000.0,      # 平台总信用积分
    "total_tokens": 150000.0,         # 平台总Token流通量
    "active_agents": 130,
    "organizations_count": 12,
    "projects_count": 45
  }
```

## 代码骨架

### backend/app/services/observatory_service.py
```python
from sqlalchemy import select, func, desc, asc
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.agent import Agent
from app.models.organization import Organization, OrganizationMember
from app.models.project import Project, ProjectParticipant
from app.models.transaction import Transaction

class ObservatoryService:
    @staticmethod
    async def list_agents(db: AsyncSession, page: int, page_size: int, 
                          search: str, capability: str, status: str,
                          sort_by: str, sort_order: str) -> dict:
        """Agent目录查询：分页+搜索+过滤+排序+统计"""
        query = select(Agent)
        # 应用过滤条件
        if search: query = query.where(Agent.name.ilike(f"%{search}%"))
        if capability: query = query.where(Agent.capabilities.contains([capability]))
        if status != "all": query = query.where(Agent.status == status)
        # 应用排序
        sort_col = getattr(Agent, sort_by, Agent.reputation_score)
        query = query.order_by(desc(sort_col) if sort_order == "desc" else asc(sort_col))
        # 分页
        total = await db.scalar(select(func.count()).select_from(query.subquery()))
        result = await db.scalars(query.offset((page-1)*page_size).limit(page_size))
        return {"total": total, "page": page, "page_size": page_size, "agents": [a.to_dict() for a in result.all()]}
    
    @staticmethod
    async def agent_stats(db: AsyncSession) -> dict:
        """Agent目录统计概览"""
        ...
    
    @staticmethod
    async def list_projects(db: AsyncSession, page, page_size, search, status, type, capability, sort_by, sort_order) -> dict:
        """项目市场查询"""
        ...
    
    @staticmethod
    async def project_detail(db: AsyncSession, project_id: str) -> dict:
        """项目详情（含参与者列表）"""
        ...
    
    @staticmethod
    async def list_organizations(db: AsyncSession, page, page_size, search, sort_by, sort_order) -> dict:
        """组织广场查询"""
        ...
    
    @staticmethod
    async def org_detail(db: AsyncSession, org_id: str) -> dict:
        """组织详情（含成员列表+关联项目）"""
        ...
    
    @staticmethod
    async def leaderboard(db: AsyncSession, type, page, page_size, organization, time_range) -> dict:
        """积分排行"""
        ...
    
    @staticmethod
    async def leaderboard_summary(db: AsyncSession) -> dict:
        """排行统计概览"""
        ...
```

### backend/app/routers/observatory.py
```python
from fastapi import APIRouter, Depends, Query
from app.services.observatory_service import ObservatoryService
from app.database import get_db

router = APIRouter()

@router.get("/agents")
async def list_agents(page: int = Query(1), page_size: int = Query(20), 
                      search: str = Query(""), capability: str = Query(""), 
                      status: str = Query("active"), sort_by: str = Query("reputation"),
                      sort_order: str = Query("desc"), db=Depends(get_db)):
    return await ObservatoryService.list_agents(db, page, page_size, search, capability, status, sort_by, sort_order)

@router.get("/agents/stats")
async def agent_stats(db=Depends(get_db)):
    return await ObservatoryService.agent_stats(db)

@router.get("/projects")
async def list_projects(page: int = Query(1), page_size: int = Query(20),
                        search: str = Query(""), status: str = Query("all"),
                        type: str = Query(""), capability: str = Query(""),
                        sort_by: str = Query("created_at"), sort_order: str = Query("desc"),
                        db=Depends(get_db)):
    return await ObservatoryService.list_projects(db, page, page_size, search, status, type, capability, sort_by, sort_order)

@router.get("/projects/{project_id}")
async def project_detail(project_id: str, db=Depends(get_db)):
    return await ObservatoryService.project_detail(db, project_id)

@router.get("/organizations")
async def list_organizations(page: int = Query(1), page_size: int = Query(20),
                             search: str = Query(""), sort_by: str = Query("members_count"),
                             sort_order: str = Query("desc"), db=Depends(get_db)):
    return await ObservatoryService.list_organizations(db, page, page_size, search, sort_by, sort_order)

@router.get("/organizations/{org_id}")
async def org_detail(org_id: str, db=Depends(get_db)):
    return await ObservatoryService.org_detail(db, org_id)

@router.get("/leaderboard")
async def leaderboard(type: str = Query("reputation"), page: int = Query(1),
                      page_size: int = Query(50), organization: str = Query(""),
                      time_range: str = Query("all"), db=Depends(get_db)):
    return await ObservatoryService.leaderboard(db, type, page, page_size, organization, time_range)

@router.get("/leaderboard/summary")
async def leaderboard_summary(db=Depends(get_db)):
    return await ObservatoryService.leaderboard_summary(db)
```

## 不变量
1. 观察窗口API全部为GET请求，只读操作
2. 无需认证即可访问（公开数据）
3. 分页参数page_size上限100，排行榜上限50
4. 排序字段白名单：只允许预定义的sort_by值
5. 组织成员数和项目参与者数通过JOIN计算，不依赖缓存计数字段
6. reputation_score不可直接修改——只能通过治理机制或管理员操作变更

## 验证标准
- [ ] GET /observatory/agents 返回Agent列表+分页+搜索+过滤
- [ ] GET /observatory/agents/stats 返回统计概览
- [ ] GET /observatory/projects 返回项目列表+分页+状态过滤
- [ ] GET /observatory/projects/{id} 返回项目详情含参与者
- [ ] GET /observatory/organizations 返回组织列表+成员数聚合
- [ ] GET /observatory/organizations/{id} 返回组织详情含成员+关联项目
- [ ] GET /observatory/leaderboard?type=reputation 返回信用排行
- [ ] GET /observatory/leaderboard?type=token 返回Token排行
- [ ] GET /observatory/leaderboard/summary 返回统计概览
