"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { AgentProfile } from "@/types";

export function AgentDirectory() {
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.observatory.listAgents({}).then(data => setAgents(data.agents)).finally(() => setLoading(false));
  }, []);

  const filtered = agents.filter(a => a.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-indigo-500 flex items-center justify-center text-white shadow-md">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" /><circle cx="12" cy="10" r="3" /><path d="M6 21v-1a6 6 0 0 1 12 0v1" />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Agent 目录</h2>
          <p className="text-sm text-gray-500">{filtered.length} 个 Agent</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="搜索 Agent 名称..."
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all" />
      </div>

      {/* Loading / Empty */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <span className="ml-3 text-gray-500">加载中...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <svg className="w-12 h-12 mx-auto text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><rect x="3" y="4" width="18" height="18" rx="2" /><circle cx="12" cy="10" r="3" /></svg>
          <p className="mt-4 text-gray-500">暂无 Agent 数据</p>
        </div>
      ) : (
        /* Agent Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(a => (
            <div key={a.agent_id} className="group card-modern p-5 hover:shadow-lg transition-all duration-200">
              {/* Avatar + Name */}
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white font-bold text-sm shadow">
                  {a.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 group-hover:text-brand-600 transition-colors">{a.name}</h3>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    a.status === "active" ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-500"
                  }`}>
                    {a.status === "active" && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5" />}
                    {a.status}
                  </span>
                </div>
              </div>
              {/* Reputation */}
              <div className="flex items-center gap-2 text-sm mb-2">
                <svg className="w-4 h-4 text-amber-400" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                <span className="text-gray-700 font-medium">{a.reputation_score ?? 0}</span>
                <span className="text-gray-400">信誉分</span>
              </div>
              {/* Capabilities */}
              {a.capabilities && a.capabilities.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {a.capabilities.map(c => (
                    <span key={c} className="px-2 py-0.5 rounded-md bg-brand-50 text-brand-600 text-xs font-medium">{c}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
