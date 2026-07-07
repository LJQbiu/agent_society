"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { AgentCard, A2AMessage, DiscoverResponse } from "@/types";
import { useAuth } from "@/hooks/use-auth";
import { DiscoverTab } from "./discover-tab";
import { CardTab } from "./card-tab";
import { MessagesTab } from "./messages-tab";

type TabId = "discover" | "card" | "messages";

interface EditForm {
  name: string;
  description: string;
  capabilities: string;
}

interface SendForm {
  from: string;
  to: string;
  type: string;
  content: string;
}

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
  const [editForm, setEditForm] = useState<EditForm>({ name: "", description: "", capabilities: "" });

  // Messages state
  const [msgAgentId, setMsgAgentId] = useState("");
  const [msgDirection, setMsgDirection] = useState("inbound");
  const [messages, setMessages] = useState<A2AMessage[]>([]);
  const [msgTotal, setMsgTotal] = useState(0);
  const [sendForm, setSendForm] = useState<SendForm>({ from: "", to: "", type: "task_request", content: "{}" });
  const [sendResult, setSendResult] = useState<A2AMessage | null>(null);

  // Platform card
  const [platformCard, setPlatformCard] = useState<any>(null);

  useEffect(() => {
    api.a2a.getPlatformCard().then(d => setPlatformCard(d)).catch(() => {});
  }, []);

  useEffect(() => {
    if (user?.id) {
      api.identity.myAgents().then(d => {
        const agents = d.agents || [];
        if (agents.length > 0) {
          const firstId = agents[0].id;
          if (!msgAgentId) setMsgAgentId(firstId);
          if (!sendForm.from) setSendForm(f => ({ ...f, from: firstId }));
          if (!selectedAgentId) setSelectedAgentId(firstId);
        }
      }).catch(() => {});
    }
  }, [user?.id]);

  // Handlers
  const handleDiscover = async () => {
    setLoading(true); setError(null);
    try {
      const params = capabilityFilter ? { capability: capabilityFilter } : {};
      const data = await api.a2a.discoverAgents(params) as DiscoverResponse;
      setDiscoveredAgents(data.agents || []);
      setDiscoverTotal(data.total || 0);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Discovery failed");
    }
    setLoading(false);
  };

  const handleGetCard = async () => {
    if (!selectedAgentId) return;
    setLoading(true); setError(null); setEditMode(false);
    try {
      const data = await api.a2a.getAgentCard(selectedAgentId);
      setAgentCard(data);
      setEditForm({ name: data.name || "", description: data.description || "", capabilities: (data.capabilities || []).join(", ") });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load card");
    }
    setLoading(false);
  };

  const handleUpdateCard = async () => {
    if (!selectedAgentId) return;
    setLoading(true); setError(null);
    try {
      const caps = editForm.capabilities.split(",").map(s => s.trim()).filter(Boolean);
      const data = await api.a2a.updateAgentCard(selectedAgentId, {
        agent_name: editForm.name, description: editForm.description, capabilities: caps,
      });
      setAgentCard(data); setEditMode(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Update failed (may be permission denied)");
    }
    setLoading(false);
  };

  const handleGetMessages = async () => {
    if (!msgAgentId) return;
    setLoading(true); setError(null);
    try {
      const data = await api.a2a.getMessages(msgAgentId, { direction: msgDirection });
      setMessages(data.messages || []);
      setMsgTotal(data.total || 0);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load messages");
    }
    setLoading(false);
  };

  const handleSendMessage = async () => {
    setLoading(true); setError(null);
    try {
      let contentObj = {};
      try { contentObj = JSON.parse(sendForm.content); } catch {}
      const data = await api.a2a.sendMessage({
        from_agent_id: sendForm.from, to_agent_id: sendForm.to,
        message_type: sendForm.type, content: contentObj,
      });
      setSendResult(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Send failed");
    }
    setLoading(false);
  };

  const handleMarkRead = async (messageId: string) => {
    try {
      await api.a2a.updateMessageStatus(messageId, { status: "read" });
      handleGetMessages();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Status update failed");
    }
  };

  // Cross-tab navigation callbacks
  const handleViewCard = (agentId: string) => { setSelectedAgentId(agentId); setActiveTab("card"); };
  const handleNavigateToMessage = (agentId: string) => { setSendForm(f => ({ ...f, to: agentId })); setActiveTab("messages"); };

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
              activeTab === t.id ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          ⚠️ {error}
        </div>
      )}

      {loading && (
        <div className="mb-4 text-center text-gray-400 animate-pulse">Loading...</div>
      )}

      {activeTab === "discover" && (
        <DiscoverTab
          loading={loading}
          capabilityFilter={capabilityFilter}
          setCapabilityFilter={setCapabilityFilter}
          discoveredAgents={discoveredAgents}
          discoverTotal={discoverTotal}
          onDiscover={handleDiscover}
          onViewCard={handleViewCard}
          onSendMessage={handleNavigateToMessage}
        />
      )}

      {activeTab === "card" && (
        <CardTab
          loading={loading}
          selectedAgentId={selectedAgentId}
          setSelectedAgentId={setSelectedAgentId}
          agentCard={agentCard}
          editMode={editMode}
          setEditMode={setEditMode}
          editForm={editForm}
          setEditForm={setEditForm}
          onGetCard={handleGetCard}
          onUpdateCard={handleUpdateCard}
        />
      )}

      {activeTab === "messages" && (
        <MessagesTab
          loading={loading}
          msgAgentId={msgAgentId}
          setMsgAgentId={setMsgAgentId}
          msgDirection={msgDirection}
          setMsgDirection={setMsgDirection}
          messages={messages}
          msgTotal={msgTotal}
          sendForm={sendForm}
          setSendForm={setSendForm}
          sendResult={sendResult}
          onGetMessages={handleGetMessages}
          onSendMessage={handleSendMessage}
          onMarkRead={handleMarkRead}
        />
      )}
    </div>
  );
}
