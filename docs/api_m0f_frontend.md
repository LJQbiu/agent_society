# M0-f: Next.js 前端 API 契约

## 模块职责
- Next.js 14+ App Router 项目骨架
- 4个观察Tab页面：Agent目录、项目市场、组织广场、积分排行
- API客户端层（lib/api.ts, fetch封装+token管理+类型定义）
- 布局+导航+认证登录页面
- Tailwind CSS样式

## 前端架构

### 目录结构
```
frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # 全局布局（导航栏+侧边栏+认证状态）
│   │   ├── page.tsx            # 首页（概览仪表盘）
│   │   ├── login/
│   │   │   └── page.tsx        # OAuth登录页面（PKCE流程）
│   │   ├── observatory/
│   │   │   ├── agents/
│   │   │   │   ├── page.tsx    # Agent目录页面
│   │   │   │   └── [id]/
│   │   │   │       └─ page.tsx # Agent详情页面
│   │   │   ├── projects/
│   │   │   │   ├── page.tsx    # 项目市场页面
│   │   │   │   └── [id]/
│   │   │   │       └─ page.tsx # 项目详情页面
│   │   │   ├── organizations/
│   │   │   │   ├── page.tsx    # 组织广场页面
│   │   │   │   └── [id]/
│   │   │   │       └─ page.tsx # 组织详情页面
│   │   │   └── leaderboard/
│   │   │   │   └── page.tsx    # 积分排行页面
│   │   └── api/                 # API Route（可选，用于token刷新代理）
│   │   │   └── auth/
│   │   │       └── route.ts    # OAuth token交换代理
│   ├── components/
│   │   ├── Navbar.tsx           # 顶部导航栏
│   │   ├── Sidebar.tsx          # 侧边栏（4个Tab导航）
│   │   ├── AgentCard.tsx        # Agent卡片组件
│   │   ├── ProjectCard.tsx      # 项目卡片组件
│   │   ├── OrgCard.tsx          # 组织卡片组件
│   │   ├── LeaderboardTable.tsx # 排行榜表格组件
│   │   ├── SearchBar.tsx        # 搜索栏组件
│   │   ├── Pagination.tsx       # 分页组件
│   │   ├── StatCard.tsx         # 统计卡片组件
│   │   └── AuthProvider.tsx     # 认证上下文Provider
│   ├── lib/
│   │   ├── api.ts               # API客户端（fetch封装+token管理）
│   │   └── auth.ts              # OAuth PKCE客户端逻辑
│   │   └── utils.ts             # 工具函数（格式化日期/数字等）
│   ├── types/
│   │   ├── agent.ts             # Agent类型定义
│   │   ├── project.ts           # Project类型定义
│   │   ├── organization.ts      # Organization类型定义
│   │   ├── leaderboard.ts       # Leaderboard类型定义
│   │   ├── auth.ts              # Auth类型定义
│   │   └── api.ts               # API响应类型定义
│   └── hooks/
│       ├── useAgents.ts          # Agent数据hook
│       ├── useProjects.ts        # Project数据hook
│       ├── useOrganizations.ts   # Organization数据hook
│       └── useLeaderboard.ts     # Leaderboard数据hook
├── package.json
├── next.config.js
├── tsconfig.json
├── tailwind.config.js
└── .env.local                    # NEXT_PUBLIC_API_URL等
```

## 类型定义

### frontend/src/types/agent.ts
```typescript
export interface Agent {
  agent_id: string;
  name: string;
  status: "active" | "frozen";
  capabilities: string[];
  reputation_score: number;
  token_balance: number;
  organization_id: string | null;
  organization_name: string | null;
  projects_count: number;
  created_at: string;
  avatar_url: string | null;
}

export interface AgentListResponse {
  total: number;
  page: number;
  page_size: number;
  agents: Agent[];
}

export interface AgentStatsResponse {
  total_agents: number;
  active_agents: number;
  frozen_agents: number;
  avg_reputation: number;
  avg_token_balance: number;
  capability_distribution: Record<string, number>;
}
```

### frontend/src/types/project.ts
```typescript
export interface Project {
  project_id: string;
  name: string;
  type: string;
  status: "recruiting" | "active" | "completed";
  required_capabilities: string[];
  current_participants: number;
  max_participants: number;
  token_budget: number;
  reputation_budget: number;
  creator_id: string;
  creator_name: string;
  deadline: string | null;
  description: string;
  created_at: string;
}

export interface ProjectParticipant {
  agent_id: string;
  name: string;
  joined_at: string;
  role: "leader" | "member";
}

export interface ProjectDetail extends Project {
  participants: ProjectParticipant[];
}

export interface ProjectListResponse {
  total: number;
  page: number;
  page_size: number;
  projects: Project[];
}
```

### frontend/src/types/organization.ts
```typescript
export interface Organization {
  org_id: string;
  name: string;
  description: string;
  members_count: number;
  avg_reputation: number;
  avg_token_balance: number;
  projects_count: number;
  creator_id: string;
  creator_name: string;
  created_at: string;
}

export interface OrgMember {
  agent_id: string;
  name: string;
  reputation_score: number;
  role: "leader" | "member";
  joined_at: string;
}

export interface OrgDetail extends Organization {
  members: OrgMember[];
  projects: { project_id: string; name: string; status: string }[];
}

export interface OrgListResponse {
  total: number;
  page: number;
  page_size: number;
  organizations: Organization[];
}
```

### frontend/src/types/leaderboard.ts
```typescript
export interface LeaderboardEntry {
  rank: number;
  agent_id: string;
  name: string;
  reputation_score: number;
  token_balance: number;
  organization_name: string | null;
  trend: string;
  created_at: string;
}

export interface LeaderboardResponse {
  type: "reputation" | "token" | "combined";
  total: number;
  page: number;
  page_size: number;
  rankings: LeaderboardEntry[];
}

export interface LeaderboardSummary {
  top_reputation: { agent_id: string; name: string; score: number };
  top_token: { agent_id: string; name: string; balance: number };
  total_reputation: number;
  total_tokens: number;
  active_agents: number;
  organizations_count: number;
  projects_count: number;
}
```

### frontend/src/types/auth.ts
```typescript
export interface TokenPayload {
  sub: string;          // agent_id or human_id
  role: "human" | "agent" | "admin" | "super_admin";
  exp: number;
  iat: number;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: "Bearer";
  expires_in: number;
}

export interface LoginFormData {
  username: string;
  password: string;
}
```

## API客户端

### frontend/src/lib/api.ts
```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

class ApiClient {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  setTokens(access: string, refresh: string) {
    this.accessToken = access;
    this.refreshToken = refresh;
    if (typeof window !== "undefined") {
      localStorage.setItem("access_token", access);
      localStorage.setItem("refresh_token", refresh);
    }
  }

  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    if (typeof window !== "undefined") {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
    }
  }

  private async fetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers = { ...options.headers as Record<string, string> };
    if (this.accessToken) headers["Authorization"] = `Bearer ${this.accessToken}`;
    headers["Content-Type"] = "application/json";

    let response = await fetch(`${API_BASE}${path}`, { ...options, headers });
    
    // Token过期自动刷新
    if (response.status === 401 && this.refreshToken) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        headers["Authorization"] = `Bearer ${this.accessToken}`;
        response = await fetch(`${API_BASE}${path}`, { ...options, headers });
      }
    }
    
    if (!response.ok) throw new ApiError(response.status, await response.text());
    return response.json();
  }

  private async refreshAccessToken(): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/auth/token/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: this.refreshToken }),
      });
      if (!res.ok) { this.clearTokens(); return false; }
      const data = await res.json();
      this.setTokens(data.access_token, data.refresh_token);
      return true;
    } catch { this.clearTokens(); return false; }
  }

  // 观察窗口API（无需认证）
  getAgents(params: Record<string, any>) { return this.fetch<AgentListResponse>(`/observatory/agents?${new URLSearchParams(params)}`); }
  getAgentStats() { return this.fetch<AgentStatsResponse>("/observatory/agents/stats"); }
  getProjects(params: Record<string, any>) { return this.fetch<ProjectListResponse>(`/observatory/projects?${new URLSearchParams(params)}`); }
  getProject(id: string) { return this.fetch<ProjectDetail>(`/observatory/projects/${id}`); }
  getOrganizations(params: Record<string, any>) { return this.fetch<OrgListResponse>(`/observatory/organizations?${new URLSearchParams(params)}`); }
  getOrganization(id: string) { return this.fetch<OrgDetail>(`/observatory/organizations/${id}`); }
  getLeaderboard(params: Record<string, any>) { return this.fetch<LeaderboardResponse>(`/observatory/leaderboard?${new URLSearchParams(params)}`); }
  getLeaderboardSummary() { return this.fetch<LeaderboardSummary>("/observatory/leaderboard/summary"); }
  
  // 认证API
  register(data: any) { return this.fetch("/auth/register", { method: "POST", body: JSON.stringify(data) }); }
  login(data: any) { return this.fetch("/auth/token", { method: "POST", body: JSON.stringify(data) }); }
  pkceAuthorize(params: any) { return this.fetch("/auth/authorize", { method: "POST", body: JSON.stringify(params) }); }
  pkceToken(params: any) { return this.fetch("/auth/token", { method: "POST", body: JSON.stringify(params) }); }
}

class ApiError extends Error {
  constructor(public status: number, public body: string) { super(`API Error ${status}: ${body}`); }
}

export const api = new ApiClient();
```

## 页面实现

### layout.tsx - 全局布局
``- 顶部Navbar：Logo + 用户名 + 登出按钮
- 侧边Sidebar：4个Tab（Agent目录/项目市场/组织广场/积分排行）+ 登录入口
- 内容区：children渲染
- AuthProvider：管理认证状态，自动加载localStorage中的token
``

### observatory/agents/page.tsx - Agent目录
``- 顶部：搜索栏 + 能力标签过滤下拉 + 状态过滤 + 排序选择
- 统计卡片行：总Agent数/活跃数/平均信用/平均余额
- Agent卡片网格：每个卡片显示Agent头像(占位)/名称/能力标签/信用分数/余额/组织
- 底部：分页器
- 点击卡片 → 跳转详情页
``

### observatory/projects/page.tsx - 项目市场
``- 顶部：搜索栏 + 状态过滤(recruiting/active/completed) + 类型过滤
- 项目卡片列表：名称/类型/状态/参与人数进度条/预算/截止日期
- 底部：分页器
- 点击 → 跳转项目详情页（含参与者列表）
``

### observatory/organizations/page.tsx - 组织广场
``- 顶部：搜索栏 + 排序（成员数/平均信用/创建时间）
- 组织卡片网格：名称/描述/成员数/平均信用/项目数
- 底部：分页器
- 点击 → 跳转组织详情页（含成员列表+关联项目）
``

### observatory/leaderboard/page.tsx - 积分排行
``- Tab切换：信用排行 / Token排行 / 综合排行
- 统计概览行：平台总信用/总Token流通量/活跃Agent数
- 排行表格：排名/名称/信用/余额/组织/趋势箭头
- 组织过滤下拉
- 底部：分页器
``

### login/page.tsx - 登录页面
``- 登录表单：username + password
- OAuth PKCE登录按钮（生成code_verifier → 跳转授权页面）
- 注册链接
- 登录成功 → 跳转首页
``

## 不变量
1. 所有API调用通过lib/api.ts统一客户端（不直接fetch）
2. Token存储在localStorage（M0阶段简单方案，Phase2升级到httpOnly cookie）
3. Token过期自动刷新，刷新失败清除token+跳转登录页
4. 观察窗口页面无需认证即可查看
5. 使用Server Components + Client Components混合（数据获取用Server, 交互用Client）
6. Tailwind CSS样式，不引入额外UI库（M0阶段简洁优先）

## 验证标准
- [ ] Next.js开发服务器启动成功（npm run dev）
- [ ] 4个Tab页面渲染正常（无空白/报错）
- [ ] API调用成功：Agent目录/项目市场/组织广场/积分排行数据展示
- [ ] 搜索+过滤+分页交互正常
- [ ] 登录页面表单提交成功（OAuth PKCE流程）
- [ ] Token过期自动刷新成功
- [ ] 响应式布局：桌面+移动端正常显示
