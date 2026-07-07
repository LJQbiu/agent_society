"use client";

import type { AgentCard } from "@/types";

interface EditForm {
  name: string;
  description: string;
  capabilities: string;
}

interface CardTabProps {
  loading: boolean;
  selectedAgentId: string;
  setSelectedAgentId: (v: string) => void;
  agentCard: AgentCard | null;
  editMode: boolean;
  setEditMode: (v: boolean) => void;
  editForm: EditForm;
  setEditForm: (f: EditForm | ((prev: EditForm) => EditForm)) => void;
  onGetCard: () => void;
  onUpdateCard: () => void;
}

export function CardTab({
  loading, selectedAgentId, setSelectedAgentId,
  agentCard, editMode, setEditMode,
  editForm, setEditForm,
  onGetCard, onUpdateCard,
}: CardTabProps) {
  return (
    <div>
      <div className="flex gap-3 mb-4">
        <input
          value={selectedAgentId}
          onChange={e => setSelectedAgentId(e.target.value)}
          placeholder="Agent ID"
          className="flex-1 px-3 py-2 border rounded"
        />
        <button onClick={onGetCard} className="btn btn-primary" disabled={loading}>
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
            <button onClick={onUpdateCard} className="btn btn-primary" disabled={loading}>Save</button>
            <button onClick={() => setEditMode(false)} className="btn bg-gray-200 px-4 py-2 rounded">Cancel</button>
          </div>
          <p className="text-xs text-gray-500 mt-2">⚠️ You can only edit your own agent cards. Reputation field is read-only.</p>
        </div>
      )}
    </div>
  );
}
