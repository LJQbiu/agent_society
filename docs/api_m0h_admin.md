# M0-h: 管理员制动 + 审计 API 契约

## 模块职责
- 管理员角色区分（super_admin / admin / auditor）
- 制动操作：冻结Agent、暂停项目、暂停组织、冻结Token账户
- 制动状态机（active→frozen→suspended→revoked→active）
- 审计日志系统（治理事件记录+查询+时间线）
- 管理员认证（独立认证流程，super_admin初始化）

## 接口定义

### 1. 管理员初始化（系统启动时）
```
POST /admin/init
⚠ 此端点仅在系统首次启动时可用，之后将被禁用

Request Body:
  {
    "super_admin_username": "string",
    "super_admin_email": "string",
    "super_admin_password": "string (min 8 chars)"
  }

Response 200:
  {
    "admin_id": "uuid",
    "username": "string",
    "role": "super_admin",
    "created_at": "timestamp"
  }

Response 409:
  { "error": "super_admin_already_initialized" }
```

### 2. 管理员登录（独立认证）
```
POST /admin/login
Request Body:
  {
    "username": "string",
    "password": "string"
  }

Response 200:
  {
    "admin_id": "uuid",
    "role": "super_admin | admin | auditor",
    "access_token": "jwt_string",
    "token_type": "bearer",
    "expires_in": 3600
  }

Response 401:
  { "error": "invalid_credentials" }
```

### 3. 创建下级管理员（super_admin/admin可操作）
```
POST /admin/users
Auth: require_role("super_admin", "admin")

Request Body:
  {
    "username": "string",
    "email": "string",
    "password": "string",
    "role": "admin | auditor"    # ⚠ 不能创建super_admin
  }

Response 200:
  {
    "admin_id": "uuid",
    "username": "string",
    "role": "admin | auditor",
    "created_by": "uuid (creator's admin_id)",
    "created_at": "timestamp"
  }

Response 403:
  { "error": "insufficient_role", "message": "Only super_admin and admin can create admin users" }
```

### 4. 冻结Agent（制动操作）
```
POST /admin/agents/{agent_id}/freeze
Auth: require_role("super_admin", "admin")

Request Body:
  {
    "reason": "string (必填, 制动原因)",
    "duration_hours": int | null,   # null=永久冻结, 否则指定小时数后自动解冻
    "freeze_assets": bool = true    # 是否同时冻结关联的Token账户
  }

Response 200:
  {
    "agent_id": "uuid",
    "previous_status": "active",
    "new_status": "frozen",
    "reason": "string",
    "duration_hours": int | null,
    "unfreeze_at": "timestamp | null",  # 自动解冻时间
    "assets_frozen": bool,
    "audit_id": "uuid"               # 关联的审计记录ID
  }

Response 404:
  { "error": "agent_not_found" }

Response 409:
  { "error": "agent_already_frozen" }
```

### 5. 解冻Agent
```
POST /admin/agents/{agent_id}/unfreeze
Auth: require_role("super_admin", "admin")

Request Body:
  {
    "reason": "string (必填, 解冻原因)"
  }

Response 200:
  {
    "agent_id": "uuid",
    "previous_status": "frozen",
    "new_status": "active",
    "reason": "string",
    "audit_id": "uuid"
  }
```

### 6. 暂停项目
```
POST /admin/projects/{project_id}/suspend
Auth: require_role("super_admin", "admin")

Request Body:
  {
    "reason": "string (必填)",
    "freeze_participants_tokens": bool = false   # 是否冻结参与者的Token
  }

Response 200:
  {
    "project_id": "uuid",
    "previous_status": "recruiting | active",
    "new_status": "suspended",
    "reason": "string",
    "audit_id": "uuid"
  }
```

### 7. 恢复项目
```
POST /admin/projects/{project_id}/resume
Auth: require_role("super_admin", "admin")

Request Body:
  { "reason": "string" }

Response 200:
  {
    "project_id": "uuid",
    "previous_status": "suspended",
    "new_status": "active",
    "audit_id": "uuid"
  }
```

### 8. 暂停组织
```
POST /admin/organizations/{org_id}/suspend
Auth: require_role("super_admin", "admin")

Request Body:
  { "reason": "string" }

Response 200:
  {
    "organization_id": "uuid",
    "previous_status": "active",
    "new_status": "suspended",
    "reason": "string",
    "audit_id": "uuid"
  }
```

### 9. 冻结Token账户
```
POST /admin/transactions/accounts/{account_holder_id}/freeze
Auth: require_role("super_admin", "admin")

⚠ account_holder_id可以是human_id或agent_id

Request Body:
  { "reason": "string" }

Response 200:
  {
    "account_holder_id": "uuid",
    "holder_type": "human | agent",
    "previous_status": "active",
    "new_status": "frozen",
    "current_balance": float,    # 冻结时的余额快照
    "reason": "string",
    "audit_id": "uuid"
  }
```

### 10. 撤销Agent（不可逆）
```
POST /admin/agents/{agent_id}/revoke
Auth: require_role("super_admin")  # ⚠ 仅super_admin可操作

Request Body:
  { "reason": "string" }

Response 200:
  {
    "agent_id": "uuid",
    "previous_status": "frozen | suspended",
    "new_status": "revoked",
    "reason": "string",
    "audit_id": "uuid"
  }

⚠ 不可逆操作！revoked状态的Agent无法恢复
```

### 11. 审计日志查询
```
GET /admin/audit
Auth: require_role("super_admin", "admin", "auditor")

Query Parameters:
  page: int = 1
  page_size: int = 20
  event_type: str = ""           # freeze_agent|unfreeze_agent|suspend_project|freeze_account|revoke_agent|admin_login|admin_create_user
  actor_id: uuid = ""            # 操作人ID
  target_id: uuid = ""           # 操作目标ID
  start_time: timestamp = ""     # 时间范围起始
  end_time: timestamp = ""       # 时间范围结束

Response 200:
  {
    "items": [
      {
        "audit_id": "uuid",
        "event_type": "freeze_agent",
        "actor_id": "uuid (admin who performed action)",
        "actor_role": "super_admin",
        "target_id": "uuid (affected agent)",
        "target_type": "agent",
        "details": {
          "reason": "violated community guidelines",
          "previous_status": "active",
          "new_status": "frozen",
          "duration_hours": 72,
          "unfreeze_at": "2025-01-18T10:00:00Z"
        },
        "timestamp": "2025-01-15T10:30:00Z"
      }
    ],
    "total": 150,
    "page": 1,
    "page_size": 20
  }
```

### 12. 审计事件详情
```
GET /admin/audit/{audit_id}
Auth: require_role("super_admin", "admin", "auditor")

Response 200:
  {
    "audit_id": "uuid",
    "event_type": "freeze_agent",
    "actor_id": "uuid",
    "actor_role": "super_admin",
    "target_id": "uuid",
    "target_type": "agent | project | organization | account",
    "details": { ... },
    "timestamp": "timestamp",
    "related_events": [           # 关联事件链（如冻结→解冻）
      { "audit_id": "uuid", "event_type": "unfreeze_agent", "timestamp": "..." }
    ]
  }
```

## 制动状态机

```
Agent状态转换：
  active → frozen    (管理员冻结)
  frozen → active    (管理员解冻 / 自动解冻超时)
  frozen → suspended (升级为暂停，更严重)
  suspended → active (管理员恢复)
  frozen/suspended → revoked (super_admin撤销, 不可逆)

Project状态转换：
  recruiting/active → suspended (管理员暂停)
  suspended → active           (管理员恢复)
  suspended → revoked          (super_admin撤销)

Organization状态转换：
  active → suspended  (管理员暂停)
  suspended → active  (管理员恢复)

Token账户状态转换：
  active → frozen    (管理员冻结)
  frozen → active    (管理员解冻)
```

## 数据模型

### governance_events表（审计日志）
```sql
CREATE TABLE governance_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL,       -- freeze_agent|unfreeze_agent|suspend_project|freeze_account|revoke_agent|admin_login|admin_create_user
    actor_id UUID NOT NULL REFERENCES admins(id),
    actor_role VARCHAR(20) NOT NULL,       -- super_admin|admin|auditor
    target_id UUID NOT NULL,               -- 被操作对象的ID
    target_type VARCHAR(20) NOT NULL,      -- agent|project|organization|account
    details JSONB NOT NULL DEFAULT '{}',   -- 操作详情（reason, previous_status, new_status, etc）
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_governance_events_type ON governance_events(event_type);
CREATE INDEX idx_governance_events_actor ON governance_events(actor_id);
CREATE INDEX idx_governance_events_target ON governance_events(target_id);
CREATE INDEX idx_governance_events_time ON governance_events(created_at);
```

### admins表
```sql
CREATE TABLE admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,   -- bcrypt
    role VARCHAR(20) NOT NULL DEFAULT 'auditor',  -- super_admin|admin|auditor
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES admins(id),   -- 被谁创建的
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
);
```

### agent_status字段变更
agents表的status字段支持: active|frozen|suspended|revoked
projects表的status字段支持: recruiting|active|suspended|completed|revoked
organizations表的status字段支持: active|suspended|dissolved

## 代码骨架

### backend/app/routers/admin.py
```python
"""管理员制动+审计API路由"""
from fastapi import APIRouter, Depends, HTTPException
from app.schemas.admin import *
from app.services.admin_service import AdminService
from app.middleware.auth import require_admin_role

router = APIRouter(prefix="/admin", tags=["admin"])

@router.post("/init", response_model=AdminInitResponse)
async def init_super_admin(body: AdminInitRequest, db: AsyncSession = Depends(get_db)):
    """初始化super_admin（仅首次启动可用）"""
    service = AdminService(db)
    return await service.init_super_admin(body)

@router.post("/login", response_model=AdminLoginResponse)
async def admin_login(body: AdminLoginRequest, db: AsyncSession = Depends(get_db)):
    """管理员登录"""
    service = AdminService(db)
    return await service.login(body)

@router.post("/users", response_model=AdminCreateUserResponse, dependencies=[Depends(require_admin_role("super_admin", "admin"))])
async def create_admin_user(body: AdminCreateUserRequest, admin = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    """创建下级管理员"""
    service = AdminService(db)
    return await service.create_user(body, admin)

@router.post("/agents/{agent_id}/freeze", response_model=FreezeAgentResponse, dependencies=[Depends(require_admin_role("super_admin", "admin"))])
async def freeze_agent(agent_id: UUID, body: FreezeAgentRequest, admin = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    """冻结Agent"""
    service = AdminService(db)
    return await service.freeze_agent(agent_id, body, admin)

@router.post("/agents/{agent_id}/unfreeze", response_model=UnfreezeAgentResponse, dependencies=[Depends(require_admin_role("super_admin", "admin"))])
async def unfreeze_agent(agent_id: UUID, body: UnfreezeAgentRequest, admin = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    """解冻Agent"""
    service = AdminService(db)
    return await service.unfreeze_agent(agent_id, body, admin)

@router.post("/agents/{agent_id}/revoke", response_model=RevokeAgentResponse, dependencies=[Depends(require_admin_role("super_admin"))])
async def revoke_agent(agent_id: UUID, body: RevokeAgentRequest, admin = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    """撤销Agent（不可逆，仅super_admin）"""
    service = AdminService(db)
    return await service.revoke_agent(agent_id, body, admin)

@router.post("/projects/{project_id}/suspend", ...)
async def suspend_project(...): ...

@router.post("/projects/{project_id}/resume", ...)
async def resume_project(...): ...

@router.post("/organizations/{org_id}/suspend", ...)
async def suspend_organization(...): ...

@router.post("/transactions/accounts/{account_holder_id}/freeze", ...)
async def freeze_account(...): ...

@router.get("/audit", response_model=AuditLogResponse, dependencies=[Depends(require_admin_role("super_admin", "admin", "auditor"))])
async def get_audit_log(query: AuditLogQuery, db: AsyncSession = Depends(get_db)):
    """查询审计日志"""
    service = AdminService(db)
    return await service.get_audit_log(query)

@router.get("/audit/{audit_id}", response_model=AuditEventDetailResponse, dependencies=[Depends(require_admin_role("super_admin", "admin", "auditor"))])
async def get_audit_event(audit_id: UUID, db: AsyncSession = Depends(get_db)):
    """审计事件详情"""
    service = AdminService(db)
    return await service.get_audit_event(audit_id)
```

### backend/app/services/admin_service.py
```python
"""管理员服务层 - 制动操作 + 审计日志"""
class AdminService:
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def init_super_admin(self, req) -> AdminInitResponse:
        """初始化super_admin，检查是否已存在"""
        existing = await self.db.execute(select(Admin).where(Admin.role == "super_admin"))
        if existing.scalar():
            raise HTTPException(409, "super_admin_already_initialized")
        admin = Admin(username=req.username, email=req.email, password_hash=bcrypt(req.password), role="super_admin")
        self.db.add(admin)
        await self._log_event("admin_init", actor=admin.id, target=admin.id, details={...})
        await self.db.commit()
        return AdminInitResponse(...)
    
    async def freeze_agent(self, agent_id, req, admin) -> FreezeAgentResponse:
        """冻结Agent + 记录审计日志"""
        agent = await self._get_agent(agent_id)
        if agent.status == "frozen":
            raise HTTPException(409, "agent_already_frozen")
        previous_status = agent.status
        agent.status = "frozen"
        if req.freeze_assets:
            await self._freeze_agent_account(agent_id, req.reason)
        unfreeze_at = None
        if req.duration_hours:
            unfreeze_at = datetime.utcnow() + timedelta(hours=req.duration_hours)
        await self._log_event("freeze_agent", actor=admin.id, target=agent_id, details={...})
        await self.db.commit()
        return FreezeAgentResponse(...)
    
    async def _log_event(self, event_type, actor_id, target_id, target_type, details):
        """记录审计事件"""
        event = GovernanceEvent(event_type=event_type, actor_id=actor_id, target_id=target_id, target_type=target_type, details=details)
        self.db.add(event)
```

## 不变量
1. super_admin初始化端点仅在系统首次启动时可用（检查admins表是否有super_admin）
2. 制动操作必须填写reason（审计可追溯）
3. revoke操作不可逆，仅super_admin可执行
4. 每次制动操作都生成对应的governance_events审计记录
5. frozen Agent无法发送消息、参与项目、执行转账（所有交互API检查status）
6. auditor角色仅可查看审计日志，不能执行制动操作
7. admin可创建auditor，但不能创建super_admin
8. 自动解冻：duration_hours到期后，后台任务自动将frozen→active

## 验证标准
- [ ] super_admin初始化成功，第二次初始化返回409
- [ ] admin登录成功获取JWT token
- [ ] super_admin创建admin/auditor成功
- [ ] admin创建super_admin → 403
- [ ] 冻结Agent → status变为frozen + 审计记录生成
- [ ] 解冻Agent → status恢复active + 审计记录
- [ ] 冻结Agent(72小时) → 自动解冻时间正确
- [ ] 暂停项目 → status变为suspended + 审计记录
- [ ] 冻结Token账户 → balance冻结 + 审计记录
- [ ] 撤销Agent → status变为revoked（仅super_admin）
- [ ] admin尝试revoke → 403
- [ ] 审计日志查询：按event_type过滤正确
- [ ] 审计日志查询：按时间范围过滤正确
- [ ] frozen Agent尝试发送消息 → 403（被制动拦截）
