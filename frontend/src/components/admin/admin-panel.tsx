"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/components/common/toast";

interface AuditEntry {
  id: string;
  event_type: string;
  target_type?: string;
  target_id?: string;
  detail?: string;
  created_at?: string;
}

export function AdminPanel() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);

  // Freeze/Unfreeze forms
  const [accountId, setAccountId] = useState("");
  const [freezeReason, setFreezeReason] = useState("");
  const [unfreezeAccountId, setUnfreezeAccountId] = useState("");
  const [unfreezeReason, setUnfreezeReason] = useState("");
  const [brakeReason, setBrakeReason] = useState("");
  const [brakeScope, setBrakeScope] = useState("all");
  const [acting, setActing] = useState(false);

  useEffect(() => {
    loadAuditLog();
  }, []);

  const loadAuditLog = async () => {
    try {
      setLoading(true);
      const data = await api.admin.getAuditLog() as any;
      setAuditLog(data.items || data || []);
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const freeze = async () => {
    if (!accountId.trim() || !freezeReason.trim()) {
      showToast("请填写账户ID和原因", "error");
      return;
    }
    try {
      setActing(true);
      await api.admin.freezeAccount(accountId, { reason: freezeReason });
      showToast("冻结成功", "success");
      setAccountId("");
      setFreezeReason("");
      loadAuditLog();
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setActing(false);
    }
  };

  const unfreeze = async () => {
    if (!unfreezeAccountId.trim() || !unfreezeReason.trim()) {
      showToast("请填写账户ID和原因", "error");
      return;
    }
    try {
      setActing(true);
      await api.admin.unfreezeAccount(unfreezeAccountId, { reason: unfreezeReason });
      showToast("解冻成功", "success");
      setUnfreezeAccountId("");
      setUnfreezeReason("");
      loadAuditLog();
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setActing(false);
    }
  };

  const brake = async () => {
    if (!brakeReason.trim()) {
      showToast("请填写制动原因", "error");
      return;
    }
    try {
      setActing(true);
      await api.admin.brake({ scope: brakeScope, reason: brakeReason });
      showToast("紧急制动已执行", "success");
      setBrakeReason("");
      loadAuditLog();
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setActing(false);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <p className="text-gray-500">请先登录</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-bold">🛡️ 管理面板</h1>

      {/* Freeze */}
      <section className="card p-6 border-l-4 border-red-500">
        <h2 className="text-xl font-semibold mb-4">❄️ 冻结账户</h2>
        <div className="space-y-3">
          <input className="input-field" placeholder="账户ID" value={accountId} onChange={(e) => setAccountId(e.target.value)} />
          <input className="input-field" placeholder="原因" value={freezeReason} onChange={(e) => setFreezeReason(e.target.value)} />
          <button className="btn bg-red-600 text-white hover:bg-red-700" onClick={freeze} disabled={acting}>冻结</button>
        </div>
      </section>

      {/* Unfreeze */}
      <section className="card p-6 border-l-4 border-green-500">
        <h2 className="text-xl font-semibold mb-4">🔓 解冻账户</h2>
        <div className="space-y-3">
          <input className="input-field" placeholder="账户ID" value={unfreezeAccountId} onChange={(e) => setUnfreezeAccountId(e.target.value)} />
          <input className="input-field" placeholder="原因" value={unfreezeReason} onChange={(e) => setUnfreezeReason(e.target.value)} />
          <button className="btn btn-primary" onClick={unfreeze} disabled={acting}>解冻</button>
        </div>
      </section>

      {/* Emergency Brake */}
      <section className="card p-6 border-l-4 border-yellow-500">
        <h2 className="text-xl font-semibold mb-4">🚨 紧急制动 (仅super_admin)</h2>
        <div className="space-y-3">
          <select className="input-field" value={brakeScope} onChange={(e) => setBrakeScope(e.target.value)}>
            <option value="all">全部</option>
            <option value="agents">仅Agent</option>
            <option value="organizations">仅组织</option>
          </select>
          <input className="input-field" placeholder="原因" value={brakeReason} onChange={(e) => setBrakeReason(e.target.value)} />
          <button className="btn bg-yellow-600 text-white hover:bg-yellow-700" onClick={brake} disabled={acting}>制动</button>
        </div>
      </section>

      {/* Audit Log */}
      <section className="card p-6">
        <h2 className="text-xl font-semibold mb-4">📋 审计日志</h2>
        {loading ? (
          <p className="text-gray-500">加载中...</p>
        ) : auditLog.length === 0 ? (
          <p className="text-gray-500">暂无审计日志</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {auditLog.map((entry) => (
              <div key={entry.id} className="border rounded p-3 text-sm">
                <span className="font-medium">{entry.event_type}</span>
                {entry.target_type && <span className="text-gray-500 ml-2">→ {entry.target_type}:{entry.target_id?.slice(0,8)}</span>}
                {entry.detail && <span className="text-gray-400 ml-2">{entry.detail}</span>}
                <span className="text-gray-400 ml-2 float-right">{entry.created_at?.slice(0,19)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
