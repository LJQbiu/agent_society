"use client";

import { useState } from "react";
import Link from "next/link";
import {
  useProjectCrudList, useProjectCrudDetail, useProjectParticipants,
  useProjectChatMessages, useProjectTodos, useProjectMutations, useMyAgents,
} from "@/hooks/use-queries";
import { LoadingList, EmptyState, ErrorAlert, SuccessAlert } from "@/components/ui/status-components";
import { cn } from "@/lib/utils";
import type { ProjectCreateRequest } from "@/types";

export default function ProjectManager() {
  // ─── Query hooks ───
  const { data: projectListData, isLoading: projectsLoading } = useProjectCrudList({});
  const projects = projectListData?.projects || [];
  const myAgentsData = useMyAgents();
  const myAgents = myAgentsData.data;

  // ─── Local state ───
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [tab, setTab] = useState<"list" | "create" | "detail">("list");
  const [search, setSearch] = useState("");
  const [selectedJoinAgent, setSelectedJoinAgent] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [showTodoForm, setShowTodoForm] = useState(false);
  const [capabilitiesInput, setCapabilitiesInput] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [createForm, setCreateForm] = useState<ProjectCreateRequest>({
    name: "", description: "", type: "task", max_participants: 10,
    budget: 0, reputation_budget: 0, required_capabilities: [],
    organization_id: "",
  });
  const [updateForm, setUpdateForm] = useState<Record<string, string>>({});
  const [todoForm, setTodoForm] = useState({ title: "", description: "", priority: "medium" });

  // ─── Detail queries ───
  const { data: selectedProject } = useProjectCrudDetail(selectedProjectId);
  const { data: participantsData } = useProjectParticipants(selectedProjectId);
  const participants = participantsData?.participants || [];
  const { data: chatData } = useProjectChatMessages(selectedProjectId, 50);
  const chatMessages = chatData?.messages || [];
  const { data: todosData } = useProjectTodos(selectedProjectId);
  const todos = todosData?.todos || [];

  // ─── Mutations ───
  const { createProject, updateProject, joinProject, leaveProject,
    updateProjectStatus, sendChatMessage, createTodo, updateTodo, claimTodo } = useProjectMutations();

  // ─── Handlers ───
  const viewDetail = (id: string) => { setSelectedProjectId(id); setTab("detail"); };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const capabilities = capabilitiesInput.split(",").map(s => s.trim()).filter(Boolean);
    createProject.mutate({ ...createForm, required_capabilities: capabilities }, {
      onSuccess: (data: any) => {
        setCreateForm({ name: "", description: "", type: "task", max_participants: 10,
          budget: 0, reputation_budget: 0, required_capabilities: [], organization_id: "" });
        setCapabilitiesInput("");
        setSuccessMsg("项目创建成功！");
        viewDetail(data.id);
      },
    });
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) return;
    updateProject.mutate({ id: selectedProjectId, data: updateForm }, {
      onSuccess: () => { setUpdateForm({}); setSuccessMsg("项目更新成功！"); },
    });
  };

  const handleJoin = (projectId: string) => {
    const agentId = selectedJoinAgent || myAgents?.agents?.[0]?.id;
    if (!agentId) return;
    joinProject.mutate({ id: projectId, data: { agent_id: agentId } }, {
      onSuccess: () => { viewDetail(projectId); setSuccessMsg("成功加入项目！"); },
    });
  };

  const handleLeave = (projectId: string) => {
    const agentId = selectedJoinAgent || myAgents?.agents?.[0]?.id;
    if (!agentId) return;
    leaveProject.mutate({ id: projectId, data: { agent_id: agentId } }, {
      onSuccess: () => { viewDetail(projectId); setSuccessMsg("已退出项目"); },
    });
  };

  const handleStatusTransition = (projectId: string) => {
    if (!newStatus) return;
    updateProjectStatus.mutate({ id: projectId, data: { new_status: newStatus } }, {
      onSuccess: () => { setNewStatus(""); setSuccessMsg("状态已更新！"); },
    });
  };

  const handleCreateTodo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) return;
    const agentId = selectedJoinAgent || myAgents?.agents?.[0]?.id;
    createTodo.mutate({ id: selectedProjectId, data: { ...todoForm, creator_agent_id: agentId } }, {
      onSuccess: () => { setTodoForm({ title: "", description: "", priority: "medium" }); setShowTodoForm(false); setSuccessMsg("TODO已创建！"); },
    });
  };

  const handleClaimTodo = (todoId: string) => {
    if (!selectedProjectId) return;
    const agentId = selectedJoinAgent || myAgents?.agents?.[0]?.id;
    claimTodo.mutate({ id: selectedProjectId, todoId, data: { claimer_type: "agent", agent_id: agentId } });
  };

  const handleUpdateTodoStatus = (todoId: string, status: string) => {
    if (!selectedProjectId) return;
    const agentId = selectedJoinAgent || myAgents?.agents?.[0]?.id;
    updateTodo.mutate({ id: selectedProjectId, todoId, data: { status, agent_id: agentId } });
  };

  // ─── Computed ───
  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.description?.toLowerCase().includes(search.toLowerCase())
  );

  const mutationError = createProject.error || updateProject.error || joinProject.error ||
    leaveProject.error || updateProjectStatus.error || createTodo.error;

  const statusColor = (s: string) => {
    switch (s) {
      case "active": return "bg-green-100 text-green-700 border-green-300";
      case "recruiting": return "bg-blue-100 text-blue-700 border-blue-300";
      case "suspended": return "bg-yellow-100 text-yellow-700 border-yellow-300";
      case "completed": return "bg-gray-100 text-gray-600 border-gray-300";
      case "paused": return "bg-orange-100 text-orange-700 border-orange-300";
      default: return "bg-red-100 text-red-700 border-red-300";
    }
  };

  const todoBorderColor = (s: string) => {
    switch (s) {
      case "completed": return "border-l-green-500 bg-green-50/50";
      case "in_progress": return "border-l-yellow-500 bg-yellow-50/50";
      case "claimed": return "border-l-blue-500 bg-blue-50/50";
      default: return "border-l-gray-400 bg-gray-50/50";
    }
  };

  // ─── Render ───
  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <span className="text-3xl">🏗️</span>
        <h1 className="text-2xl font-bold text-gray-800">项目协作</h1>
      </div>

      {/* Alerts */}
      {mutationError && (
        <ErrorAlert message={(mutationError as any)?.message || "操作失败"} onClose={() => {}} />
      )}
      {successMsg && (
        <SuccessAlert message={successMsg} onClose={() => setSuccessMsg("")} />
      )}

      {/* Tab buttons */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {(["list", "create"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2 rounded-lg transition-all font-medium text-sm shadow-sm",
              tab === t
                ? "bg-brand-600 text-white shadow-card"
                : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
            )}>
            {t === "list" ? "📋 项目列表" : "➕ 创建项目"}
          </button>
        ))}
        {selectedProject && (
          <button onClick={() => setTab("detail")}
            className={cn(
              "px-4 py-2 rounded-lg transition-all font-medium text-sm shadow-sm",
              tab === "detail"
                ? "bg-brand-600 text-white shadow-card"
                : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
            )}>
            📊 项目详情
          </button>
        )}
      </div>

      {/* List tab */}
      {tab === "list" && (
        <div>
          <div className="flex gap-2 mb-4 items-center">
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="🔍 搜索项目..."
              className="border border-gray-200 p-2.5 rounded-lg flex-1 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all" />
            <select value={selectedJoinAgent} onChange={e => setSelectedJoinAgent(e.target.value)}
              className="border border-gray-200 p-2.5 rounded-lg text-sm focus:border-brand-500">
              <option value="">选择Agent...</option>
              {myAgents?.agents?.map(a => (
                <option key={a.id} value={a.id}>{a.name || a.id}</option>
              ))}
            </select>
          </div>

          {projectsLoading ? (
            <LoadingList />
          ) : filtered.length === 0 ? (
            <EmptyState icon="🏗️" title="暂无项目" description="创建一个新项目来开始协作" action={{ label: "创建项目", onClick: () => setTab("create") }} />
          ) : (
            <div className="space-y-3">
              {filtered.map(p => (
                <div key={p.id} className="bg-white p-4 rounded-xl shadow-card hover:shadow-lg transition-all border border-gray-100">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-lg text-gray-800">{p.name}</h3>
                      <p className="text-gray-500 text-sm mt-1">{p.description || "暂无描述"}</p>
                    </div>
                    <span className={cn("px-2.5 py-1 rounded-full text-xs font-medium border", statusColor(p.status))}>
                      {p.status}
                    </span>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => viewDetail(p.id)}
                      className="px-3 py-1.5 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700 transition-all shadow-sm">
                      📊 详情
                    </button>
                    <button onClick={() => handleJoin(p.id)}
                      className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={joinProject.isPending}>
                      🤝 加入
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create tab */}
      {tab === "create" && (
        <form onSubmit={handleCreate} className="bg-white p-6 rounded-xl shadow-card space-y-5 animate-slideDown">
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
          <div className="grid grid-cols-2 gap-4">
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
              <label className="block font-medium text-gray-700 mb-1">最大参与人数</label>
              <input type="number" value={createForm.max_participants}
                onChange={e => setCreateForm(f => ({ ...f, max_participants: parseInt(e.target.value) || 10 }))}
                className="border border-gray-200 p-2.5 rounded-lg w-full focus:border-brand-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
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
      )}

      {/* Detail tab */}
      {tab === "detail" && selectedProject && (
        <div className="space-y-4 animate-slideDown">
          {/* Project info card */}
          <div className="bg-white p-5 rounded-xl shadow-card border border-gray-100">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-800">{selectedProject.name}</h2>
                <p className="text-gray-500 mt-1">{selectedProject.description || "暂无描述"}</p>
              </div>
              <span className={cn("px-2.5 py-1 rounded-full text-xs font-medium border", statusColor(selectedProject.status))}>
                {selectedProject.status}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 text-sm">
              <div className="flex items-center gap-2 text-gray-600">
                <span className="font-medium text-gray-700">类型:</span> {selectedProject.type || "-"}
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <span className="font-medium text-gray-700">预算:</span> {selectedProject.budget || 0}
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <span className="font-medium text-gray-700">参与人数:</span> {selectedProject.max_participants || "-"}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 items-center flex-wrap bg-white p-3 rounded-xl shadow-card border border-gray-100">
            <select value={selectedJoinAgent} onChange={e => setSelectedJoinAgent(e.target.value)}
              className="border border-gray-200 p-2 rounded-lg text-sm focus:border-brand-500">
              <option value="">选择Agent...</option>
              {myAgents?.agents?.map(a => (
                <option key={a.id} value={a.id}>{a.name || a.id}</option>
              ))}
            </select>
            <button onClick={() => handleJoin(selectedProject.id)}
              className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-all shadow-sm disabled:opacity-50"
              disabled={!selectedJoinAgent && !myAgents?.agents?.[0]?.id}>
              🤝 加入
            </button>
            <button onClick={() => handleLeave(selectedProject.id)}
              className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 transition-all shadow-sm">
              🚪 退出
            </button>
            <div className="flex gap-1 items-center ml-2">
              <select value={newStatus} onChange={e => setNewStatus(e.target.value)}
                className="border border-gray-200 p-2 rounded-lg text-sm focus:border-brand-500">
                <option value="">变更状态...</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <button onClick={() => handleStatusTransition(selectedProject.id)}
                className="px-3 py-1.5 bg-yellow-600 text-white rounded-lg text-sm hover:bg-yellow-700 transition-all shadow-sm">
                应用
              </button>
            </div>
          </div>

          {/* Participants */}
          <div className="bg-white p-5 rounded-xl shadow-card border border-gray-100">
            <h3 className="font-bold text-gray-800 mb-3">👥 参与者 ({participants.length})</h3>
            {participants.length === 0 ? (
              <EmptyState icon="👤" title="暂无参与者" description="加入项目开始协作" size="sm" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="py-2 px-3 text-left text-gray-500 font-medium">Agent</th>
                      <th className="py-2 px-3 text-left text-gray-500 font-medium hidden sm:table-cell">角色</th>
                      <th className="py-2 px-3 text-left text-gray-500 font-medium">状态</th>
                      <th className="py-2 px-3 text-left text-gray-500 font-medium hidden sm:table-cell">加入时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {participants.map(p => (
                      <tr key={p.agent_id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="py-2 px-3">
                          <span className="font-semibold text-gray-700">{p.agent_name || "未知"}</span>
                          <span className="text-xs text-gray-400 ml-1" title={p.agent_id}>{p.agent_id.slice(0,8)}...</span>
                        </td>
                        <td className="py-2 px-3 hidden sm:table-cell text-gray-600">{p.role}</td>
                        <td className="py-2 px-3">{p.status}</td>
                        <td className="py-2 px-3 hidden sm:table-cell text-gray-500">{p.created_at ? new Date(p.created_at).toLocaleString() : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Chat & Todo Split */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Chat */}
            <div className="bg-white p-5 rounded-xl shadow-card border border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-800">💬 多Agent聊天</h3>
                <Link href={`/projects/${selectedProject.id}/chat`}
                  className="text-sm text-brand-600 hover:text-brand-800 font-medium transition-colors">
                  进入完整Chat →
                </Link>
              </div>
              {chatMessages.length === 0 ? (
                <EmptyState icon="💬" title="暂无消息" description="开始一段对话吧！" size="sm" />
              ) : (
                <div className="space-y-2 max-h-32 overflow-y-auto mb-2">
                  {chatMessages.slice(-3).map(msg => (
                    <div key={msg.id} className={cn(
                      "flex gap-1 p-1.5 rounded-lg text-sm",
                      msg.sender_type === "human" ? "bg-brand-50" : "bg-green-50"
                    )}>
                      <span className={cn("font-semibold", msg.sender_type === "human" ? "text-brand-600" : "text-green-600")}>
                        {msg.sender_type === "human" ? "👤" : "🤖"}{msg.sender_name}
                      </span>
                      <span className="text-gray-600 truncate flex-1">{msg.content.slice(0, 80)}...</span>
                    </div>
                  ))}
                </div>
              )}
              {chatMessages.length > 3 && (
                <p className="text-xs text-gray-400 text-center">...还有 {chatMessages.length - 3} 条消息</p>
              )}
            </div>

            {/* Todo */}
            <div className="bg-white p-5 rounded-xl shadow-card border border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-800">📋 TODO列表</h3>
                {myAgents && myAgents.agents.length > 0 && (
                  <button onClick={() => setShowTodoForm(!showTodoForm)}
                    className="bg-purple-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-purple-700 transition-all shadow-sm">
                    ➕ 新TODO
                  </button>
                )}
              </div>
              {showTodoForm && (
                <form onSubmit={handleCreateTodo} className="bg-gray-50 p-3 rounded-lg mb-3 space-y-2 animate-slideDown border border-gray-200">
                  <input value={todoForm.title} onChange={e => setTodoForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="标题" className="border border-gray-200 p-2 rounded-lg w-full focus:border-brand-500" required />
                  <textarea value={todoForm.description} onChange={e => setTodoForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="描述" className="border border-gray-200 p-2 rounded-lg w-full focus:border-brand-500" rows={2} />
                  <select value={todoForm.priority}
                    onChange={e => setTodoForm(f => ({ ...f, priority: e.target.value as "low" | "medium" | "high" | "critical" }))}
                    className="border border-gray-200 p-2 rounded-lg focus:border-brand-500">
                    <option value="low">低</option>
                    <option value="medium">中</option>
                    <option value="high">高</option>
                    <option value="critical">紧急</option>
                  </select>
                  <div className="flex gap-2">
                    <button type="submit" className="bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700 transition-all shadow-sm">创建</button>
                    <button type="button" onClick={() => setShowTodoForm(false)} className="bg-gray-200 px-3 py-1.5 rounded-lg text-gray-600 hover:bg-gray-300 transition-all">取消</button>
                  </div>
                </form>
              )}
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {todos.length === 0 ? (
                  <EmptyState icon="📋" title="暂无TODO" description="创建第一个任务项" size="sm" />
                ) : todos.map(todo => (
                  <div key={todo.id} className={cn("p-2.5 rounded-lg border-l-4", todoBorderColor(todo.status))}>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className={cn("font-semibold text-sm",
                          todo.priority === "critical" ? "text-red-600" : todo.priority === "high" ? "text-orange-600" : "text-gray-700"
                        )}>
                          [{todo.priority}] {todo.title}
                        </span>
                        {todo.description && <p className="text-xs text-gray-500 mt-1">{todo.description}</p>}
                      </div>
                      <div className="flex gap-1">
                        {todo.status === "pending" && (
                          <button onClick={() => handleClaimTodo(todo.id)}
                            className="bg-blue-500 text-white px-2 py-1 rounded-lg text-xs hover:bg-blue-600 transition-all shadow-sm">
                            🤝 认领
                          </button>
                        )}
                        {todo.status === "claimed" && (
                          <button onClick={() => handleUpdateTodoStatus(todo.id, "in_progress")}
                            className="bg-yellow-500 text-white px-2 py-1 rounded-lg text-xs hover:bg-yellow-600 transition-all shadow-sm">
                            ▶ 开始
                          </button>
                        )}
                        {todo.status === "in_progress" && (
                          <button onClick={() => handleUpdateTodoStatus(todo.id, "completed")}
                            className="bg-green-500 text-white px-2 py-1 rounded-lg text-xs hover:bg-green-600 transition-all shadow-sm">
                            ✅ 完成
                          </button>
                        )}
                      </div>
                    </div>
                    {todo.claimed_by && (
                      <div className="text-xs text-blue-500 mt-1">
                        认领者: {todo.claimed_by_name || todo.claimed_by} {todo.claimed_at && `于 ${new Date(todo.claimed_at).toLocaleString()}`}
                      </div>
                    )}
                    <div className="text-xs text-gray-400 mt-1">
                      创建: {new Date(todo.created_at).toLocaleString()} · 状态: {todo.status}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Update form */}
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
        </div>
      )}
    </div>
  );
}
