/** TanStack Query hooks — 替代手动 useState+useEffect+api 调用 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";

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

/** 我的Agents */
export function useMyAgents() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.myAgents(),
    queryFn: () => api.identity.myAgents(),
    enabled: !!user,
  });
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

// ─── Mutations ───

/** 组织CRUD mutations */
export function useOrgMutations() {
  const qc = useQueryClient();
  return {
    createOrg: useMutation({
      mutationFn: (data: any) => api.organizations.create(data),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["organizations"] }),
    }),
    updateOrg: useMutation({
      mutationFn: ({ id, data }: { id: string; data: any }) => api.organizations.update(id, data),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["organizations"] }),
    }),
    joinOrg: useMutation({
      mutationFn: ({ orgId, data }: { orgId: string; data: any }) => api.organizations.join(orgId, data),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["organizations"] }),
    }),

  };
}

/** Agent注册/绑定 mutations */
export function useAgentMutations() {
  const qc = useQueryClient();
  return {
    registerAgent: useMutation({
      mutationFn: (data: any) => api.identity.registerAgent(data),
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

/** Settlement mutations */
export function useSettlementMutations() {
  const qc = useQueryClient();
  return {
    deposit: useMutation({
      mutationFn: (data: any) => api.settlement.deposit(data),
      onSuccess: (_data, variables) => {
        qc.invalidateQueries({ queryKey: ["balance"] });
        qc.invalidateQueries({ queryKey: ["transactions"] });
      },
    }),
    transfer: useMutation({
      mutationFn: (data: any) => api.settlement.transfer(data),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["balance"] });
        qc.invalidateQueries({ queryKey: ["transactions"] });
      },
    }),
  };
}
