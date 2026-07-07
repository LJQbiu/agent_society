/** TanStack Query hooks — 替代手动 useState+useEffect+api 调用 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import type { OrganizationCreateRequest, OrganizationUpdateRequest, JoinOrgRequest, ProjectCreateRequest, ProjectUpdateRequest, TodoCreate, TodoUpdate, TodoClaimRequest, A2AMessageSend, DepositRequest, TransferRequest, ChatMessageCreate, StatusTransitionRequest } from "@/types";

// ─── Query Key工厂 ───
export const queryKeys = {
  agents: (params?: Record<string, any>) => ["agents", params] as const,
  agentDetail: (id: string) => ["agentDetail", id] as const,
  agentStats: () => ["agentStats"] as const,
  myAgents: () => ["myAgents"] as const,
  myToken: () => ["myToken"] as const,
  organizations: (params?: Record<string, any>) => ["organizations", params] as const,
  orgDetail: (id: string) => ["orgDetail", id] as const,
  orgMessages: (id: string) => ["orgMessages", id] as const,
  projects: (params?: Record<string, any>) => ["projects", params] as const,
  projectDetail: (id: string) => ["projectDetail", id] as const,
  leaderboard: (params: Record<string, any>) => ["leaderboard", params] as const,
  leaderboardSummary: () => ["leaderboardSummary"] as const,
  balance: (holderId: string, holderType?: string) => ["balance", holderId, holderType] as const,
  transactions: (holderId: string, params?: Record<string, any>) => ["transactions", holderId, params] as const,
  a2aPlatformCard: () => ["a2aPlatformCard"] as const,
  skills: () => ["skills"] as const,
};

// ─── Observatory ───

/** Agent列表(分页+筛选) */
export function useAgents(params: { page?: number; page_size?: number; status?: string; capability?: string; organization?: string } = {}) {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.agents(params),
    queryFn: () => api.observatory.listAgents(params),
    enabled: !!user,
  });
}

/** Agent统计概览 */
export function useAgentStats() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.agentStats(),
    queryFn: () => api.observatory.getAgentStats(),
    enabled: !!user,
  });
}

/** Agent详情 */
export function useAgentDetail(id: string) {
  return useQuery({
    queryKey: queryKeys.agentDetail(id),
    queryFn: () => api.observatory.getAgentDetail(id),
    enabled: !!id,
  });
}

/** 项目列表(分页+筛选) */
export function useProjects(params: { page?: number; page_size?: number; status?: string; type?: string } = {}) {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.projects(params),
    queryFn: () => api.observatory.listProjects(params),
    enabled: !!user,
  });
}

/** 项目详情 */
export function useProjectDetail(id: string) {
  return useQuery({
    queryKey: queryKeys.projectDetail(id),
    queryFn: () => api.observatory.getProjectDetail(id),
    enabled: !!id,
  });
}

/** 组织列表(分页) */
export function useOrganizations(params: { page?: number; page_size?: number } = {}) {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.organizations(params),
    queryFn: () => api.observatory.listOrganizations(params),
    enabled: !!user,
  });
}

/** 组织详情 */
export function useOrganizationDetail(id: string) {
  return useQuery({
    queryKey: queryKeys.orgDetail(id),
    queryFn: () => api.observatory.getOrganizationDetail(id),
    enabled: !!id,
  });
}

/** 组织消息 */
export function useOrgMessages(id: string) {
  return useQuery({
    queryKey: queryKeys.orgMessages(id),
    queryFn: () => api.organizations.getMessages(id),
    enabled: !!id,
  });
}

/** 排行榜 */
export function useLeaderboard(params: { type: "reputation" | "token"; page?: number; page_size?: number; organization?: string; time_range?: string }) {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.leaderboard(params),
    queryFn: () => api.observatory.getLeaderboard(params),
    enabled: !!user,
  });
}

/** 排行榜摘要 */
export function useLeaderboardSummary() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.leaderboardSummary(),
    queryFn: () => api.observatory.getLeaderboardSummary(),
    enabled: !!user,
  });
}

// ─── Identity ───

/** 我的资料 */
export function useProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["profile"],
    queryFn: () => api.identity.getProfile(),
    enabled: !!user,
  });
}

/** 我的Agents */
export function useMyAgents() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.myAgents(),
    queryFn: () => api.identity.myAgents(),
    enabled: !!user,
  });
}

/** Identity mutations (updateProfile, agentCredentials) */
export function useIdentityMutations() {
  const qc = useQueryClient();
  return {
    updateProfile: useMutation({
      mutationFn: (data: Record<string, unknown>) => api.identity.updateProfile(data),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
    }),
    agentCredentials: useMutation({
      mutationFn: (agentId: string) => api.auth.agentCredentials(agentId),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["myAgents"] }),
    }),
  };
}

/** 我的JWT Token */
export function useMyToken() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.myToken(),
    queryFn: () => api.auth.myToken(),
    enabled: !!user,
  });
}

// ─── Settlement ───

/** 余额 */
export function useBalance(holderId: string, holderType: string = "agent") {
  return useQuery({
    queryKey: queryKeys.balance(holderId, holderType),
    queryFn: () => api.settlement.getBalance(holderId, holderType),
    enabled: !!holderId,
  });
}

/** 交易记录 */
export function useTransactions(holderId: string, params: { holder_type?: string; limit?: number; offset?: number } = {}) {
  return useQuery({
    queryKey: queryKeys.transactions(holderId, params),
    queryFn: () => api.settlement.getTransactions(holderId, params),
    enabled: !!holderId,
  });
}

// ─── A2A ───

/** 平台Agent Card */
export function useA2aPlatformCard() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.a2aPlatformCard(),
    queryFn: () => api.a2a.getPlatformCard(),
    enabled: !!user,
  });
}

// ─── CRUD Queries (Org/Project detail pages) ───

/** 组织CRUD列表 */
export function useOrgCrudList(params: { limit?: number; offset?: number } = {}) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["orgCrudList", params],
    queryFn: () => api.organizations.list(params),
    enabled: !!user,
  });
}

/** 组织CRUD详情 */
export function useOrgCrudDetail(orgId: string) {
  return useQuery({
    queryKey: ["orgCrudDetail", orgId],
    queryFn: () => api.organizations.get(orgId),
    enabled: !!orgId,
  });
}

/** 组织成员列表 */
export function useOrgMembers(orgId: string) {
  return useQuery({
    queryKey: ["orgMembers", orgId],
    queryFn: () => api.organizations.listMembers(orgId),
    enabled: !!orgId,
  });
}

/** 项目CRUD列表 */
export function useProjectCrudList(params: { limit?: number; offset?: number; status?: string; type?: string; owner_id?: string } = {}) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["projectCrudList", params],
    queryFn: () => api.projects.list(params),
    enabled: !!user,
  });
}

/** 项目CRUD详情 */
export function useProjectCrudDetail(projectId: string) {
  return useQuery({
    queryKey: ["projectCrudDetail", projectId],
    queryFn: () => api.projects.get(projectId),
    enabled: !!projectId,
  });
}

/** 项目参与者列表 */
export function useProjectParticipants(projectId: string) {
  return useQuery({
    queryKey: ["projectParticipants", projectId],
    queryFn: () => api.projects.listParticipants(projectId),
    enabled: !!projectId,
  });
}

/** 项目聊天消息(轮询) */
export function useProjectChatMessages(projectId: string, limit: number = 50) {
  return useQuery({
    queryKey: ["projectChatMessages", projectId, limit],
    queryFn: () => api.projects.listChatMessages(projectId, limit),
    enabled: !!projectId,
    refetchInterval: 5000,
  });
}

/** 项目Todo列表(轮询) */
export function useProjectTodos(projectId: string) {
  return useQuery({
    queryKey: ["projectTodos", projectId],
    queryFn: () => api.projects.listTodos(projectId),
    enabled: !!projectId,
    refetchInterval: 10000,
  });
}

/** 项目CRUD mutations */
export function useProjectMutations() {
  const qc = useQueryClient();
  return {
    createProject: useMutation({
      mutationFn: (data: ProjectCreateRequest) => api.projects.create(data),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["projectCrudList"] }),
    }),
    updateProject: useMutation({
      mutationFn: ({ id, data }: { id: string; data: ProjectUpdateRequest }) => api.projects.update(id, data),
      onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ["projectCrudDetail", vars.id] }),
    }),
    joinProject: useMutation({
      mutationFn: ({ id, data }: { id: string; data?: Record<string, unknown> }) => api.projects.join(id, data),
      onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ["projectCrudDetail", vars.id] }),
    }),
    leaveProject: useMutation({
      mutationFn: ({ id, data }: { id: string; data?: Record<string, unknown> }) => api.projects.leave(id, data),
      onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ["projectCrudDetail", vars.id] }),
    }),
    updateProjectStatus: useMutation({
      mutationFn: ({ id, data }: { id: string; data: StatusTransitionRequest }) => api.projects.updateStatus(id, data),
      onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ["projectCrudDetail", vars.id] }),
    }),
    sendChatMessage: useMutation({
      mutationFn: ({ id, data }: { id: string; data: ChatMessageCreate }) => api.projects.sendChatMessage(id, data),
      onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ["projectChatMessages", vars.id] }),
    }),
    createTodo: useMutation({
      mutationFn: ({ id, data }: { id: string; data: TodoCreate }) => api.projects.createTodo(id, data),
      onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ["projectTodos", vars.id] }),
    }),
    updateTodo: useMutation({
      mutationFn: ({ id, todoId, data }: { id: string; todoId: string; data: TodoUpdate }) => api.projects.updateTodo(id, todoId, data),
      onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ["projectTodos", vars.id] }),
    }),
    claimTodo: useMutation({
      mutationFn: ({ id, todoId, data }: { id: string; todoId: string; data: TodoClaimRequest }) => api.projects.claimTodo(id, todoId, data),
      onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ["projectTodos", vars.id] }),
    }),
    deleteTodo: useMutation({
      mutationFn: ({ id, todoId }: { id: string; todoId: string }) =>
        api.projects.deleteTodo(id, todoId),
      onSuccess: (_data: unknown, vars) => qc.invalidateQueries({ queryKey: ["projectTodos", vars.id] }),
    }),
  };
}

// ─── Mutations ───

/** 组织CRUD mutations */
export function useOrgMutations() {
  const qc = useQueryClient();
  return {
    createOrg: useMutation({
      mutationFn: (data: OrganizationCreateRequest) => api.organizations.create(data),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["organizations"] });
        qc.invalidateQueries({ queryKey: ["orgCrudList"] });
      },
    }),
    updateOrg: useMutation({
      mutationFn: ({ id, data }: { id: string; data: OrganizationUpdateRequest }) => api.organizations.update(id, data),
      onSuccess: (_data, vars) => {
        qc.invalidateQueries({ queryKey: ["organizations"] });
        qc.invalidateQueries({ queryKey: ["orgCrudList"] });
        qc.invalidateQueries({ queryKey: ["orgCrudDetail", vars.id] });
      },
    }),
    joinOrg: useMutation({
      mutationFn: ({ orgId, data }: { orgId: string; data: JoinOrgRequest }) => api.organizations.join(orgId, data),
      onSuccess: (_data, vars) => {
        qc.invalidateQueries({ queryKey: ["organizations"] });
        qc.invalidateQueries({ queryKey: ["orgCrudList"] });
        qc.invalidateQueries({ queryKey: ["orgCrudDetail", vars.orgId] });
        qc.invalidateQueries({ queryKey: ["orgMembers", vars.orgId] });
      },
    }),

  };
}

/** Agent注册/绑定 mutations */
export function useAgentMutations() {
  const qc = useQueryClient();
  return {
    registerAgent: useMutation({
      mutationFn: (data: { agent_id: string; name: string; description: string; capabilities: string[]; endpoints?: Record<string, string> }) => api.identity.registerAgent(data),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["myAgents"] }),
    }),
    bindAgent: useMutation({
      mutationFn: (agentId: string) => api.auth.bindAgent(agentId),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["myAgents"] }),
    }),
    deleteAgent: useMutation({
      mutationFn: (agentId: string) => api.identity.deleteMyAgent(agentId),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["myAgents"] }),
    }),
  };
}

// ─── MCP ───

/** MCP工具列表 */
export function useMcpTools() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["mcpTools"],
    queryFn: async () => { const t = await api.mcp.listTools(); return Array.isArray(t) ? t : []; },
    enabled: !!user,
  });
}

/** MCP资源列表 */
export function useMcpResources() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["mcpResources"],
    queryFn: async () => { const r = await api.mcp.listResources(); return Array.isArray(r) ? r : []; },
    enabled: !!user,
  });
}

/** MCP调用工具 mutation */
export function useMcpCallTool() {
  return useMutation({
      mutationFn: ({ toolName, args }: { toolName: string; args: Record<string, unknown> }) => api.mcp.callTool(toolName, args),
  });
}

// ─── A2A Messages ───

/** A2A消息列表 */
export function useMessages(agentId: string, params?: { limit?: number }) {
  return useQuery({
    queryKey: ["messages", agentId, params],
    queryFn: async () => { const data = await api.a2a.getMessages(agentId, params); return data.messages || []; },
    enabled: !!agentId,
  });
}

/** 发送消息 mutation */
export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: A2AMessageSend) => api.a2a.sendMessage(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["messages"] }),
  });
}

/** Settlement mutations */
export function useSettlementMutations() {
  const qc = useQueryClient();
  return {
    deposit: useMutation({
      mutationFn: (data: DepositRequest) => api.settlement.deposit(data),
      onSuccess: (_data, variables) => {
        qc.invalidateQueries({ queryKey: ["balance"] });
        qc.invalidateQueries({ queryKey: ["transactions"] });
      },
    }),
    transfer: useMutation({
      mutationFn: (data: TransferRequest) => api.settlement.transfer(data),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["balance"] });
        qc.invalidateQueries({ queryKey: ["transactions"] });
      },
    }),
  };
}
