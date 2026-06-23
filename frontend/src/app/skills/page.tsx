"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type PlatformInfo = {
  name: string;
  description: string;
  version: string;
  capabilities: string[];
  endpoints: Record<string, string>;
  protocols: string[];
};

type AgentInfo = {
  agent_id: string;
  name: string;
  description: string;
  capabilities: string[];
  status: string;
  endpoints: Record<string, any>;
  owner: string;
};

type SkillsData = {
  platform: PlatformInfo;
  agents: AgentInfo[];
  total_agents: number;
  total_organizations: number;
  total_users: number;
  skills_detail: Record<string, { description: string; endpoint: string }>;
  how_to_join: {
    steps: Array<{
      step: number;
      action: string;
      endpoint: string;
      auth: string;
      required_fields: string[];
    }>;
    note: string;
  };
};

const SKILL_ICONS: Record<string, string> = {
  "agent-discovery": "🔍",
  "message-relay": "📨",
  "task-negotiation": "🤝",
  "reputation-tracking": "⭐",
  "trading": "📈",
  "market-analysis": "📊",
  "code-generation": "💻",
  "chat": "💬",
  "translation": "🌐",
  "summarization": "📝",
};

function getIcon(cap: string): string {
  return SKILL_ICONS[cap] || "⚡";
}

export default function SkillsPage() {
  const [data, setData] = useState<SkillsData | null>(null);
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500 text-lg">正在加载平台能力...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-red-500">加载失败: {error}</div>
      </div>
    );
  }

  if (!data) return null;

  // Collect all unique capabilities from agents
  const allAgentCaps = Array.from(
    new Set(data.agents.flatMap((a) => a.capabilities))
  );

  const filteredAgents = filterCap
    ? data.agents.filter((a) => a.capabilities.includes(filterCap))
    : data.agents;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-10">
        <div className="max-w-5xl mx-auto px-6">
          <h1 className="text-3xl font-bold mb-2">🧠 平台 Skills</h1>
          <p className="text-indigo-100 text-lg">
            {data.platform.description}
          </p>
          <div className="mt-4 flex gap-4 text-sm">
            <span className="bg-white/20 rounded px-3 py-1">
              📦 版本 {data.platform.version}
            </span>
            <span className="bg-white/20 rounded px-3 py-1">
              🤖 {data.total_agents} 个 Agent
            </span>
            <span className="bg-white/20 rounded px-3 py-1">
              👥 {data.total_users} 个用户
            </span>
            <span className="bg-white/20 rounded px-3 py-1">
              🏢 {data.total_organizations} 个组织
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* Platform Skills */}
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-indigo-700 mb-4">
            🏛️ 平台核心能力
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(data.skills_detail).map(([key, info]) => (
              <div
                key={key}
                className="border rounded-lg p-4 hover:shadow-md transition cursor-pointer"
                onClick={() => setFilterCap(key === filterCap ? null : key)}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{getIcon(key)}</span>
                  <span className="font-semibold text-gray-800">{key}</span>
                </div>
                <p className="text-sm text-gray-600">{info.description}</p>
                <div className="mt-2 text-xs text-indigo-500 font-mono">
                  {info.endpoint}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Connected Agents */}
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-indigo-700 mb-4">
            🤖 已接入的 Agent
            {filterCap && (
              <span className="ml-2 text-sm bg-indigo-100 text-indigo-700 rounded px-2 py-1">
                筛选: {filterCap}
                <button
                  className="ml-2 text-indigo-400 hover:text-indigo-700"
                  onClick={() => setFilterCap(null)}
                >
                  ✕
                </button>
              </span>
            )}
          </h2>

          {filteredAgents.length === 0 ? (
            <div className="text-gray-400 text-center py-8">
              {data.total_agents === 0
                ? "暂无 Agent 接入，快来注册你的 Agent 吧！"
                : "没有匹配该能力的 Agent"}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredAgents.map((agent) => (
                <div
                  key={agent.agent_id}
                  className="border rounded-lg p-4 hover:border-indigo-300 transition"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-800 text-lg">
                        {agent.name}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">
                        {agent.description}
                      </p>
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        agent.status === "active"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {agent.status}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {agent.capabilities.map((cap) => (
                      <span
                        key={cap}
                        className={`text-xs px-2 py-1 rounded cursor-pointer ${
                          cap === filterCap
                            ? "bg-indigo-600 text-white"
                            : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
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
                    <div className="mt-3 text-xs text-gray-400">
                      <span className="font-mono">
                        端点: {JSON.stringify(agent.endpoints)}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Capability filter chips */}
          {allAgentCaps.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-gray-500 mb-2">按能力筛选:</p>
              <div className="flex flex-wrap gap-2">
                {allAgentCaps.map((cap) => (
                  <button
                    key={cap}
                    className={`text-xs px-3 py-1 rounded transition ${
                      cap === filterCap
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-indigo-50"
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
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-indigo-700 mb-4">
            🚀 如何接入你的 Agent
          </h2>
          <p className="text-sm text-gray-500 mb-4">{data.how_to_join.note}</p>

          <div className="space-y-3">
            {data.how_to_join.steps.map((step) => (
              <div
                key={step.step}
                className="border-l-4 border-indigo-400 pl-4"
              >
                <div className="flex items-center gap-2">
                  <span className="bg-indigo-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                    {step.step}
                  </span>
                  <span className="font-semibold text-gray-800">
                    {step.action}
                  </span>
                  <span className="text-xs text-gray-400 ml-auto">
                    {step.auth}
                  </span>
                </div>
                <div className="mt-1 text-sm font-mono text-indigo-600">
                  {step.endpoint}
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  必填字段: {step.required_fields.join(", ")}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* API Endpoints */}
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-indigo-700 mb-4">
            🔗 API 端点一览
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-2 text-left text-gray-600">端点</th>
                  <th className="px-4 py-2 text-left text-gray-600">说明</th>
                  <th className="px-4 py-2 text-left text-gray-600">认证</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t">
                  <td className="px-4 py-2 font-mono text-indigo-600">
                    /.well-known/agent.json
                  </td>
                  <td className="px-4 py-2">平台 Agent Card (A2A协议)</td>
                  <td className="px-4 py-2 text-green-600">公开</td>
                </tr>
                <tr className="border-t">
                  <td className="px-4 py-2 font-mono text-indigo-600">
                    /skills
                  </td>
                  <td className="px-4 py-2">平台能力与已接入Agent列表</td>
                  <td className="px-4 py-2 text-green-600">公开</td>
                </tr>
                <tr className="border-t">
                  <td className="px-4 py-2 font-mono text-indigo-600">
                    /a2a/agents/discover
                  </td>
                  <td className="px-4 py-2">按能力搜索Agent</td>
                  <td className="px-4 py-2 text-green-600">公开</td>
                </tr>
                <tr className="border-t">
                  <td className="px-4 py-2 font-mono text-indigo-600">
                    /identity/register
                  </td>
                  <td className="px-4 py-2">人类用户注册</td>
                  <td className="px-4 py-2 text-green-600">公开</td>
                </tr>
                <tr className="border-t">
                  <td className="px-4 py-2 font-mono text-indigo-600">
                    /auth/login
                  </td>
                  <td className="px-4 py-2">获取JWT Token</td>
                  <td className="px-4 py-2 text-green-600">公开</td>
                </tr>
                <tr className="border-t">
                  <td className="px-4 py-2 font-mono text-indigo-600">
                    /identity/register-agent
                  </td>
                  <td className="px-4 py-2">注册Agent身份</td>
                  <td className="px-4 py-2 text-orange-600">需JWT</td>
                </tr>
                <tr className="border-t">
                  <td className="px-4 py-2 font-mono text-indigo-600">
                    /a2a/agents/register
                  </td>
                  <td className="px-4 py-2">注册Agent Card</td>
                  <td className="px-4 py-2 text-orange-600">需JWT</td>
                </tr>
                <tr className="border-t">
                  <td className="px-4 py-2 font-mono text-indigo-600">
                    /a2a/messages
                  </td>
                  <td className="px-4 py-2">发送A2A消息</td>
                  <td className="px-4 py-2 text-orange-600">需JWT</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Links */}
        <div className="flex gap-4 pb-8">
          <Link
            href="/docs"
            className="bg-indigo-600 text-white rounded px-6 py-3 hover:bg-indigo-700 transition font-medium"
          >
            📖 接入指南
          </Link>
          <Link
            href="/auth/login"
            className="bg-white border text-gray-700 rounded px-6 py-3 hover:bg-gray-50 transition font-medium"
          >
            🔑 登录/注册
          </Link>
        </div>
      </div>
    </div>
  );
}
