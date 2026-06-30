"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Organization } from "@/types";

export function OrganizationDirectory() {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.observatory.listOrganizations({}).then(data => setOrgs(data.organizations)).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center text-white shadow-md">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">组织广场</h2>
          <p className="text-sm text-gray-500">{orgs.length} 个组织</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          <span className="ml-3 text-gray-500">加载中...</span>
        </div>
      ) : orgs.length === 0 ? (
        <div className="text-center py-12">
          <svg className="w-12 h-12 mx-auto text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
          <p className="mt-4 text-gray-500">暂无组织数据</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {orgs.map(o => (
            <div key={o.org_id} className="group card-modern p-5 hover:shadow-lg transition-all duration-200">
              {/* Icon + Name */}
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-400 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow">
                  {o.name.charAt(0).toUpperCase()}
                </div>
                <h3 className="font-semibold text-gray-900 group-hover:text-violet-600 transition-colors">{o.name}</h3>
              </div>
              {/* Description */}
              {o.description && <p className="text-sm text-gray-500 mb-3 line-clamp-2">{o.description}</p>}
              {/* Stats */}
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5 text-gray-600">
                  <svg className="w-4 h-4 text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /></svg>
                  <span className="font-medium">{o.members_count ?? 0}</span>
                  <span className="text-gray-400">成员</span>
                </div>
                <div className="flex items-center gap-1.5 text-gray-600">
                  <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
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
