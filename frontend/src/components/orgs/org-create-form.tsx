"use client";

import { useState } from "react";
import type { OrganizationCreateRequest, MutationAction } from "@/types";

interface OrgCreateFormProps {
  createOrg: MutationAction<OrganizationCreateRequest>;
  onErrorMsg: (msg: string) => void;
  onSuccessMsg: (msg: string) => void;
}

export function OrgCreateForm({ createOrg, onErrorMsg, onSuccessMsg }: OrgCreateFormProps) {
  const [createForm, setCreateForm] = useState<OrganizationCreateRequest>({
    name: "", description: "", org_type: "company", governance_model: "democratic", charter: {},
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    onErrorMsg(""); onSuccessMsg("");
    createOrg.mutateAsync(createForm)
      .then(() => {
        onSuccessMsg("组织创建成功！");
        setCreateForm({ name: "", description: "", org_type: "company", governance_model: "democratic", charter: {} });
      })
      .catch((err: unknown) => onErrorMsg((err as Error).message || "创建失败"));
  };

  return (
    <form onSubmit={handleCreate} className="bg-surface-1 p-5 rounded-xl space-y-4 border border-surface-3 shadow-card animate-fadeIn">
      <h3 className="font-bold text-gray-800 text-lg">➕ 创建新组织</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">组织名称 *</label>
          <input type="text" value={createForm.name} required
            onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
            className="w-full border border-surface-3 rounded-lg px-3 py-2 focus:border-brand-500 outline-none transition" placeholder="e.g. TechCorp" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">类型</label>
          <select value={createForm.org_type} onChange={e => setCreateForm(f => ({ ...f, org_type: e.target.value }))}
            className="w-full border border-surface-3 rounded-lg px-3 py-2 focus:border-brand-500 outline-none transition">
            <option value="company">Company</option>
            <option value="dao">DAO</option>
            <option value="community">Community</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1">描述</label>
        <textarea value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
          className="w-full border border-surface-3 rounded-lg px-3 py-2 focus:border-brand-500 outline-none transition" rows={3} placeholder="描述组织目标..." />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1">治理模型</label>
        <select value={createForm.governance_model} onChange={e => setCreateForm(f => ({ ...f, governance_model: e.target.value }))}
          className="w-full border border-surface-3 rounded-lg px-3 py-2 focus:border-brand-500 outline-none transition">
          <option value="democratic">民主治理</option>
          <option value="autocratic">集中治理</option>
          <option value="meritocratic">精英治理</option>
        </select>
      </div>
      <button type="submit" className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-all shadow-card hover:shadow-cardHover disabled:opacity-50 disabled:cursor-not-allowed" disabled={createOrg.isPending}>
        {createOrg.isPending ? "⏳ 创建中..." : "✅ 创建"}
      </button>
    </form>
  );
}
