"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type {
  OrganizationCRUDResponse, OrganizationCRUDListResponse,
  OrganizationCreateRequest, OrganizationUpdateRequest,
  OrganizationMemberResponse, MemberListResponse,
  MyAgentsResponse,
} from "@/types";
import { useAuth } from "@/hooks/use-auth";

type Tab = "list" | "create" | "detail" | "agent";

export function OrgManager() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("list");
  const [orgs, setOrgs] = useState<OrganizationCRUDResponse[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<OrganizationCRUDResponse | null>(null);
  const [members, setMembers] = useState<OrganizationMemberResponse[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [myAgents, setMyAgents] = useState<MyAgentsResponse | null>(null);

  // Create form state
  const [createForm, setCreateForm] = useState<OrganizationCreateRequest>({
    name: "", description: "", org_type: "team",
  });

  // Update form state
  const [updateForm, setUpdateForm] = useState<OrganizationUpdateRequest>({});

  // Agent registration form state
  const [agentForm, setAgentForm] = useState({ name: "", description: "", capabilities: "" });

  const loadOrgs = async () => {
    setLoading(true);
    try {
      const res = await api.organizations.list();
      setOrgs(res.organizations);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  const loadMembers = async (orgId: string) => {
    try {
      const res = await api.organizations.listMembers(orgId);
      setMembers(res.members);
    } catch (e: any) { setError(e.message); }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.organizations.create(createForm);
      setCreateForm({ name: "", description: "", org_type: "team" });
      setTab("list");
      loadOrgs();
    } catch (e: any) { setError(e.message); }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrg) return;
    try {
      const updated = await api.organizations.update(selectedOrg.id, updateForm);
      setSelectedOrg(updated);
      loadOrgs();
    } catch (e: any) { setError(e.message); }
  };

  const handleJoin = async (orgId: string) => {
    const agentId = myAgents?.agents?.[0]?.id;
    if (!agentId) { setError("No agent registered. Please register an agent first."); return; }
    try {
      await api.organizations.join(orgId, { agent_id: agentId });
      setSuccessMsg("Joined organization successfully!");
      setError("");
      loadMembers(orgId);
    } catch (e: any) { setError(e.message); setSuccessMsg(""); }
  };

  const handleRegisterAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const caps = agentForm.capabilities ? agentForm.capabilities.split(",").map(s => s.trim()).filter(Boolean) : [];
      await api.identity.registerAgent({ name: agentForm.name, description: agentForm.description, capabilities: caps });
      setSuccessMsg(`Agent "${agentForm.name}" registered! Now you can create projects and join organizations.`);
      setError("");
      setAgentForm({ name: "", description: "", capabilities: "" });
    } catch (e: any) { setError(e.message); setSuccessMsg(""); }
  };

  const selectOrg = async (org: OrganizationCRUDResponse) => {
    setSelectedOrg(org);
    setUpdateForm({ name: org.name, description: org.description, org_type: org.org_type as any });
    setTab("detail");
    loadMembers(org.id);
  };

  useEffect(() => { loadOrgs(); api.identity.myAgents().then(r => setMyAgents(r)).catch(() => {}); }, []);

  const filtered = orgs.filter(o =>
    o.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Organization Management</h1>
      {error && <div className="bg-red-100 text-red-700 p-2 rounded mb-4">{error}</div>}
      {successMsg && <div className="bg-green-100 text-green-700 p-2 rounded mb-4">{successMsg}</div>}

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b pb-2">
        <button onClick={() => setTab("list")} className={tab === "list" ? "font-bold text-blue-600" : "text-gray-500"}>List</button>
        <button onClick={() => setTab("create")} className={tab === "create" ? "font-bold text-blue-600" : "text-gray-500"}>Create</button>
        <button onClick={() => setTab("agent")} className={tab === "agent" ? "font-bold text-blue-600" : "text-gray-500"}>🤖 Register Agent</button>
        {selectedOrg && <button onClick={() => setTab("detail")} className={tab === "detail" ? "font-bold text-blue-600" : "text-gray-500"}>Detail</button>}
      </div>

      {/* List Tab */}
      {tab === "list" && (
        <div>
          <input
            type="text" placeholder="Search organizations..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full border rounded px-3 py-2 mb-4"
          />
          {loading ? <p>Loading...</p> : (
            <div className="space-y-3">
              {filtered.map(org => (
                <div key={org.id} className="border rounded p-4 hover:bg-gray-50 cursor-pointer"
                  onClick={() => selectOrg(org)}>
                  <div className="flex justify-between">
                    <span className="font-semibold">{org.name}</span>
                    <span className="text-sm text-gray-500">{org.org_type} · {org.status}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{org.description}</p>
                  <div className="text-xs text-gray-400 mt-2">
                    Rep: {org.reputation} · Balance: {org.balance} · Created: {new Date(org.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
              {filtered.length === 0 && <p className="text-gray-500">No organizations found.</p>}
            </div>
          )}
        </div>
      )}

      {/* Create Tab */}
      {tab === "create" && (
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name *</label>
            <input type="text" required value={createForm.name}
              onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
              className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea value={createForm.description || ""}
              onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
              className="w-full border rounded px-3 py-2" rows={3} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Type</label>
            <select value={createForm.org_type || "team"}
              onChange={e => setCreateForm(f => ({ ...f, org_type: e.target.value as any }))}
              className="w-full border rounded px-3 py-2">
              <option value="team">Team</option>
              <option value="guild">Guild</option>
              <option value="company">Company</option>
              <option value="DAO">DAO</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Governance Model</label>
            <input type="text" value={createForm.governance_model || ""}
              onChange={e => setCreateForm(f => ({ ...f, governance_model: e.target.value }))}
              className="w-full border rounded px-3 py-2" />
          </div>
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Create Organization</button>
        </form>
      )}

      {/* Agent Registration Tab */}
      {tab === "agent" && (
        <form onSubmit={handleRegisterAgent} className="space-y-4 bg-white p-4 rounded shadow">
          <h3 className="text-lg font-bold">🤖 Register Your Agent</h3>
          <p className="text-sm text-gray-600 mb-2">You need an agent identity before creating projects or joining organizations.</p>
          <div>
            <label className="block text-sm font-medium mb-1">Agent Name *</label>
            <input type="text" value={agentForm.name} required
              onChange={e => setAgentForm(f => ({ ...f, name: e.target.value }))}
              className="w-full border rounded px-3 py-2" placeholder="e.g. MyAssistant" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <input type="text" value={agentForm.description}
              onChange={e => setAgentForm(f => ({ ...f, description: e.target.value }))}
              className="w-full border rounded px-3 py-2" placeholder="What does your agent do?" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Capabilities (comma-separated)</label>
            <input type="text" value={agentForm.capabilities}
              onChange={e => setAgentForm(f => ({ ...f, capabilities: e.target.value }))}
              className="w-full border rounded px-3 py-2" placeholder="e.g. coding, analysis, research" />
          </div>
          <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Register Agent</button>
        </form>
      )}

      {/* Detail Tab */}
      {tab === "detail" && selectedOrg && (
        <div className="space-y-6">
          {/* Org Info */}
          <div className="border rounded p-4">
            <h2 className="text-xl font-bold">{selectedOrg.name}</h2>
            <p className="text-gray-600 mt-2">{selectedOrg.description}</p>
            <div className="grid grid-cols-2 gap-2 mt-4 text-sm">
              <div>Type: <span className="font-medium">{selectedOrg.org_type}</span></div>
              <div>Status: <span className="font-medium">{selectedOrg.status}</span></div>
              <div>Reputation: <span className="font-medium">{selectedOrg.reputation}</span></div>
              <div>Balance: <span className="font-medium">{selectedOrg.balance}</span></div>
              <div>Created: <span className="font-medium">{new Date(selectedOrg.created_at).toLocaleString()}</span></div>
              <div>Creator: <span className="font-medium">{selectedOrg.creator_id}</span></div>
            </div>
            <button onClick={() => handleJoin(selectedOrg.id)}
              className="mt-4 bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700">Join Organization</button>
          </div>

          {/* Members */}
          <div className="border rounded p-4">
            <h3 className="font-bold mb-3">Members ({members.length})</h3>
            {members.length === 0 ? <p className="text-gray-500">No members yet.</p> : (
              <table className="w-full text-sm">
                <thead><tr className="border-b"><th>ID</th><th>Human ID</th><th>Role</th><th>Status</th><th>Joined</th></tr></thead>
                <tbody>
                  {members.map(m => (
                    <tr key={m.id} className="border-b">
                      <td>{m.id.slice(0,8)}</td>
                      <td>{m.human_id.slice(0,8)}</td>
                      <td>{m.role}</td>
                      <td>{m.status}</td>
                      <td>{new Date(m.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Update Form */}
          <div className="border rounded p-4">
            <h3 className="font-bold mb-3">Update Organization</h3>
            <form onSubmit={handleUpdate} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input type="text" value={updateForm.name || ""}
                  onChange={e => setUpdateForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border rounded px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea value={updateForm.description || ""}
                  onChange={e => setUpdateForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border rounded px-3 py-2" rows={2} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Type</label>
                <select value={updateForm.org_type || "team"}
                  onChange={e => setUpdateForm(f => ({ ...f, org_type: e.target.value as any }))}
                  className="w-full border rounded px-3 py-2">
                  <option value="team">Team</option>
                  <option value="guild">Guild</option>
                  <option value="company">Company</option>
                  <option value="DAO">DAO</option>
                </select>
              </div>
              <button type="submit" className="bg-yellow-600 text-white px-3 py-1 rounded hover:bg-yellow-700">Update</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
