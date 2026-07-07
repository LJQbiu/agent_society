"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/common/toast";
import type { DashboardStats, AdminListItem, AuditLogEvent } from "@/types";

export type TabType = "dashboard" | "agents" | "projects" | "organizations" | "purge" | "audit";

function getErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "未知错误";
}

export function useAdminPanel() {
  const { showToast } = useToast();
  const [adminLoggedIn, setAdminLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [items, setItems] = useState<AdminListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [auditEntries, setAuditEntries] = useState<AuditLogEvent[]>([]);

  useEffect(() => {
    setAdminLoggedIn(Boolean(localStorage.getItem("admin_token")));
  }, []);

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

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.admin.dashboard();
      setStats(res.stats);
    } catch (e: unknown) {
      showToast("加载dashboard失败: " + getErrorMessage(e), "error");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadList = useCallback(async (type: TabType) => {
    setLoading(true);
    try {
      let res;
      if (type === "agents") res = await api.admin.listAgents();
      else if (type === "projects") res = await api.admin.listProjects();
      else res = await api.admin.listOrganizations();
      if (type === "agents") setItems(res.agents || []);
      else if (type === "projects") setItems(res.projects || []);
      else setItems(res.organizations || []);
    } catch (e: unknown) {
      showToast("加载列表失败: " + getErrorMessage(e), "error");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAudit = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.admin.getAuditLog();
      setAuditEntries(res.events || []);
    } catch (e: unknown) {
      showToast("加载审计日志失败: " + getErrorMessage(e), "error");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLogin = useCallback(async (username: string, password: string): Promise<boolean> => {
    try {
      await api.admin.login({ username, password });
      setAdminLoggedIn(true);
      showToast("Admin登录成功", "success");
      return true;
    } catch (e: unknown) {
      showToast("Admin登录失败: " + getErrorMessage(e), "error");
      return false;
    }
  }, []);

  const handleLogout = useCallback(() => {
    api.admin.logout();
    setAdminLoggedIn(false);
    setStats(null);
    setItems([]);
    setAuditEntries([]);
    showToast("已退出Admin", "success");
  }, []);

  const handleDelete = useCallback(async (type: "agent" | "project" | "organization", id: string, name: string) => {
    if (!confirm(`确认删除 ${type} "${name}"？此操作不可撤销！`)) return;
    try {
      let res;
      if (type === "agent") res = await api.admin.deleteAgent(id);
      else if (type === "project") res = await api.admin.deleteProject(id);
      else res = await api.admin.deleteOrganization(id);
      showToast(res.message || "删除成功", "success");
      loadList(activeTab);
    } catch (e: unknown) {
      showToast("删除失败: " + getErrorMessage(e), "error");
    }
  }, [activeTab]);

  const handlePurge = useCallback(async () => {
    const scope = prompt("输入清理范围(agents/projects/organizations/all)，默认all:", "all");
    if (scope === null) return;
    const filter = prompt("输入过滤类型(test/inactive/all)，默认all:", "all");
    if (filter === null) return;
    if (!confirm(`确认批量清理？scope=${scope}, filter="${filter}"。此操作不可撤销！`)) return;
    try {
      const res = await api.admin.purge({ scope: scope || "all", filter: filter || "all", confirm: true });
      showToast(res.message || "清理完成", "success");
    } catch (e: unknown) {
      showToast("清理失败: " + getErrorMessage(e), "error");
    }
  }, []);

  return {
    adminLoggedIn,
    activeTab, setActiveTab,
    stats, items, loading, auditEntries,
    handleLogin, handleLogout,
    handleDelete, handlePurge,
  };
}
