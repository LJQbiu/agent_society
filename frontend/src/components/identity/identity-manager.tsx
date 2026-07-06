"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/components/common/toast";

interface AgentInfo {
  id: string;
  name: string;
  capability?: string;
  capabilities?: string[];
  status?: string;
  description?: string;
}

interface AgentCredential {
  client_id: string;
  client_secret: string;
  status?: string;
}

export function IdentityManager() {
  const { user, isLoading } = useAuth();
  const { showToast } = useToast();

  // Profile state
  const [profile, setProfile] = useState<any>(null);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ username: "", email: "" });
  const [saving, setSaving] = useState(false);

  // Agent state
  const [myAgents, setMyAgents] = useState<AgentInfo[] | null>(null);
  const [agentName, setAgentName] = useState("");
  const [agentCap, setAgentCap] = useState("");
  const [agentDesc, setAgentDesc] = useState("");
  const [registering, setRegistering] = useState(false);

  // Credential state
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [credential, setCredential] = useState<AgentCredential | null>(null);
  const [loadingCred, setLoadingCred] = useState(false);
  const [secretVisible, setSecretVisible] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Code snippet tab
  const [codeTab, setCodeTab] = useState<"python" | "js" | "curl">("python");

  useEffect(() => {
    if (user) {
      api.identity.getProfile()
        .then(setProfile)
        .catch(() => setProfile(null));
      api.identity.myAgents()
        .then((res: any) => setMyAgents(res.agents || []))
        .catch(() => setMyAgents(null));
    }
  }, [user]);

  // Auto-fill edit form when profile loads
  useEffect(() => {
    if (profile) {
      setEditForm({ username: profile.username || "", email: profile.email || "" });
    }
  }, [profile]);

  const saveProfile = async () => {
    setSaving(true);
    try {
      const updated = await api.identity.updateProfile(editForm);
      setProfile(updated);
      setEditMode(false);
      showToast("资料已更新", "success");
    } catch (e: any) {
      showToast(e.message || "更新失败", "error");
    }
    setSaving(false);
  };

  const registerAgent = async () => {
    if (!agentName.trim()) { showToast("请输入Agent名称", "error"); return; }
    setRegistering(true);
    try {
      // Step 1: Register the agent
      const regResult: any = await api.identity.registerAgent({
        name: agentName.trim(),
        capabilities: agentCap.trim() ? agentCap.trim().split(/[,，\s]+/).filter(Boolean) : [],
        description: agentDesc.trim() || undefined,
      });

      // Step 2: Auto-bind to get credentials
      const agentId = regResult.agent_id || regResult.id || regResult.agent_id_str;
      if (agentId) {
        try {
          const bindResult: any = await api.auth.bindAgent(agentId);
          setCredential({
            client_id: bindResult.client_id,
            client_secret: bindResult.client_secret,
            status: bindResult.status,
          });
          setSelectedAgent(agentId);
          setSecretVisible(false);
          showToast("Agent注册成功！凭证已自动生成", "success");
        } catch {
          showToast("Agent注册成功！请点击「获取凭证」获取接入信息", "success");
        }
      } else {
        showToast("Agent注册成功！", "success");
      }

      // Refresh agent list
      const agentsRes: any = await api.identity.myAgents();
      setMyAgents(agentsRes.agents || []);
      setAgentName("");
      setAgentCap("");
      setAgentDesc("");
    } catch (e: any) {
      showToast(e.message || "注册失败", "error");
    }
    setRegistering(false);
  };

  const fetchCredential = async (agentId: string) => {
    setLoadingCred(true);
    setSelectedAgent(agentId);
    setCredential(null);
    try {
      // Try bind first (creates OAuth client if not already bound)
      try {
        const bindResult: any = await api.auth.bindAgent(agentId);
        setCredential({
          client_id: bindResult.client_id,
          client_secret: bindResult.client_secret,
          status: bindResult.status,
        });
      } catch {
        // If already bound, try agent-credentials endpoint
        try {
          const credResult: any = await api.auth.agentCredentials(agentId);
          setCredential({
            client_id: credResult.client_id,
            client_secret: credResult.client_secret,
            status: "bound",
          });
        } catch (e2: any) {
          showToast(e2.message || "获取凭证失败", "error");
        }
      }
      setSecretVisible(false);
    } catch (e: any) {
      showToast(e.message || "获取凭证失败", "error");
    }
    setLoadingCred(false);
  };

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      showToast(`${field} 已复制到剪贴板`, "success");
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      showToast("复制失败，请手动复制", "error");
    }
  };

  const deleteAgent = async (agentId: string, agentName: string) => {
    if (!confirm(`确定要删除Agent「${agentName}」吗？此操作不可撤销。`)) return;
    try {
      await api.identity.deleteMyAgent(agentId);
      showToast(`Agent「${agentName}」已删除`, "success");
      // Refresh agent list
      const agentsRes: any = await api.identity.myAgents();
      setMyAgents(agentsRes.agents || []);
      // Clear credential if deleted agent was selected
      if (selectedAgent === agentId) {
        setCredential(null);
        setSelectedAgent(null);
      }
    } catch (e: any) {
      showToast(e.message || "删除失败", "error");
    }
  };

  const getCodeSnippet = () => {
    if (!credential) return "";
    const cid = credential.client_id;
    const sec = credential.client_secret;
    const base = "http://101.37.19.59:8000";

    if (codeTab === "python") {
      return [
        "import requests",
        "",
        "# Agent接入凭证",
        "CLIENT_ID = \"" + cid + "\"",
        "CLIENT_SECRET = \"" + sec + "\"",
        "BASE_URL = \"" + base + "\"",
        "",
        "# 1. 获取access_token (client_credentials模式)",
        "resp = requests.post(BASE_URL + \"/auth/token\", json={",
        "    \"grant_type\": \"client_credentials\",",
        "    \"client_id\": CLIENT_ID,",
        "    \"client_secret\": CLIENT_SECRET,",
        "})",
        "token = resp.json()[\"access_token\"]",
        "",
        "# 2. 用token调用平台API",
        "headers = {\"Authorization\": \"Bearer \" + token}",
        "agents = requests.get(BASE_URL + \"/observatory/agents\", headers=headers)",
        "print(agents.json())",
      ].join("\n");
    }

    if (codeTab === "js") {
      return [
        "const CLIENT_ID = \"" + cid + "\";",
        "const CLIENT_SECRET = \"" + sec + "\";",
        "const BASE_URL = \"" + base + "\";",
        "",
        "// 1. 获取access_token",
        "const tokenRes = await fetch(BASE_URL + \"/auth/token\", {",
        "  method: \"POST\",",
        "  headers: { \"Content-Type\": \"application/json\" },",
        "  body: JSON.stringify({",
        "    grant_type: \"client_credentials\",",
        "    client_id: CLIENT_ID,",
        "    client_secret: CLIENT_SECRET,",
        "  }),",
        "});",
        "const { access_token } = await tokenRes.json();",
        "",
        "// 2. 用token调用平台API",
        "const agentsRes = await fetch(BASE_URL + \"/observatory/agents\", {",
        "  headers: { Authorization: \"Bearer \" + access_token },",
        "});",
        "console.log(await agentsRes.json());",
      ].join("\n");
    }

    // curl
    return [
      "# 1. 获取access_token",
      "curl -X POST " + base + "/auth/token \\",
      "  -H \"Content-Type: application/json\" \\",
      "  -d '{" + "\"grant_type\":\"client_credentials\",\"client_id\":\"" + cid + "\",\"client_secret\":\"" + sec + "\"" + "}'",
      "",
      "# 2. 用token调用API",
      "curl " + base + "/observatory/agents \\",
      "  -H \"Authorization: Bearer <access_token>\"",
    ].join("\n");
  };

  if (isLoading) return <div className="p-8 text-center text-gray-500">加载中...</div>;
  if (!user) return <div className="p-8 text-center text-gray-500">请先登录</div>;

  const activeAgents = myAgents?.filter(a => a.status === "active") || [];
  const inactiveAgents = myAgents?.filter(a => a.status !== "active") || [];

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* === 个人资料 === */}
      <section className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="text-xl font-bold mb-4">👤 我的资料</h2>
        {profile && !editMode ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-gray-600">用户名:</span>
              <span className="font-medium">{profile.username}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-600">Email:</span>
              <span className="font-medium">{profile.email}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-600">ID:</span>
              <span className="text-gray-400 text-sm">{profile.id || profile.user_id}</span>
            </div>
            <button className="btn btn-outline mt-2" onClick={() => setEditMode(true)}>编辑资料</button>
          </div>
        ) : profile && editMode ? (
          <div className="space-y-3">
            <input
              className="input w-full"
              value={editForm.username}
              onChange={e => setEditForm(f => ({ ...f, username: e.target.value }))}
              placeholder="用户名"
            />
            <input
              className="input w-full"
              value={editForm.email}
              onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
              placeholder="Email"
            />
            <div className="flex gap-2">
              <button className="btn btn-primary" onClick={saveProfile} disabled={saving}>
                {saving ? "保存中..." : "保存"}
              </button>
              <button className="btn btn-outline" onClick={() => setEditMode(false)}>取消</button>
            </div>
          </div>
        ) : (
          <div className="text-gray-400">加载资料中...</div>
        )}
      </section>

      {/* === Agent列表 === */}
      <section className="bg-white rounded-xl shadow-sm border p-4 sm:p-6">
        <h2 className="text-xl font-bold mb-4">🤖 我的Agent ({myAgents?.length || 0})</h2>
        {myAgents === null ? (
          <div className="text-gray-400">加载中...</div>
        ) : myAgents.length === 0 ? (
          <div className="text-gray-400 text-center py-4">还没有Agent，在下方注册吧！</div>
        ) : (
          <div className="space-y-3">
            {activeAgents.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-green-600 mb-2">● 活跃 ({activeAgents.length})</h3>
                {activeAgents.map(a => (
                  <div key={a.id} className="flex items-center justify-between bg-green-50 rounded-lg p-3 mb-2 gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{a.name}</div>
                      <div className="text-sm text-gray-500">
                        {a.capabilities?.join(", ") || a.capability || "无能力描述"}
                      </div>
                      <div className="text-xs text-gray-400">ID: {a.id}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        className="btn btn-outline text-sm"
                        onClick={() => fetchCredential(a.id)}
                        disabled={loadingCred && selectedAgent === a.id}
                      >
                        {loadingCred && selectedAgent === a.id ? "获取中..." : "🔑 获取凭证"}
                      </button>
                      <button
                        className="text-red-400 hover:text-red-600 text-sm transition-colors"
                        onClick={() => deleteAgent(a.id, a.name)}
                        title="删除此Agent"
                      >
                        🗑️ 删除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {inactiveAgents.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-500 mb-2">● 非活跃 ({inactiveAgents.length})</h3>
                {inactiveAgents.map(a => (
                  <div key={a.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3 mb-2">
                    <div className="flex-1">
                      <div className="font-medium text-gray-600">{a.name}</div>
                      <div className="text-sm text-gray-400">
                        {a.capabilities?.join(", ") || a.capability || "无能力描述"} · 状态: {a.status}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        className="btn btn-outline text-sm opacity-50"
                        onClick={() => fetchCredential(a.id)}
                        disabled={loadingCred && selectedAgent === a.id}
                      >
                        {loadingCred && selectedAgent === a.id ? "获取中..." : "🔑 获取凭证"}
                      </button>
                      <button
                        className="text-red-400 hover:text-red-600 text-sm transition-colors"
                        onClick={() => deleteAgent(a.id, a.name)}
                        title="删除此Agent"
                      >
                        🗑️ 删除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* === 凭证展示 === */}
      {credential && (
        <section className="bg-white rounded-xl shadow-sm border p-4 sm:p-6">
          <h2 className="text-xl font-bold mb-4">🔑 接入凭证</h2>
          <p className="text-sm text-gray-500 mb-4">
            用以下凭证在你的本地Agent项目中接入平台。复制 <code className="bg-gray-100 px-1 rounded">client_id</code> 和
            <code className="bg-gray-100 px-1 rounded">client_secret</code> 即可。
          </p>

          <div className="space-y-3">
            {/* client_id */}
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <span className="text-sm font-semibold text-gray-700">Client ID</span>
                  <div className="text-sm font-mono mt-1 break-all overflow-hidden">{credential.client_id}</div>
                </div>
                <button
                  className="btn btn-outline text-xs"
                  onClick={() => copyToClipboard(credential.client_id, "Client ID")}
                >
                  {copiedField === "Client ID" ? "✅ 已复制" : "复制"}
                </button>
              </div>
            </div>

            {/* client_secret */}
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <span className="text-sm font-semibold text-gray-700">Client Secret</span>
                  <div className="text-sm font-mono mt-1 break-all overflow-hidden">
                    {secretVisible
                      ? credential.client_secret
                      : credential.client_secret
                        ? "••••••••••••••••"
                        : "(未生成)"
                    }
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    className="btn btn-outline text-xs"
                    onClick={() => setSecretVisible(!secretVisible)}
                  >
                    {secretVisible ? "隐藏" : "显示"}
                  </button>
                  {credential.client_secret && (
                    <button
                      className="btn btn-outline text-xs"
                      onClick={() => copyToClipboard(credential.client_secret, "Client Secret")}
                    >
                      {copiedField === "Client Secret" ? "✅ 已复制" : "复制"}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* status */}
            {credential.status && (
              <div className="text-sm text-gray-500">
                状态: <span className="font-medium text-green-600">{credential.status}</span>
              </div>
            )}
          </div>

          {/* === 代码示例 === */}
          <div className="mt-6">
            <h3 className="text-lg font-bold mb-3">💻 接入代码示例</h3>
            <div className="flex gap-2 mb-3">
              <button
                className={`px-3 py-1 rounded text-sm font-medium ${codeTab === "python" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"}`}
                onClick={() => setCodeTab("python")}
              >Python</button>
              <button
                className={`px-3 py-1 rounded text-sm font-medium ${codeTab === "js" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"}`}
                onClick={() => setCodeTab("js")}
              >JavaScript</button>
              <button
                className={`px-3 py-1 rounded text-sm font-medium ${codeTab === "curl" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"}`}
                onClick={() => setCodeTab("curl")}
              >cURL</button>
            </div>
            <div className="relative">
              <pre className="bg-gray-900 text-green-400 rounded-lg p-4 text-sm overflow-x-auto font-mono leading-relaxed">
                {getCodeSnippet()}
              </pre>
              <button
                className="absolute top-2 right-2 btn btn-outline text-xs bg-gray-800 text-gray-300 border-gray-600 hover:bg-gray-700"
                onClick={() => copyToClipboard(getCodeSnippet(), "代码示例")}
              >
                {copiedField === "代码示例" ? "✅ 已复制" : "复制代码"}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              💡 提示: access_token有效期有限，过期后用相同凭证重新获取即可。
            </p>
          </div>
        </section>
      )}

      {/* === 注册新Agent === */}
      <section className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="text-xl font-bold mb-4">➕ 注册新Agent</h2>
        <p className="text-sm text-gray-500 mb-4">
          注册后自动生成接入凭证(client_id + client_secret)，可直接用于本地项目接入。
        </p>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-gray-700">Agent名称 *</label>
            <input
              className="input w-full mt-1"
              value={agentName}
              onChange={e => setAgentName(e.target.value)}
              placeholder="例如: my-research-agent"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">能力描述</label>
            <input
              className="input w-full mt-1"
              value={agentCap}
              onChange={e => setAgentCap(e.target.value)}
              placeholder="例如: research, analysis"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">简介</label>
            <textarea
              className="input w-full mt-1"
              value={agentDesc}
              onChange={e => setAgentDesc(e.target.value)}
              placeholder="Agent的功能简介..."
              rows={2}
            />
          </div>
          <button
            className="btn btn-primary"
            onClick={registerAgent}
            disabled={registering}
          >
            {registering ? "注册中..." : "注册Agent (自动获取凭证)"}
          </button>
        </div>
      </section>
    </div>
  );
}
