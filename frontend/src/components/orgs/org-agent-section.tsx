"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface AgentInfo { id: string; name: string }

interface OrgAgentSectionProps {
  orgId: string;
  myAgents: AgentInfo[];
  joinOrg: { mutate: (vars: any, opts?: any) => void; isPending: boolean };
  registerAgent: { mutate: (vars: any, opts?: any) => void; isPending: boolean };
  onErrorMsg: (msg: string) => void;
  onSuccessMsg: (msg: string) => void;
}

export function OrgAgentSection({ orgId, myAgents, joinOrg, registerAgent, onErrorMsg, onSuccessMsg }: OrgAgentSectionProps) {
  const [joinAgentId, setJoinAgentId] = useState<string>("");
  const [showRegisterAgent, setShowRegisterAgent] = useState(false);
  const [agentForm, setAgentForm] = useState({ name: "", description: "", capabilities: "", type: "assistant" });

  const handleJoin = () => {
    if (!orgId || !joinAgentId) return;
    onErrorMsg(""); onSuccessMsg("");
    joinOrg.mutate({ orgId, data: { agent_id: joinAgentId } }, {
      onSuccess: () => { setJoinAgentId(""); onSuccessMsg("成功加入组织！"); },
      onError: (err: Error) => onErrorMsg(err.message || "加入失败"),
    });
  };

  const handleRegisterAgent = (e: React.FormEvent) => {
    e.preventDefault();
    onErrorMsg(""); onSuccessMsg("");
    registerAgent.mutate(agentForm, {
      onSuccess: () => { setShowRegisterAgent(false); onSuccessMsg("Agent注册成功！"); setAgentForm({ name: "", description: "", capabilities: "", type: "assistant" }); },
      onError: (err: Error) => onErrorMsg(err.message || "注册Agent失败"),
    });
  };

  return (
    <div className="space-y-3">
      {/* Join org */}
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-600 mb-1">选择Agent加入</label>
          <select value={joinAgentId} onChange={e => setJoinAgentId(e.target.value)}
            className="w-full border border-surface-3 rounded-lg px-3 py-2 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition">
            <option value="">-- 选择Agent --</option>
            {myAgents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <button onClick={handleJoin} className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-all shadow-card hover:shadow-cardHover disabled:opacity-50 disabled:cursor-not-allowed" disabled={joinOrg.isPending || !joinAgentId}>
          {joinOrg.isPending ? "⏳ 加入中..." : "🤝 加入"}
        </button>
        <button onClick={() => setShowRegisterAgent(!showRegisterAgent)}
          className={cn("px-3 py-2 rounded-lg text-sm font-medium transition-all shadow-card hover:shadow-cardHover",
            showRegisterAgent ? "bg-gray-200 text-gray-700" : "bg-gray-600 text-white hover:bg-gray-700")}>
          {showRegisterAgent ? "✕ 取消" : "➕ 注册Agent"}
        </button>
      </div>

      {/* Register agent form */}
      {showRegisterAgent && (
        <form onSubmit={handleRegisterAgent} className="bg-surface-1 p-4 rounded-xl space-y-3 border border-surface-3 animate-fadeIn">
          <h4 className="font-bold text-gray-700">注册新Agent</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Agent名称 *</label>
              <input type="text" value={agentForm.name} required
                onChange={e => setAgentForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border border-surface-3 rounded-lg px-3 py-2 focus:border-brand-500 outline-none transition" placeholder="e.g. MyAssistant" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">描述</label>
              <textarea value={agentForm.description}
                onChange={e => setAgentForm(f => ({ ...f, description: e.target.value }))}
                className="w-full border border-surface-3 rounded-lg px-3 py-2 focus:border-brand-500 outline-none transition" rows={2} placeholder="描述Agent功能..." />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">能力(逗号分隔)</label>
              <input type="text" value={agentForm.capabilities}
                onChange={e => setAgentForm(f => ({ ...f, capabilities: e.target.value }))}
                className="w-full border border-surface-3 rounded-lg px-3 py-2 focus:border-brand-500 outline-none transition" placeholder="e.g. search,translate" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">类型</label>
              <select value={agentForm.type} onChange={e => setAgentForm(f => ({ ...f, type: e.target.value }))}
                className="w-full border border-surface-3 rounded-lg px-3 py-2 focus:border-brand-500 outline-none transition">
                <option value="assistant">Assistant</option>
                <option value="worker">Worker</option>
              </select>
            </div>
          </div>
          <button type="submit" className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed" disabled={registerAgent.isPending}>
            {registerAgent.isPending ? "⏳ 注册中..." : "✅ 注册"}
          </button>
        </form>
      )}
    </div>
  );
}
