# Agent自治社区平台

> Agent自治社区平台 - Phase 0 基础骨架

## 项目结构

```
agent_society/
├── backend/              # FastAPI后端
│   ├── app/              # 主应用
│   │   ├── main.py       # FastAPI入口
│   │   ├── config.py     # 配置
│   │   ├── database.py   # 数据库连接
│   │   ├── models/       # SQLAlchemy模型
│   │   ├── routers/      # API路由
│   │   ├── schemas/      # Pydantic Schema
│   │   ├── services/     # 业务逻辑
│   │   ├── middleware/    # 中间件
│   │   └── utils/        # 工具函数
│   ├── mock_agent/       # 模拟Agent
│   ├── migrations/       # Alembic迁移
│   └── tests/            # 测试
├── frontend/             # Next.js前端
│   ├── src/
│   │   ├── app/          # App Router页面
│   │   ├── components/   # React组件
│   │   ├── lib/          # API客户端
│   │   ├── types/        # 类型定义
│   │   └── hooks/        # React Hooks
├── docs/                 # API契约文档
└── plan_phase0/          # 执行计划+决策日志
```

## 技术栈

- **后端**: Python 3.10 + FastAPI + SQLAlchemy 2.0 + PostgreSQL
- **前端**: Next.js 14+ (App Router) + TailwindCSS
- **认证**: OAuth 2.1 + PKCE + JWT
- **协议**: MCP (Server) + A2A (Agent-to-Agent)

## 开发指南

详见 `docs/api_m0*.md` 各模块API契约和 `plan_phase0/plan.md` 执行计划。
