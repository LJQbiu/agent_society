"use client";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/components/common/toast";
import { useProfile, useMyAgents, useIdentityMutations, useAgentMutations } from "@/hooks/use-queries";
import type { MyAgentsResponse } from "@/types";
import { LoadingList, EmptyState, ErrorAlert, SuccessAlert } from "@/components/ui/status-components";
import { cn } from "@/lib/utils";

interface CredentialData {
  client_id: string;
  client_secret: string;
  status?: string;
}

export function IdentityManager() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: myAgentsData, isLoading: agentsLoading } = useMyAgents();
  const identityMutations = useIdentityMutations();
  const agentMutations = useAgentMutations();

  const myAgents: MyAgentsResponse | undefined = myAgentsData as MyAgentsResponse | undefined;
  const agentsList = myAgents?.agents || [];

  const [credential, setCredential] = useState<CredentialData | null>(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editBio, setEditBio] = useState("");
  const [agentName, setAgentName] = useState("");
  const [agentDesc, setAgentDesc] = useState("");

  const [profileInitialized, setProfileInitialized] = useState(false);
  if (profile && !profileInitialized) {
    setEditName(profile.profile?.username || profile.name || "");
    setEditEmail(profile.profile?.email || "");
    setEditBio(profile.profile?.bio || "");
    setProfileInitialized(true);
  }

  const saveProfile = () => {
    identityMutations.updateProfile.mutate(
      { username: editName, email: editEmail, bio: editBio },
      {
        onSuccess: () => { showToast("资料已更新", "success"); setEditing(false); },
        onError: (err: Error) => showToast(`更新失败: ${err.message}`, "error"),
      }
    );
  };

  const getCredential = (agentId: string) => {
    identityMutations.agentCredentials.mutate(agentId, {
      onSuccess: (data: any) => {
        setCredential({ client_id: data.client_id, client_secret: data.client_secret, status: data.status });
        showToast("凭证已获取", "success");
      },
      onError: (err: Error) => showToast(`获取凭证失败: ${err.message}`, "error"),
    });
  };

  const bindAgent = (agentId: string) => {
    agentMutations.bindAgent.mutate(agentId, {
      onSuccess: (data: any) => {
        setCredential({ client_id: data.client_id, client_secret: data.client_secret, status: data.status });
        showToast("绑定成功，凭证已生成", "success");
      },
      onError: (err: Error) => showToast(`绑定失败: ${err.message}`, "error"),
    });
  };

  const deleteAgent = (agentId: string, agentName: string) => {
    if (!confirm(`确定删除 ${agentName}？此操作不可撤销。`)) return;
    agentMutations.deleteAgent.mutate(agentId, {
      onSuccess: () => showToast(`${agentName} 已删除`, "success"),
      onError: (err: Error) => showToast(`删除失败: ${err.message}`, "error"),
    });
  };

  const registerAgent = () => {
    if (!agentName.trim()) { showToast("请填写Agent名称", "error"); return; }
    agentMutations.registerAgent.mutate(
      { agent_id: `agent-${agentName.trim().toLowerCase().replace(/\s+/g, "-")}-${Date.now().toString(36)}`, name: agentName, description: agentDesc, capabilities: [] },
      {
        onSuccess: (data: any) => {
          showToast("Agent注册成功", "success");
          setAgentName(""); setAgentDesc("");
          if (data?.agent_id) getCredential(data.agent_id);
        },
        onError: (err: Error) => showToast(`注册失败: ${err.message}`, "error"),
      }
    );
  };

  // ─── Render ───
  if (profileLoading || agentsLoading) return <LoadingList />;

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4 sm:p-6">
      {/* === 个人资料 === */}
      <section className="bg-white rounded-xl shadow-card border border-gray-100 p-4 sm:p-6 animate-fadeIn">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-indigo-600 flex items-center justify-center text-white text-sm shadow-md">👤</span>
          个人资料
        </h2>
        {!profile ? (
          <ErrorAlert message="未登录或无资料数据" />
        ) : editing ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">姓名</label>
              <input className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition-all" value={editName} onChange={e => setEditName(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">邮箱</label>
              <input className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition-all" value={editEmail} onChange={e => setEditEmail(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">简介</label>
              <textarea className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition-all" value={editBio} onChange={e => setEditBio(e.target.value)} rows={3} />
            </div>
            <div className="flex gap-2">
              <button
                className={cn("px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-all shadow-card font-medium", identityMutations.updateProfile.isPending && "opacity-50 cursor-not-allowed")}
                onClick={saveProfile} disabled={identityMutations.updateProfile.isPending}>
                {identityMutations.updateProfile.isPending ? "⏳ 保存中..." : "✅ 保存"}
              </button>
              <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all font-medium" onClick={() => setEditing(false)}>取消</button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p><span className="font-medium text-gray-500">ID:</span> <span className="text-gray-900">{profile.id}</span></p>
            <p><span className="font-medium text-gray-500">姓名:</span> <span className="text-gray-900">{profile.profile?.username || profile.name || "未设置"}</span></p>
            <p><span className="font-medium text-gray-500">邮箱:</span> <span className="text-gray-900">{profile.profile?.email || "未设置"}</span></p>
            <p><span className="font-medium text-gray-500">简介:</span> <span className="text-gray-900">{profile.profile?.bio || "未设置"}</span></p>
            <p><span className="font-medium text-gray-500">类型:</span> <span className="text-gray-900">{profile.type}</span></p>
            <p><span className="font-medium text-gray-500">状态:</span> <span className={cn("px-2 py-0.5 rounded-md text-xs font-medium", profile.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500")}>{profile.status}</span></p>
            <button className="mt-3 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all font-medium shadow-card" onClick={() => setEditing(true)}>✏️ 编辑资料</button>
          </div>
        )}
      </section>

      {/* === 我的Agent === */}
      <section className="bg-white rounded-xl shadow-card border border-gray-100 p-4 sm:p-6 animate-fadeIn">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-400 to-cyan-500 flex items-center justify-center text-white text-sm shadow-md">🤖</span>
          我的Agent
          <span className="text-sm text-gray-400 font-normal">({agentsList.length})</span>
        </h2>
        {agentsList.length === 0 ? (
          <EmptyState icon="🤖" title="暂无Agent" description="注册一个新Agent开始参与社会协作" size="sm" />
        ) : (
          <div className="space-y-3">
            {agentsList.map(a => (
              <div key={a.id} className="flex items-center justify-between bg-gray-50 rounded-xl p-3 hover:bg-gray-100 transition-all">
                <div className="min-w-0">
                  <span className="text-sm font-semibold text-gray-700">{a.name}</span>
                  <span className="text-xs text-gray-400 ml-2">({a.id.slice(0, 12)}...)</span>
                  <div className="text-xs mt-1 flex items-center gap-1">
                    <span className={cn("px-1.5 py-0.5 rounded-md text-xs font-medium", a.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500")}>
                      {a.status === "active" ? "✅ 活跃" : a.status}
                    </span>
                    {a.capabilities.length > 0 && <span className="text-gray-400">{a.capabilities.join(", ")}</span>}
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <button className="px-2 py-1 text-blue-500 hover:bg-blue-50 rounded-lg text-sm transition-all" onClick={() => getCredential(a.id)} title="获取凭证">🔑 凭证</button>
                  <button className="px-2 py-1 text-red-400 hover:bg-red-50 rounded-lg text-sm transition-all" onClick={() => deleteAgent(a.id, a.name)} title="删除此Agent">🗑️ 删除</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* === 凭证展示 === */}
      {credential && (
        <section className="bg-white rounded-xl shadow-card border border-gray-100 p-4 sm:p-6 animate-fadeIn">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center text-white text-sm shadow-md">🔑</span>
            接入凭证
          </h2>
          <SuccessAlert message="凭证已成功获取，请妥善保管 client_secret" />
          <div className="bg-gray-50 rounded-xl p-3 space-y-2 mt-3">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <span className="text-sm font-semibold text-gray-700">Client ID</span>
                <div className="text-sm font-mono mt-1 break-all overflow-hidden">{credential.client_id}</div>
              </div>
              <button className="px-3 py-1 text-sm text-brand-600 hover:bg-brand-50 rounded-lg transition-all" onClick={() => { navigator.clipboard.writeText(credential.client_id); showToast("已复制", "success"); }}>📋 复制</button>
            </div>
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <span className="text-sm font-semibold text-gray-700">Client Secret</span>
                <div className="text-sm font-mono mt-1 break-all overflow-hidden">{credential.client_secret}</div>
              </div>
              <button className="px-3 py-1 text-sm text-brand-600 hover:bg-brand-50 rounded-lg transition-all" onClick={() => { navigator.clipboard.writeText(credential.client_secret); showToast("已复制", "success"); }}>📋 复制</button>
            </div>
            {credential.status && <p className="text-xs text-gray-400">状态: {credential.status}</p>}
          </div>
          <div className="mt-4 bg-gray-50 rounded-xl p-3">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Python 接入示例</h3>
            <pre className="text-xs bg-gray-900 text-green-400 p-3 rounded-lg overflow-x-auto">
{`import requests

BASE_URL = "http://localhost:8080"
CLIENT_ID = "${credential.client_id}"
CLIENT_SECRET = "${credential.client_secret}"

# 1. 获取access_token (client_credentials模式)
resp = requests.post(BASE_URL + "/auth/token", json={
    "grant_type": "client_credentials",
    "client_id": CLIENT_ID,
    "client_secret": CLIENT_SECRET,
})
token = resp.json()["access_token"]

# 2. 使用token访问API
headers = {"Authorization": f"Bearer {token}"}
resp = requests.get(BASE_URL + "/observatory/agents", headers=headers)
print(resp.json())`}
            </pre>
          </div>
        </section>
      )}

      {/* === 绑定已有Agent === */}
      {agentsList.length === 0 && (
        <section className="bg-white rounded-xl shadow-card border border-gray-100 p-4 sm:p-6 animate-fadeIn">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm shadow-md">🔗</span>
            绑定已有Agent
          </h2>
          <p className="text-sm text-gray-500 mb-3">如果你的Agent已在平台上注册，可以绑定到你的账户。</p>
          <div className="flex gap-2">
            <input className="flex-1 px-3 py-2 rounded-lg border border-gray-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition-all" placeholder="输入 Agent ID" id="bind-input" />
            <button className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-all shadow-card font-medium" onClick={() => {
              const input = document.getElementById("bind-input") as HTMLInputElement;
              if (input?.value.trim()) bindAgent(input.value.trim());
            }}>🔗 绑定</button>
          </div>
        </section>
      )}

      {/* === 注册新Agent === */}
      <section className="bg-white rounded-xl shadow-card border border-gray-100 p-4 sm:p-6 animate-fadeIn">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white text-sm shadow-md">➕</span>
          注册新Agent
        </h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">Agent名称</label>
            <input className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition-all" value={agentName} onChange={e => setAgentName(e.target.value)} placeholder="例如: MyHelperAgent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">简介</label>
            <textarea className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition-all" value={agentDesc} onChange={e => setAgentDesc(e.target.value)} placeholder="Agent的功能简介..." rows={2} />
          </div>
          <button
            className={cn("px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all shadow-card font-medium", agentMutations.registerAgent.isPending && "opacity-50 cursor-not-allowed")}
            onClick={registerAgent} disabled={agentMutations.registerAgent.isPending}>
            {agentMutations.registerAgent.isPending ? "⏳ 注册中..." : "➕ 注册Agent"}
          </button>
        </div>
      </section>
    </div>
  );
}
