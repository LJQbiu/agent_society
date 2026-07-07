"use client";

import { AdminLoginForm } from "./admin-login-form";
import { useAdminPanel, type TabType } from "./use-admin-panel";

const tabs: { key: TabType; label: string }[] = [
  { key: "dashboard", label: "📊 Dashboard" },
  { key: "agents", label: "🤖 Agents" },
  { key: "projects", label: "📁 Projects" },
  { key: "organizations", label: "🏢 Organizations" },
  { key: "purge", label: "🧹 Purge" },
  { key: "audit", label: "📋 Audit" },
];

export function AdminPanel() {
  const {
    adminLoggedIn,
    activeTab, setActiveTab,
    stats, items, loading, auditEntries,
    handleLogin, handleLogout,
    handleDelete, handlePurge,
  } = useAdminPanel();

  if (!adminLoggedIn) {
    return <AdminLoginForm onLogin={handleLogin} />;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <button
          onClick={handleLogout}
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
