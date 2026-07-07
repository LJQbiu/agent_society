"use client";

import { useState } from "react";
import type { ProjectUpdateRequest, MutationAction } from "@/types";

interface ProjectUpdateFormProps {
  projectId: string;
  updateProject: MutationAction<{ id: string; data: ProjectUpdateRequest }>;
  onSuccessMsg: (msg: string) => void;
}

export function ProjectUpdateForm({ projectId, updateProject, onSuccessMsg }: ProjectUpdateFormProps) {
  const [updateForm, setUpdateForm] = useState<Record<string, string>>({});

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) return;
    updateProject.mutateAsync({ id: projectId, data: updateForm })
      .then(() => { setUpdateForm({}); onSuccessMsg("项目更新成功！"); });
  };

  return (
    <div className="bg-white p-5 rounded-xl shadow-card border border-gray-100">
      <h3 className="font-bold text-gray-800 mb-3">📝 更新项目</h3>
      <form onSubmit={handleUpdate} className="space-y-3">
        <div>
          <label className="block font-medium text-gray-700 mb-1">名称</label>
          <input value={updateForm.name || ""}
            onChange={e => setUpdateForm(f => ({ ...f, name: e.target.value }))}
            className="border border-gray-200 p-2.5 rounded-lg w-full focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all" />
        </div>
        <div>
          <label className="block font-medium text-gray-700 mb-1">描述</label>
          <textarea value={updateForm.description || ""}
            onChange={e => setUpdateForm(f => ({ ...f, description: e.target.value }))}
            className="border border-gray-200 p-2.5 rounded-lg w-full focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all" rows={2} />
        </div>
        <button type="submit"
          className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-all shadow-card disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          disabled={updateProject.isPending}>
          {updateProject.isPending ? "⏳ 更新中..." : "📝 更新"}
        </button>
      </form>
    </div>
  );
}
