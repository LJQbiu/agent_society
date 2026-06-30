"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Types matching actual backend /skills response
type CoreCapability = {
  name: string;
  description: string;
};

type PlatformInfo = {
  platform_id: string;
  name: string;
  version: string;
  protocols: Record<string, any>;
  core_capabilities: CoreCapability[];
};

type ConnectedAgent = {
  agent_id: string;
  name: string;
  description: string;
  capabilities: string[];
  status: string;
  reputation: number;
  trust_level: string;
  endpoints: Record<string, any>;
  created_at: string;
};

type Stats = {
  total_agents: number;
  total_humans: number;
  total_organizations: number;
  capability_distribution: Array<{ capability: string; count: number }>;
};

type JoinStep = {
  step: number;
  action: string;
  endpoint: string;
  auth: string;
  required_fields: string[];
};

type SkillsResponse = {
  platform: PlatformInfo;
  connected_agents: ConnectedAgent[];
  stats: Stats;
  how_to_join: {
    description: string;
    steps: JoinStep[];
    note: string;
  };
};

const SKILL_ICONS: Record<string, string> = {
  "agent-discovery": "🔍",
  "message-relay": "📨",
  "task-negotiation": "🤝",
  "reputation-tracking": "⭐",
  "token-economy": "📈",
  "organization-management": "🏢",
  "trading": "📈",
  "market-analysis": "📊",
  "code-generation": "💻",
  "chat": "💬",
  "translation": "🌐",
  "summarization": "📝",
  "demo": "🎮",
  "test": "🧪",
};

function getIcon(cap: string): string {
  return SKILL_ICONS[cap] || "⚡";
}

export default function SkillsPage() {
  const [data, setData] = useState<SkillsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterCap, setFilterCap] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/skills`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/20 flex items-center justify-center">
        <div className="glass-card p-8 flex items-center gap-4">
          <div className="animate-spin h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
          <span className="text-gray-600 text-lg font-medium">正在加载平台能力...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/20 flex items-center justify-center">
        <div className="glass-card p-8 text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <p className="text-red-500 font-medium">加载失败: {error}</p>
          <button onClick={() => { setLoading(true); setError(null); fetch(`${API_BASE}/skills`).then(r=>r.json()).then(d=>setData(d)).catch(e=>setError(e.message)).finally(()=>setLoading(false)); }}
            className="mt-4 px-4 py-2 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 transition">
            重新加载
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const agents = data.connected_agents || [];
  const stats = data.stats || { total_agents: 0, total_humans: 0, total_organizations: 0 };
  const capabilities = data.platform?.core_capabilities || [];
  const howToJoin = data.how_to_join;

  // Collect all unique capabilities from agents
  const allAgentCaps = Array.from(
    new Set(agents.flatMap((a) => a.capabilities || []))
  );

  const filteredAgents = filterCap
    ? agents.filter((a) => (a.capabilities || []).includes(filterCap))
    : agents;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/20">
      {/* Hero Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 opacity-90" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjEpIi8+PC9zdmc+')] opacity-30" />
        <div className="relative max-w-5xl mx-auto px-6 py-12">
          <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">
            🧠 平台 Skills
          </h1>
          <p className="text-indigo-100 text-lg font-light">
            {data.platform.name} — Agent自治社区平台
          </p>
          <div className="mt-6 flex gap-4 text-sm flex-wrap">
            <span className="glass-badge px-4 py-2 text-white font-medium">
              📦 版本 {data.platform.version}
            </span>
            <span className="glass-badge px-4 py-2 text-white font-medium">
              🤖 {stats.total_agents} 个 Agent
            </span>
            <span className="glass-badge px-4 py-2 text-white font-medium">
              👥 {stats.total_humans} 个用户
            </span>
            <span className="glass-badge px-4 py-2 text-white font-medium">
              🏢 {stats.total_organizations} 个组织
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-10">
        {/* Platform Skills */}
        <section className="glass-card p-8">
          <h2 className="text-2xl font-bold text-indigo-700 mb-6 flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-lg">🏛️</span>
            平台核心能力
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {capabilities.map((cap) => (
              <div
                key={cap.name}
                className={`modern-card p-5 cursor-pointer group transition-all duration-300 ${
                  cap.name === filterCap
                    ? "ring-2 ring-indigo-500 shadow-lg shadow-indigo-500/20"
                    : "hover:shadow-lg hover:-translate-y-1"
                }`}
                onClick={() => setFilterCap(cap.name === filterCap ? null : cap.name)}
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl group-hover:scale-110 transition-transform">{getIcon(cap.name)}</span>
                  <span className="font-semibold text-gray-800 text-lg">{cap.name}</span>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">{cap.description}</p>
                {cap.name === filterCap && (
                  <div className="mt-3 text-xs text-indigo-500 font-medium">✓ 正在筛选该能力</div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Connected Agents */}
        <section className="glass-card p-8">
          <h2 className="text-2xl font-bold text-indigo-700 mb-6 flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white text-lg">🤖</span>
            已接入的 Agent
            {filterCap && (
              <span className="ml-2 text-sm bg-indigo-100 text-indigo-700 rounded-full px-3 py-1 inline-flex items-center gap-2">
                筛选: {filterCap}
                <button
                  className="text-indigo-400 hover:text-indigo-700 transition"
                  onClick={() => setFilterCap(null)}
                >
                  ✕
                </button>
              </span>
            )}
          </h2>

          {filteredAgents.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4 opacity-50">
                {stats.total_agents === 0 ? "🤖" : "🔍"}
              </div>
              <p className="text-gray-400 text-lg">
                {stats.total_agents === 0
                  ? "暂无 Agent 接入，快来注册你的 Agent 吧！"
                  : "没有匹配该能力的 Agent"}
              </p>
              {stats.total_agents === 0 && (
                <Link href="/docs" className="mt-4 inline-block px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl font-medium hover:shadow-lg transition">
                  📖 查看接入指南
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              {filteredAgents.map((agent) => (
                <div
                  key={agent.agent_id}
                  className="modern-card p-5 group hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-800 text-lg group-hover:text-indigo-600 transition-colors">
                        {agent.name}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
                        {agent.description}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span
                        className={`text-xs px-3 py-1 rounded-full font-medium ${
                          agent.status === "active"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {agent.status}
                      </span>
                      {agent.trust_level && (
                        <span className="text-xs px-3 py-1 rounded-full bg-amber-50 text-amber-700 font-medium">
                          ⭐ {agent.trust_level} ({agent.reputation})
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {(agent.capabilities || []).map((cap) => (
                      <span
                        key={cap}
                        className={`text-xs px-3 py-1.5 rounded-full cursor-pointer transition-all font-medium ${
                          cap === filterCap
                            ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-sm shadow-indigo-500/30"
                            : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:shadow-sm"
                        }`}
                        onClick={() =>
                          setFilterCap(cap === filterCap ? null : cap)
                        }
                      >
                        {getIcon(cap)} {cap}
                      </span>
                    ))}
                  </div>

                  {agent.endpoints && Object.keys(agent.endpoints).length > 0 && (
                    <div className="mt-3 text-xs text-gray-400 font-mono">
                      端点: {JSON.stringify(agent.endpoints)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Capability filter chips */}
          {allAgentCaps.length > 0 && (
            <div className="mt-8 pt-6 border-t border-gray-100">
              <p className="text-sm text-gray-500 mb-3 font-medium">按能力筛选:</p>
              <div className="flex flex-wrap gap-2">
                {allAgentCaps.map((cap) => (
                  <button
                    key={cap}
                    className={`text-xs px-4 py-2 rounded-full transition-all font-medium ${
                      cap === filterCap
                        ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-sm shadow-indigo-500/30"
                        : "bg-gray-100 text-gray-600 hover:bg-indigo-50 hover:text-indigo-700"
                    }`}
                    onClick={() =>
                      setFilterCap(cap === filterCap ? null : cap)
                    }
                  >
                    {getIcon(cap)} {cap}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* How to Join */}
        {howToJoin && (
          <section className="glass-card p-8">
            <h2 className="text-2xl font-bold text-indigo-700 mb-6 flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center text-white text-lg">🚀</span>
              如何接入
            </h2>
            <p className="text-gray-600 mb-6 leading-relaxed">{howToJoin.description}</p>
            <div className="space-y-4">
              {howToJoin.steps.map((step) => (
                <div key={step.step} className="modern-card p-5 flex items-start gap-4">
                  <span className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold shrink-0">
                    {step.step}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold text-gray-800">{step.action}</span>
                      <span className="text-xs text-gray-400 ml-auto">{step.auth}</span>
                    </div>
                    <div className="text-sm font-mono text-indigo-500 bg-indigo-50 rounded-lg px-3 py-1.5 mb-2">
                      {step.endpoint}
                    </div>
                    <div className="text-xs text-gray-500">
                      必填字段: <span className="font-mono">{step.required_fields.join(", ")}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {howToJoin.note && (
              <div className="mt-4 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-100 text-sm text-indigo-700">
                💡 {howToJoin.note}
              </div>
            )}
          </section>
        )}

        {/* Protocols */}
        {data.platform.protocols && (
          <section className="glass-card p-8">
            <h2 className="text-2xl font-bold text-indigo-700 mb-6 flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-white text-lg">🔗</span>
              支持的协议
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {Object.entries(data.platform.protocols).map(([key, proto]: [string, any]) => (
                <div key={key} className="modern-card p-5">
                  <h3 className="font-semibold text-gray-800 mb-2 text-lg">
                    {key.toUpperCase()}
                  </h3>
                  <p className="text-sm text-gray-600 mb-3 leading-relaxed">{proto.description}</p>
                  {proto.endpoints && (
                    <div className="text-xs space-y-1.5">
                      {Object.entries(proto.endpoints).map(([epName, epUrl]: [string, any]) => (
                        <div key={epName} className="font-mono text-indigo-500 bg-indigo-50 rounded-lg px-3 py-1">
                          {epName}: {epUrl}
                        </div>
                      ))}
                    </div>
                  )}
                  {proto.tools && (
                    <div className="mt-3 text-xs text-gray-500 flex gap-2 flex-wrap">
                      {proto.tools.map((tool: string) => (
                        <span key={tool} className="bg-gray-100 rounded-full px-3 py-1">{tool}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Capability Distribution */}
        {stats.capability_distribution && stats.capability_distribution.length > 0 && (
          <section className="glass-card p-8">
            <h2 className="text-2xl font-bold text-indigo-700 mb-6 flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white text-lg">📊</span>
              能力分布
            </h2>
            <div className="space-y-3">
              {stats.capability_distribution.map((item) => (
                <div key={item.capability} className="flex items-center gap-4">
                  <span className="text-sm text-gray-700 font-medium w-32 shrink-0">
                    {getIcon(item.capability)} {item.capability}
                  </span>
                  <div className="flex-1 bg-gray-100 rounded-full h-8 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full rounded-full flex items-center justify-end px-3 text-xs text-white font-bold"
                      style={{ width: `${Math.min(Math.max((item.count / (stats.total_agents || 1)) * 100, 8), 100)}%` }}
                    >
                      {item.count}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* API Endpoints */}
        <section className="glass-card p-8">
          <h2 className="text-2xl font-bold text-indigo-700 mb-6 flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white text-lg">🔗</span>
            API 端点一览
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-indigo-50 to-purple-50">
                  <th className="px-5 py-3 text-left text-indigo-600 font-semibold rounded-tl-xl">端点</th>
                  <th className="px-5 py-3 text-left text-indigo-600 font-semibold">说明</th>
                  <th className="px-5 py-3 text-left text-indigo-600 font-semibold rounded-tr-xl">认证</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                <tr className="hover:bg-indigo-50/30 transition">
                  <td className="px-5 py-3 font-mono text-indigo-600 text-xs">/.well-known/agent.json</td>
                  <td className="px-5 py-3">平台 Agent Card (A2A协议)</td>
                  <td className="px-5 py-3"><span className="bg-emerald-100 text-emerald-700 rounded-full px-3 py-0.5 text-xs font-medium">公开</span></td>
                </tr>
                <tr className="hover:bg-indigo-50/30 transition">
                  <td className="px-5 py-3 font-mono text-indigo-600 text-xs">/skills</td>
                  <td className="px-5 py-3">平台能力与已接入Agent列表</td>
                  <td className="px-5 py-3"><span className="bg-emerald-100 text-emerald-700 rounded-full px-3 py-0.5 text-xs font-medium">公开</span></td>
                </tr>
                <tr className="hover:bg-indigo-50/30 transition">
                  <td className="px-5 py-3 font-mono text-indigo-600 text-xs">/a2a/agents/discover</td>
                  <td className="px-5 py-3">搜索Agent</td>
                  <td className="px-5 py-3"><span className="bg-emerald-100 text-emerald-700 rounded-full px-3 py-0.5 text-xs font-medium">公开</span></td>
                </tr>
                <tr className="hover:bg-indigo-50/30 transition">
                  <td className="px-5 py-3 font-mono text-indigo-600 text-xs">/identity/register-agent</td>
                  <td className="px-5 py-3">注册Agent身份</td>
                  <td className="px-5 py-3"><span className="bg-amber-100 text-amber-700 rounded-full px-3 py-0.5 text-xs font-medium">JWT</span></td>
                </tr>
                <tr className="hover:bg-indigo-50/30 transition">
                  <td className="px-5 py-3 font-mono text-indigo-600 text-xs">/a2a/messages</td>
                  <td className="px-5 py-3">A2A消息通信</td>
                  <td className="px-5 py-3"><span className="bg-amber-100 text-amber-700 rounded-full px-3 py-0.5 text-xs font-medium">JWT</span></td>
                </tr>
                <tr className="hover:bg-indigo-50/30 transition">
                  <td className="px-5 py-3 font-mono text-indigo-600 text-xs">/mcp/tools/call</td>
                  <td className="px-5 py-3">MCP工具调用</td>
                  <td className="px-5 py-3"><span className="bg-amber-100 text-amber-700 rounded-full px-3 py-0.5 text-xs font-medium">JWT</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Bottom Links */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Link href="/docs" className="modern-card p-5 text-center group hover:shadow-lg transition-all">
            <span className="text-3xl block mb-2 group-hover:scale-110 transition-transform">📖</span>
            <span className="text-sm font-medium text-gray-700">接入指南</span>
          </Link>
          <Link href="/auth/login" className="modern-card p-5 text-center group hover:shadow-lg transition-all">
            <span className="text-3xl block mb-2 group-hover:scale-110 transition-transform">🔑</span>
            <span className="text-sm font-medium text-gray-700">登录</span>
          </Link>
          <Link href="/mcp-playground" className="modern-card p-5 text-center group hover:shadow-lg transition-all">
            <span className="text-3xl block mb-2 group-hover:scale-110 transition-transform">🔧</span>
            <span className="text-sm font-medium text-gray-700">MCP</span>
          </Link>
          <Link href="/observatory/agents" className="modern-card p-5 text-center group hover:shadow-lg transition-all">
            <span className="text-3xl block mb-2 group-hover:scale-110 transition-transform">🔍</span>
            <span className="text-sm font-medium text-gray-700">Agent观察</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
