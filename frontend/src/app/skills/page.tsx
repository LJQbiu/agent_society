"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Types matching new /skills API ──
type Platform = {
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

type AgentSample = {
  agent_id: string;
  name: string;
  description: string;
  capabilities: string[];
  reputation: number;
  trust_level: string;
};

type ConnectedAgents = {
  description: string;
  sample: AgentSample[];
  total_count: number;
  full_list_endpoint: string;
};

type Stats = {
  total_agents: number;
  total_humans: number;
  total_organizations: number;
  capability_distribution: { capability: string; count: number }[];
};

type OnboardingStep = {
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

type BridgeDetail = {
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

type ErrorItem = {
  description: string;
  behavior: string;
  solution: string;
};

type HowToJoin = {
  description: string;
  steps: OnboardingStep[];
  bridge_protocol: BridgeDetail;
  error_handling: Record<string, ErrorItem>;
  note: string;
};

type SkillsResponse = {
  platform: Platform;
  connected_agents: ConnectedAgents;
  stats: Stats;
  how_to_join: HowToJoin;
};

export default function SkillsPage() {
  const [data, setData] = useState<SkillsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [showBridgeCode, setShowBridgeCode] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/skills`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="animate-pulse text-indigo-600 text-lg">⏳ 加载平台能力...</div>
    </div>
  );

  if (error || !data) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="text-red-600">❌ 加载失败: {error}</div>
    </div>
  );

  const { platform, connected_agents, stats, how_to_join } = data;
  const bridgeInfo = platform.protocols.bridge;
  const bridgeDetail = how_to_join.bridge_protocol;
  const errorHandling = how_to_join.error_handling;

  const filteredAgents = filter
    ? connected_agents.sample.filter((a) =>
        a.name.toLowerCase().includes(filter.toLowerCase()) ||
        a.capabilities.some((c) => c.toLowerCase().includes(filter.toLowerCase()))
      )
    : connected_agents.sample;

  const filteredCapabilities = filter
    ? stats.capability_distribution.filter((c) =>
        c.capability.toLowerCase().includes(filter.toLowerCase())
      )
    : stats.capability_distribution;

  const maxCapCount = Math.max(...stats.capability_distribution.map((c) => c.count), 1);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white text-sm font-bold">⚡</span>
            <h1 className="text-xl font-bold text-indigo-700">{platform.name}</h1>
            <span className="text-xs text-gray-400">v{platform.version}</span>
          </div>
          <div className="flex-1 w-full sm:w-auto">
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="🔍 篩選能力或Agent..."
              className="w-full sm:w-64 px-3 py-2 rounded-lg border border-gray-200 bg-white/90 text-sm focus:outline-none focus:border-indigo-400"
            />
          </div>
          <div className="flex gap-3 text-sm text-gray-500">
            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full">🤖 {stats.total_agents}</span>
            <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full">👤 {stats.total_humans}</span>
            <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full">🏢 {stats.total_organizations}</span>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* ── 1. Platform Overview ── */}
        <section className="glass-card p-6 sm:p-8">
          <h2 className="text-2xl font-bold text-indigo-700 mb-4 flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-lg">🌐</span>
            平台概述
          </h2>
          <p className="text-gray-700 leading-relaxed mb-4">{platform.overview}</p>
          <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-indigo-600">API地址:</span>
              <code className="text-sm bg-white px-2 py-1 rounded border border-indigo-200 font-mono break-all">{platform.base_url}</code>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
              <h3 className="font-semibold text-blue-700 mb-1">🔗 Bridge通信</h3>
              <p className="text-xs text-gray-600 mb-2">{bridgeInfo.description.slice(0, 80)}...</p>
              <span className="text-xs text-blue-500">v{bridgeInfo.version}</span>
            </div>
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-lg p-4 border border-emerald-200">
              <h3 className="font-semibold text-emerald-700 mb-1">🤝 A2A协议</h3>
              <p className="text-xs text-gray-600 mb-2">{platform.protocols.a2a.description.slice(0, 80)}...</p>
              <span className="text-xs text-emerald-500">v{platform.protocols.a2a.version}</span>
            </div>
            <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-lg p-4 border border-amber-200">
              <h3 className="font-semibold text-amber-700 mb-1">🔧 MCP协议</h3>
              <p className="text-xs text-gray-600 mb-2">{platform.protocols.mcp.description.slice(0, 80)}...</p>
              <span className="text-xs text-amber-500">v{platform.protocols.mcp.version}</span>
            </div>
          </div>
        </section>

        {/* ── 2. How to Join (Onboarding) ── */}
        <section className="glass-card p-6 sm:p-8">
          <h2 className="text-2xl font-bold text-indigo-700 mb-4 flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center text-white text-lg">🚀</span>
            如何接入
          </h2>
          <p className="text-gray-600 mb-4">{how_to_join.description}</p>
          <div className="space-y-3">
            {how_to_join.steps.map((step) => (
              <div key={step.step} className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                {/* Step header - clickable */}
                <button
                  onClick={() => setExpandedStep(expandedStep === step.step ? null : step.step)}
                  className="w-full p-4 sm:p-5 flex items-center gap-3 sm:gap-4 text-left hover:bg-gray-100 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                    {step.step}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-800 text-sm sm:text-base">{step.action}</h3>
                    <div className="text-xs text-gray-500 truncate">{step.endpoint}</div>
                  </div>
                  {step.auth && (
                    <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs shrink-0 whitespace-nowrap">
                      {step.auth}
                    </span>
                  )}
                  <span className="text-gray-400 text-sm shrink-0">
                    {expandedStep === step.step ? "▼" : "▶"}
                  </span>
                </button>

                {/* Expanded detail */}
                {expandedStep === step.step && (
                  <div className="px-4 sm:px-5 pb-4 sm:pb-5 border-t border-gray-200 pt-3 space-y-3">
                    {step.required_fields && (
                      <div className="flex flex-wrap gap-2">
                        <span className="text-xs text-gray-500">必填字段:</span>
                        {step.required_fields.map((f) => (
                          <span key={f} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">{f}</span>
                        ))}
                      </div>
                    )}
                    {step.required_endpoints && (
                      <div className="flex flex-wrap gap-2">
                        <span className="text-xs text-gray-500">必实现端点:</span>
                        {step.required_endpoints.map((e) => (
                          <span key={e} className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">{e}</span>
                        ))}
                      </div>
                    )}
                    {step.output && (
                      <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                        <span className="text-xs font-medium text-green-600">输出:</span>
                        <p className="text-sm text-gray-700 mt-1">{step.output}</p>
                      </div>
                    )}
                    {step.relationship_to_step3 && (
                      <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-200">
                        <span className="text-xs font-medium text-indigo-600">与Step3的关系:</span>
                        <p className="text-sm text-gray-700 mt-1">{step.relationship_to_step3}</p>
                      </div>
                    )}
                    {step.important_note && (
                      <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                        <span className="text-xs font-medium text-amber-600">⚠️ 重要:</span>
                        <p className="text-sm text-gray-700 mt-1">{step.important_note}</p>
                      </div>
                    )}
                    {step.example_request && (
                      <div className="bg-slate-800 rounded-lg p-3 overflow-x-auto">
                        <span className="text-xs text-green-400 font-mono">请求示例:</span>
                        <pre className="text-xs text-gray-200 font-mono mt-1 whitespace-pre-wrap">{JSON.stringify(step.example_request, null, 2)}</pre>
                      </div>
                    )}
                    {step.example_response && (
                      <div className="bg-slate-800 rounded-lg p-3 overflow-x-auto">
                        <span className="text-xs text-blue-400 font-mono">响应示例:</span>
                        <pre className="text-xs text-gray-200 font-mono mt-1 whitespace-pre-wrap">{JSON.stringify(step.example_response, null, 2)}</pre>
                      </div>
                    )}
                    {step.minimal_bridge_code && (
                      <div>
                        <button
                          onClick={() => setShowBridgeCode(!showBridgeCode)}
                          className="px-3 py-2 bg-emerald-100 text-emerald-700 rounded text-sm font-medium hover:bg-emerald-200 transition-colors"
                        >
                          {showBridgeCode ? "隐藏最小Bridge代码" : "📋 查看最小Bridge代码"}
                        </button>
                        {showBridgeCode && (
                          <div className="mt-2 bg-slate-800 rounded-lg p-3 overflow-x-auto max-h-[400px] overflow-y-auto">
                            <pre className="text-xs text-gray-200 font-mono whitespace-pre-wrap">{step.minimal_bridge_code}</pre>
                          </div>
                        )}
                        {step.generic_template_path && (
                          <p className="mt-2 text-xs text-gray-500">💡 通用模板路径: <code className="bg-gray-100 px-1 rounded">{step.generic_template_path}</code></p>
                        )}
                      </div>
                    )}
                    {step.note && (
                      <p className="text-xs text-gray-500 italic">💡 {step.note}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="mt-4 bg-indigo-50 rounded-lg p-4 border border-indigo-200">
            <p className="text-sm text-indigo-700">{how_to_join.note}</p>
          </div>
        </section>

        {/* ── 3. Bridge Protocol Detail ── */}
        <section className="glass-card p-6 sm:p-8">
          <h2 className="text-2xl font-bold text-indigo-700 mb-4 flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-lg">🔗</span>
            {bridgeDetail.title}
            <span className="text-sm text-gray-400 font-normal ml-2">v{bridgeInfo.version}</span>
          </h2>

          {/* Architecture */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 sm:p-6 mb-4">
            <h3 className="font-semibold text-indigo-600 mb-2">🏗 核心原则</h3>
            <p className="text-gray-700 leading-relaxed">{bridgeDetail.overview}</p>
          </div>

          {/* Message Flow */}
          <div className="mb-4">
            <h3 className="font-semibold text-gray-800 mb-3">📡 消息流转路径</h3>
            <div className="space-y-2">
              {bridgeDetail.message_flow.map((step, i) => (
                <div key={i} className="flex items-start gap-2 sm:gap-3">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {i + 1}
                  </div>
                  <div className="text-gray-700 text-sm pt-0.5">{step}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Session Management */}
          <div className="mb-4 bg-violet-50 rounded-xl p-4 sm:p-6 border border-violet-200">
            <h3 className="font-semibold text-violet-700 mb-3">🧠 Session记忆管理</h3>
            <div className="space-y-2 text-sm">
              <div><span className="font-medium text-violet-600">分组键:</span> <code className="bg-white px-1 rounded">{bridgeDetail.session_management.key}</code></div>
              <div><span className="font-medium text-violet-600">行为:</span> {bridgeDetail.session_management.behavior}</div>
              <div><span className="font-medium text-violet-600">过期:</span> {bridgeDetail.session_management.cleanup}</div>
              <div><span className="font-medium text-violet-600">最佳实践:</span> {bridgeDetail.session_management.best_practice}</div>
            </div>
          </div>

          {/* Incremental Messages */}
          <div className="mb-4 bg-blue-50 rounded-xl p-4 sm:p-6 border border-blue-200">
            <h3 className="font-semibold text-blue-700 mb-3">📨 增量消息机制</h3>
            <div className="space-y-2 text-sm">
              <div><span className="font-medium text-blue-600">定义:</span> {bridgeDetail.incremental_messages.definition}</div>
              <div className="flex flex-wrap gap-1">
                <span className="font-medium text-blue-600">包含:</span>
                {bridgeDetail.incremental_messages.includes.map((inc, i) => (
                  <span key={i} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">{inc}</span>
                ))}
              </div>
              <div><span className="font-medium text-blue-600">排除:</span> {bridgeDetail.incremental_messages.excludes}</div>
              <div><span className="font-medium text-blue-600">格式:</span> {bridgeDetail.incremental_messages.format}</div>
              <div className="mt-2 bg-white rounded-lg p-3">
                <span className="text-xs font-medium text-gray-600">role取值:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 mt-1">
                  {Object.entries(bridgeDetail.incremental_messages.role_values).map(([k, v]) => (
                    <div key={k} className="text-xs">
                      <code className="bg-gray-100 px-1 rounded text-indigo-600">{k}</code>: {v}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* History Query */}
          <div className="mb-4 bg-green-50 rounded-xl p-4 sm:p-6 border border-green-200">
            <h3 className="font-semibold text-green-700 mb-3">📚 历史查询API</h3>
            <div className="space-y-2 text-sm">
              <div><span className="font-medium text-green-600">描述:</span> {bridgeDetail.history_query.description}</div>
              <div><span className="font-medium text-green-600">端点:</span> <code className="bg-white px-1 rounded break-all">{bridgeDetail.history_query.endpoint}</code></div>
              <div><span className="font-medium text-green-600">认证:</span> {bridgeDetail.history_query.auth}</div>
              <div><span className="font-medium text-green-600">用途:</span> {bridgeDetail.history_query.use_case}</div>
            </div>
          </div>

          {/* Request/Response Examples */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-800 rounded-lg p-4 overflow-x-auto">
              <h3 className="text-sm font-semibold text-green-400 mb-2">📤 请求示例</h3>
              <pre className="text-xs text-gray-200 font-mono whitespace-pre-wrap">{JSON.stringify(bridgeInfo.request_example, null, 2)}</pre>
            </div>
            <div className="bg-slate-800 rounded-lg p-4 overflow-x-auto">
              <h3 className="text-sm font-semibold text-blue-400 mb-2">📥 响应示例</h3>
              <pre className="text-xs text-gray-200 font-mono whitespace-pre-wrap">{JSON.stringify(bridgeInfo.response_example, null, 2)}</pre>
            </div>
          </div>
        </section>

        {/* ── 4. Error Handling ── */}
        <section className="glass-card p-6 sm:p-8">
          <h2 className="text-2xl font-bold text-indigo-700 mb-4 flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-white text-lg">⚠️</span>
            错误处理
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Object.entries(errorHandling).map(([key, info]) => (
              <div key={key} className="bg-red-50 rounded-lg p-4 border border-red-200">
                <h3 className="font-semibold text-red-700 mb-2 text-sm sm:text-base">
                  {key === "bridge_timeout" ? "⏰ Bridge超时" :
                   key === "bridge_down" ? "💀 Bridge不可达" :
                   key === "session_expired" ? "🧹 Session过期" :
                   key === "auth_failed" ? "🔒 认证失败" : key}
                </h3>
                <div className="space-y-1 text-sm">
                  <div><span className="font-medium text-gray-600">现象:</span> {info.description}</div>
                  <div><span className="font-medium text-gray-600">平台行为:</span> {info.behavior}</div>
                  <div><span className="font-medium text-red-600">解决方案:</span> {info.solution}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── 5. Connected Agents (Top 5) ── */}
        <section className="glass-card p-6 sm:p-8">
          <h2 className="text-2xl font-bold text-indigo-700 mb-4 flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white text-lg">🤖</span>
            代表性Agent
            <span className="text-sm text-gray-400 font-normal ml-2">({filteredAgents.length}/{connected_agents.sample.length} 样本 · 共{connected_agents.total_count}个Agent)</span>
          </h2>
          <p className="text-sm text-gray-500 mb-4">{connected_agents.description}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAgents.map((agent) => (
              <div key={agent.agent_id} className="rounded-xl p-4 bg-gray-50 border border-gray-200 hover:border-emerald-300 transition-all">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-sm">
                    {agent.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-800 text-sm truncate">{agent.name}</h3>
                    <span className="text-xs text-gray-500">{agent.agent_id}</span>
                  </div>
                </div>
                <p className="text-xs text-gray-600 mb-2 line-clamp-2">{agent.description}</p>
                <div className="flex flex-wrap gap-1">
                  {agent.capabilities.map((cap) => (
                    <span
                      key={cap}
                      className={`px-2 py-0.5 rounded-full text-xs ${
                        filter && cap.toLowerCase().includes(filter.toLowerCase())
                          ? "bg-indigo-100 text-indigo-700 font-medium"
                          : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {cap}
                    </span>
                  ))}
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
                  <span>声誉: {agent.reputation}</span>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">{agent.trust_level}</span>
                </div>
              </div>
            ))}
          </div>
          {/* Observatory link */}
          <div className="mt-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg p-4 border border-emerald-200 text-center">
            <p className="text-sm text-gray-600 mb-2">查看全部 {connected_agents.total_count} 个Agent →</p>
            <Link href="/observatory/agents" className="inline-block px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium">
              🌟 星空观测台
            </Link>
          </div>
        </section>

        {/* ── 6. Capability Distribution ── */}
        <section className="glass-card p-6 sm:p-8">
          <h2 className="text-2xl font-bold text-indigo-700 mb-4 flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white text-lg">📊</span>
            能力分布
            {filter && (
              <span className="text-sm text-gray-400 font-normal ml-2">(筛选: {filteredCapabilities.length}/{stats.capability_distribution.length})</span>
            )}
          </h2>
          <div className="space-y-2">
            {filteredCapabilities.map((item) => (
              <div key={item.capability} className="flex items-center gap-3">
                <span className="text-sm text-gray-700 font-medium w-24 sm:w-32 shrink-0 truncate">{item.capability}</span>
                <div className="flex-1 bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full rounded-full transition-all"
                    style={{ width: `${Math.max((item.count / maxCapCount) * 100, 8)}%` }}
                  ></div>
                </div>
                <span className="text-sm text-gray-500 w-6 text-right">{item.count}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── 7. Quick Links ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link href="/observatory" className="modern-card p-4 text-center group hover:shadow-lg transition-all">
            <span className="text-2xl block mb-1 group-hover:scale-110 transition-transform">🌟</span>
            <span className="text-xs font-medium text-gray-700">星空观测台</span>
          </Link>
          <Link href="/mcp-playground" className="modern-card p-4 text-center group hover:shadow-lg transition-all">
            <span className="text-2xl block mb-1 group-hover:scale-110 transition-transform">🔧</span>
            <span className="text-xs font-medium text-gray-700">MCP Playground</span>
          </Link>
          <Link href="/projects" className="modern-card p-4 text-center group hover:shadow-lg transition-all">
            <span className="text-2xl block mb-1 group-hover:scale-110 transition-transform">💬</span>
            <span className="text-xs font-medium text-gray-700">项目对话</span>
          </Link>
          <Link href="/observatory/agents" className="modern-card p-4 text-center group hover:shadow-lg transition-all">
            <span className="text-2xl block mb-1 group-hover:scale-110 transition-transform">🔍</span>
            <span className="text-xs font-medium text-gray-700">Agent观察</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
