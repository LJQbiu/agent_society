"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type {
  ProjectCRUDResponse, ProjectCRUDListResponse,
  ProjectCreateRequest, ProjectUpdateRequest,
  ProjectParticipantResponse, ParticipantListResponse,
  JoinProjectRequest, StatusTransitionRequest,
  MyAgentsResponse,
} from "@/types";
import { useAuth } from "@/hooks/use-auth";

type Tab = "list" | "create" | "detail";

export function ProjectManager() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("list");
  const [projects, setProjects] = useState<ProjectCRUDResponse[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedProject, setSelectedProject] = useState<ProjectCRUDResponse | null>(null);
  const [participants, setParticipants] = useState<ProjectParticipantResponse[]>([]);
  const [myAgents, setMyAgents] = useState<MyAgentsResponse | null>(null);

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
      const data = await api.projects.list(params);
      setProjects(data.projects || []);
    } catch (e: any) {
      setError(e.message || "Failed to load projects");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProjects(); api.identity.myAgents().then(r => setMyAgents(r)).catch(() => {}); }, []);

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
    const agentId = myAgents?.agents?.[0]?.id;
    if (!agentId) { setError("No agent registered. Please register an agent first."); return; }
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
    const agentId = myAgents?.agents?.[0]?.id;
    if (!agentId) { setError("No agent registered."); return; }
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
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Project Collaboration</h1>

      {error && <div className="bg-red-100 text-red-700 p-2 rounded mb-4">{error}</div>}

      {/* Tab buttons */}
      <div className="flex gap-2 mb-6">
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
          <div className="flex gap-2 mb-4">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects..." className="border p-2 rounded flex-1" />
            <button onClick={loadProjects} className="bg-blue-600 text-white px-3 py-2 rounded">Search</button>
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
                      <button onClick={() => handleJoin(p.id)} className="bg-green-500 text-white px-2 py-1 rounded text-sm">Join</button>
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
          <div className="grid grid-cols-2 gap-4">
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
            <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
              <div><span className="font-medium">Type:</span> {selectedProject.type || "-"}</div>
              <div><span className="font-medium">Status:</span> {selectedProject.status}</div>
              <div><span className="font-medium">Budget:</span> {selectedProject.budget || 0}</div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button onClick={() => handleJoin(selectedProject.id)} className="bg-green-600 text-white px-3 py-1 rounded">Join</button>
            <button onClick={() => handleLeave(selectedProject.id)} className="bg-red-500 text-white px-3 py-1 rounded">Leave</button>
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
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border p-2">Agent ID</th>
                    <th className="border p-2">Role</th>
                    <th className="border p-2">Status</th>
                    <th className="border p-2">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {participants.map(p => (
                    <tr key={p.agent_id} className="border">
                      <td className="p-2">{p.agent_id}</td>
                      <td className="p-2">{p.role}</td>
                      <td className="p-2">{p.status}</td>
                      <td className="p-2">{p.created_at || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
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
