"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { BalanceResponse, TransactionResponse, TransactionListResponse } from "@/types";
import { useAuth } from "@/hooks/use-auth";

export function WalletView() {
  const { user } = useAuth();
  const [holderId, setHolderId] = useState("");
  const [holderType, setHolderType] = useState<"agent" | "organization">("agent");
  const [balance, setBalance] = useState<BalanceResponse | null>(null);
  const [transactions, setTransactions] = useState<TransactionResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Deposit form
  const [depositAmount, setDepositAmount] = useState("");
  const [depositDesc, setDepositDesc] = useState("");

  // Transfer form
  const [transferTo, setTransferTo] = useState("");
  const [transferToType, setTransferToType] = useState<"agent" | "organization">("agent");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferDesc, setTransferDesc] = useState("");

  const fetchBalance = async () => {
    if (!holderId) return;
    setLoading(true);
    setError("");
    try {
      const data = await api.settlement.getBalance(holderId, holderType);
      setBalance(data);
    } catch (e: any) {
      setError(e.message || "查询余额失败");
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async () => {
    if (!holderId) return;
    try {
      const data = await api.settlement.getTransactions(holderId, { holder_type: holderType, limit: 20 });
      setTransactions(data.transactions);
    } catch (e: any) {
      setError(e.message || "查询交易记录失败");
    }
  };

  const handleDeposit = async () => {
    if (!holderId || !depositAmount) return;
    setLoading(true);
    setError("");
    try {
      await api.settlement.deposit({
        holder_id: holderId,
        holder_type: holderType,
        amount: parseFloat(depositAmount),
        description: depositDesc || "充值",
      });
      setDepositAmount("");
      setDepositDesc("");
      await fetchBalance();
      await fetchTransactions();
    } catch (e: any) {
      setError(e.message || "充值失败");
    } finally {
      setLoading(false);
    }
  };

  const handleTransfer = async () => {
    if (!holderId || !transferTo || !transferAmount) return;
    setLoading(true);
    setError("");
    try {
      await api.settlement.transfer({
        from_holder_id: holderId,
        from_holder_type: holderType,
        to_holder_id: transferTo,
        to_holder_type: transferToType,
        amount: parseFloat(transferAmount),
        description: transferDesc || "转账",
      });
      setTransferTo("");
      setTransferAmount("");
      setTransferDesc("");
      await fetchBalance();
      await fetchTransactions();
    } catch (e: any) {
      setError(e.message || "转账失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (holderId) {
      fetchBalance();
      fetchTransactions();
    }
  }, [holderId, holderType]);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">💰 Token钱包</h2>

      {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}

      {/* Holder selector */}
      <div className="card p-4 mb-6">
        <h3 className="font-semibold mb-3">选择账户</h3>
        <div className="flex gap-3 items-center">
          <input
            value={holderId}
            onChange={e => setHolderId(e.target.value)}
            placeholder="输入 Agent/Organization ID"
            className="input flex-1"
          />
          <select value={holderType} onChange={e => setHolderType(e.target.value as "agent" | "organization")} className="input">
            <option value="agent">Agent</option>
            <option value="organization">Organization</option>
          </select>
          <button onClick={fetchBalance} className="btn btn-primary" disabled={!holderId || loading}>
            查询
          </button>
        </div>
      </div>

      {/* Balance display */}
      {balance && (
        <div className="card p-4 mb-6">
          <h3 className="font-semibold mb-2">余额信息</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-gray-500 text-sm">余额</p>
              <p className="text-2xl font-bold text-green-600">{balance.balance} Token</p>
            </div>
            <div>
              <p className="text-gray-500 text-sm">冻结状态</p>
              <p className="text-xl font-bold">{balance.frozen ? "❌ 已冻结" : "✅ 正常"}</p>
            </div>
          </div>
          <p className="text-gray-400 text-xs mt-2">类型: {balance.holder_type}</p>
        </div>
      )}

      {/* Deposit form */}
      <div className="card p-4 mb-6">
        <h3 className="font-semibold mb-3">充值</h3>
        <div className="flex gap-3 items-center">
          <input
            value={depositAmount}
            onChange={e => setDepositAmount(e.target.value)}
            placeholder="金额"
            type="number"
            className="input flex-1"
          />
          <input
            value={depositDesc}
            onChange={e => setDepositDesc(e.target.value)}
            placeholder="描述(可选)"
            className="input flex-1"
          />
          <button onClick={handleDeposit} className="btn btn-primary" disabled={!depositAmount || loading}>
            充值
          </button>
        </div>
      </div>

      {/* Transfer form */}
      <div className="card p-4 mb-6">
        <h3 className="font-semibold mb-3">转账</h3>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <input
            value={transferTo}
            onChange={e => setTransferTo(e.target.value)}
            placeholder="对方ID"
            className="input"
          />
          <select value={transferToType} onChange={e => setTransferToType(e.target.value as "agent" | "organization")} className="input">
            <option value="agent">Agent</option>
            <option value="organization">Organization</option>
          </select>
        </div>
        <div className="flex gap-3 items-center">
          <input
            value={transferAmount}
            onChange={e => setTransferAmount(e.target.value)}
            placeholder="金额"
            type="number"
            className="input flex-1"
          />
          <input
            value={transferDesc}
            onChange={e => setTransferDesc(e.target.value)}
            placeholder="描述(可选)"
            className="input flex-1"
          />
          <button onClick={handleTransfer} className="btn btn-primary" disabled={!transferTo || !transferAmount || loading}>
            转账
          </button>
        </div>
      </div>

      {/* Transaction history */}
      {transactions.length > 0 && (
        <div className="card p-4">
          <h3 className="font-semibold mb-3">交易记录</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 border-b">
                <th>时间</th>
                <th>类型</th>
                <th>金额</th>
                <th>描述</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(t => (
                <tr key={t.id} className="border-b hover:bg-gray-50">
                  <td className="py-2">{t.created_at?.slice(0, 19) || "-"}</td>
                  <td>{t.transaction_type}</td>
                  <td className={t.transaction_type === "deposit" || t.transaction_type === "reward" ? "text-green-600" : "text-red-500"}>
                    {t.amount}
                  </td>
                  <td className="truncate max-w-[200px]">{t.description}</td>
                  <td>{t.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
