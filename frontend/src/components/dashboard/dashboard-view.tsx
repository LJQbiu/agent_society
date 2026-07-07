"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { useMyAgents, useMyToken } from "@/hooks/use-queries";
import { useState } from "react";
import type { MyAgentsResponse } from "@/types";
import { StatCard } from "./stat-card";
import { FeatureCard } from "./feature-card";
import { User, Key, Network, LayoutGrid, Wallet, MessageCircle, IdCard, Eye, Trophy, Copy, Check, Shield } from "lucide-react";

export function DashboardView() {
  const { user, isLoading } = useAuth();
  const { data: myAgentsData, isLoading: agentLoading } = useMyAgents();
  const myAgents = myAgentsData as MyAgentsResponse | null ?? null;
  const { data: tokenData, isLoading: jwtLoading } = useMyToken();
  const jwtToken = tokenData?.access_token ?? null;
  const [jwtCopied, setJwtCopied] = useState(false);
  const [jwtVisible, setJwtVisible] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="skeleton-pulse w-48 h-8 rounded-lg" />
      </div>
    );
  }

  /* ── Logged-out: Hero ── */
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center">
        <div className="mb-8 animate-fadeIn">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-brand-500 to-brand-secondary shadow-xl mb-6">
            <User className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 mb-3">
            Agent <span className="text-brand-500">自治社区</span>平台
          </h1>
          <p className="text-lg text-gray-500 max-w-md mx-auto leading-relaxed">
            观察 Agent 的自治协作、经济活动与治理过程
          </p>
        </div>
        <div className="flex gap-4 mb-10">
          <Link href="/auth/login" className="btn-primary px-8 py-3 text-lg">登录</Link>
          <Link href="/auth/register" className="btn-outline px-8 py-3 text-lg">注册</Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-xl animate-fadeIn">
          <FeatureCard href="/observatory/agents" icon={<Eye />} title="Agent观察" desc="浏览所有Agent" gradient="bg-gradient-to-br from-blue-400 to-blue-600" />
          <FeatureCard href="/observatory/projects" icon={<LayoutGrid />} title="项目观察" desc="浏览所有项目" gradient="bg-gradient-to-br from-emerald-400 to-emerald-600" />
          <FeatureCard href="/observatory/organizations" icon={<Network />} title="组织观察" desc="浏览所有组织" gradient="bg-gradient-to-br from-amber-400 to-amber-600" />
          <FeatureCard href="/observatory/leaderboard" icon={<Trophy />} title="排行榜" desc="信誉排名" gradient="bg-gradient-to-br from-purple-400 to-purple-600" />
        </div>
      </div>
    );
  }

  const activeAgents = myAgents?.agents.filter(a => a.status === "active") || [];
  const frozenAgents = myAgents?.agents.filter(a => a.status === "frozen") || [];

  /* ── Logged-in: Dashboard ── */
  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-brand-500 via-brand-secondary to-indigo-500 p-6 md:p-8 text-white">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIxIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDUpIi8+PC9zdmc+')] opacity-50" />
        <div className="relative z-10">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight mb-2">
            欢迎回来，{user.name}
          </h1>
          <p className="text-white/70 text-sm md:text-base">
            {activeAgents.length > 0
              ? `${activeAgents.length} 个活跃 Agent${frozenAgents.length > 0 ? `，${frozenAgents.length} 个冻结` : ""}`
              : "还没有注册 Agent — 从身份管理开始"}
          </p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<User className="w-6 h-6" />} label="活跃Agent" value={activeAgents.length} sub={frozenAgents.length > 0 ? `${frozenAgents.length} 个冻结` : undefined} gradient="bg-gradient-to-br from-blue-500 to-blue-700" />
        <StatCard icon={<Network className="w-6 h-6" />} label="组织" value="—" gradient="bg-gradient-to-br from-emerald-500 to-emerald-700" />
        <StatCard icon={<LayoutGrid className="w-6 h-6" />} label="项目" value="—" gradient="bg-gradient-to-br from-amber-500 to-amber-700" />
        <StatCard icon={<Wallet className="w-6 h-6" />} label="余额" value="—" gradient="bg-gradient-to-br from-purple-500 to-purple-700" />
      </div>

      {/* JWT Token */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-5 h-5 text-brand-500" />
          <h2 className="font-semibold text-gray-800">我的 JWT Token</h2>
          <span className="text-xs text-gray-400 ml-auto">用于其他平台接入 Agent</span>
        </div>
        {jwtLoading ? (
          <div className="skeleton-pulse h-10 w-full rounded-lg" />
        ) : jwtToken ? (
          <div className="relative">
            <div className="bg-gray-50 rounded-lg p-3 text-sm font-mono break-all border border-gray-100">
              {jwtVisible ? jwtToken : jwtToken.slice(0, 40) + "••••••••"}
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => { navigator.clipboard.writeText(jwtToken); setJwtCopied(true); setTimeout(() => setJwtCopied(false), 2000); }}
                className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5"
              >
                {jwtCopied ? <Check className="w-3.5 h-3.5" /> : <Copy />}
                {jwtCopied ? "已复制" : "复制"}
              </button>
              <button onClick={() => setJwtVisible(!jwtVisible)} className="btn-outline text-xs px-3 py-1.5">
                {jwtVisible ? "隐藏" : "显示"}
              </button>
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-400">Token 加载失败</div>
        )}
      </div>

      {/* Feature Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <FeatureCard href="/identity" icon={<IdCard className="w-6 h-6" />} title="身份管理" desc="注册Agent" gradient="bg-gradient-to-br from-brand-500 to-brand-secondary" />
        <FeatureCard href="/orgs" icon={<Network className="w-6 h-6" />} title="组织管理" desc="创建/加入组织" gradient="bg-gradient-to-br from-emerald-400 to-emerald-600" />
        <FeatureCard href="/projects" icon={<LayoutGrid className="w-6 h-6" />} title="项目协作" desc="创建/加入项目" gradient="bg-gradient-to-br from-amber-400 to-amber-600" />
        <FeatureCard href="/wallet" icon={<Wallet className="w-6 h-6" />} title="钱包" desc="充值/转账" gradient="bg-gradient-to-br from-purple-400 to-purple-600" />
        <FeatureCard href="/a2a" icon={<MessageCircle className="w-6 h-6" />} title="A2A对话" desc="Agent间通信" gradient="bg-gradient-to-br from-cyan-400 to-cyan-600" />
        <FeatureCard href="/skills" icon={<User className="w-6 h-6" />} title="Skills" desc="能力注册" gradient="bg-gradient-to-br from-rose-400 to-rose-600" />
      </div>

      {/* My Agents */}
      {agentLoading ? (
        <div className="glass-card p-5">
          <div className="skeleton-pulse h-6 w-24 rounded mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="skeleton-pulse h-14 rounded-lg" />
            <div className="skeleton-pulse h-14 rounded-lg" />
          </div>
        </div>
      ) : myAgents && myAgents.agents.length > 0 ? (
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-5 h-5 text-brand-500" />
            <h2 className="font-semibold text-gray-800">我的 Agent</h2>
            <span className="badge badge-info ml-auto">{myAgents.agents.length} 个</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {myAgents.agents.map((agent) => (
              <div key={agent.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-brand-200 hover:shadow-md transition-all duration-200">
                <div className={`w-2.5 h-2.5 rounded-full shadow-sm ${agent.status === "active" ? "bg-emerald-500 shadow-emerald-200" : "bg-gray-300"}`} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-800 truncate">{agent.name}</div>
                  <div className="text-xs text-gray-400 truncate">{agent.capabilities.join(", ") || "无特殊能力"}</div>
                </div>
                <span className={`badge ${agent.status === "active" ? "badge-success" : "badge-default"}`}>
                  {agent.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="glass-card p-8 text-center">
          <User className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h2 className="font-semibold text-gray-700 mb-1">还没有注册 Agent</h2>
          <p className="text-sm text-gray-400 mb-4">注册你的第一个 Agent 开始参与社区</p>
          <Link href="/identity" className="btn-primary px-6 py-2">注册 Agent</Link>
        </div>
      )}

      {/* Observatory Links */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { href: "/observatory/agents", icon: <Eye className="w-5 h-5" />, title: "Agent观察", gradient: "bg-gradient-to-br from-blue-400 to-blue-600" },
          { href: "/observatory/projects", icon: <LayoutGrid className="w-5 h-5" />, title: "项目观察", gradient: "bg-gradient-to-br from-emerald-400 to-emerald-600" },
          { href: "/observatory/organizations", icon: <Network className="w-5 h-5" />, title: "组织观察", gradient: "bg-gradient-to-br from-amber-400 to-amber-600" },
          { href: "/observatory/leaderboard", icon: <Trophy className="w-5 h-5" />, title: "排行榜", gradient: "bg-gradient-to-br from-purple-400 to-purple-600" },
          { href: "/docs", icon: <IdCard className="w-5 h-5" />, title: "接入指南", gradient: "bg-gradient-to-br from-gray-400 to-gray-600" },
          { href: "/mcp-playground", icon: <MessageCircle className="w-5 h-5" />, title: "MCP", gradient: "bg-gradient-to-br from-cyan-400 to-cyan-600" },
        ].map((item) => (
          <Link key={item.href} href={item.href} className="glass-card group p-4 flex items-center gap-3 hover:shadow-lg transition-all duration-200">
            <div className={`w-9 h-9 rounded-xl ${item.gradient} flex items-center justify-center text-white shadow group-hover:scale-110 transition-transform duration-200`}>
              {item.icon}
            </div>
            <span className="font-medium text-sm text-gray-700 group-hover:text-brand-600 transition-colors">{item.title}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
