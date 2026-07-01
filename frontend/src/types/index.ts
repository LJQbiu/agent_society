/** 前端类型定义 - 对齐后端Schema */

// === Human Profile (used by AuthProvider) ===
export interface HumanProfile {
  id: string;
  name: string;
  type: string;
  status: string;
  profile: Record<string, any>;
}

// === Auth ===
export interface HumanRegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface HumanRegisterResponse {
  user_id: string;
  username: string;
}

export interface HumanLoginRequest {
  username: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface RefreshTokenRequest {
  refresh_token: string;
  client_id: string;
}

// === Observatory: Agents ===
export interface AgentItem {
  agent_id: string;
  name: string;
  status: string;
  capabilities: string[];
  reputation_score: number;
  token_balance: number;
  organization_id?: string;
  organization_name?: string;
  projects_count: number;
  created_at?: string;
  avatar_url?: string;
}

export interface AgentDirectoryResponse {
  total: number;
  page: number;
  page_size: number;
  agents: AgentItem[];
}

export interface AgentStatsResponse {
  total_agents: number;
  active_agents: number;
  frozen_agents: number;
  avg_reputation: number;
  avg_token_balance: number;
  capability_distribution: Record<string, number>;
}

// === Observatory: Projects ===
export interface ProjectItem {
  project_id: string;
  name: string;
  type: string;
  status: string;
  required_capabilities: string[];
  current_participants: number;
  max_participants: number;
  token_budget: number;
  reputation_budget: number;
  creator_id: string;
  creator_name: string;
  deadline?: string;
  description: string;
  created_at?: string;
}

export interface ProjectDirectoryResponse {
  total: number;
  page: number;
  page_size: number;
  projects: ProjectItem[];
}

export interface ParticipantItem {
  agent_id: string;
  name: string;
  role: string;
  joined_at?: string;
}

export interface ProjectDetailResponse {
  project_id: string;
  name: string;
  type: string;
  status: string;
  required_capabilities: string[];
  participants: ParticipantItem[];
  token_budget: number;
  reputation_budget: number;
  creator: Record<string, any>;
  deadline?: string;
  description: string;
  created_at?: string;
}

// === Observatory: Organizations ===
export interface OrganizationItem {
  org_id: string;
  name: string;
  description: string;
  members_count: number;
  avg_reputation: number;
  avg_token_balance: number;
  projects_count: number;
  creator_id: string;
  creator_name: string;
  created_at?: string;
}

export interface OrganizationDirectoryResponse {
  total: number;
  page: number;
  page_size: number;
  organizations: OrganizationItem[];
}

export interface MemberItem {
  agent_id: string;
  name: string;
  reputation_score: number;
  role: string;
  joined_at?: string;
}

export interface OrganizationDetailResponse {
  org_id: string;
  name: string;
  description: string;
  members: MemberItem[];
  projects: { project_id: string; name: string; status: string }[];
  avg_reputation: number;
  avg_token_balance: number;
  created_at?: string;
}

// === Observatory: Leaderboard ===
export interface RankingItem {
  rank: number;
  agent_id: string;
  name: string;
  reputation_score: number;
  token_balance: number;
  organization_name?: string;
  trend: string;
  created_at?: string;
}

export interface LeaderboardResponse {
  type: string;
  total: number;
  page: number;
  page_size: number;
  rankings: RankingItem[];
}

export interface LeaderboardSummaryResponse {
  top_reputation: { agent_id?: string; name?: string; score: number };
  top_token: { agent_id?: string; name?: string; balance: number };
  total_reputation: number;
  total_tokens: number;
  active_agents: number;
  organizations_count: number;
  projects_count: number;
}

// === My Agents ===
export interface MyAgentsResponse {
  agents: Array<{
    id: string;
    name: string;
    status: string;
    capabilities: string[];
  }>;
}

// === A2A ===
export interface AgentCard {
  agent_id: string;
  name: string;
  description: string;
  capabilities: string[];
  status: string;
  reputation: number;
  trust_level: string;
  endpoints: Record<string, any>;
  metadata: Record<string, any>;
  version: number;
  created_at?: string;
  updated_at?: string;
}

export interface AgentCardUpdate {
  agent_name?: string;
  description?: string;
  capabilities?: string[];
  endpoints?: Record<string, any>;
}

export interface A2AMessage {
  message_id: string;
  from_agent_id: string;
  to_agent_id: string;
  message_type: string;
  status: string;
  created_at: string;
}

export interface A2AMessageSend {
  from_agent_id: string;
  to_agent_id: string;
  content: Record<string, any>;
  message_type: string;
  priority?: string;
}

export interface DiscoverResponse {
  agents: AgentCard[];
  total: number;
}

export interface MessageListResponse {
  messages: A2AMessage[];
  total: number;
  page: number;
}

export interface PlatformAgentCard {
  agent_id: string;
  name: string;
  description: string;
  capabilities: string[];
  endpoints: Record<string, any>;
  version: string;
}

// === MCP ===
export interface MCPTool {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

export interface MCPResource {
  uri: string;
  name: string;
  description: string;
  mime_type?: string;
}

export interface MCPCallResult {
  content: Array<{ type: string; text?: string; data?: string; mime_type?: string }>;
  is_error?: boolean;
}

export interface MCPRpcRequest {
  jsonrpc: "2.0";
  method: string;
  params?: Record<string, any>;
  id?: number | string;
}

export interface MCPRpcResponse {
  jsonrpc: "2.0";
  result?: any;
  error?: { code: number; message: string; data?: any };
  id?: number | string;
}

// === Settlement ===
export interface TransferRequest {
  from_holder_id: string;
  from_holder_type: "agent" | "organization";
  to_holder_id: string;
  to_holder_type: "agent" | "organization";
  amount: number;
  description?: string;
  reference_id?: string;
}

export interface DepositRequest {
  holder_id: string;
  holder_type: "agent" | "organization";
  amount: number;
  description?: string;
}

export interface BalanceResponse {
  holder_id: string;
  holder_type: string;
  balance: number;
  frozen: boolean;
  reputation?: number;
  trust_level?: string;
}

export interface TransactionResponse {
  id: string;
  from_holder_id: string;
  from_holder_type: string;
  to_holder_id: string;
  to_holder_type: string;
  amount: number;
  transaction_type: string;
  description: string;
  reference_id?: string;
  status: string;
  created_at?: string;
}

export interface TransactionListResponse {
  transactions: TransactionResponse[];
  total: number;
  limit: number;
  offset: number;
}

// === Organization CRUD ===
export interface OrganizationCreateRequest {
  name: string;
  description?: string;
  org_type?: "team" | "guild" | "company" | "DAO";
  governance_model?: string;
  charter?: Record<string, any>;
}

export interface OrganizationUpdateRequest {
  name?: string;
  description?: string;
  org_type?: "team" | "guild" | "company" | "DAO";
  governance_model?: string;
  charter?: Record<string, any>;
}

export interface OrganizationCRUDResponse {
  id: string;
  name: string;
  description: string;
  org_type: string;
  status: string;
  governance_model: string;
  reputation: number;
  balance: number;
  charter: Record<string, any>;
  creator_id: string;
  created_at: string;
  updated_at?: string;
}

export interface OrganizationMemberResponse {
  id: string;
  organization_id: string;
  human_id: string;
  agent_id?: string;
  role: string;
  status: string;
  created_at: string;
}

export interface OrganizationCRUDListResponse {
  organizations: OrganizationCRUDResponse[];
  total: number;
  limit: number;
  offset: number;
}

export interface MemberListResponse {
  members: OrganizationMemberResponse[];
  total: number;
}

export interface JoinOrgRequest {
  agent_id?: string;
}

// === Project CRUD ===
export interface ProjectCreateRequest {
  name: string;
  description?: string;
  type?: string;
  budget?: number;
  reputation_budget?: number;
  required_capabilities?: string[];
  max_participants?: number;
  organization_id?: string;
}

export interface ProjectUpdateRequest {
  name?: string;
  description?: string;
  type?: string;
  budget?: number;
  reputation_budget?: number;
  required_capabilities?: string[];
  max_participants?: number;
  organization_id?: string;
}

export interface ProjectCRUDResponse {
  id: string;
  name: string;
  description: string;
  type: string;
  status: string;
  budget: number;
  reputation_budget: number;
  required_capabilities: string[];
  max_participants: number;
  creator_id: string;
  organization_id?: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectParticipantResponse {
  id: string;
  project_id: string;
  agent_id: string;
  agent_name?: string;
  role: string;
  status: string;
  contribution_score: number;
  created_at: string;
}

export interface ProjectCRUDListResponse {
  projects: ProjectCRUDResponse[];
  total: number;
  limit: number;
  offset: number;
}

export interface ParticipantListResponse {
  participants: ProjectParticipantResponse[];
  total: number;
}

export interface JoinProjectRequest {
  agent_id?: string;
}

export interface StatusTransitionRequest {
  new_status: "recruiting" | "active" | "suspended" | "completed" | "revoked";
}

// === Project Chat ===
export interface ChatMessageCreate {
  content: string;
  sender_type: "human" | "agent";
}

export interface ChatMessageResponse {
  id: string;
  project_id: string;
  sender_type: string;
  sender_id: string;
  sender_name: string;
  content: string;
  created_at: string;
}

export interface ChatMessageListResponse {
  messages: ChatMessageResponse[];
  total: number;
}

// === Project Todo ===
export interface TodoCreate {
  title: string;
  description?: string;
  priority?: "low" | "medium" | "high" | "critical";
}

export interface TodoUpdate {
  title?: string;
  description?: string;
  priority?: "low" | "medium" | "high" | "critical";
  status?: "open" | "in_progress" | "completed" | "cancelled";
}

export interface TodoClaimRequest {
  claimer_type: "human" | "agent";
  agent_id?: string;
}

export interface ProjectTodoResponse {
  id: string;
  project_id: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  created_by: string;
  claimed_by?: string;
  claimed_by_name?: string;
  claimed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface TodoListResponse {
  todos: ProjectTodoResponse[];
  total: number;
}

// === Pagination (generic) ===
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

// === Admin Dashboard ===
export interface DashboardStats {
  total_agents: number;
  active_agents: number;
  total_projects: number;
  active_projects: number;
  total_organizations: number;
  active_organizations: number;
  total_humans: number;
  total_messages: number;
}

export interface DashboardResponse {
  stats: DashboardStats;
}

export interface AdminListItem {
  id: string;
  name: string;
  status?: string;
  owner_name?: string;
  created_at?: string;
}

export interface AdminListResponse {
  total: number;
  page: number;
  page_size: number;
  [key: string]: any;
}

export type AdminDeleteResponse = DeleteAgentResponse;

export interface PurgeResponse {
  scope: string;
  filter: string;
  deleted_projects: number;
  deleted_organizations: number;
  deleted_agents: number;
  audit_id: string;
  message: string;
}

export interface DeleteAgentResponse {
  agent_id: string;
  agent_name: string;
  audit_id: string;
  message: string;
}

export interface AuditLogEvent {
  event_id: string;
  event_type: string;
  actor_id: string;
  actor_role: string;
  target_id: string;
  target_type: string;
  details: Record<string, any>;
  created_at: string;
}

export interface AuditLogResponse {
  events: AuditLogEvent[];
  total: number;
  page: number;
  page_size: number;
}

// === Type aliases (used by component imports) ===
export type AgentProfile = AgentItem;
export type Organization = OrganizationItem;
export type Project = ProjectItem;
export type LeaderboardEntry = RankingItem;
