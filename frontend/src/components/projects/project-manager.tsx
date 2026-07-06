"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type {
  ProjectCRUDResponse, ProjectCRUDListResponse,
  ProjectCreateRequest, ProjectUpdateRequest,
  ProjectParticipantResponse, ParticipantListResponse,
  JoinProjectRequest, StatusTransitionRequest,
  MyAgentsResponse,
  ChatMessageResponse, ChatMessageListResponse,
  ProjectTodoResponse, TodoListResponse, TodoCreate, TodoUpdate,
} from "@/types";
import { useAuth } from "@/hooks/use-auth";

type Tab = "list" | "create" | "detail";

export function ProjectManager() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("list");
  const [projects, setProjects] = useState<ProjectCRUDResponse[]>([]);
  const [search, setSearch] = useState("");
  const [myOnly, setMyOnly] = useState(false);  // "我的项目" toggle
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedProject, setSelectedProject] = useState<ProjectCRUDResponse | null>(null);
  const [participants, setParticipants] = useState<ProjectParticipantResponse[]>([]);
  const [myAgents, setMyAgents] = useState<MyAgentsResponse | null>(null);
  const [selectedJoinAgent, setSelectedJoinAgent] = useState<string>("");
  const [messages, setMessages] = useState<any[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  // Chat & Todo state
  const [chatMessages, setChatMessages] = useState<ChatMessageResponse[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [todos, setTodos] = useState<ProjectTodoResponse[]>([]);
  const [todoForm, setTodoForm] = useState<TodoCreate>({ title: "", description: "", priority: "medium" });
  const [showTodoForm, setShowTodoForm] = useState(false);

  // Create form
  const [createForm, setCreateForm] = useState<ProjectCreateRequest>({
    name: "",
    description: "",
    type: "research",
    budget: 0,
    reputation_budget: 0,
    required_capabilities: [],
    max_participants: 10,
    organization_id: "",
  });
  const [capabilitiesInput, setCapabilitiesInput] = useState("");

  // Update form
  const [updateForm, setUpdateForm] = useState<ProjectUpdateRequest>({});

  // Status transition
  const [newStatus, setNewStatus] = useState("");

  // Load projects
  const loadProjects = async () => {
    setLoading(true);
    setError("");
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (myOnly && user?.id) params.owner_id = user.id;
      const data = await api.projects.list(params);
      setProjects(data.projects || []);
    } catch (e: any) {
      setError(e.message || "Failed to load projects");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProjects(); api.identity.myAgents().then(r => setMyAgents(r)).catch(() => {}); }, [myOnly]);

  // Poll chat & todo when viewing detail
  useEffect(() => {
    if (tab !== "detail" || !selectedProject) return;
    const poll = async () => {
      try {
        const chatData = await api.projects.listChatMessages(selectedProject.id);
        setChatMessages(chatData.messages || []);
      } catch {}
      try {
        const todoData = await api.projects.listTodos(selectedProject.id);
        setTodos(todoData.todos || []);
      } catch {}
    };
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [tab, selectedProject?.id]);

  // Send chat message
  const handleSendChat = async () => {
    if (!selectedProject || !chatInput.trim()) return;
    try {
      await api.projects.sendChatMessage(selectedProject.id, { content: chatInput.trim(), sender_type: "human" });
      setChatInput("");
      const chatData = await api.projects.listChatMessages(selectedProject.id);
      setChatMessages(chatData.messages || []);
    } catch (e: any) {
      setError(e.message || "Failed to send message");
    }
  };

  // Create todo (only leader)
  const handleCreateTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !todoForm.title.trim()) return;
    try {
      await api.projects.createTodo(selectedProject.id, todoForm);
      setTodoForm({ title: "", description: "", priority: "medium" });
      setShowTodoForm(false);
      const todoData = await api.projects.listTodos(selectedProject.id);
      setTodos(todoData.todos || []);
    } catch (e: any) {
      setError(e.message || "Failed to create todo");
    }
  };

  // Claim todo
  const handleClaimTodo = async (todoId: string) => {
    if (!selectedProject) return;
    const agentId = selectedJoinAgent || myAgents?.agents?.[0]?.id;
    if (!agentId) { setError("请先选择一个Agent来认领此TODO"); return; }
    try {
      await api.projects.claimTodo(selectedProject.id, todoId, { agent_id: agentId, claimer_type: "agent" });
      const todoData = await api.projects.listTodos(selectedProject.id);
      setTodos(todoData.todos || []);
    } catch (e: any) {
      setError(e.message || "Failed to claim todo");
    }
  };

  // Update todo status
  const handleUpdateTodoStatus = async (todoId: string, status: "open" | "in_progress" | "completed" | "cancelled") => {
    if (!selectedProject) return;
    try {
      await api.projects.updateTodo(selectedProject.id, todoId, { status });
      const todoData = await api.projects.listTodos(selectedProject.id);
      setTodos(todoData.todos || []);
    } catch (e: any) {
      setError(e.message || "Failed to update todo");
    }
  };

  // Create project
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { ...createForm };
      if (capabilitiesInput) {
        payload.required_capabilities = capabilitiesInput.split(",").map(s => s.trim());
      }
      if (!payload.organization_id) delete payload.organization_id;
      await api.projects.create(payload);
      setTab("list");
      setCreateForm({ name: "", description: "", type: "research", budget: 0, reputation_budget: 0, required_capabilities: [], max_participants: 10, organization_id: "" });
      setCapabilitiesInput("");
      loadProjects();
    } catch (e: any) {
      setError(e.message || "Failed to create project");
    }
  };

  // View detail
  const viewDetail = async (id: string) => {
    try {
      const proj = await api.projects.get(id);
      setSelectedProject(proj);
      const members = await api.projects.listParticipants(id);
      setParticipants(members.participants || []);
      setMessagesLoading(true);
      try {
        const msgData = await api.projects.getMessages(id);
        setMessages(msgData.messages || []);
      } catch { setMessages([]); }
      setMessagesLoading(false);
      // Load chat messages
      try {
        const chatData = await api.projects.listChatMessages(id);
        setChatMessages(chatData.messages || []);
      } catch { setChatMessages([]); }
      // Load todos
      try {
        const todoData = await api.projects.listTodos(id);
        setTodos(todoData.todos || []);
      } catch { setTodos([]); }
      setTab("detail");
    } catch (e: any) {
      setError(e.message || "Failed to load project");
    }
  };

  // Update project
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;
    try {
      const updated = await api.projects.update(selectedProject.id, updateForm);
      setSelectedProject(updated);
      setUpdateForm({});
      loadProjects();
    } catch (e: any) {
      setError(e.message || "Failed to update project");
    }
  };

  // Join project
  const handleJoin = async (projectId: string) => {
    const agentId = selectedJoinAgent || myAgents?.agents?.[0]?.id;
    if (!agentId) { setError("No agent selected. Please select an agent first."); return; }
    try {
      const payload: JoinProjectRequest = { agent_id: agentId };
      await api.projects.join(projectId, payload);
      viewDetail(projectId);
    } catch (e: any) {
      setError(e.message || "Failed to join project");
    }
  };

  // Leave project
  const handleLeave = async (projectId: string) => {
    const agentId = selectedJoinAgent || myAgents?.agents?.[0]?.id;
    if (!agentId) { setError("No agent selected."); return; }
    try {
      await api.projects.leave(projectId, { agent_id: agentId } as JoinProjectRequest);
      viewDetail(projectId);
    } catch (e: any) {
      setError(e.message || "Failed to leave project");
    }
  };

  // Status transition
  const handleStatusTransition = async (projectId: string) => {
    if (!newStatus) return;
    try {
      const payload: StatusTransitionRequest = { new_status: newStatus as "recruiting" | "active" | "suspended" | "completed" | "revoked" };
      await api.projects.updateStatus(projectId, payload);
      viewDetail(projectId);
      setNewStatus("");
    } catch (e: any) {
      setError(e.message || "Failed to change status");
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      <h1 className="text-2xl font-bold mb-4">Project Collaboration</h1>

      {error && <div className="bg-red-100 text-red-700 p-2 rounded mb-4">{error}</div>}

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
            <select
              value={selectedJoinAgent}
              onChange={e => setSelectedJoinAgent(e.target.value)}
              className="border p-2 rounded text-sm"
            >
              <option value="">选择Agent...</option>
              {myAgents?.agents?.map(a => (
                <option key={a.id} value={a.id}>{a.name || a.id}</option>
              ))}
            </select>
            <button onClick={loadProjects} className="bg-blue-600 text-white px-3 py-2 rounded">Search</button>
            <button
              onClick={() => setMyOnly(!myOnly)}
              className={myOnly ? "bg-purple-600 text-white px-3 py-2 rounded" : "bg-gray-200 px-3 py-2 rounded"}
              title="Show only projects created by my agents"
            >
              🏠 My Projects
            </button>
          </div>
          {loading ? <p>Loading...</p> : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-2">Name</th>
                  <th className="border p-2">Type</th>
                  <th className="border p-2">Status</th>
                  <th className="border p-2">Budget</th>
                  <th className="border p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {projects.map(p => (
                  <tr key={p.id} className="border">
                    <td className="p-2">{p.name}</td>
                    <td className="p-2">{p.type || "-"}</td>
                    <td className="p-2">{p.status}</td>
                    <td className="p-2">{p.budget || 0}</td>
                    <td className="p-2 flex gap-1">
                      <button onClick={() => viewDetail(p.id)} className="bg-blue-500 text-white px-2 py-1 rounded text-sm">View</button>
                      <button onClick={() => handleJoin(p.id)} className="bg-green-500 text-white px-2 py-1 rounded text-sm" disabled={!selectedJoinAgent && !myAgents?.agents?.[0]?.id}>🤝 加入</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Create tab */}
      {tab === "create" && (
        <form onSubmit={handleCreate} className="space-y-4 bg-white p-4 rounded shadow">
          <div>
            <label className="block font-medium mb-1">Project Name *</label>
            <input value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} className="border p-2 rounded w-full" required />
          </div>
          <div>
            <label className="block font-medium mb-1">Description</label>
            <textarea value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))} className="border p-2 rounded w-full" rows={3} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium mb-1">Type</label>
              <select value={createForm.type} onChange={e => setCreateForm(f => ({ ...f, type: e.target.value }))} className="border p-2 rounded w-full">
                <option value="research">Research</option>
                <option value="development">Development</option>
                <option value="creative">Creative</option>
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
          <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Create Project</button>
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
            <select
              value={selectedJoinAgent}
              onChange={e => setSelectedJoinAgent(e.target.value)}
              className="border p-1 rounded text-sm"
            >
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
                <Link
                  href={`/projects/${selectedProject.id}/chat`}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
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
                {/* Create todo (backend enforces leader-only) */}
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
                          <button onClick={() => handleClaimTodo(todo.id)} className="bg-blue-500 text-white px-2 py-1 rounded text-xs hover:bg-blue-600" title="Claim this TODO">
                            🤝 Claim
                          </button>
                        )}
                        {todo.status === "claimed" && (
                          <button onClick={() => handleUpdateTodoStatus(todo.id, "in_progress")} className="bg-yellow-500 text-white px-2 py-1 rounded text-xs hover:bg-yellow-600" title="Start working">
                            ▶ Start
                          </button>
                        )}
                        {todo.status === "in_progress" && (
                          <button onClick={() => handleUpdateTodoStatus(todo.id, "completed")} className="bg-green-500 text-white px-2 py-1 rounded text-xs hover:bg-green-600" title="Mark completed">
                            ✅ Done
                          </button>
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
              <button type="submit" className="bg-yellow-600 text-white px-3 py-1 rounded hover:bg-yellow-700">Update</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
