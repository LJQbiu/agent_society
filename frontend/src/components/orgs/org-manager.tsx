"use client";

import { useState } from "react";
import {
  useOrgCrudList, useOrgCrudDetail, useOrgMembers,
  useOrgMutations, useMyAgents, useAgentMutations,
} from "@/hooks/use-queries";
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

  // ─── Handlers ───
  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    createOrg.mutate(createForm, {
      onSuccess: () => { setShowCreateForm(false); setCreateForm({ name: "", description: "", org_type: "company", governance_model: "democratic", charter: {} }); },
      onError: (err: any) => setErrorMsg(err.message || "创建失败"),
    });
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrgId) return;
    setErrorMsg("");
    updateOrg.mutate({ id: selectedOrgId, data: updateForm }, {
      onSuccess: () => setUpdateForm({}),
      onError: (err: any) => setErrorMsg(err.message || "更新失败"),
    });
  };

  const handleJoin = () => {
    if (!selectedOrgId || !joinAgentId) return;
    setErrorMsg("");
    joinOrg.mutate({ orgId: selectedOrgId, data: { agent_id: joinAgentId } }, {
      onSuccess: () => setJoinAgentId(""),
      onError: (err: any) => setErrorMsg(err.message || "加入失败"),
    });
  };

  const handleRegisterAgent = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    registerAgent.mutate(agentForm, {
      onSuccess: () => { setShowRegisterAgent(false); setAgentForm({ name: "", description: "", capabilities: "", type: "assistant" }); },
      onError: (err: any) => setErrorMsg(err.message || "注册Agent失败"),
    });
  };

  // ─── Render ───
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">组织管理</h2>
        <button onClick={() => setShowCreateForm(!showCreateForm)} className="bg-blue-600 text-white px-3 py-1 rounded text-sm">
          {showCreateForm ? "取消" : "➕ 创建组织"}
        </button>
      </div>

      {errorMsg && <div className="bg-red-100 text-red-700 p-2 rounded text-sm">{errorMsg}</div>}

      {/* 创建组织表单 */}
      {showCreateForm && (
        <form onSubmit={handleCreate} className="bg-gray-50 p-4 rounded-lg space-y-3 border">
          <div>
            <label className="block text-sm font-medium mb-1">名称 *</label>
            <input type="text" value={createForm.name} required
              onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
              className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">描述</label>
            <input type="text" value={createForm.description}
              onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
              className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">类型</label>
            <select value={createForm.org_type} onChange={e => setCreateForm(f => ({ ...f, org_type: e.target.value }))} className="border rounded px-3 py-2">
              <option value="company">Company</option>
              <option value="dao">DAO</option>
              <option value="community">Community</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">治理模式</label>
            <select value={createForm.governance_model} onChange={e => setCreateForm(f => ({ ...f, governance_model: e.target.value }))} className="border rounded px-3 py-2">
              <option value="democratic">Democratic</option>
              <option value="hierarchical">Hierarchical</option>
              <option value="autonomous">Autonomous</option>
            </select>
          </div>
          <button type="submit" className="bg-green-600 text-white px-3 py-1 rounded" disabled={createOrg.isPending}>
            {createOrg.isPending ? "创建中..." : "✅ 创建"}
          </button>
        </form>
      )}

      {/* 组织列表 */}
      {orgsLoading ? <div className="text-gray-500">加载中...</div> : (
        <div className="space-y-2">
          {orgs.map(org => (
            <div key={org.id} onClick={() => { setSelectedOrgId(org.id); setUpdateForm({}); }}
              className={`p-3 border rounded cursor-pointer hover:bg-gray-50 ${selectedOrgId === org.id ? "bg-blue-50 border-blue-300" : ""}`}>
              <div className="font-medium">{org.name}</div>
              <div className="text-sm text-gray-500">{org.org_type} · {org.governance_model} · {org.status}</div>
            </div>
          ))}
          {orgs.length === 0 && <div className="text-gray-400 text-center py-4">暂无组织</div>}
        </div>
      )}

      {/* 组织详情 */}
      {selectedOrg && (
        <div className="bg-white p-4 rounded-lg border">
          <h3 className="font-bold text-lg mb-2">{selectedOrg.name}</h3>
          <div className="text-sm text-gray-600 mb-2">{selectedOrg.description}</div>
          <div className="grid grid-cols-2 gap-2 text-sm mb-3">
            <div>类型: {selectedOrg.org_type}</div>
            <div>治理: {selectedOrg.governance_model}</div>
            <div>声誉: {selectedOrg.reputation}</div>
            <div>余额: {selectedOrg.balance}</div>
            <div>创建者: {selectedOrg.creator_id}</div>
            <div>状态: {selectedOrg.status}</div>
          </div>

          {/* 成员列表 */}
          <div className="mb-3">
            <h4 className="font-medium mb-1">成员 ({members.length})</h4>
            {members.length === 0 ? <div className="text-gray-400 text-sm">暂无成员</div> : (
              <div className="space-y-1">
                {members.map(m => (
                  <div key={m.id} className="text-sm flex gap-2">
                    <span className="font-medium">{m.role}</span>
                    <span>{m.agent_id || m.human_id}</span>
                    <span className="text-gray-400">{m.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 加入组织 */}
          <div className="flex gap-2 items-end mb-3">
            <div>
              <label className="block text-sm font-medium mb-1">选择Agent加入</label>
              <select value={joinAgentId} onChange={e => setJoinAgentId(e.target.value)} className="border rounded px-3 py-2">
                <option value="">-- 选择Agent --</option>
                {myAgents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <button onClick={handleJoin} className="bg-green-600 text-white px-3 py-1 rounded" disabled={joinOrg.isPending || !joinAgentId}>
              {joinOrg.isPending ? "加入中..." : "🤝 加入组织"}
            </button>
            <button onClick={() => setShowRegisterAgent(!showRegisterAgent)} className="bg-gray-600 text-white px-3 py-1 rounded text-sm">
              {showRegisterAgent ? "取消注册" : "➕ 注册新Agent"}
            </button>
          </div>

          {/* 注册Agent表单 */}
          {showRegisterAgent && (
            <form onSubmit={handleRegisterAgent} className="bg-gray-50 p-3 rounded space-y-2 border mb-3">
              <div>
                <label className="block text-sm font-medium mb-1">Agent名称 *</label>
                <input type="text" value={agentForm.name} required
                  onChange={e => setAgentForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border rounded px-3 py-2" placeholder="e.g. MyAssistant" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">描述</label>
                <input type="text" value={agentForm.description}
                  onChange={e => setAgentForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border rounded px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">能力(逗号分隔)</label>
                <input type="text" value={agentForm.capabilities}
                  onChange={e => setAgentForm(f => ({ ...f, capabilities: e.target.value }))}
                  className="w-full border rounded px-3 py-2" placeholder="e.g. search,translate" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">类型</label>
                <select value={agentForm.type} onChange={e => setAgentForm(f => ({ ...f, type: e.target.value }))} className="border rounded px-3 py-2">
                  <option value="assistant">Assistant</option>
                  <option value="worker">Worker</option>
                </select>
              </div>
              <button type="submit" className="bg-green-600 text-white px-3 py-1 rounded" disabled={registerAgent.isPending}>
                {registerAgent.isPending ? "注册中..." : "✅ 注册"}
              </button>
            </form>
          )}

          {/* 更新组织表单 */}
          <form onSubmit={handleUpdate} className="space-y-2">
            <div>
              <label className="block text-sm font-medium mb-1">名称</label>
              <input type="text" value={updateForm.name || selectedOrg.name || ""}
                onChange={e => setUpdateForm(f => ({ ...f, name: e.target.value }))} className="border p-2 rounded w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">描述</label>
              <textarea value={updateForm.description || selectedOrg.description || ""}
                onChange={e => setUpdateForm(f => ({ ...f, description: e.target.value }))} className="border p-2 rounded w-full" rows={2} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">类型</label>
              <select value={updateForm.org_type || selectedOrg.org_type || "company"}
                onChange={e => setUpdateForm(f => ({ ...f, org_type: e.target.value }))} className="border p-2 rounded">
                <option value="company">Company</option>
                <option value="DAO">DAO</option>
              </select>
            </div>
            <button type="submit" className="bg-yellow-600 text-white px-3 py-1 rounded hover:bg-yellow-700" disabled={updateOrg.isPending}>
              {updateOrg.isPending ? "更新中..." : "更新"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
