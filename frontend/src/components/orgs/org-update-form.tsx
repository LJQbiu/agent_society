"use client";

import { useState } from "react";
import type { OrganizationCRUDResponse } from "@/types";

interface OrgUpdateFormProps {
  selectedOrg: OrganizationCRUDResponse;
  orgId: string;
  updateOrg: { mutate: (vars: any, opts?: any) => void; isPending: boolean };
  onErrorMsg: (msg: string) => void;
  onSuccessMsg: (msg: string) => void;
}

export function OrgUpdateForm({ selectedOrg, orgId, updateOrg, onErrorMsg, onSuccessMsg }: OrgUpdateFormProps) {
  const [updateForm, setUpdateForm] = useState<Record<string, string>>({});

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId) return;
    onErrorMsg(""); onSuccessMsg("");
    updateOrg.mutate({ id: orgId, data: updateForm }, {
      onSuccess: () => { setUpdateForm({}); onSuccessMsg("组织更新成功！"); },
      onError: (err: Error) => onErrorMsg(err.message || "更新失败"),
    });
  };

  return (
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
  );
}
