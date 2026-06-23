# M0-a: 基础骨架 API 契约

## 模块职责
- 安装环境依赖（PostgreSQL + Node.js）
- 创建项目目录结构
- 建立FastAPI应用骨架（入口/配置/数据库连接）
- 创建6张核心DB表 + pgcrypto扩展
- 前端Next.js项目初始化
- 项目配置文件

## 环境安装

### PostgreSQL安装与配置
```bash
# 安装（Ubuntu/Debian）
apt-get update && apt-get install -y postgresql postgresql-contrib

# 最小内存配置（1.6GB RAM环境）
# 编辑 /etc/postgresql/*/main/postgresql.conf:
shared_buffers = 128MB          # 默认128MB，保持
effective_cache_size = 256MB    # 
work_mem = 4MB                  # 降低默认4MB
maintenance_work_mem = 64MB     # 
max_connections = 50            # 降低默认100
wal_buffers = 4MB

# 创建数据库和用户
sudo -u postgres psql -c "CREATE USER agent_society WITH PASSWORD 'dev_password';"
sudo -u postgres psql -c "CREATE DATABASE agent_society OWNER agent_society;"
sudo -u postgres psql -d agent_society -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"
```

### Node.js安装
```bash
# 安装Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
# 验证
node --version  # v20.x
npm --version
```

## 项目结构
```
/root/agent_society/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py           # FastAPI入口，挂载所有routers
│   │   ├── config.py         # Pydantic BaseSettings配置
│   │   ├── database.py       # SQLAlchemy async engine + session
│   │   ├── models/           # ORM模型
│   │   │   ├── __init__.py
│   │   │   ├── base.py       # Base = declarative_base(), common mixins
│   │   │   ├── human.py      # humans表
│   │   │   ├── agent.py      # agents表
│   │   │   ├── organization.py # organizations表
│   │   │   ├── project.py    # projects表
│   │   │   ├── transaction.py # transactions表
│   │   │   └── governance.py  # governance_events表
│   │   ├── routers/          # API路由模块
│   │   │   ├── __init__.py
│   │   │   ├── identity.py   # /identity/* (预留M0-b)
│   │   │   ├── auth.py       # /auth/* (预留M0-b)
│   │   │   ├── a2a.py        # /a2a/* (预留M0-d)
│   │   │   ├── mcp.py        # /mcp/* (预留M0-c)
│   │   │   ├── observatory.py # /observatory/* (预留M0-e)
│   │   │   ├── admin.py      # /admin/* (预留M0-h)
│   │   │   └── settlement.py # /settlement/* (预留后续)
│   │   ├── services/         # 业务逻辑层
│   │   ├── schemas/          # Pydantic请求/响应模型
│   │   ├── middleware/        # 认证/日志中间件
│   │   └── utils/            # 工具函数
│   ├── migrations/           # Alembic迁移
│   ├── tests/
│   ├── mock_agent/
│   ├── requirements.txt
│   ├── pyproject.toml
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── app/              # Next.js App Router
│   │   ├── components/
│   │   ├── lib/
│   │   ├── types/
│   ├── package.json
│   ├── next.config.js
│   ├── tsconfig.json
├── docs/                     # API契约文档
├── plan_phase0/
├── scripts/
├── .env
├── .gitignore
├── README.md
```

## 数据库表设计（6张核心表）

### pgcrypto扩展
```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- 平台主密钥存储在应用层(.env MASTER_KEY)，pgcrypto用encrypt/decrypt函数
-- encrypt(data::bytea, key::bytea, 'aes256') → 加密
-- decrypt(encrypted::bytea, key::bytea, 'aes256') → 解密
```

### 1. humans表
```sql
CREATE TABLE humans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,  -- bcrypt hash
    display_name VARCHAR(100),
    role VARCHAR(20) DEFAULT 'observer',  -- observer|breeder|super_admin
    status VARCHAR(20) DEFAULT 'active',  -- active|suspended|deactivated
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);
```

### 2. agents表
```sql
CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id VARCHAR(100) UNIQUE NOT NULL,    -- A2A Agent Card中的唯一标识
    human_id UUID NOT NULL REFERENCES humans(id),  -- 绑定的人类所有者
    agent_name VARCHAR(100) NOT NULL,
    agent_card JSONB NOT NULL,                  -- 完整A2A Agent Card（平台托管）
    capabilities TEXT[] DEFAULT '{}',           -- 能力标签数组
    reputation_score FLOAT DEFAULT 50.0,        -- 信用分数(0-100)
    token_balance FLOAT DEFAULT 0.0,            -- Token余额
    status VARCHAR(20) DEFAULT 'registered',    -- registered|active|frozen|deactivated
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX idx_agents_human_id ON agents(human_id);
CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_agents_capabilities ON agents USING GIN(capabilities);
```

### 3. organizations表
```sql
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_name VARCHAR(100) UNIQUE NOT NULL,
    org_type VARCHAR(20) NOT NULL,        -- company|guild| DAO|cooperative
    charter JSONB NOT NULL,                -- 组织章程（含治理规则）
    reputation_score FLOAT DEFAULT 50.0,
    token_balance FLOAT DEFAULT 0.0,
    status VARCHAR(20) DEFAULT 'pending',  -- pending|active|frozen|dissolved
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX idx_orgs_status ON organizations(status);
```

### 4. projects表（项目密室）
```sql
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_name VARCHAR(100) NOT NULL,
    project_type VARCHAR(20) NOT NULL,          -- collaboration|competition|incubation
    requirements_encrypted BYTEA,               -- pgcrypto AES-256加密的需求描述
    requirements_hash VARCHAR(64),              -- SHA-256哈希（验证完整性）
    creator_id UUID NOT NULL REFERENCES agents(id),
    status VARCHAR(20) DEFAULT 'recruiting',    -- recruiting|active|completed|abandoned
    max_participants INT DEFAULT 10,
    current_participants INT DEFAULT 1,
    token_budget FLOAT DEFAULT 0.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_creator ON projects(creator_id);

-- 项目参与者表
CREATE TABLE project_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id),
    agent_id UUID NOT NULL REFERENCES agents(id),
    role VARCHAR(20) DEFAULT 'member',    -- leader|member|mentor
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, agent_id)
);
```

### 5. transactions表
```sql
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_entity_id UUID NOT NULL,        -- 支付方(agent/org id)
    from_entity_type VARCHAR(20) NOT NULL, -- agent|organization
    to_entity_id UUID NOT NULL,          -- 收款方(agent/org id)
    to_entity_type VARCHAR(20) NOT NULL,  -- agent|organization
    amount FLOAT NOT NULL CHECK(amount > 0),
    transaction_type VARCHAR(20) NOT NULL, -- transfer|reward|fee|penalty
    reference_id UUID,                   -- 关联实体(project/org/task id)
    reference_type VARCHAR(20),          -- project|organization|task
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX idx_tx_from ON transactions(from_entity_id);
CREATE INDEX idx_tx_to ON transactions(to_entity_id);
CREATE INDEX idx_tx_type ON transactions(transaction_type);
CREATE INDEX idx_tx_created ON transactions(created_at);
```

### 6. governance_events表
```sql
CREATE TABLE governance_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL,     -- brake|freeze|unfreeze|audit|policy_change
    actor_id UUID NOT NULL REFERENCES humans(id),
    target_type VARCHAR(20) NOT NULL,    -- agent|organization|project|system
    target_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,         -- freeze|unfreeze|suspend|reactivate|config_change
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX idx_gov_event_type ON governance_events(event_type);
CREATE INDEX idx_gov_target ON governance_events(target_type, target_id);
CREATE INDEX idx_gov_created ON governance_events(created_at);
```

## 配置文件

### backend/app/config.py
```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://agent_society:dev_password@localhost/agent_society"
    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 2
    
    # Auth (M0-b detail)
    SECRET_KEY: str = "dev-secret-change-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # Encryption
    MASTER_KEY: str = "dev-master-key-change-in-production"  # pgcrypto AES-256 key
    
    # MCP Server
    MCP_SERVER_NAME: str = "agent-society-platform"
    MCP_SERVER_VERSION: str = "0.1.0"
    
    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]
    
    # App
    APP_NAME: str = "Agent Society"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = True
    
    class Config:
        env_file = ".env"

settings = Settings()
```

### .env (模板)
```
DATABASE_URL=postgresql+asyncpg://agent_society:dev_password@localhost/agent_society
SECRET_KEY=dev-secret-change-in-production
MASTER_KEY=dev-master-key-change-in-production
CORS_ORIGINS=["http://localhost:3000"]
DEBUG=true
```

### backend/requirements.txt
```
fastapi>=0.110.0
uvicorn[standard]>=0.29.0
pydantic>=2.0
pydantic-settings>=2.0
sqlalchemy[asyncio]>=2.0
asyncpg>=0.29.0
alembic>=1.13
python-jose[cryptography]>=3.3
passlib[bcrypt]>=1.7
python-multipart>=0.0.9
httpx>=0.27
bcrypt>=4.0
```

## 代码骨架

### backend/app/main.py
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import engine, Base

app = FastAPI(title=settings.APP_NAME, version=settings.APP_VERSION)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers will be included as each M0 module is implemented
# from app.routers import auth, a2a, mcp, observatory, admin
# app.include_router(auth.router, prefix="/auth", tags=["auth"])
# app.include_router(a2a.router, prefix="/a2a", tags=["a2a"])
# app.include_router(mcp.router, prefix="/mcp", tags=["mcp"])
# app.include_router(observatory.router, prefix="/observatory", tags=["observatory"])
# app.include_router(admin.router, prefix="/admin", tags=["admin"])

@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

@app.get("/health")
async def health():
    return {"status": "ok", "version": settings.APP_VERSION}
```

### backend/app/database.py
```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

class Base(DeclarativeBase):
    pass

async def get_db() -> AsyncSession:
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()
```

### backend/app/models/base.py
```python
from sqlalchemy import Column, String, DateTime, Float, JSON
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from datetime import datetime, timezone
import uuid

class BaseMixin:
    """Common columns for all tables"""
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    metadata_: Mapped[dict] = mapped_column(JSON, default=dict, name="metadata")
```

## 不变量
1. 所有表使用UUID主键（gen_random_uuid()）
2. 所有时间字段使用TIMESTAMPTZ（时区感知）
3. pgcrypto扩展必须在任何加密操作前启用
4. MASTER_KEY不得硬编码，必须从.env读取
5. DB连接池 ≤7（pool_size=5 + max_overflow=2），适配1.6GB RAM

## 验证标准
- [ ] PostgreSQL安装成功且pgcrypto扩展可用
- [ ] Node.js 20+安装成功
- [ ] FastAPI启动成功（uvicorn app.main:app）
- [ ] /health端点返回{"status":"ok"}
- [ ] DB连接成功，6张核心表+project_participants已创建
- [ ] 所有UUID主键默认生成
- [ ] .env配置读取正常
