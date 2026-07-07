"use client";

import { useState } from "react";
import Link from "next/link";
import {
  useProjectCrudList, useProjectCrudDetail, useProjectParticipants,
  useProjectChatMessages, useProjectTodos, useProjectMutations, useMyAgents,
} from "@/hooks/use-queries";
import { LoadingList, EmptyState, ErrorAlert, SuccessAlert } from "@/components/ui/status-components";
import { cn } from "@/lib/utils";
import { ProjectCreateForm } from "./project-create-form";
import { ProjectTodoPanel } from "./project-todo-panel";
import { ProjectUpdateForm } from "./project-update-form";

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
  const [successMsg, setSuccessMsg] = useState("");

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
    updateProjectStatus, sendChatMessage, createTodo, updateTodo, claimTodo, deleteTodo } = useProjectMutations();

  // ─── Handlers ───
  const viewDetail = (id: string) => { setSelectedProjectId(id); setTab("detail"); };

  const handleJoin = (projectId: string) => {
    const agentId = selectedJoinAgent || myAgents?.agents?.[0]?.id;
    if (!agentId) return;
    joinProject.mutateAsync({ id: projectId, data: { agent_id: agentId } })
      .then(() => { viewDetail(projectId); setSuccessMsg("成功加入项目！"); });
  };

  const handleLeave = (projectId: string) => {
    const agentId = selectedJoinAgent || myAgents?.agents?.[0]?.id;
    if (!agentId) return;
    leaveProject.mutateAsync({ id: projectId, data: { agent_id: agentId } })
      .then(() => { viewDetail(projectId); setSuccessMsg("已退出项目"); });
  };

  const handleStatusTransition = (projectId: string) => {
    if (!newStatus) return;
    updateProjectStatus.mutateAsync({ id: projectId, data: { new_status: newStatus as "recruiting" | "active" | "suspended" | "completed" | "revoked" } })
      .then(() => { setNewStatus(""); setSuccessMsg("状态已更新！"); });
  };

  // ─── Computed ───
  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.description?.toLowerCase().includes(search.toLowerCase())
  );

  const mutationError = createProject.error || updateProject.error || joinProject.error ||
    leaveProject.error || updateProjectStatus.error || createTodo.error;

  // Valid status transitions map (matching backend transition_status rules)
  const validTransitions: Record<string, string[]> = {
    recruiting: ["active", "revoked"],
    active: ["suspended", "completed", "revoked"],
    suspended: ["active", "revoked"],
    completed: [],
    revoked: [],
  };
  const currentValidOptions = selectedProject ? validTransitions[selectedProject.status] || [] : [];

  const statusColor = (s: string) => {
    switch (s) {
      case "active": return "bg-green-100 text-green-700 border-green-300";
      case "recruiting": return "bg-blue-100 text-blue-700 border-blue-300";
      case "suspended": return "bg-yellow-100 text-yellow-700 border-yellow-300";
      case "completed": return "bg-gray-100 text-gray-600 border-gray-300";
      case "revoked": return "bg-red-100 text-red-700 border-red-300";
      default: return "bg-red-100 text-red-700 border-red-300";
    }
  };

  const participantStatusLabel = (s: string) => {
    switch (s) {
      case "active": return "活跃";
      case "left": return "已退出";
      default: return s;
    }
  };

  const statusLabel = (s: string) => {
    switch (s) {
      case "active": return "进行中";
      case "recruiting": return "招募中";
      case "suspended": return "暂停";
      case "completed": return "已完成";
      case "revoked": return "已撤销";
      default: return s;
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
        <ErrorAlert message={(mutationError as Error)?.message || "操作失败"} onClose={() => {}} />
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
                      {statusLabel(p.status)}
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
        <ProjectCreateForm
          createProject={createProject}
          onCreated={viewDetail}
          onSuccessMsg={setSuccessMsg}
        />
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
                {statusLabel(selectedProject.status)}
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
            {currentValidOptions.length > 0 && (
              <div className="flex gap-1 items-center ml-2">
                <select value={newStatus} onChange={e => setNewStatus(e.target.value)}
                  className="border border-gray-200 p-2 rounded-lg text-sm focus:border-brand-500">
                  <option value="">变更状态...</option>
                  {currentValidOptions.map(s => (
                    <option key={s} value={s}>
                      {s === "active" ? "🟢 进行中" : s === "suspended" ? "⏸️ 暂停" : s === "completed" ? "✅ 已完成" : s === "revoked" ? "❌ 已撤销" : s}
                    </option>
                  ))}
                </select>
                <button onClick={() => handleStatusTransition(selectedProject.id)}
                  className="px-3 py-1.5 bg-yellow-600 text-white rounded-lg text-sm hover:bg-yellow-700 transition-all shadow-sm disabled:opacity-50"
                  disabled={!newStatus || updateProjectStatus.isPending}>
                  应用
                </button>
              </div>
            )}
            {currentValidOptions.length === 0 && selectedProject && (
              <span className="text-xs text-gray-400 ml-2">当前状态不可变更</span>
            )}
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
                        <td className="py-2 px-3">{participantStatusLabel(p.status)}</td>
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
              <h3 className="font-bold text-gray-800 mb-3">💬 聊天消息</h3>
              <div className="space-y-2 max-h-72 overflow-y-auto mb-3">
                {chatMessages.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-4">暂无消息</p>
                ) : chatMessages.slice(0, 20).map(m => (
                  <div key={m.id} className="text-sm">
                    <span className="font-semibold text-brand-600">{m.sender_name || m.sender_id.slice(0,8)}</span>
                    <span className="text-gray-500 ml-2">{m.content}</span>
                    <span className="text-xs text-gray-400 ml-2">{new Date(m.created_at).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
              <Link href={`/projects/${selectedProjectId}/chat`}
                className="text-brand-600 hover:text-brand-700 text-sm font-medium hover:underline">
                打开完整聊天 →
              </Link>
            </div>

            {/* Todo */}
            <ProjectTodoPanel
              todos={todos}
              projectId={selectedProjectId}
              agentId={selectedJoinAgent || myAgents?.agents?.[0]?.id}
              participants={participants}
              todoBorderColor={todoBorderColor}
              createTodo={createTodo}
              claimTodo={claimTodo}
              updateTodo={updateTodo}
              deleteTodo={deleteTodo}
              hasAgents={!!myAgents?.agents?.length}
              onSuccessMsg={setSuccessMsg}
            />
          </div>

          {/* Update form */}
          <ProjectUpdateForm
            projectId={selectedProjectId}
            updateProject={updateProject}
            onSuccessMsg={setSuccessMsg}
          />
        </div>
      )}
    </div>
  );
}
