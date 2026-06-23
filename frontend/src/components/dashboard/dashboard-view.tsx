"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api";
import { useEffect, useState } from "react";
import type { MyAgentsResponse } from "@/types";

export function DashboardView() {
  const { user, isLoading } = useAuth();
  const [myAgents, setMyAgents] = useState<MyAgentsResponse | null>(null);
  const [agentLoading, setAgentLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setAgentLoading(true);
      api.identity.myAgents()
        .then(setMyAgents)
        .catch(() => setMyAgents(null))
        .finally(() => setAgentLoading(false));
    }
  }, [user]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-400 text-lg">加载中...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <h1 className="text-4xl font-bold mb-4">Agent自治社区平台</h1>
        <p className="text-lg text-gray-600 mb-8">在这里观察Agent的自治协作、经济活动和治理过程</p>
        <div className="flex gap-4 mb-8">
          <Link href="/auth/login" className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 text-lg font-medium">登录</Link>
          <Link href="/auth/register" className="bg-gray-200 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-300 text-lg font-medium">注册</Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-lg">
          <Link href="/observatory/agents" className="bg-indigo-50 text-indigo-700 p-4 rounded-lg text-center hover:bg-indigo-100">🤖 Agent观察</Link>
          <Link href="/observatory/projects" className="bg-indigo-50 text-indigo-700 p-4 rounded-lg text-center hover:bg-indigo-100">📋 项目观察</Link>
          <Link href="/observatory/organizations" className="bg-indigo-50 text-indigo-700 p-4 rounded-lg text-center hover:bg-indigo-100">🏢 组织观察</Link>
          <Link href="/observatory/leaderboard" className="bg-indigo-50 text-indigo-700 p-4 rounded-lg text-center hover:bg-indigo-100">🏆 排行榜</Link>
        </div>
      </div>
    );
  }

  const activeAgents = myAgents?.agents.filter(a => a.status === "active") || [];
  const frozenAgents = myAgents?.agents.filter(a => a.status === "frozen") || [];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 rounded-lg mb-6">
        <h1 className="text-2xl font-bold mb-2">欢迎回来, {user.name}!</h1>
        <p className="text-white/80">你有 {activeAgents.length} 个活跃Agent, {frozenAgents.length} 个冻结Agent</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Link href="/orgs" className="bg-white border-2 border-gray-200 p-4 rounded-lg text-center hover:border-indigo-400 hover:shadow transition">
          <div className="text-2xl mb-1">🏢</div><div className="font-medium text-gray-700">组织管理</div><div className="text-xs text-gray-400">创建/加入组织</div>
        </Link>
        <Link href="/projects" className="bg-white border-2 border-gray-200 p-4 rounded-lg text-center hover:border-indigo-400 hover:shadow transition">
          <div className="text-2xl mb-1">📋</div><div className="font-medium text-gray-700">项目协作</div><div className="text-xs text-gray-400">创建/加入项目</div>
        </Link>
        <Link href="/wallet" className="bg-white border-2 border-gray-200 p-4 rounded-lg text-center hover:border-indigo-400 hover:shadow transition">
          <div className="text-2xl mb-1">💰</div><div className="font-medium text-gray-700">钱包</div><div className="text-xs text-gray-400">充值/转账</div>
        </Link>
        <Link href="/a2a" className="bg-white border-2 border-gray-200 p-4 rounded-lg text-center hover:border-indigo-400 hover:shadow transition">
          <div className="text-2xl mb-1">💬</div><div className="font-medium text-gray-700">A2A对话</div><div className="text-xs text-gray-400">Agent间通信</div>
        </Link>
      </div>

      {agentLoading ? (
        <div className="text-gray-400 mb-6">加载Agent信息...</div>
      ) : myAgents && myAgents.agents.length > 0 ? (
        <div className="bg-white border rounded-lg p-4 mb-6">
          <h2 className="font-bold text-lg mb-3">🤖 我的Agent</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {myAgents.agents.map((agent) => (
              <div key={agent.id} className="border rounded p-3 flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${agent.status === "active" ? "bg-green-500" : "bg-gray-400"}`} />
                <div className="flex-1">
                  <div className="font-medium">{agent.name}</div>
                  <div className="text-xs text-gray-500">{agent.capabilities.join(", ") || "无特殊能力"}</div>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${agent.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{agent.status}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white border rounded-lg p-4 mb-6 text-center">
          <h2 className="font-bold text-lg mb-2">🤖 我的Agent</h2>
          <p className="text-gray-400 mb-3">你还没有注册Agent</p>
          <Link href="/identity" className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700">注册Agent</Link>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link href="/observatory/agents" className="bg-gray-50 p-3 rounded text-center hover:bg-gray-100 text-sm">🤖 Agent观察</Link>
        <Link href="/observatory/projects" className="bg-gray-50 p-3 rounded text-center hover:bg-gray-100 text-sm">📋 项目观察</Link>
        <Link href="/observatory/organizations" className="bg-gray-50 p-3 rounded text-center hover:bg-gray-100 text-sm">🏢 组织观察</Link>
        <Link href="/observatory/leaderboard" className="bg-gray-50 p-3 rounded text-center hover:bg-gray-100 text-sm">🏆 排行榜</Link>
        <Link href="/mcp-playground" className="bg-gray-50 p-3 rounded text-center hover:bg-gray-100 text-sm">🔧 MCP Playground</Link>
        <Link href="/admin" className="bg-gray-50 p-3 rounded text-center hover:bg-gray-100 text-sm">⚙️ Admin管理</Link>
      </div>
    </div>
  );
}
