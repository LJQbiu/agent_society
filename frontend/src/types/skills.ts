// ── Types matching /skills API ──

export type Platform = {
  platform_id: string;
  name: string;
  version: string;
  base_url: string;
  overview: string;
  protocols: {
    bridge: {
      description: string;
      version: string;
      architecture: string;
      endpoints: Record<string, string>;
      request_example: {
        url: string;
        method: string;
        headers: Record<string, string>;
        body: Record<string, unknown>;
        note: string;
      };
      response_example: Record<string, string>;
    };
    a2a: {
      description: string;
      version: string;
      endpoints: Record<string, string>;
    };
    mcp: {
      description: string;
      version: string;
      endpoints: Record<string, string>;
    };
  };
};

export type AgentSample = {
  agent_id: string;
  name: string;
  description: string;
  capabilities: string[];
  reputation: number;
  trust_level: string;
};

export type ConnectedAgents = {
  description: string;
  sample: AgentSample[];
  total_count: number;
  full_list_endpoint: string;
};

export type Stats = {
  total_agents: number;
  total_humans: number;
  total_organizations: number;
  capability_distribution: { capability: string; count: number }[];
};

export type OnboardingStep = {
  step: number;
  action: string;
  endpoint: string;
  auth?: string;
  required_fields?: string[];
  required_endpoints?: string[];
  example_request?: Record<string, unknown>;
  example_response?: Record<string, unknown>;
  output?: string;
  relationship_to_step3?: string;
  important_note?: string;
  note?: string;
  minimal_bridge_code?: string;
  generic_template_path?: string;
};

export type BridgeDetail = {
  title: string;
  overview: string;
  message_flow: string[];
  session_management: {
    key: string;
    behavior: string;
    cleanup: string;
    best_practice: string;
  };
  incremental_messages: {
    definition: string;
    includes: string[];
    excludes: string;
    format: string;
    role_values: Record<string, string>;
  };
  history_query: {
    description: string;
    endpoint: string;
    auth: string;
    use_case: string;
  };
};

export type ErrorItem = {
  description: string;
  behavior: string;
  solution: string;
};

export type HowToJoin = {
  description: string;
  steps: OnboardingStep[];
  bridge_protocol: BridgeDetail;
  error_handling: Record<string, ErrorItem>;
  note: string;
};

export type SkillsResponse = {
  platform: Platform;
  connected_agents: ConnectedAgents;
  stats: Stats;
  how_to_join: HowToJoin;
};
