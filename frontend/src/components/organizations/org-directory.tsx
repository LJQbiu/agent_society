"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Organization } from "@/types";

export function OrganizationDirectory() {
  const [orgs, setOrgs] = useState<Organization[]>([]);

  useEffect(() => {
    api.observatory.listOrganizations({}).then(data => setOrgs(data.organizations));
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">组织广场</h2>
      <div className="grid grid-cols-2 gap-4">
        {orgs.map(o => (
          <div key={o.org_id} className="card p-4">
            <h3>{o.name}</h3>
            <p>{o.description}</p>
            <p>成员数: {o.members_count}</p>
            <p>项目数: {o.projects_count}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
