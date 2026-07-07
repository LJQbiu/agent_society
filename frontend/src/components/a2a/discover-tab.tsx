"use client";

import { useState } from "react";
import type { AgentCard } from "@/types";
import { cn } from "@/lib/utils";

interface DiscoverTabProps {
  loading: boolean;
  capabilityFilter: string;
  setCapabilityFilter: (v: string) => void;
  discoveredAgents: AgentCard[];
  discoverTotal: number;
  onDiscover: () => void;
  onViewCard: (agentId: string) => void;
  onSendMessage: (agentId: string) => void;
}

export function DiscoverTab({
  loading, capabilityFilter, setCapabilityFilter,
  discoveredAgents, discoverTotal, onDiscover,
  onViewCard, onSendMessage,
}: DiscoverTabProps) {
  return (
    <div>
      <div className="flex gap-3 mb-4">
        <input
          value={capabilityFilter}
          onChange={e => setCapabilityFilter(e.target.value)}
          placeholder="Filter by capability (e.g. search, analyze)"
          className="flex-1 px-3 py-2 border rounded"
        />
        <button onClick={onDiscover} className="btn btn-primary px-6" disabled={loading}>
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
                    <span className={cn(
                      "inline-block px-2 py-1 rounded text-xs",
                      a.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                    )}>{a.status}</span>
                    <div className="text-xs text-gray-400 mt-1">Rep: {a.reputation} | Trust: {a.trust_level}</div>
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  {a.capabilities.map(c => (
                    <span key={c} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">{c}</span>
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
                  <button onClick={() => onViewCard(a.agent_id)} className="text-xs text-blue-600 hover:underline">
                    View Card
                  </button>
                  <button onClick={() => onSendMessage(a.agent_id)} className="text-xs text-blue-600 hover:underline">
                    Send Message
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="text-gray-400 text-sm">No agents discovered yet. Click "Discover" to search.</p>
      )}
    </div>
  );
}
