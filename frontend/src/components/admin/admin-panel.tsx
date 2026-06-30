"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/common/toast";
import type { DashboardStats, AdminListItem, AuditLogEvent } from "@/types";

type TabType = "dashboard" | "agents" | "projects" | "organizations" | "purge" | "audit";

export function AdminPanel() {
  const { showToast } = useToast();
  // Admin auth: check localStorage for admin_token
  const [adminLoggedIn, setAdminLoggedIn] = useState(false);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  useEffect(() => {
    setAdminLoggedIn(Boolean(localStorage.getItem("admin_token")));
  }, []);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError("");
    try {
      await api.admin.login({ username: loginUsername, password: loginPassword });
      setAdminLoggedIn(true);
      showToast("Admin登录成功", "success");
    } catch (err: any) {
      setLoginError(err.message || "登录失败");
      showToast("Admin登录失败: " + (err.message || "未知错误"), "error");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleAdminLogout = () => {
    api.admin.logout();
    setAdminLoggedIn(false);
    setStats(null);
    setItems([]);
    setAuditEntries([]);
    showToast("已退出Admin", "success");
  };
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [items, setItems] = useState<AdminListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [auditEntries, setAuditEntries] = useState<AuditLogEvent[]>([]);

  // Dashboard stats
  useEffect(() => {
    if (activeTab === "dashboard") loadDashboard();
  }, [activeTab]);

  // List items
  useEffect(() => {
    if (["agents", "projects", "organizations"].includes(activeTab)) loadList(activeTab);
  }, [activeTab]);

  // Audit log
  useEffect(() => {
    if (activeTab === "audit") loadAudit();
  }, [activeTab]);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const res = await api.admin.dashboard();
      setStats(res.stats);
    } catch (e: any) {
      showToast("加载dashboard失败: " + (e.message || "未知错误"), "error");
    } finally {
      setLoading(false);
    }
  };

  const loadList = async (type: TabType) => {
    setLoading(true);
    try {
      let res;
      if (type === "agents") res = await api.admin.listAgents();
      else if (type === "projects") res = await api.admin.listProjects();
      else res = await api.admin.listOrganizations();
      if (type === "agents") setItems(res.agents || []);
      else if (type === "projects") setItems(res.projects || []);
      else setItems(res.organizations || []);
    } catch (e: any) {
      showToast("加载列表失败: " + (e.message || "未知错误"), "error");
    } finally {
      setLoading(false);
    }
  };

  const loadAudit = async () => {
    setLoading(true);
    try {
      const res = await api.admin.getAuditLog();
      setAuditEntries(res.events || []);
    } catch (e: any) {
      showToast("加载审计日志失败: " + (e.message || "未知错误"), "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (type: "agent" | "project" | "organization", id: string, name: string) => {
    if (!confirm(`确认删除 ${type} "${name}"？此操作不可撤销！`)) return;
    try {
      let res;
      if (type === "agent") res = await api.admin.deleteAgent(id);
      else if (type === "project") res = await api.admin.deleteProject(id);
      else res = await api.admin.deleteOrganization(id);
      showToast(res.message || "删除成功", "success");
      loadList(activeTab);
    } catch (e: any) {
      showToast("删除失败: " + (e.message || "未知错误"), "error");
    }
  };

  const handlePurge = async () => {
    const scope = prompt("输入清理范围(agents/projects/organizations/all)，默认all:", "all");
    if (scope === null) return;
    const filter = prompt("输入过滤类型(test/inactive/all)，默认all:", "all");
    if (filter === null) return;
    if (!confirm(`确认批量清理？scope=${scope}, filter="${filter}"。此操作不可撤销！`)) return;
    try {
      const res = await api.admin.purge({ scope: scope || "all", filter: filter || "all", confirm: true });
      showToast(res.message || "清理完成", "success");
    } catch (e: any) {
      showToast("清理失败: " + (e.message || "未知错误"), "error");
    }
  };

  const tabs: { key: TabType; label: string }[] = [
    { key: "dashboard", label: "📊 Dashboard" },
    { key: "agents", label: "🤖 Agents" },
    { key: "projects", label: "📁 Projects" },
    { key: "organizations", label: "🏢 Organizations" },
    { key: "purge", label: "🧹 Purge" },
    { key: "audit", label: "📋 Audit" },
  ];

  // Show login form if not authenticated
  if (!adminLoggedIn) {
    return (
      <div className="p-6 max-w-md mx-auto mt-20">
        <h1 className="text-2xl font-bold mb-6 text-center">🔐 Admin 登录</h1>
        <form onSubmit={handleAdminLogin} className="bg-white rounded-lg shadow p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">用户名</label>
            <input
              type="text"
              value={loginUsername}
              onChange={e => setLoginUsername(e.target.value)}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="super_admin"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
            <input
              type="password"
              value={loginPassword}
              onChange={e => setLoginPassword(e.target.value)}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Admin123!@#"
              required
            />
          </div>
          {loginError && <div className="text-red-500 text-sm">{loginError}</div>}
          <button
            type="submit"
            disabled={loginLoading}
            className="w-full bg-blue-600 text-white py-2 rounded font-medium hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loginLoading ? "登录中..." : "登录"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <button
          onClick={handleAdminLogout}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300 transition"
        >
          🚪 退出登录
        </button>
      </div>
      <div className="flex gap-2 mb-6 border-b pb-2">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 rounded-t text-sm font-medium transition ${
              activeTab === t.key
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && <div className="text-center py-8 text-gray-400">Loading...</div>}

      {/* Dashboard Stats */}
      {activeTab === "dashboard" && stats && !loading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "总Agent数", value: stats.total_agents, sub: `活跃: ${stats.active_agents}` },
            { label: "总Project数", value: stats.total_projects, sub: `活跃: ${stats.active_projects}` },
            { label: "总Organization数", value: stats.total_organizations, sub: `活跃: ${stats.active_organizations}` },
            { label: "总Human数", value: stats.total_humans, sub: `消息: ${stats.total_messages}` },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">{card.label}</div>
              <div className="text-3xl font-bold text-blue-600">{card.value}</div>
              <div className="text-xs text-gray-400 mt-1">{card.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* List View (agents/projects/organizations) */}
      {["agents", "projects", "organizations"].includes(activeTab) && !loading && (
        <div>
          {items.length === 0 ? (
            <div className="text-center py-8 text-gray-400">暂无数据</div>
          ) : (
            <div className="space-y-2">
              {items.map(item => (
                <div key={item.id} className="bg-white rounded-lg shadow p-3 flex items-center justify-between">
                  <div>
                    <span className="font-medium">{item.name}</span>
                    <span className={`ml-2 px-2 py-0.5 rounded text-xs ${
                      item.status === "active" ? "bg-green-100 text-green-700"
                        : item.status === "inactive" ? "bg-gray-100 text-gray-500"
                        : "bg-yellow-100 text-yellow-700"
                    }`}>{item.status}</span>
                    {item.owner_name && <span className="ml-2 text-sm text-gray-400">owner: {item.owner_name}</span>}
                    {item.created_at && <span className="ml-2 text-xs text-gray-400">{item.created_at.slice(0, 10)}</span>}
                  </div>
                  <button
                    onClick={() => handleDelete(activeTab === "agents" ? "agent" : activeTab === "projects" ? "project" : "organization", item.id, item.name)}
                    className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600 transition"
                  >
                    🗑️ Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Purge */}
      {activeTab === "purge" && !loading && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold mb-4">🧹 批量清理不活跃数据</h2>
          <p className="text-gray-500 mb-4">
            可按时间范围和状态批量删除不活跃的agents、projects、organizations及其关联数据。
          </p>
          <button
            onClick={handlePurge}
            className="px-6 py-2 bg-red-600 text-white rounded font-medium hover:bg-red-700 transition"
          >
            🧹 开始清理
          </button>
        </div>
      )}

      {/* Audit Log */}
      {activeTab === "audit" && !loading && (
        <div>
          {auditEntries.length === 0 ? (
            <div className="text-center py-8 text-gray-400">暂无审计记录</div>
          ) : (
            <div className="space-y-2">
              {auditEntries.map((entry, i) => (
                <div key={entry.event_id || i} className="bg-white rounded shadow p-3 flex items-center justify-between">
                  <div>
                    <span className="font-medium text-blue-600">{entry.event_type}</span>
                    {entry.target_type && <span className="ml-2 text-sm text-gray-500">{entry.target_type}: {entry.target_id?.slice(0,8)}...</span>}
                    {entry.details && <span className="ml-2 text-gray-400">({Object.values(entry.details).join(", ")})</span>}
                  </div>
                  <span className="text-xs text-gray-400">{entry.created_at?.slice(0, 19)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
