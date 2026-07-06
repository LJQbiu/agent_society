"use client";

import { useState } from "react";
import Link from "next/link";
import {
  useProjectCrudList, useProjectCrudDetail, useProjectParticipants,
  useProjectChatMessages, useProjectTodos, useProjectMutations, useMyAgents,
} from "@/hooks/use-queries";
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
  const [createForm, setCreateForm] = useState<ProjectCreateRequest>({
    name: "", description: "", type: "task", max_participants: 10,
    budget: 0, reputation_budget: 0, required_capabilities: [],
    organization_id: "",
  });
  const [updateForm, setUpdateForm] = useState<Record<string, string>>({});
  const [todoForm, setTodoForm] = useState({ title: "", description: "", priority: "medium" });

  // ─── Detail queries (enabled only when selectedProjectId set) ───
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
  const viewDetail = (id: string) => {
    setSelectedProjectId(id);
    setTab("detail");
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const capabilities = capabilitiesInput.split(",").map(s => s.trim()).filter(Boolean);
    createProject.mutate({ ...createForm, required_capabilities: capabilities }, {
      onSuccess: (data: any) => {
        setCreateForm({ name: "", description: "", type: "task", max_participants: 10,
          budget: 0, reputation_budget: 0, required_capabilities: [], organization_id: "" });
        setCapabilitiesInput("");
        viewDetail(data.id);
      },
    });
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) return;
    updateProject.mutate({ id: selectedProjectId, data: updateForm }, {
      onSuccess: () => setUpdateForm({}),
    });
  };

  const handleJoin = (projectId: string) => {
    const agentId = selectedJoinAgent || myAgents?.agents?.[0]?.id;
    if (!agentId) return;
    joinProject.mutate({ id: projectId, data: { agent_id: agentId } }, {
      onSuccess: () => viewDetail(projectId),
    });
  };

  const handleLeave = (projectId: string) => {
    const agentId = selectedJoinAgent || myAgents?.agents?.[0]?.id;
    if (!agentId) return;
    leaveProject.mutate({ id: projectId, data: { agent_id: agentId } }, {
      onSuccess: () => viewDetail(projectId),
    });
  };

  const handleStatusTransition = (projectId: string) => {
    if (!newStatus) return;
    updateProjectStatus.mutate({ id: projectId, data: { new_status: newStatus } }, {
      onSuccess: () => { setNewStatus(""); },
    });
  };

  const handleCreateTodo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) return;
    const agentId = selectedJoinAgent || myAgents?.agents?.[0]?.id;
    createTodo.mutate({ id: selectedProjectId, data: { ...todoForm, creator_agent_id: agentId } }, {
      onSuccess: () => { setTodoForm({ title: "", description: "", priority: "medium" }); setShowTodoForm(false); },
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

  // ─── Render ───
  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      <h1 className="text-2xl font-bold mb-4">Project Collaboration</h1>

      {mutationError && (
        <div className="bg-red-100 text-red-700 p-2 rounded mb-4">
          {(mutationError as any)?.message || "Operation failed"}
        </div>
      )}

      {/* Tab buttons */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <button onClick={() => setTab("list")} className={tab === "list" ? "bg-blue-600 text-white px-4 py-2 rounded" : "bg-gray-200 px-4 py-2 rounded"}>
          Project List
        </button>
        <button onClick={() => setTab("create")} className={tab === "create" ? "bg-blue-600 text-white px-4 py-2 rounded" : "bg-gray-200 px-4 py-2 rounded"}>
          Create Project
        </button>
        {selectedProject && (
          <button onClick={() => setTab("detail")} className={tab === "detail" ? "bg-blue-600 text-white px-4 py-2 rounded" : "bg-gray-200 px-4 py-2 rounded"}>
            Detail
          </button>
        )}
      </div>

      {/* List tab */}
      {tab === "list" && (
        <div>
          <div className="flex gap-2 mb-4 items-center">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects..." className="border p-2 rounded flex-1" />
            <select value={selectedJoinAgent} onChange={e => setSelectedJoinAgent(e.target.value)} className="border p-2 rounded text-sm">
              <option value="">选择Agent...</option>
              {myAgents?.agents?.map(a => (
                <option key={a.id} value={a.id}>{a.name || a.id}</option>
              ))}
            </select>
          </div>

          {projectsLoading ? (
            <p className="text-gray-500">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="text-gray-500">No projects found</p>
          ) : (
            <div className="space-y-3">
              {filtered.map(p => (
                <div key={p.id} className="bg-white p-4 rounded shadow hover:shadow-md transition">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-lg">{p.name}</h3>
                      <p className="text-gray-600 text-sm mt-1">{p.description || "No description"}</p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      p.status === "active" ? "bg-green-100 text-green-700" :
                      p.status === "recruiting" ? "bg-blue-100 text-blue-700" :
                      p.status === "suspended" ? "bg-yellow-100 text-yellow-700" :
                      p.status === "completed" ? "bg-gray-100 text-gray-700" :
                      "bg-red-100 text-red-700"
                    }`}>{p.status}</span>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => viewDetail(p.id)} className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700">View</button>
                    <button onClick={() => handleJoin(p.id)} className="bg-green-600 text-white px-3 py-1 rounded text-sm" disabled={joinProject.isPending}>🤝 加入</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create tab */}
      {tab === "create" && (
        <form onSubmit={handleCreate} className="bg-white p-6 rounded shadow space-y-4">
          <h2 className="text-xl font-bold">Create New Project</h2>
          <div>
            <label className="block font-medium mb-1">Name</label>
            <input value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} className="border p-2 rounded w-full" required />
          </div>
          <div>
            <label className="block font-medium mb-1">Description</label>
            <textarea value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))} className="border p-2 rounded w-full" rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-medium mb-1">Type</label>
              <select value={createForm.type} onChange={e => setCreateForm(f => ({ ...f, type: e.target.value }))} className="border p-2 rounded w-full">
                <option value="task">Task</option>
                <option value="project">Project</option>
                <option value="service">Service</option>
              </select>
            </div>
            <div>
              <label className="block font-medium mb-1">Max Participants</label>
              <input type="number" value={createForm.max_participants} onChange={e => setCreateForm(f => ({ ...f, max_participants: parseInt(e.target.value) || 10 }))} className="border p-2 rounded w-full" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-medium mb-1">Budget</label>
              <input type="number" value={createForm.budget} onChange={e => setCreateForm(f => ({ ...f, budget: parseFloat(e.target.value) || 0 }))} className="border p-2 rounded w-full" />
            </div>
            <div>
              <label className="block font-medium mb-1">Reputation Budget</label>
              <input type="number" value={createForm.reputation_budget} onChange={e => setCreateForm(f => ({ ...f, reputation_budget: parseFloat(e.target.value) || 0 }))} className="border p-2 rounded w-full" />
            </div>
          </div>
          <div>
            <label className="block font-medium mb-1">Required Capabilities (comma-separated)</label>
            <input value={capabilitiesInput} onChange={e => setCapabilitiesInput(e.target.value)} placeholder="coding, analysis, design" className="border p-2 rounded w-full" />
          </div>
          <div>
            <label className="block font-medium mb-1">Organization ID</label>
            <input value={createForm.organization_id} onChange={e => setCreateForm(f => ({ ...f, organization_id: e.target.value }))} placeholder="Optional: link to org" className="border p-2 rounded w-full" />
          </div>
          <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700" disabled={createProject.isPending}>
            {createProject.isPending ? "Creating..." : "Create Project"}
          </button>
        </form>
      )}

      {/* Detail tab */}
      {tab === "detail" && selectedProject && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded shadow">
            <h2 className="text-xl font-bold">{selectedProject.name}</h2>
            <p className="text-gray-600 mt-1">{selectedProject.description || "No description"}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3 text-sm">
              <div><span className="font-medium">Type:</span> {selectedProject.type || "-"}</div>
              <div><span className="font-medium">Status:</span> {selectedProject.status}</div>
              <div><span className="font-medium">Budget:</span> {selectedProject.budget || 0}</div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 items-center flex-wrap">
            <select value={selectedJoinAgent} onChange={e => setSelectedJoinAgent(e.target.value)} className="border p-1 rounded text-sm">
              <option value="">选择Agent...</option>
              {myAgents?.agents?.map(a => (
                <option key={a.id} value={a.id}>{a.name || a.id}</option>
              ))}
            </select>
            <button onClick={() => handleJoin(selectedProject.id)} className="bg-green-600 text-white px-3 py-1 rounded text-sm" disabled={!selectedJoinAgent && !myAgents?.agents?.[0]?.id}>🤝 加入</button>
            <button onClick={() => handleLeave(selectedProject.id)} className="bg-red-500 text-white px-3 py-1 rounded text-sm">🚪 退出</button>
            <div className="flex gap-1 items-center">
              <select value={newStatus} onChange={e => setNewStatus(e.target.value)} className="border p-1 rounded">
                <option value="">Change status...</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <button onClick={() => handleStatusTransition(selectedProject.id)} className="bg-yellow-600 text-white px-3 py-1 rounded">Apply</button>
            </div>
          </div>

          {/* Participants */}
          <div className="bg-white p-4 rounded shadow">
            <h3 className="font-bold mb-2">Participants ({participants.length})</h3>
            {participants.length === 0 ? <p className="text-gray-500">No participants yet</p> : (
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border p-2 text-left">Agent</th>
                    <th className="border p-2 text-left hidden sm:table-cell">Role</th>
                    <th className="border p-2 text-left">Status</th>
                    <th className="border p-2 text-left hidden sm:table-cell">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {participants.map(p => (
                    <tr key={p.agent_id} className="border">
                      <td className="p-2">
                        <span className="font-semibold">{p.agent_name || "Unknown"}</span>
                        <span className="text-xs text-gray-400 ml-1" title={p.agent_id}>{p.agent_id.slice(0,8)}...</span>
                      </td>
                      <td className="p-2">{p.role}</td>
                      <td className="p-2">{p.status}</td>
                      <td className="p-2">{p.created_at ? new Date(p.created_at).toLocaleString() : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Chat & Todo Split Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left: Chat Preview + Link */}
            <div className="bg-white p-4 rounded shadow">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold">💬 Multi-Agent Chat</h3>
                <Link href={`/projects/${selectedProject.id}/chat`} className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                  进入完整Chat →
                </Link>
              </div>
              <div className="space-y-2 max-h-32 overflow-y-auto mb-2">
                {chatMessages.length === 0 ? (
                  <p className="text-gray-400 italic">No messages yet. Start a conversation!</p>
                ) : chatMessages.slice(-3).map((msg) => (
                  <div key={msg.id} className={`flex gap-1 p-1 rounded text-sm ${msg.sender_type === "human" ? "bg-blue-50" : "bg-green-50"}`}>
                    <span className={`font-semibold ${msg.sender_type === "human" ? "text-blue-600" : "text-green-600"}`}>
                      {msg.sender_type === "human" ? "👤" : "🤖"}{msg.sender_name}
                    </span>
                    <span className="text-gray-600 truncate flex-1">{msg.content.slice(0, 80)}...</span>
                  </div>
                ))}
              </div>
              {chatMessages.length > 3 && (
                <p className="text-xs text-gray-400 text-center">...还有 {chatMessages.length - 3} 条消息</p>
              )}
            </div>

            {/* Right: Todo Panel */}
            <div className="bg-white p-4 rounded shadow">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold">📋 TODO List</h3>
                {myAgents && myAgents.agents.length > 0 && (
                  <button onClick={() => setShowTodoForm(!showTodoForm)} className="bg-purple-600 text-white px-2 py-1 rounded text-sm hover:bg-purple-700">
                    + New TODO
                  </button>
                )}
              </div>
              {/* Todo Create Form */}
              {showTodoForm && (
                <form onSubmit={handleCreateTodo} className="bg-gray-50 p-3 rounded mb-3 space-y-2">
                  <input value={todoForm.title} onChange={e => setTodoForm(f => ({ ...f, title: e.target.value }))} placeholder="Title" className="border p-2 rounded w-full" required />
                  <textarea value={todoForm.description} onChange={e => setTodoForm(f => ({ ...f, description: e.target.value }))} placeholder="Description" className="border p-2 rounded w-full" rows={2} />
                  <select value={todoForm.priority} onChange={e => setTodoForm(f => ({ ...f, priority: e.target.value as "low" | "medium" | "high" | "critical" }))} className="border p-2 rounded">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                  <div className="flex gap-2">
                    <button type="submit" className="bg-purple-600 text-white px-3 py-1 rounded hover:bg-purple-700">Create</button>
                    <button type="button" onClick={() => setShowTodoForm(false)} className="bg-gray-200 px-3 py-1 rounded">Cancel</button>
                  </div>
                </form>
              )}
              {/* Todo List */}
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {todos.length === 0 ? (
                  <p className="text-gray-400 italic">No TODO items yet.</p>
                ) : todos.map((todo) => (
                  <div key={todo.id} className={`p-2 rounded border-l-4 ${todo.status === "completed" ? "border-green-500 bg-green-50" : todo.status === "in_progress" ? "border-yellow-500 bg-yellow-50" : todo.status === "claimed" ? "border-blue-500 bg-blue-50" : "border-gray-400 bg-gray-50"}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className={`font-semibold text-sm ${todo.priority === "critical" ? "text-red-600" : todo.priority === "high" ? "text-orange-600" : ""}`}>
                          [{todo.priority}] {todo.title}
                        </span>
                        {todo.description && <p className="text-xs text-gray-500 mt-1">{todo.description}</p>}
                      </div>
                      <div className="flex gap-1">
                        {todo.status === "pending" && (
                          <button onClick={() => handleClaimTodo(todo.id)} className="bg-blue-500 text-white px-2 py-1 rounded text-xs hover:bg-blue-600" title="Claim this TODO">🤝 Claim</button>
                        )}
                        {todo.status === "claimed" && (
                          <button onClick={() => handleUpdateTodoStatus(todo.id, "in_progress")} className="bg-yellow-500 text-white px-2 py-1 rounded text-xs hover:bg-yellow-600" title="Start working">▶ Start</button>
                        )}
                        {todo.status === "in_progress" && (
                          <button onClick={() => handleUpdateTodoStatus(todo.id, "completed")} className="bg-green-500 text-white px-2 py-1 rounded text-xs hover:bg-green-600" title="Mark completed">✅ Done</button>
                        )}
                      </div>
                    </div>
                    {todo.claimed_by && (
                      <div className="text-xs text-blue-500 mt-1">
                        Claimed by: {todo.claimed_by_name || todo.claimed_by} {todo.claimed_at && `at ${new Date(todo.claimed_at).toLocaleString()}`}
                      </div>
                    )}
                    <div className="text-xs text-gray-400 mt-1">
                      Created: {new Date(todo.created_at).toLocaleString()} · Status: {todo.status}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Update form */}
          <div className="bg-white p-4 rounded shadow">
            <h3 className="font-bold mb-2">Update Project</h3>
            <form onSubmit={handleUpdate} className="space-y-3">
              <div>
                <label className="block font-medium mb-1">Name</label>
                <input value={updateForm.name || ""} onChange={e => setUpdateForm(f => ({ ...f, name: e.target.value }))} className="border p-2 rounded w-full" />
              </div>
              <div>
                <label className="block font-medium mb-1">Description</label>
                <textarea value={updateForm.description || ""} onChange={e => setUpdateForm(f => ({ ...f, description: e.target.value }))} className="border p-2 rounded w-full" rows={2} />
              </div>
              <button type="submit" className="bg-yellow-600 text-white px-3 py-1 rounded hover:bg-yellow-700" disabled={updateProject.isPending}>
                {updateProject.isPending ? "Updating..." : "Update"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
