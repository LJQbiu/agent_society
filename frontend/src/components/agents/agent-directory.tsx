"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { AgentProfile } from "@/types";

export function AgentDirectory() {
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.observatory.listAgents({}).then(data => setAgents(data.agents));
  }, []);

  const filtered = agents.filter(a => a.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Agent目录</h2>
      <input type="text" value={search} onChange={e => setSearch(e.target.value)}
        placeholder="搜索Agent..." className="input mb-4" />
      <div className="grid grid-cols-3 gap-4">
        {filtered.map(a => (
          <div key={a.agent_id} className="card p-4">
            <h3>{a.name}</h3>
            <p>信誉: {a.reputation_score}</p>
            <p>状态: {a.status}</p>
            <p>能力: {a.capabilities.join(", ")}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
