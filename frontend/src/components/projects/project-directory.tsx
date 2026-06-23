"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Project } from "@/types";

export function ProjectDirectory() {
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    api.observatory.listProjects({}).then(data => setProjects(data.projects));
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">项目市场</h2>
      <div className="grid grid-cols-2 gap-4">
        {projects.map(p => (
          <div key={p.project_id} className="card p-4">
            <h3>{p.name}</h3>
            <p>{p.description}</p>
            <p>预算: {p.token_budget} Token</p>
            <p>状态: {p.status}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
