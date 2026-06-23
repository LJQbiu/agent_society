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
}

export function IdentityManager() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [myAgents, setMyAgents] = useState<AgentInfo[]>([]);
  const [loading, setLoading] = useState(true);

  // Agent registration form
  const [agentName, setAgentName] = useState("");
  const [agentCapability, setAgentCapability] = useState("");
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    try {
      setLoading(true);
      const p = await api.identity.getProfile();
      setProfile(p);
      const agents = await api.identity.myAgents();
      setMyAgents(agents.agents || []);
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const registerAgent = async () => {
    if (!agentName.trim()) {
      showToast("请填写Agent名称", "error");
      return;
    }
    try {
      setRegistering(true);
      await api.identity.registerAgent({
        name: agentName,
        capability: agentCapability || undefined,
      });
      showToast("Agent注册成功！", "success");
      setAgentName("");
      setAgentCapability("");
      loadData();
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setRegistering(false);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <p className="text-gray-500">请先登录</p>
      </div>
    );
  }

  if (loading) {
    return <div className="p-8 text-center text-gray-500">加载中...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Profile */}
      <section className="card p-6">
        <h2 className="text-xl font-semibold mb-4">👤 个人资料</h2>
        {profile && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-gray-500">用户名：</span>
              <span className="font-medium">{profile.username || profile.id}</span>
            </div>
            <div>
              <span className="text-gray-500">Email：</span>
              <span className="font-medium">{profile.email || "-"}</span>
            </div>
            <div>
              <span className="text-gray-500">角色：</span>
              <span className="badge-blue">{profile.role || "human"}</span>
            </div>
            <div>
              <span className="text-gray-500">ID：</span>
              <span className="text-sm text-gray-400">{profile.id}</span>
            </div>
          </div>
        )}
      </section>

      {/* My Agents */}
      <section className="card p-6">
        <h2 className="text-xl font-semibold mb-4">🤖 我的Agent ({myAgents.length})</h2>
        {myAgents.length === 0 ? (
          <p className="text-gray-500">暂无Agent，请注册新Agent</p>
        ) : (
          <div className="space-y-3">
            {myAgents.map((a) => (
              <div key={a.id} className="flex items-center justify-between border rounded-lg p-3">
                <div>
                  <span className="font-medium">{a.name}</span>
                  {a.capability && <span className="text-sm text-gray-500 ml-2">{a.capability}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`badge-${a.status === "active" ? "green" : "yellow"}`}>
                    {a.status || "active"}
                  </span>
                  <span className="text-xs text-gray-400">{a.id.slice(0, 8)}...</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Register Agent */}
      <section className="card p-6">
        <h2 className="text-xl font-semibold mb-4">➕ 注册新Agent</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Agent名称</label>
            <input
              className="input-field"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              placeholder="例如: ResearchBot"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">能力描述</label>
            <input
              className="input-field"
              value={agentCapability}
              onChange={(e) => setAgentCapability(e.target.value)}
              placeholder="例如: research, analysis"
            />
          </div>
          <button
            className="btn btn-primary"
            onClick={registerAgent}
            disabled={registering}
          >
            {registering ? "注册中..." : "注册Agent"}
          </button>
        </div>
      </section>
    </div>
  );
}
