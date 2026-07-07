"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { ProjectCreateRequest, MutationAction } from "@/types";

interface ProjectCreateFormProps {
  createProject: MutationAction<ProjectCreateRequest>;
  onCreated: (projectId: string) => void;
  onSuccessMsg: (msg: string) => void;
}

export function ProjectCreateForm({ createProject, onCreated, onSuccessMsg }: ProjectCreateFormProps) {
  const [createForm, setCreateForm] = useState<ProjectCreateRequest>({
    name: "", description: "", type: "task", status: "recruiting", max_participants: 10,
    budget: 0, reputation_budget: 0, required_capabilities: [],
    organization_id: "",
  });
  const [capabilitiesInput, setCapabilitiesInput] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const capabilities = capabilitiesInput.split(",").map(s => s.trim()).filter(Boolean);
    const payload: ProjectCreateRequest = {
      ...createForm, required_capabilities: capabilities,
      organization_id: createForm.organization_id || undefined,
    };
    createProject.mutateAsync(payload)
      .then((data: unknown) => {
        const result = data as { id: string };
        setCreateForm({ name: "", description: "", type: "task", status: "recruiting", max_participants: 10,
          budget: 0, reputation_budget: 0, required_capabilities: [], organization_id: "" });
        setCapabilitiesInput("");
        onSuccessMsg("项目创建成功！");
        onCreated(result.id);
      });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-card space-y-5 animate-slideDown">
      <h2 className="text-xl font-bold text-gray-800">创建新项目</h2>
      <div>
        <label className="block font-medium text-gray-700 mb-1">项目名称</label>
        <input value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
          className="border border-gray-200 p-2.5 rounded-lg w-full focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all" required />
      </div>
      <div>
        <label className="block font-medium text-gray-700 mb-1">描述</label>
        <textarea value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
          className="border border-gray-200 p-2.5 rounded-lg w-full focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all" rows={3} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block font-medium text-gray-700 mb-1">类型</label>
          <select value={createForm.type} onChange={e => setCreateForm(f => ({ ...f, type: e.target.value }))}
            className="border border-gray-200 p-2.5 rounded-lg w-full focus:border-brand-500">
            <option value="task">任务</option>
            <option value="project">项目</option>
            <option value="service">服务</option>
          </select>
        </div>
        <div>
          <label className="block font-medium text-gray-700 mb-1">初始状态</label>
          <select value={createForm.status} onChange={e => setCreateForm(f => ({ ...f, status: e.target.value }))}
            className="border border-gray-200 p-2.5 rounded-lg w-full focus:border-brand-500">
            <option value="recruiting">📢 招募中</option>
            <option value="active">🚀 进行中</option>
            <option value="suspended">⏸️ 已暂停</option>
            <option value="completed">✅ 已完成</option>
            <option value="revoked">❌ 已撤销</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block font-medium text-gray-700 mb-1">最大参与人数</label>
        <input type="number" value={createForm.max_participants}
          onChange={e => setCreateForm(f => ({ ...f, max_participants: parseInt(e.target.value) || 10 }))}
          className="border border-gray-200 p-2.5 rounded-lg w-full focus:border-brand-500" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block font-medium text-gray-700 mb-1">预算</label>
          <input type="number" value={createForm.budget}
            onChange={e => setCreateForm(f => ({ ...f, budget: parseFloat(e.target.value) || 0 }))}
            className="border border-gray-200 p-2.5 rounded-lg w-full focus:border-brand-500" />
        </div>
        <div>
          <label className="block font-medium text-gray-700 mb-1">声誉预算</label>
          <input type="number" value={createForm.reputation_budget}
            onChange={e => setCreateForm(f => ({ ...f, reputation_budget: parseFloat(e.target.value) || 0 }))}
            className="border border-gray-200 p-2.5 rounded-lg w-full focus:border-brand-500" />
        </div>
      </div>
      <div>
        <label className="block font-medium text-gray-700 mb-1">所需能力(逗号分隔)</label>
        <input value={capabilitiesInput} onChange={e => setCapabilitiesInput(e.target.value)}
          placeholder="coding, analysis, design"
          className="border border-gray-200 p-2.5 rounded-lg w-full focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all" />
      </div>
      <div>
        <label className="block font-medium text-gray-700 mb-1">关联组织ID</label>
        <input value={createForm.organization_id}
          onChange={e => setCreateForm(f => ({ ...f, organization_id: e.target.value }))}
          placeholder="可选: 关联到组织"
          className="border border-gray-200 p-2.5 rounded-lg w-full focus:border-brand-500" />
      </div>
      <button type="submit"
        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all shadow-card disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        disabled={createProject.isPending}>
        {createProject.isPending ? "⏳ 创建中..." : "✅ 创建项目"}
      </button>
    </form>
  );
}
