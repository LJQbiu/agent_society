"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { AgentCard, A2AMessage, DiscoverResponse } from "@/types";
import { useAuth } from "@/hooks/use-auth";

type TabId = "discover" | "card" | "messages";

export function A2AExplorer() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>("discover");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Discover state
  const [capabilityFilter, setCapabilityFilter] = useState("");
  const [discoveredAgents, setDiscoveredAgents] = useState<AgentCard[]>([]);
  const [discoverTotal, setDiscoverTotal] = useState(0);

  // Card state
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [agentCard, setAgentCard] = useState<AgentCard | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", description: "", capabilities: "" });

  // Messages state
  const [msgAgentId, setMsgAgentId] = useState("");
  const [msgDirection, setMsgDirection] = useState("inbound");
  const [messages, setMessages] = useState<A2AMessage[]>([]);
  const [msgTotal, setMsgTotal] = useState(0);
  const [sendForm, setSendForm] = useState({ from: "", to: "", type: "task_request", content: "{}" });
  const [sendResult, setSendResult] = useState<A2AMessage | null>(null);

  // Platform card
  const [platformCard, setPlatformCard] = useState<any>(null);

  // Load platform card on mount
  useEffect(() => {
    api.a2a.getPlatformCard()
      .then(d => setPlatformCard(d))
      .catch(() => {});
  }, []);

  // Auto-fill agent IDs from user's agents
  useEffect(() => {
    if (user?.id) {
      api.identity.myAgents()
        .then(d => {
          const agents = d.agents || [];
          if (agents.length > 0) {
            const firstId = agents[0].id;
            if (!msgAgentId) setMsgAgentId(firstId);
            if (!sendForm.from) setSendForm(f => ({ ...f, from: firstId }));
            if (!selectedAgentId) setSelectedAgentId(firstId);
          }
        })
        .catch(() => {});
    }
  }, [user?.id]);

  // Discover agents
  const handleDiscover = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = capabilityFilter ? { capability: capabilityFilter } : {};
      const data = await api.a2a.discoverAgents(params) as DiscoverResponse;
      setDiscoveredAgents(data.agents || []);
      setDiscoverTotal(data.total || 0);
    } catch (e: any) {
      setError(e.message || "Discovery failed");
    }
    setLoading(false);
  };

  // Get agent card
  const handleGetCard = async () => {
    if (!selectedAgentId) return;
    setLoading(true);
    setError(null);
    setEditMode(false);
    try {
      const data = await api.a2a.getAgentCard(selectedAgentId);
      setAgentCard(data);
      setEditForm({
        name: data.name || "",
        description: data.description || "",
        capabilities: (data.capabilities || []).join(", "),
      });
    } catch (e: any) {
      setError(e.message || "Failed to load card");
    }
    setLoading(false);
  };

  // Update agent card
  const handleUpdateCard = async () => {
    if (!selectedAgentId) return;
    setLoading(true);
    setError(null);
    try {
      const caps = editForm.capabilities.split(",").map(s => s.trim()).filter(Boolean);
      const data = await api.a2a.updateAgentCard(selectedAgentId, {
        agent_name: editForm.name,
        description: editForm.description,
        capabilities: caps,
      });
      setAgentCard(data);
      setEditMode(false);
    } catch (e: any) {
      setError(e.message || "Update failed (may be permission denied)");
    }
    setLoading(false);
  };

  // Get messages
  const handleGetMessages = async () => {
    if (!msgAgentId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.a2a.getMessages(msgAgentId, { direction: msgDirection });
      setMessages(data.messages || []);
      setMsgTotal(data.total || 0);
    } catch (e: any) {
      setError(e.message || "Failed to load messages");
    }
    setLoading(false);
  };

  // Send message
  const handleSendMessage = async () => {
    setLoading(true);
    setError(null);
    try {
      let contentObj = {};
      try { contentObj = JSON.parse(sendForm.content); } catch {}
      const data = await api.a2a.sendMessage({
        from_agent_id: sendForm.from,
        to_agent_id: sendForm.to,
        message_type: sendForm.type,
        content: contentObj,
      });
      setSendResult(data);
    } catch (e: any) {
      setError(e.message || "Send failed");
    }
    setLoading(false);
  };

  // Update message status
  const handleMarkRead = async (messageId: string) => {
    try {
      await api.a2a.updateMessageStatus(messageId, { status: "read" });
      handleGetMessages(); // refresh
    } catch (e: any) {
      setError(e.message || "Status update failed");
    }
  };

  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: "discover", label: "Agent Discovery", icon: "🔍" },
    { id: "card", label: "Agent Card", icon: "🪪" },
    { id: "messages", label: "Messages", icon: "📨" },
  ];

  return (
    <div className="max-w-5xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">A2A Protocol Explorer</h1>
        {platformCard && (
          <div className="text-sm text-gray-500 bg-gray-50 p-2 rounded">
            Platform: <strong>{platformCard.name}</strong> — {platformCard.description}
            <span className="ml-2 text-xs">({platformCard.capabilities?.join(", ")})</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b pb-2">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 rounded-t font-medium transition ${
              activeTab === t.id
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Error display */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="mb-4 text-center text-gray-400 animate-pulse">Loading...</div>
      )}

      {/* === DISCOVER TAB === */}
      {activeTab === "discover" && (
        <div>
          <div className="flex gap-3 mb-4">
            <input
              value={capabilityFilter}
              onChange={e => setCapabilityFilter(e.target.value)}
              placeholder="Filter by capability (e.g. search, analyze)"
              className="flex-1 px-3 py-2 border rounded"
            />
            <button onClick={handleDiscover} className="btn btn-primary px-6" disabled={loading}>
              Discover
            </button>
          </div>

          {discoveredAgents.length > 0 ? (
            <>
              <p className="text-sm text-gray-500 mb-2">Found {discoverTotal} agents</p>
              <div className="grid gap-3">
                {discoveredAgents.map(a => (
                  <div key={a.agent_id} className="p-4 border rounded-lg hover:shadow transition">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold">{a.name}</h3>
                        <p className="text-sm text-gray-600 mt-1">{a.description}</p>
                      </div>
                      <div className="text-right">
                        <span className={`inline-block px-2 py-1 rounded text-xs ${
                          a.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                        }`}>{a.status}</span>
                        <div className="text-xs text-gray-400 mt-1">Rep: {a.reputation} | Trust: {a.trust_level}</div>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-2">
                      {a.capabilities.map(c => (
                        <span key={c} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">{c}</span>
                      ))}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => { setSelectedAgentId(a.agent_id); setActiveTab("card"); }}
                        className="text-xs text-blue-600 hover:underline"
                      >View Card</button>
                      <button
                        onClick={() => { setSendForm(f => ({ ...f, to: a.agent_id })); setActiveTab("messages"); }}
                        className="text-xs text-blue-600 hover:underline"
                      >Send Message</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-gray-400 text-sm">No agents discovered yet. Click "Discover" to search.</p>
          )}
        </div>
      )}

      {/* === CARD TAB === */}
      {activeTab === "card" && (
        <div>
          <div className="flex gap-3 mb-4">
            <input
              value={selectedAgentId}
              onChange={e => setSelectedAgentId(e.target.value)}
              placeholder="Agent ID"
              className="flex-1 px-3 py-2 border rounded"
            />
            <button onClick={handleGetCard} className="btn btn-primary" disabled={loading}>
              Load Card
            </button>
          </div>

          {agentCard && !editMode && (
            <div className="p-6 border rounded-lg bg-white">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl font-bold">{agentCard.name}</h2>
                  <p className="text-gray-500 text-sm mt-1">ID: {agentCard.agent_id}</p>
                </div>
                <button onClick={() => setEditMode(true)} className="text-sm text-blue-600 hover:underline">
                  ✏️ Edit
                </button>
              </div>
              <p className="mb-3">{agentCard.description}</p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><strong>Status:</strong> <span className={agentCard.status === "active" ? "text-green-600" : "text-gray-500"}>{agentCard.status}</span></div>
                <div><strong>Reputation:</strong> {agentCard.reputation}</div>
                <div><strong>Trust Level:</strong> {agentCard.trust_level}</div>
                <div><strong>Version:</strong> {agentCard.version}</div>
              </div>
              <div className="mt-3">
                <strong className="text-sm">Capabilities:</strong>
                <div className="flex gap-2 mt-1">
                  {agentCard.capabilities.map(c => (
                    <span key={c} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">{c}</span>
                  ))}
                </div>
              </div>
              {agentCard.endpoints && Object.keys(agentCard.endpoints).length > 0 && (
                <div className="mt-3">
                  <strong className="text-sm">Endpoints:</strong>
                  <pre className="mt-1 p-2 bg-gray-50 rounded text-xs overflow-auto">{JSON.stringify(agentCard.endpoints, null, 2)}</pre>
                </div>
              )}
            </div>
          )}

          {agentCard && editMode && (
            <div className="p-6 border rounded-lg bg-yellow-50">
              <h3 className="font-bold mb-3">Edit Agent Card</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Name</label>
                  <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 border rounded mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium">Description</label>
                  <textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} className="w-full px-3 py-2 border rounded mt-1" rows={3} />
                </div>
                <div>
                  <label className="text-sm font-medium">Capabilities (comma-separated)</label>
                  <input value={editForm.capabilities} onChange={e => setEditForm(f => ({ ...f, capabilities: e.target.value }))} className="w-full px-3 py-2 border rounded mt-1" />
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <button onClick={handleUpdateCard} className="btn btn-primary" disabled={loading}>Save</button>
                <button onClick={() => setEditMode(false)} className="btn bg-gray-200 px-4 py-2 rounded">Cancel</button>
              </div>
              <p className="text-xs text-gray-500 mt-2">⚠️ You can only edit your own agent cards. Reputation field is read-only.</p>
            </div>
          )}
        </div>
      )}

      {/* === MESSAGES TAB === */}
      {activeTab === "messages" && (
        <div>
          {/* Send message */}
          <div className="p-4 border rounded-lg mb-4 bg-white">
            <h3 className="font-semibold mb-3">Send Message</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium">From Agent</label>
                <input value={sendForm.from} onChange={e => setSendForm(f => ({ ...f, from: e.target.value }))} className="w-full px-3 py-2 border rounded mt-1 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium">To Agent</label>
                <input value={sendForm.to} onChange={e => setSendForm(f => ({ ...f, to: e.target.value }))} className="w-full px-3 py-2 border rounded mt-1 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium">Type</label>
                <select value={sendForm.type} onChange={e => setSendForm(f => ({ ...f, type: e.target.value }))} className="w-full px-3 py-2 border rounded mt-1 text-sm">
                  <option value="task_request">Task Request</option>
                  <option value="task_response">Task Response</option>
                  <option value="notification">Notification</option>
                  <option value="query">Query</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium">Content (JSON)</label>
                <input value={sendForm.content} onChange={e => setSendForm(f => ({ ...f, content: e.target.value }))} className="w-full px-3 py-2 border rounded mt-1 text-sm" placeholder='{"task": "..."}' />
              </div>
            </div>
            <button onClick={handleSendMessage} className="btn btn-primary mt-3" disabled={loading}>Send</button>
            {sendResult && (
              <div className="mt-3 p-3 bg-green-50 rounded text-sm">
                ✅ Sent! ID: {sendResult.message_id} | Status: {sendResult.status}
              </div>
            )}
          </div>

          {/* Query messages */}
          <div className="p-4 border rounded-lg bg-white">
            <h3 className="font-semibold mb-3">Query Messages</h3>
            <div className="flex gap-3 mb-3">
              <input value={msgAgentId} onChange={e => setMsgAgentId(e.target.value)} placeholder="Agent ID" className="flex-1 px-3 py-2 border rounded text-sm" />
              <select value={msgDirection} onChange={e => setMsgDirection(e.target.value)} className="px-3 py-2 border rounded text-sm">
                <option value="inbound">Inbound</option>
                <option value="outbound">Outbound</option>
              </select>
              <button onClick={handleGetMessages} className="btn btn-primary" disabled={loading}>Query</button>
            </div>

            {messages.length > 0 ? (
              <>
                <p className="text-sm text-gray-500 mb-2">{msgTotal} messages ({msgDirection})</p>
                <div className="space-y-2">
                  {messages.map(m => (
                    <div key={m.message_id} className="p-3 border rounded flex justify-between items-start hover:bg-gray-50">
                      <div>
                        <div className="font-medium text-sm">
                          {msgDirection === "inbound" ? `From: ${m.from_agent_id}` : `To: ${m.to_agent_id}`}
                        </div>
                        <div className="text-xs text-gray-500">
                          Type: {m.message_type} | {m.created_at}
                        </div>
                      </div>
                      <div className="flex gap-2 items-center">
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          m.status === "delivered" ? "bg-yellow-50 text-yellow-700" :
                          m.status === "read" ? "bg-green-50 text-green-700" :
                          "bg-gray-50 text-gray-500"
                        }`}>{m.status}</span>
                        {msgDirection === "inbound" && m.status !== "read" && (
                          <button onClick={() => handleMarkRead(m.message_id)} className="text-xs text-blue-600 hover:underline">
                            Mark Read
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-gray-400 text-sm">No messages loaded. Enter agent ID and click "Query".</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
