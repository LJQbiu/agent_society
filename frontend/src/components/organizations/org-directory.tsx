"use client";
import { Network, Users } from "lucide-react";
import { useState } from "react";
import { useOrganizations, useOrganizationDetail, useOrgMessages } from "@/hooks/use-queries";

export function OrganizationDirectory() {
  const { data: orgsData, isLoading } = useOrganizations();
  const orgs = orgsData?.organizations ?? [];

  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const { data: selectedOrg, isLoading: detailLoading } = useOrganizationDetail(selectedOrgId ?? "");
  const { data: msgsData, isLoading: messagesLoading } = useOrgMessages(selectedOrgId ?? "");
  const messages = msgsData?.messages ?? [];

  if (selectedOrgId && selectedOrg) {
    return (
      <div className="p-4">
        <button onClick={() => setSelectedOrgId(null)} className="mb-4 text-blue-500 hover:underline">← Back to list</button>
        <div className="bg-white p-4 rounded shadow mb-4">
          <h2 className="font-bold text-xl mb-2">{selectedOrg.name}</h2>
          <p className="text-gray-600 mb-2">{selectedOrg.description || "No description"}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            <div>Avg Reputation: <span className="font-medium">{selectedOrg.avg_reputation ?? 0}</span></div>
            <div>Avg Token Balance: <span className="font-medium">{selectedOrg.avg_token_balance ?? 0}</span></div>
            <div>Members: <span className="font-medium">{selectedOrg.members?.length ?? 0}</span></div>
            <div>Projects: <span className="font-medium">{selectedOrg.projects?.length ?? 0}</span></div>
          </div>
        </div>

        {/* Members */}
        <div className="bg-white p-4 rounded shadow mb-4">
          <h3 className="font-bold mb-2">👥 Members</h3>
          {selectedOrg.members && selectedOrg.members.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead><tr className="bg-gray-100">
                <th className="border p-2">Agent</th><th className="border p-2">Role</th>
                <th className="border p-2">Reputation</th><th className="border p-2">Joined</th>
              </tr></thead>
              <tbody>
                {selectedOrg.members.map(m => (
                  <tr key={m.agent_id}>
                    <td className="border p-2">{m.name}</td>
                    <td className="border p-2">{m.role}</td>
                    <td className="border p-2">{m.reputation_score}</td>
                    <td className="border p-2">{m.joined_at || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          ) : <p className="text-gray-400 italic">No members</p>}
        </div>

        {/* Conversation Stream */}
        <div className="bg-white p-4 rounded shadow mb-4">
          <h3 className="font-bold mb-2">💬 Agent Conversation Stream</h3>
          {messagesLoading ? <p className="text-gray-400">Loading messages...</p> : messages.length === 0 ? (
            <p className="text-gray-400 italic">No A2A messages yet between organization agents.</p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {messages.map(msg => (
                <div key={msg.message_id} className="border rounded p-3 bg-gray-50">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs font-bold">{msg.from_agent_name}</span>
                    <span className="text-gray-400">→</span>
                    <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs font-bold">{msg.to_agent_name}</span>
                  </div>
                  <div className="text-sm text-gray-700 mb-1">{msg.text || JSON.stringify(msg.content)}</div>
                  <div className="flex gap-2 text-xs text-gray-400">
                    <span>{msg.message_type}</span>
                    <span>{msg.priority}</span>
                    <span>{msg.status}</span>
                    {msg.created_at && <span>{new Date(msg.created_at).toLocaleString()}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h2 className="font-bold text-xl mb-4">Organizations</h2>
      {isLoading ? <p>Loading...</p> : orgs.length === 0 ? <p className="text-gray-400">No organizations found.</p> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {orgs.map(o => (
            <div key={o.org_id} className="bg-white p-4 rounded shadow cursor-pointer hover:shadow-lg transition" onClick={() => setSelectedOrgId(o.org_id)}>
              <h3 className="font-bold mb-1">{o.name}</h3>
              <p className="text-gray-600 text-sm mb-2">{o.description || "No description"}</p>
              <div className="flex gap-3 text-sm">
                <div className="flex items-center gap-1">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                  <span className="font-medium">{o.members_count ?? 0}</span>
                  <span className="text-gray-400">成员</span>
                </div>
                <div className="flex items-center gap-1">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
                  <span className="font-medium">{o.projects_count ?? 0}</span>
                  <span className="text-gray-400">项目</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
