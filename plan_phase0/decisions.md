# Phase 0 关键决策日志

## 技术栈
| 决策项 | 选择 | 理由 |
|--------|------|------|
| 后端语言 | Python 3.11+ / FastAPI | 异步原生+类型系统+生态丰富 |
| 前端框架 | Next.js 14+ (App Router) | 用户确认，SSR+CSR混合 |
| 数据库 | PostgreSQL 15+ | 复杂关系+JSONB+事务支持 |
| ORM | SQLAlchemy 2.0 (async) | 异步原生+成熟生态 |
| 驱动 | asyncpg | 纯异步PostgreSQL驱动 |
| 认证 | OAuth 2.1 + PKCE | 用户确认，无需client_secret |
| Agent协议 | A2A (Agent Card + 消息) | 标准化Agent间通信 |
| 工具协议 | MCP (JSON-RPC) | 标准化Agent-平台交互 |
| 密码哈希 | bcrypt | 用户确认 |
| Token | JWT HS256 | M0阶段简洁方案 |
| 样式 | Tailwind CSS | 无额外UI库 |
| MockAgent | 纯脚本(无LLM) | Phase1引入LLM，M0用固定响应 |

## 执行顺序
M0-a(骨架) → M0-b(认证) → M0-d(A2A) → M0-c(MCP) → M0-e(观察) → M0-f(前端) → M0-g(MockAgent) → M0-h(管理)
理由：认证是所有交互基础→A2A先于MCP(A2A更基础)→观察依赖前面的数据→前端依赖后端API→MockAgent依赖全部→管理制动是最后安全层

## 环境约束
- 内存：1.6GB RAM → DB连接池≤7(pool_size=5+max_overflow=2)
- pgcrypto扩展必须在加密操作前启用
- 所有UUID主键用gen_random_uuid()
- 所有时间字段用TIMESTAMPTZ

## DB Schema
7张核心表：humans, agents, organizations, projects, project_participants, transactions, governance_events
+ admins表(M0-h)
+ 2张辅助表：oauth_clients, refresh_tokens(M0-b)

## 认证架构
- 人类：bcrypt密码 + OAuth authorization_code(PKCE)
- Agent：client_credentials flow
- 管理员：独立认证体系(role: super_admin/admin/auditor)
- Token存储：localStorage(M0) → httpOnly cookie(Phase2升级)

## 安全设计
- MASTER_KEY从.env读取，不硬编码
- PKCE防止授权码拦截
- 管理员制动状态机(active→frozen→suspended→revoked)
- 审计日志记录所有治理操作

## 待定事项（Phase1解决）
- [ ] 项目密室加密方案（Phase1引入，M0不实现）
- [ ] LLM Agent接入（M0用MockAgent固定响应）
- [ ] httpOnly cookie升级（M0用localStorage）
- [ ] WebSocket实时推送（M0用REST轮询）
- [ ] 分布式部署（M0单机）
