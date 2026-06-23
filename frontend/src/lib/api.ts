/** API客户端 - fetch封装 + httpOnly Cookie认证 + 401自动刷新 */

import type {
  HumanProfile, HumanRegisterRequest, HumanRegisterResponse, HumanLoginRequest, TokenResponse,
  AgentDirectoryResponse, AgentStatsResponse,
  ProjectDirectoryResponse, ProjectDetailResponse,
  OrganizationDirectoryResponse, OrganizationDetailResponse,
  LeaderboardResponse, LeaderboardSummaryResponse,
  AgentCard, AgentCardUpdate, A2AMessage, A2AMessageSend, DiscoverResponse, MessageListResponse, PlatformAgentCard,
  MCPTool, MCPResource, MCPCallResult, MCPRpcResponse,
  TransferRequest, DepositRequest, BalanceResponse, TransactionListResponse,
  MyAgentsResponse,
  OrganizationCreateRequest, OrganizationUpdateRequest, OrganizationCRUDResponse, OrganizationCRUDListResponse, MemberListResponse,
  ProjectCreateRequest, ProjectUpdateRequest, ProjectCRUDResponse, ProjectCRUDListResponse, ParticipantListResponse, StatusTransitionRequest,
} from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

/** 清理params对象(去除undefined/null值) */
function cleanParams(params: Record<string, any>): string {
  const filtered: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") {
      filtered[k] = String(v);
    }
  }
  return new URLSearchParams(filtered).toString();
}

class ApiClient {
  /** 构造请求headers — httpOnly Cookie模式下无需手动添加Authorization */
  private getHeaders(hasBody: boolean = false): Record<string, string> {
    const headers: Record<string, string> = {};
    // Token由httpOnly Cookie自动携带，不再从localStorage读取
    if (hasBody) headers["Content-Type"] = "application/json";
    return headers;
  }

  private isRefreshing = false;
  private refreshPromise: Promise<boolean> | null = null;

  /** 自动刷新token — httpOnly Cookie模式下POST /auth/refresh即可 */
  private async tryRefresh(): Promise<boolean> {
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }
    this.isRefreshing = true;
    this.refreshPromise = this._doRefresh();
    const result = await this.refreshPromise;
    this.isRefreshing = false;
    this.refreshPromise = null;
    return result;
  }

  private async _doRefresh(): Promise<boolean> {
    // httpOnly Cookie模式下，refresh_token由cookie自动携带
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // 关键：携带httpOnly Cookie
      });
      if (!res.ok) return false;
      // 新token通过Set-Cookie自动写入浏览器
      return true;
    } catch {
      return false;
    }
  }

  private async request<T>(method: string, path: string, body?: any): Promise<T> {
    const hasBody = body !== undefined;
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: this.getHeaders(hasBody),
      body: hasBody ? JSON.stringify(body) : undefined,
      credentials: "include", // 关键：所有请求都携带httpOnly Cookie
    });

    // 401 → 自动尝试refresh后重试一次
    if (res.status === 401) {
      const refreshed = await this.tryRefresh();
      if (refreshed) {
        const retryRes = await fetch(`${API_BASE}${path}`, {
          method,
          headers: this.getHeaders(hasBody),
          body: hasBody ? JSON.stringify(body) : undefined,
          credentials: "include",
        });
        if (!retryRes.ok) {
          let detail = retryRes.statusText;
          try { const errBody = await retryRes.json(); detail = errBody.detail || errBody.message || JSON.stringify(errBody); } catch {}
          throw new Error(`API error ${retryRes.status}: ${detail}`);
        }
        return retryRes.json();
      }
      // refresh失败 → 抛出错误让UI层处理
      throw new Error("UNAUTHORIZED");
    }

    if (!res.ok) {
      let detail = res.statusText;
      try { const errBody = await res.json(); detail = errBody.detail || errBody.message || JSON.stringify(errBody); } catch {}
      throw new Error(`API error ${res.status}: ${detail}`);
    }
    return res.json();
  }

  // === Identity ===
  identity = {
    registerHuman: (data: HumanRegisterRequest) =>
      this.request<HumanRegisterResponse>("POST", "/identity/register", data),
    registerAgent: (data: any) =>
      this.request("POST", "/identity/register-agent", data),
    registerOrganization: (data: any) =>
      this.request("POST", "/identity/register-organization", data),
    getProfile: () => this.request<HumanProfile>("GET", "/identity/me"),
    updateProfile: (data: any) => this.request("PUT", "/identity/me", data),
    myAgents: () => this.request<MyAgentsResponse>("GET", "/identity/my-agents"),
  };

  // === Auth ===
  auth = {
    /** 人类用户登录 → httpOnly Cookie自动写入 */
    login: (data: HumanLoginRequest) =>
      this.request<TokenResponse>("POST", "/auth/login", data),
    /** 人类用户注册 */
    register: (data: HumanRegisterRequest) =>
      this.request<HumanRegisterResponse>("POST", "/auth/register", data),
    /** 登出 → 清除httpOnly Cookie */
    logout: () =>
      this.request<{ message: string }>("POST", "/auth/logout"),
    /** 获取当前JWT Token — 用于在其他平台接入Agent时作为Bearer Token */
    myToken: () =>
      this.request<{ access_token: string; user_type: string; sub: string; expires_at: number }>("GET", "/auth/my-token"),
    /** 绑定Agent到Human账户 → 创建OAuth2 client credentials */
    bindAgent: (agentId: string) =>
      this.request<{ agent_id: string; human_id: string; client_id: string; client_secret: string; status: string }>("POST", "/auth/bind-agent", { agent_id: agentId }),
    /** 获取Agent的接入凭证 → client_id/client_secret/短期access_token */
    agentCredentials: (agentId: string) =>
      this.request<{ client_id: string; client_secret: string; access_token: string; expires_in: number }>("POST", "/auth/agent-credentials", { agent_id: agentId }),
  };

  // === Observatory ===
  observatory = {
    /** Agent列表(分页+筛选) */
    listAgents: (params: { page?: number; page_size?: number; status?: string; capability?: string; organization?: string } = {}) =>
      this.request<AgentDirectoryResponse>("GET", `/observatory/agents?${cleanParams(params)}`),
    /** Agent统计概览 */
    getAgentStats: () =>
      this.request<AgentStatsResponse>("GET", "/observatory/agents/stats"),
    /** Agent详情 */
    getAgentDetail: (id: string) =>
      this.request("GET", `/observatory/agents/${id}`),
    /** 项目列表(分页+筛选) */
    listProjects: (params: { page?: number; page_size?: number; status?: string; type?: string } = {}) =>
      this.request<ProjectDirectoryResponse>("GET", `/observatory/projects?${cleanParams(params)}`),
    /** 项目详情 */
    getProjectDetail: (id: string) =>
      this.request<ProjectDetailResponse>("GET", `/observatory/projects/${id}`),
    /** 组织列表(分页) */
    listOrganizations: (params: { page?: number; page_size?: number } = {}) =>
      this.request<OrganizationDirectoryResponse>("GET", `/observatory/organizations?${cleanParams(params)}`),
    /** 组织详情 */
    getOrganizationDetail: (id: string) =>
      this.request<OrganizationDetailResponse>("GET", `/observatory/organizations/${id}`),
    /** 排行榜(type=reputation|token) */
    getLeaderboard: (params: { type: "reputation" | "token"; page?: number; page_size?: number; organization?: string; time_range?: string }) =>
      this.request<LeaderboardResponse>("GET", `/observatory/leaderboard?${cleanParams(params)}`),
    /** 排行榜摘要 */
    getLeaderboardSummary: () =>
      this.request<LeaderboardSummaryResponse>("GET", "/observatory/leaderboard/summary"),
  };

  // === Settlement ===
  settlement = {
    deposit: (data: DepositRequest) =>
      this.request<BalanceResponse>("POST", "/settlement/deposit", data),
    getBalance: (holderId: string, holderType: string = "agent") =>
      this.request<BalanceResponse>("GET", `/settlement/balance/${holderId}?holder_type=${holderType}`),
    transfer: (data: TransferRequest) =>
      this.request("POST", "/settlement/transfer", data),
    getTransactions: (holderId: string, params: { holder_type?: string; limit?: number; offset?: number } = {}) =>
      this.request<TransactionListResponse>("GET", `/settlement/transactions/${holderId}?${cleanParams(params)}`),
  };

  // === Organization CRUD ===
  organizations = {
    create: (data: OrganizationCreateRequest) =>
      this.request<OrganizationCRUDResponse>("POST", "/organization/create", data),
    list: (params: { limit?: number; offset?: number } = {}) =>
      this.request<OrganizationCRUDListResponse>("GET", `/organization/list?${cleanParams(params)}`),
    get: (orgId: string) =>
      this.request<OrganizationCRUDResponse>("GET", `/organization/${orgId}`),
    update: (orgId: string, data: OrganizationUpdateRequest) =>
      this.request<OrganizationCRUDResponse>("PUT", `/organization/${orgId}/update`, data),
    join: (orgId: string, data?: { agent_id?: string }) =>
      this.request("POST", `/organization/${orgId}/join`, data || {}),
    listMembers: (orgId: string) =>
      this.request<MemberListResponse>("GET", `/organization/${orgId}/members`),
  };

  // === Project CRUD ===
  projects = {
    create: (data: ProjectCreateRequest) =>
      this.request<ProjectCRUDResponse>("POST", "/project/create", data),
    list: (params: { limit?: number; offset?: number; status?: string; type?: string } = {}) =>
      this.request<ProjectCRUDListResponse>("GET", `/project/list?${cleanParams(params)}`),
    get: (projectId: string) =>
      this.request<ProjectCRUDResponse>("GET", `/project/${projectId}`),
    update: (projectId: string, data: ProjectUpdateRequest) =>
      this.request<ProjectCRUDResponse>("PUT", `/project/${projectId}/update`, data),
    join: (projectId: string, data?: { agent_id?: string }) =>
      this.request("POST", `/project/${projectId}/join`, data || {}),
    leave: (projectId: string, data?: { agent_id?: string }) =>
      this.request("POST", `/project/${projectId}/leave`, data || {}),
    updateStatus: (projectId: string, data: StatusTransitionRequest) =>
      this.request("PATCH", `/project/${projectId}/status`, data),
    listParticipants: (projectId: string) =>
      this.request<ParticipantListResponse>("GET", `/project/${projectId}/participants`),
  };

  // === A2A ===
  a2a = {
    getAgentCard: (agentId: string) =>
      this.request<AgentCard>("GET", `/a2a/agents/${agentId}/card`),
    updateAgentCard: (agentId: string, data: AgentCardUpdate) =>
      this.request<AgentCard>("PUT", `/a2a/agents/${agentId}/card`, data),
    discoverAgents: (params: { capability?: string; status?: string } = {}) =>
      this.request<DiscoverResponse>("GET", `/a2a/agents/discover?${cleanParams(params)}`),
    registerAgent: (data: { agent_id: string; name: string; description: string; capabilities: string[]; endpoints?: Record<string, any> }) =>
      this.request<AgentCard>("POST", "/a2a/agents/register", data),
    sendMessage: (data: A2AMessageSend) =>
      this.request<A2AMessage>("POST", "/a2a/messages", data),
    getMessages: (agentId: string, params: { direction?: string; limit?: number; offset?: number; status?: string } = {}) =>
      this.request<MessageListResponse>("GET", `/a2a/messages/${agentId}?${cleanParams(params)}`),
    updateMessageStatus: (messageId: string, data: { status: string }) =>
      this.request("PUT", `/a2a/messages/${messageId}/status`, data),
    getPlatformCard: () =>
      this.request<PlatformAgentCard>("GET", "/.well-known/agent.json"),
  };

  // === Admin ===
  admin = {
    init: (data: { username: string; password: string; email: string }) =>
      this.request("POST", "/admin/init", data),
    login: (data: { username: string; password: string }) =>
      this.request("POST", "/admin/login", data),
    freezeAgent: (agentId: string, data: { reason: string }) =>
      this.request("POST", `/admin/agents/${agentId}/freeze`, data),
    unfreezeAgent: (agentId: string, data: { reason: string }) =>
      this.request("POST", `/admin/agents/${agentId}/unfreeze`, data),
    revokeAgent: (agentId: string, data: { reason: string }) =>
      this.request("POST", `/admin/agents/${agentId}/revoke`, data),
    suspendProject: (projectId: string, data: { reason: string }) =>
      this.request("POST", `/admin/projects/${projectId}/suspend`, data),
    resumeProject: (projectId: string, data: { reason: string }) =>
      this.request("POST", `/admin/projects/${projectId}/resume`, data),
    suspendOrganization: (orgId: string, data: { reason: string }) =>
      this.request("POST", `/admin/organizations/${orgId}/suspend`, data),
    resumeOrganization: (orgId: string, data: { reason: string }) =>
      this.request("POST", `/admin/organizations/${orgId}/resume`, data),
    freezeAccount: (accountId: string, data: { reason: string }) =>
      this.request("POST", `/admin/accounts/${accountId}/freeze`, data),
    unfreezeAccount: (accountId: string, data: { reason: string }) =>
      this.request("POST", `/admin/accounts/${accountId}/unfreeze`, data),
    brake: (data: { scope?: string; reason: string }) =>
      this.request("POST", "/admin/brake", data),
    getAuditLog: (params: { event_type?: string; target_type?: string; start_time?: string; end_time?: string } = {}) =>
      this.request("GET", `/admin/audit?${cleanParams(params)}`),
  };

  // === MCP ===
  mcp = {
    listTools: () =>
      this.request<MCPTool[]>("GET", "/mcp/tools"),
    callTool: (toolName: string, args: any) =>
      this.request<MCPCallResult>("POST", "/mcp/tools/call", { tool_name: toolName, arguments: args }),
    listResources: () =>
      this.request<MCPResource[]>("GET", "/mcp/resources"),
    readResource: (uri: string) =>
      this.request("GET", `/mcp/resources/${encodeURIComponent(uri)}`),
    rpc: (method: string, params?: any) =>
      this.request<MCPRpcResponse>("POST", "/mcp/rpc", { jsonrpc: "2.0", method, params: params || {}, id: Date.now() }),
  };
}

export const api = new ApiClient();
