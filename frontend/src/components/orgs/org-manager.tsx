"use client";

import { useState } from "react";
import {
  useOrgCrudList, useOrgCrudDetail, useOrgMembers,
  useOrgMutations, useMyAgents, useAgentMutations,
} from "@/hooks/use-queries";
import { LoadingList, EmptyState, ErrorAlert, SuccessAlert } from "@/components/ui/status-components";
import { cn } from "@/lib/utils";
import type { OrganizationCRUDResponse, OrganizationCreateRequest } from "@/types";

export default function OrgManager() {
  // ─── Query hooks ───
  const { data: orgListData, isLoading: orgsLoading } = useOrgCrudList();
  const orgs = orgListData?.organizations || [];

  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const { data: selectedOrg, isLoading: detailLoading } = useOrgCrudDetail(selectedOrgId);
  const { data: membersData } = useOrgMembers(selectedOrgId);
  const members = membersData?.members || [];

  const { data: myAgentsData } = useMyAgents();
  const myAgents = myAgentsData?.agents || [];

  // ─── Mutation hooks ───
  const { createOrg, updateOrg, joinOrg } = useOrgMutations();
  const { registerAgent } = useAgentMutations();

  // ─── Form states ───
  const [createForm, setCreateForm] = useState<OrganizationCreateRequest>({
    name: "", description: "", org_type: "company", governance_model: "democratic", charter: {},
  });
  const [updateForm, setUpdateForm] = useState<Record<string, any>>({});
  const [joinAgentId, setJoinAgentId] = useState<string>("");
  const [agentForm, setAgentForm] = useState({ name: "", description: "", capabilities: "", type: "assistant" });
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showRegisterAgent, setShowRegisterAgent] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [successMsg, setSuccessMsg] = useState<string>("");

  // ─── Handlers ───
  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(""); setSuccessMsg("");
    createOrg.mutate(createForm, {
      onSuccess: () => { setShowCreateForm(false); setSuccessMsg("组织创建成功！"); setCreateForm({ name: "", description: "", org_type: "company", governance_model: "democratic", charter: {} }); },
      onError: (err: any) => setErrorMsg(err.message || "创建失败"),
    });
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrgId) return;
    setErrorMsg(""); setSuccessMsg("");
    updateOrg.mutate({ id: selectedOrgId, data: updateForm }, {
      onSuccess: () => { setUpdateForm({}); setSuccessMsg("组织更新成功！"); },
      onError: (err: any) => setErrorMsg(err.message || "更新失败"),
    });
  };

  const handleJoin = () => {
    if (!selectedOrgId || !joinAgentId) return;
    setErrorMsg(""); setSuccessMsg("");
    joinOrg.mutate({ orgId: selectedOrgId, data: { agent_id: joinAgentId } }, {
      onSuccess: () => { setJoinAgentId(""); setSuccessMsg("成功加入组织！"); },
      onError: (err: any) => setErrorMsg(err.message || "加入失败"),
    });
  };

  const handleRegisterAgent = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(""); setSuccessMsg("");
    registerAgent.mutate(agentForm, {
      onSuccess: () => { setShowRegisterAgent(false); setSuccessMsg("Agent注册成功！"); setAgentForm({ name: "", description: "", capabilities: "", type: "assistant" }); },
      onError: (err: any) => setErrorMsg(err.message || "注册Agent失败"),
    });
  };

  // ─── Helpers ───
  const orgTypeIcon: Record<string, string> = { company: "🏢", dao: "🏛️", community: "👥" };
  const govModelLabel: Record<string, string> = { democratic: "民主制", hierarchical: "层级制", autonomous: "自治" };
  const statusColor: Record<string, string> = { active: "bg-green-100 text-green-700 border-green-300", pending: "bg-yellow-100 text-yellow-700 border-yellow-300", suspended: "bg-red-100 text-red-700 border-red-300" };

  // ─── Render ───
  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-800">🏗️ 组织管理</h2>
        <button onClick={() => setShowCreateForm(!showCreateForm)}
          className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-card hover:shadow-cardHover",
            showCreateForm ? "bg-gray-200 text-gray-700 hover:bg-gray-300" : "bg-brand-600 text-white hover:bg-brand-700")}>
          {showCreateForm ? "✕ 取消" : "➕ 创建组织"}
        </button>
      </div>

      {/* Alerts */}
      {errorMsg && <ErrorAlert message={errorMsg} onClose={() => setErrorMsg("")} />}
      {successMsg && <SuccessAlert message={successMsg} onClose={() => setSuccessMsg("")} />}

      {/* Create org form */}
      {showCreateForm && (
        <form onSubmit={handleCreate} className="bg-white p-5 rounded-xl border border-surface-3 space-y-4 shadow-card animate-fadeIn">
          <h3 className="font-bold text-lg text-gray-700">新建组织</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">名称 *</label>
              <input type="text" value={createForm.name} required
                onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border border-surface-3 rounded-lg px-3 py-2 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition" placeholder="输入组织名称" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">描述</label>
              <input type="text" value={createForm.description}
                onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
                className="w-full border border-surface-3 rounded-lg px-3 py-2 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition" placeholder="简述组织目的" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">类型</label>
              <select value={createForm.org_type} onChange={e => setCreateForm(f => ({ ...f, org_type: e.target.value }))}
                className="w-full border border-surface-3 rounded-lg px-3 py-2 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition">
                <option value="company">🏢 Company</option>
                <option value="dao">🏛️ DAO</option>
                <option value="community">👥 Community</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">治理模式</label>
              <select value={createForm.governance_model} onChange={e => setCreateForm(f => ({ ...f, governance_model: e.target.value }))}
                className="w-full border border-surface-3 rounded-lg px-3 py-2 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition">
                <option value="democratic">🗳️ Democratic</option>
                <option value="hierarchical">📊 Hierarchical</option>
                <option value="autonomous">🤖 Autonomous</option>
              </select>
            </div>
          </div>
          <button type="submit" className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-all shadow-card hover:shadow-cardHover disabled:opacity-50 disabled:cursor-not-allowed" disabled={createOrg.isPending}>
            {createOrg.isPending ? "⏳ 创建中..." : "✅ 创建"}
          </button>
        </form>
      )}

      {/* Org list */}
      {orgsLoading ? <LoadingList count={3} /> : (
        orgs.length === 0 ? (
          <EmptyState icon="🏗️" title="暂无组织" description="创建第一个组织，开始协作" action={{ label: "创建组织", onClick: () => setShowCreateForm(true) }} />
        ) : (
          <div className="space-y-2">
            {orgs.map(org => (
              <div key={org.id} onClick={() => { setSelectedOrgId(org.id); setUpdateForm({}); setErrorMsg(""); setSuccessMsg(""); }}
                className={cn("p-4 rounded-xl border cursor-pointer transition-all hover:shadow-cardHover animate-fadeIn",
                  selectedOrgId === org.id ? "bg-brand-50 border-brand-400 shadow-card" : "bg-white border-surface-3 hover:border-brand-200")}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{orgTypeIcon[org.org_type] || "🏢"}</span>
                    <span className="font-semibold text-gray-800">{org.name}</span>
                  </div>
                  <span className={cn("px-2 py-1 rounded-full text-xs font-medium border", statusColor[org.status] || "bg-gray-100 text-gray-600 border-gray-300")}>
                    {org.status}
                  </span>
                </div>
                <div className="text-sm text-gray-500 mt-1 flex gap-3">
                  <span>{org.org_type}</span>
                  <span>·</span>
                  <span>{govModelLabel[org.governance_model] || org.governance_model}</span>
                  <span>·</span>
                  <span>声誉 {org.reputation ?? 0}</span>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Org detail */}
      {detailLoading && selectedOrgId && <LoadingList count={1} />}
      {selectedOrg && (
        <div className="bg-white p-5 rounded-xl border border-surface-3 shadow-card animate-fadeIn space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{orgTypeIcon[selectedOrg.org_type] || "🏢"}</span>
            <h3 className="font-bold text-lg text-gray-800">{selectedOrg.name}</h3>
            <span className={cn("px-2 py-1 rounded-full text-xs font-medium border", statusColor[selectedOrg.status] || "bg-gray-100 text-gray-600 border-gray-300")}>
              {selectedOrg.status}
            </span>
          </div>

          <p className="text-sm text-gray-600">{selectedOrg.description || "无描述"}</p>

          {/* Info grid */}
          <div className="grid grid-cols-3 gap-3 text-sm">
            {[
              { label: "类型", value: selectedOrg.org_type, icon: orgTypeIcon[selectedOrg.org_type] },
              { label: "治理", value: govModelLabel[selectedOrg.governance_model] || selectedOrg.governance_model, icon: "📊" },
              { label: "声誉", value: selectedOrg.reputation ?? 0, icon: "⭐" },
              { label: "余额", value: selectedOrg.balance ?? 0, icon: "💰" },
              { label: "创建者", value: selectedOrg.creator_id, icon: "👤" },
              { label: "状态", value: selectedOrg.status, icon: "📌" },
            ].map(item => (
              <div key={item.label} className="bg-surface-1 rounded-lg px-3 py-2 flex items-center gap-2">
                <span>{item.icon}</span>
                <span className="text-gray-500">{item.label}:</span>
                <span className="font-medium text-gray-700">{item.value}</span>
              </div>
            ))}
          </div>

          {/* Members */}
          <div>
            <h4 className="font-medium text-gray-700 mb-2">👥 成员 ({members.length})</h4>
            {members.length === 0 ? (
              <EmptyState icon="👥" title="暂无成员" description="加入组织或注册Agent" size="sm" />
            ) : (
              <div className="space-y-1">
                {members.map(m => (
                  <div key={m.id} className="text-sm flex gap-2 items-center bg-surface-1 rounded-lg px-3 py-2">
                    <span className="font-medium text-gray-700">{m.role}</span>
                    <span className="text-gray-500">{m.agent_id || m.human_id}</span>
                    <span className={cn("px-1.5 py-0.5 rounded text-xs", statusColor[m.status] || "bg-gray-100 text-gray-600")}>{m.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

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
                  <input type="text" value={agentForm.description}
                    onChange={e => setAgentForm(f => ({ ...f, description: e.target.value }))}
                    className="w-full border border-surface-3 rounded-lg px-3 py-2 focus:border-brand-500 outline-none transition" />
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

          {/* Update org form */}
          <form onSubmit={handleUpdate} className="space-y-3">
            <h4 className="font-medium text-gray-700">📝 更新组织信息</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">名称</label>
                <input type="text" value={updateForm.name || selectedOrg.name || ""}
                  onChange={e => setUpdateForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border border-surface-3 rounded-lg px-3 py-2 focus:border-brand-500 outline-none transition" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">描述</label>
                <textarea value={updateForm.description || selectedOrg.description || ""}
                  onChange={e => setUpdateForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border border-surface-3 rounded-lg px-3 py-2 focus:border-brand-500 outline-none transition" rows={2} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">类型</label>
              <select value={updateForm.org_type || selectedOrg.org_type || "company"}
                onChange={e => setUpdateForm(f => ({ ...f, org_type: e.target.value }))}
                className="border border-surface-3 rounded-lg px-3 py-2 focus:border-brand-500 outline-none transition">
                <option value="company">Company</option>
                <option value="dao">DAO</option>
                <option value="community">Community</option>
              </select>
            </div>
            <button type="submit" className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed" disabled={updateOrg.isPending}>
              {updateOrg.isPending ? "⏳ 更新中..." : "📝 更新"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
