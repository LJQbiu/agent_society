"use client";

import { useState } from "react";
import {
  useOrgCrudList, useOrgCrudDetail, useOrgMembers,
  useOrgMutations, useMyAgents, useAgentMutations,
} from "@/hooks/use-queries";
import { LoadingList, EmptyState, ErrorAlert, SuccessAlert } from "@/components/ui/status-components";
import { cn } from "@/lib/utils";
import { OrgCreateForm } from "./org-create-form";
import { OrgAgentSection } from "./org-agent-section";
import { OrgUpdateForm } from "./org-update-form";
import type { OrganizationCRUDResponse, OrganizationMemberResponse } from "@/types";

// ─── Helpers ───
const orgTypeIcon: Record<string, string> = { company: "🏢", dao: "🏛️", community: "🌐" };
const statusColor: Record<string, string> = { active: "bg-green-100 text-green-700", inactive: "bg-gray-100 text-gray-600", suspended: "bg-red-100 text-red-700" };
const govModelLabel: Record<string, string> = { democratic: "民主治理", autocratic: "集中治理", meritocratic: "精英治理" };

export default function OrgManager() {
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // ─── Queries ───
  const { data: orgList, isLoading: listLoading, error: listError } = useOrgCrudList();
  const { data: orgDetail, isLoading: detailLoading } = useOrgCrudDetail(selectedOrgId);
  const { data: membersData } = useOrgMembers(selectedOrgId);
  const { createOrg, updateOrg, joinOrg } = useOrgMutations();
  const { registerAgent } = useAgentMutations();
  const { data: myAgentsData } = useMyAgents();

  const selectedOrg = orgDetail as OrganizationCRUDResponse | undefined;
  const members = (membersData as { members: OrganizationMemberResponse[] } | undefined)?.members || [];
  const myAgents = (myAgentsData as { agents: { id: string; name: string }[] } | undefined)?.agents || [];
  const mutationError = createOrg.error || updateOrg.error || joinOrg.error;

  // ─── Handlers ───
  const viewDetail = (id: string) => {
    setErrorMsg(""); setSuccessMsg(""); setSelectedOrgId(id); setShowCreateForm(false);
  };

  // ─── Render ───
  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <span className="text-3xl">🏢</span>
        <h1 className="text-2xl font-bold text-gray-800">组织管理</h1>
      </div>

      {/* Alerts */}
      {(mutationError || errorMsg) && (
        <ErrorAlert message={errorMsg || (mutationError as Error)?.message || "操作失败"} onClose={() => { setErrorMsg(""); }} />
      )}
      {successMsg && (
        <SuccessAlert message={successMsg} onClose={() => setSuccessMsg("")} />
      )}

      {/* Action buttons */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setShowCreateForm(!showCreateForm)}
          className={cn("px-4 py-2 rounded-lg font-medium transition-all shadow-card hover:shadow-cardHover",
            showCreateForm ? "bg-gray-200 text-gray-700" : "bg-brand-600 text-white hover:bg-brand-700")}>
          {showCreateForm ? "✕ 取消创建" : "➕ 创建组织"}
        </button>
        {selectedOrgId && (
          <button onClick={() => { setSelectedOrgId(""); setErrorMsg(""); setSuccessMsg(""); }}
            className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-all">
            ← 返回列表
          </button>
        )}
      </div>

      {/* Create form */}
      {showCreateForm && !selectedOrgId && (
        <OrgCreateForm createOrg={createOrg} onErrorMsg={setErrorMsg} onSuccessMsg={setSuccessMsg} />
      )}

      {/* List */}
      {!selectedOrgId && !showCreateForm && (
        listLoading ? <LoadingList /> :
        listError ? <ErrorAlert message="加载失败" onClose={() => {}} /> :
        !orgList?.organizations?.length ? (
          <EmptyState icon="🏢" title="暂无组织" description="创建一个组织开始协作" size="sm" />
        ) : (
          <div className="space-y-2">
            {orgList.organizations.map((org: OrganizationCRUDResponse) => (
              <button key={org.id} onClick={() => viewDetail(org.id)}
                className="w-full text-left bg-surface-1 rounded-lg px-4 py-3 border border-surface-3 hover:border-brand-400 transition-all shadow-sm hover:shadow-card flex items-center gap-3">
                <span className="text-xl">{orgTypeIcon[org.org_type] || "🏢"}</span>
                <div>
                  <div className="font-medium text-gray-800">{org.name}</div>
                  <div className="text-sm text-gray-500">{org.description?.slice(0, 50) || "无描述"}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    <span>{govModelLabel[org.governance_model] || org.governance_model}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )
      )}

      {/* Detail */}
      {selectedOrgId && selectedOrg && (
        detailLoading ? <LoadingList /> :
        <div className="bg-surface-1 rounded-xl p-6 border border-surface-3 shadow-card space-y-5 animate-fadeIn">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{orgTypeIcon[selectedOrg.org_type] || "🏢"}</span>
            <h2 className="text-xl font-bold text-gray-800">{selectedOrg.name}</h2>
            <span className={cn("px-2 py-0.5 rounded-full text-xs", statusColor[selectedOrg.status] || "bg-gray-100 text-gray-600")}>{selectedOrg.status}</span>
          </div>
          <p className="text-gray-600">{selectedOrg.description || "无描述"}</p>

          {/* Info grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { label: "类型", value: orgTypeIcon[selectedOrg.org_type] + " " + (selectedOrg.org_type || "—"), icon: "🏷️" },
              { label: "治理", value: govModelLabel[selectedOrg.governance_model] || selectedOrg.governance_model, icon: "📊" },
              { label: "声誉", value: selectedOrg.reputation ?? 0, icon: "⭐" },
              { label: "余额", value: selectedOrg.balance ?? 0, icon: "💰" },
              { label: "创建者", value: selectedOrg.creator_id, icon: "👤" },
              { label: "状态", value: selectedOrg.status, icon: "📌" },
            ].map(item => (
              <div key={item.label} className="bg-surface-1 rounded-lg px-3 py-2 flex items-center gap-2">
                <span>{item.icon}</span>
                <span className="text-gray-500">{item.label}:</span>
                <span className="font-medium text-gray-700">{item.value}</span>
              </div>
            ))}
          </div>

          {/* Members */}
          <div>
            <h4 className="font-medium text-gray-700 mb-2">👥 成员 ({members.length})</h4>
            {members.length === 0 ? (
              <EmptyState icon="👥" title="暂无成员" description="加入组织或注册Agent" size="sm" />
            ) : (
              <div className="space-y-1">
                {members.map((m: OrganizationMemberResponse) => (
                  <div key={m.id} className="text-sm flex gap-2 items-center bg-surface-1 rounded-lg px-3 py-2">
                    <span className="font-medium text-gray-700">{m.role}</span>
                    <span className="text-gray-500">{m.agent_id || m.human_id}</span>
                    <span className={cn("px-1.5 py-0.5 rounded text-xs", statusColor[m.status] || "bg-gray-100 text-gray-600")}>{m.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Agent section: join + register */}
          <OrgAgentSection
            orgId={selectedOrgId}
            myAgents={myAgents}
            joinOrg={joinOrg}
            registerAgent={registerAgent}
            onErrorMsg={setErrorMsg}
            onSuccessMsg={setSuccessMsg}
          />

          {/* Update form */}
          <OrgUpdateForm
            selectedOrg={selectedOrg}
            orgId={selectedOrgId}
            updateOrg={updateOrg}
            onErrorMsg={setErrorMsg}
            onSuccessMsg={setSuccessMsg}
          />
        </div>
      )}
    </div>
  );
}
