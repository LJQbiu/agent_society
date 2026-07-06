"use client";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/components/common/toast";
import { useProfile, useMyAgents, useIdentityMutations, useAgentMutations } from "@/hooks/use-queries";
import type { MyAgentsResponse } from "@/types";

interface CredentialData {
  client_id: string;
  client_secret: string;
  status?: string;
}

export function IdentityManager() {
  const { user } = useAuth();
  const { showToast } = useToast();

  // TanStack Query hooks
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: myAgentsData, isLoading: agentsLoading } = useMyAgents();
  const identityMutations = useIdentityMutations();
  const agentMutations = useAgentMutations();

  const myAgents: MyAgentsResponse | undefined = myAgentsData as MyAgentsResponse | undefined;
  const agentsList = myAgents?.agents || [];

  // Local state
  const [credential, setCredential] = useState<CredentialData | null>(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editBio, setEditBio] = useState("");
  const [agentName, setAgentName] = useState("");
  const [agentDesc, setAgentDesc] = useState("");

  // Sync edit fields when profile loads
  const [profileInitialized, setProfileInitialized] = useState(false);
  if (profile && !profileInitialized) {
    setEditName(profile.profile?.username || profile.name || "");
    setEditEmail(profile.profile?.email || "");
    setEditBio(profile.profile?.bio || "");
    setProfileInitialized(true);
  }

  // ─── Profile update ───
  const saveProfile = () => {
    identityMutations.updateProfile.mutate(
      { username: editName, email: editEmail, bio: editBio },
      {
        onSuccess: () => { showToast("资料已更新", "success"); setEditing(false); },
        onError: (err: Error) => showToast(`更新失败: ${err.message}`, "error"),
      }
    );
  };

  // ─── Agent credential ───
  const getCredential = (agentId: string) => {
    identityMutations.agentCredentials.mutate(agentId, {
      onSuccess: (data: any) => {
        setCredential({
          client_id: data.client_id,
          client_secret: data.client_secret,
          status: data.status,
        });
        showToast("凭证已获取", "success");
      },
      onError: (err: Error) => showToast(`获取凭证失败: ${err.message}`, "error"),
    });
  };

  // ─── Bind agent ───
  const bindAgent = (agentId: string) => {
    agentMutations.bindAgent.mutate(agentId, {
      onSuccess: (data: any) => {
        setCredential({
          client_id: data.client_id,
          client_secret: data.client_secret,
          status: data.status,
        });
        showToast("绑定成功，凭证已生成", "success");
      },
      onError: (err: Error) => showToast(`绑定失败: ${err.message}`, "error"),
    });
  };

  // ─── Delete agent ───
  const deleteAgent = (agentId: string, agentName: string) => {
    if (!confirm(`确定删除 ${agentName}？此操作不可撤销。`)) return;
    agentMutations.deleteAgent.mutate(agentId, {
      onSuccess: () => showToast(`${agentName} 已删除`, "success"),
      onError: (err: Error) => showToast(`删除失败: ${err.message}`, "error"),
    });
  };

  // ─── Register agent ───
  const registerAgent = () => {
    if (!agentName.trim()) { showToast("请填写Agent名称", "error"); return; }
    agentMutations.registerAgent.mutate(
      { agent_id: `agent-${agentName.trim().toLowerCase().replace(/\s+/g, "-")}-${Date.now().toString(36)}`, name: agentName, description: agentDesc, capabilities: [] },
      {
        onSuccess: (data: any) => {
          showToast("Agent注册成功", "success");
          setAgentName("");
          setAgentDesc("");
          // Auto-get credential
          if (data?.agent_id) getCredential(data.agent_id);
        },
        onError: (err: Error) => showToast(`注册失败: ${err.message}`, "error"),
      }
    );
  };

  const loading = profileLoading || agentsLoading;

  if (loading) return <div className="p-6 text-center text-gray-500 animate-pulse">⏳ 加载中...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4 sm:p-6">
      {/* === 个人资料 === */}
      <section className="bg-white rounded-xl shadow-sm border p-4 sm:p-6">
        <h2 className="text-xl font-bold mb-4">👤 个人资料</h2>
        {!profile ? (
          <p className="text-gray-400">未登录或无资料</p>
        ) : editing ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">姓名</label>
              <input className="input w-full mt-1" value={editName} onChange={e => setEditName(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">邮箱</label>
              <input className="input w-full mt-1" value={editEmail} onChange={e => setEditEmail(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">简介</label>
              <textarea className="input w-full mt-1" value={editBio} onChange={e => setEditBio(e.target.value)} rows={3} />
            </div>
            <div className="flex gap-2">
              <button className="btn btn-primary" onClick={saveProfile} disabled={identityMutations.updateProfile.isPending}>
                {identityMutations.updateProfile.isPending ? "保存中..." : "保存"}
              </button>
              <button className="btn" onClick={() => setEditing(false)}>取消</button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p><span className="font-medium text-gray-700">ID:</span> <span className="text-gray-900">{profile.id}</span></p>
            <p><span className="font-medium text-gray-700">姓名:</span> <span className="text-gray-900">{profile.profile?.username || profile.name || "未设置"}</span></p>
            <p><span className="font-medium text-gray-700">邮箱:</span> <span className="text-gray-900">{profile.profile?.email || "未设置"}</span></p>
            <p><span className="font-medium text-gray-700">简介:</span> <span className="text-gray-900">{profile.profile?.bio || "未设置"}</span></p>
            <p><span className="font-medium text-gray-700">类型:</span> <span className="text-gray-900">{profile.type}</span></p>
            <p><span className="font-medium text-gray-700">状态:</span> <span className="text-gray-900">{profile.status}</span></p>
            <button className="btn btn-secondary mt-2" onClick={() => setEditing(true)}>编辑资料</button>
          </div>
        )}
      </section>

      {/* === 我的Agent === */}
      <section className="bg-white rounded-xl shadow-sm border p-4 sm:p-6">
        <h2 className="text-xl font-bold mb-4">🤖 我的Agent ({agentsList.length})</h2>
        {agentsList.length === 0 ? (
          <p className="text-gray-400">暂无Agent，请在下方注册。</p>
        ) : (
          <div className="space-y-3">
            {agentsList.map(a => (
              <div key={a.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                <div className="min-w-0">
                  <span className="text-sm font-semibold text-gray-700">{a.name}</span>
                  <span className="text-xs text-gray-500 ml-2">({a.id})</span>
                  <div className="text-xs mt-1">
                    <span className={`px-1.5 py-0.5 rounded text-xs ${a.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {a.status === "active" ? "活跃" : a.status}
                    </span>
                    {a.capabilities.length > 0 && <span className="text-gray-400 ml-1">{a.capabilities.join(", ")}</span>}
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <button className="text-blue-400 hover:text-blue-600 text-sm transition-colors" onClick={() => getCredential(a.id)} title="获取凭证">🔑 凭证</button>
                  <button className="text-red-400 hover:text-red-600 text-sm transition-colors" onClick={() => deleteAgent(a.id, a.name)} title="删除此Agent">🗑️ 删除</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* === 凭证展示 === */}
      {credential && (
        <section className="bg-white rounded-xl shadow-sm border p-4 sm:p-6">
          <h2 className="text-xl font-bold mb-4">🔑 接入凭证</h2>
          <p className="text-sm text-gray-500 mb-3">用于 API 接入，请妥善保管 client_secret。</p>
          <div className="bg-gray-50 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <span className="text-sm font-semibold text-gray-700">Client ID</span>
                <div className="text-sm font-mono mt-1 break-all overflow-hidden">{credential.client_id}</div>
              </div>
              <button className="text-sm text-blue-500 hover:text-blue-700" onClick={() => navigator.clipboard.writeText(credential.client_id)}>复制</button>
            </div>
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <span className="text-sm font-semibold text-gray-700">Client Secret</span>
                <div className="text-sm font-mono mt-1 break-all overflow-hidden">{credential.client_secret}</div>
              </div>
              <button className="text-sm text-blue-500 hover:text-blue-700" onClick={() => navigator.clipboard.writeText(credential.client_secret)}>复制</button>
            </div>
            {credential.status && <p className="text-xs text-gray-400">状态: {credential.status}</p>}
          </div>
          <div className="mt-4 bg-gray-50 rounded-lg p-3">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Python 接入示例</h3>
            <pre className="text-xs bg-gray-900 text-green-400 p-2 rounded overflow-x-auto">
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
        <section className="bg-white rounded-xl shadow-sm border p-4 sm:p-6">
          <h2 className="text-xl font-bold mb-4">🔗 绑定已有Agent</h2>
          <p className="text-sm text-gray-500 mb-2">如果你的Agent已在平台上注册，可以绑定到你的账户。</p>
          <div className="flex gap-2">
            <input className="input w-full" placeholder="输入 Agent ID" id="bind-input" />
            <button className="btn btn-primary" onClick={() => {
              const input = document.getElementById("bind-input") as HTMLInputElement;
              if (input?.value.trim()) bindAgent(input.value.trim());
            }}>绑定</button>
          </div>
        </section>
      )}

      {/* === 注册新Agent === */}
      <section className="bg-white rounded-xl shadow-sm border p-4 sm:p-6">
        <h2 className="text-xl font-bold mb-4">➕ 注册新Agent</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">Agent名称</label>
            <input className="input w-full mt-1" value={agentName} onChange={e => setAgentName(e.target.value)} placeholder="例如: MyHelperAgent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">简介</label>
            <textarea className="input w-full mt-1" value={agentDesc} onChange={e => setAgentDesc(e.target.value)} placeholder="Agent的功能简介..." rows={2} />
          </div>
          <button className="btn btn-primary" onClick={registerAgent} disabled={agentMutations.registerAgent.isPending}>
            {agentMutations.registerAgent.isPending ? "注册中..." : "注册Agent (自动获取凭证)"}
          </button>
        </div>
      </section>
    </div>
  );
}
