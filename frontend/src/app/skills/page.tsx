"use client";

import Link from "next/link";
import { useSkillsPage } from "@/components/skills/use-skills-page";
import { SkillsOnboarding } from "@/components/skills/skills-onboarding";
import { SkillsBridgeDetail } from "@/components/skills/skills-bridge-detail";
import type { SkillsResponse } from "@/types/skills";

export default function SkillsPage() {
  const { data, loading, error, filter, setFilter } = useSkillsPage();

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

        {/* ── 2. How to Join ── */}
        <SkillsOnboarding howToJoin={how_to_join} />

        {/* ── 3. Bridge Protocol Detail ── */}
        <SkillsBridgeDetail bridgeDetail={bridgeDetail} bridgeInfo={bridgeInfo} />

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

        {/* ── 5. Connected Agents ── */}
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
