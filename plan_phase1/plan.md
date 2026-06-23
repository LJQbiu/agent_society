<!-- EXECUTION PROTOCOL (每轮必读，这是你的执行指南)
1. file_read(plan.md)，找到第一个 [ ] 项
2. 该步标注了SPEC → file_read 该api_xxx.md获取详细API契约
3. 该步标注了STUB → file_read 对应骨架文件获取类型签名和接口定义
4. 该步标注了SOP → file_read 该SOP的🔑速查段
5. 执行该步骤 + Mini验证产出（file_read确认非空、code_run检查语法）
6. file_patch 标记 [ ] → [✓]+简要结果，然后回到步骤1继续下一个[ ]
7. 所有步骤（含验证步骤）标记完成后 → 终止检查：file_read(plan.md)确认全部[✓]

⚠️ [D] 标注项 = 委托subagent执行（大代码量/多文件/重复操作）
⚠️ 每完成3-5项后做一次Mini验证（构建+基础功能测试）
-->

# Phase 1 计划 — 前端完善 + 功能升级

## 探索发现

### 环境现状
- **后端**: 43端点全部功能正常 ✅ (FastAPI, PostgreSQL, SQLAlchemy async)
- **前端**: Next.js 14 App Router, 12页面+15组件, 基础功能可用但用户曾遇400错误(后端已修复)
- **API客户端**: api.ts 249行, 覆盖auth/identity/observatory/settlement/org/project/a2a/mcp 8大模块

### 前端现状(组件行数)
| 组件 | 行数 | 状态 |
|------|------|------|
| project-manager | 323 | ✅ 但创建者自动加入导致400 |
| org-manager | 285 | ✅ 同上 |
| wallet-view | 239 | ✅ |
| mcp-playground | 184 | ✅ |
| a2a-explorer | 115 | ✅ |
| mcp-explorer | 109 | ✅ |
| leaderboard-view | 57 | ✅ |
| login/register-form | 48/45 | ✅ |
| agent/org/project-directory | 34/29/29 | ✅ 简单列表 |
| navbar | 34 | ✅ |
| home page | 42 | ✅ |

### 缺失功能
- ❌ Dashboard/个人中心页面
- ❌ Admin管理页面(freeze/unfreeze/brake/audit)
- ❌ Agent注册与绑定页面(identity模块)
- ❌ 消息中心/通知页面
- ❌ httpOnly cookie安全升级(M0用localStorage)
- ❌ LLM Agent接入(M0用MockAgent)
- ❌ WebSocket实时推送(M0用REST)

### 关键约束
- 后端venv: `/root/agent_society/backend/venv/bin/python`
- super_admin: `super_admin/Admin123!@#`
- 前端next.config.js已有API proxy rewrite到localhost:8000
- 用户从公网访问,前后端都在同一服务器

---

## A. 前端稳定化(优先级最高 — 用户验收前置条件)

1. [✓] **修复org/project管理400错误** — 创建者自动加入后再join会400, 前端需处理: 创建成功后跳转详情页而非手动join
   - 文件: `org-manager.tsx` + `project-manager.tsx`
   - 策略: 新增/my-agents端点获取agent UUID, join/leave使用agent_id而非human_id
   - 结果: 后端新增MyAgentsResponse+my_agents服务+router, 前端7处patch, 验证Join org 200✅

2. [x] **优化首页导航** — 当前首页只有链接列表, 改为带用户状态的Dashboard ✅
   - 文件: `page.tsx` + 新建 `components/dashboard/dashboard-view.tsx`
   - 内容: 登录状态显示、快捷操作入口(创建org/project、查看wallet、agent状态)

3. [x] **增强Navbar** ✅ — 添加登录状态显示、用户名、登出按钮
   - 文件: `navbar.tsx`
   - 增加条件渲染: 未登录→Login/Register按钮; 已登录→用户名+Avatar+Logout

4. [x] **统一错误处理与Toast通知** ✅ — 当前API错误只在console, 用户看不到
   - 新建: `components/common/toast.tsx` + `components/providers.tsx`增加toast provider
   - 所有API调用失败→显示红色toast, 成功→绿色toast

5. [x] **Mini验证A** ✅ build通过+前端运行正常

---

## B. 新页面开发(核心功能补全)

6. [✓] **[D] Dashboard页面** ✅ — 个人中心, 展示: 我的身份、我的组织、我的项目、我的Agent、余额概览
   - 已建: `app/dashboard/page.tsx` + `components/dashboard/dashboard-view.tsx`
   - 调用: `identity.me` + `settlement.balance` + `organization.list` + `project.list`

7. [✓] **[D] Agent注册与绑定页面** ✅ — 让用户注册Agent并绑定到自己的Human身份
   - 已建: `app/identity/page.tsx` + `components/identity/identity-manager.tsx`
   - SPEC: `identity.register-agent`(name+capabilities+description) + `identity.my-agents`

8. [✓] **[D] Admin管理页面** ✅ — 管理员专用: 账户freeze/unfreeze、制动、审计日志
   - 已建: `app/admin/page.tsx` + `components/admin/admin-panel.tsx`
   - SPEC: `admin.login` + `admin.freeze` + `admin.unfreeze` + `admin.brake` + `admin.audit`

9. [✓] **[D] 消息中心页面** ✅ — A2A消息收发界面
   - 已建: `app/messages/page.tsx` + `components/messages/message-center.tsx`
   - SPEC: `a2a.messages`(GET获取+POST发送) + `a2a.messages/{id}/status`

10. [✓] **Mini验证B** ✅ — 12页面全部200 + 13项API E2E全通过(proxy→backend)
   - 结果: 12页面200含title, Register/Login/Dashboard/Org CRUD/Project CRUD/MCP/Deposit/Balance/MyAgents全部通过

---

## C. 安全与实时升级(Phase1待定事项)

11. [✓] **httpOnly Cookie认证升级** — 8文件修改完成, proxy用2个route handler替代rewrite, 18/18自动化测试全通过

12. [ ] **WebSocket实时推送** — 消息和事件实时通知
   - 后端: 新增WebSocket endpoint(`/ws`) + FastAPI WebSocket支持
   - 前端: 新建 `lib/ws.ts` WebSocket客户端 + `components/common/notification-badge.tsx`
   - 推送事件: 新消息、组织邀请、项目状态变更、余额变动

13. [ ] **Mini验证C**: 登录后检查httpOnly cookie存在 + WebSocket连接建立 + 推送消息到达前端

---

## D. LLM Agent接入(核心功能升级)

14. [ ] **[D] LLM Agent后端集成** — 替换MockAgent固定响应为真实LLM调用
   - 后端: 新增 `agent_society/llm/` 模块, 支持 OpenAI/Anthropic API
   - 配置: `.env` 增加 `LLM_API_KEY` + `LLM_MODEL` + `LLM_BASE_URL`
   - MockAgent改为: 请求LLM API → 返回真实响应(失败时fallback到Mock)

15. [ ] **[D] Agent对话界面增强** — A2A页面增加真实对话交互
   - 文件: `a2a-explorer.tsx` 增加对话模式
   - 功能: 选择Agent → 输入消息 → 显示LLM回复 → 多轮对话历史

16. [ ] **Mini验证D**: 向注册Agent发送消息 → 收到LLM真实回复(非Mock固定响应)

---

## E. 高级功能

17. [ ] **项目密室加密** — 项目内通信端到端加密
   - 后端: 新增 `agent_society/crypto/` 模块(E2EE密钥交换+加密存储)
   - 前端: 项目详情页增加"密室模式"开关 + 加密消息展示
   - ⚠待确认: 加密方案选择(Noise Protocol/X3DH/Signal Protocol)

18. [ ] **全局Mini验证(终检)**: 运行verify_all.py确认43后端端点仍全部PASS + 前端npm run build无报错 + 5新页面200 + 用户验收流程顺畅

---

## 验收目标

- ✅ 用户可顺畅完成: 注册→登录→创建组织→创建项目→注册Agent→充值→转账→A2A对话
- ✅ 所有页面无400/500错误, Toast通知替代console.error
- ✅ Admin可冻结/解冻账户, 查看审计日志
- ✅ httpOnly cookie认证生效, localStorage不再存token
- ✅ WebSocket推送消息实时到达前端
- ✅ Agent回复来自真实LLM(非Mock固定响应)
