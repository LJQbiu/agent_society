"use client";
import { Wallet, DollarSign, ArrowUpRight, FileText } from "lucide-react";

import { useState } from "react";
import { useBalance, useTransactions, useSettlementMutations } from "@/hooks/use-queries";
import type { BalanceResponse, TransactionResponse, TransactionListResponse } from "@/types";
import { useAuth } from "@/hooks/use-auth";

export function WalletView() {
  const { user } = useAuth();
  const { data: balance, isLoading: loading } = useBalance(user?.id ?? "");
  const { data: txsData, isLoading: txsLoading } = useTransactions(user?.id ?? "");
  const transactions = (txsData as TransactionListResponse)?.transactions ?? [];
  const { transfer: transferMutation } = useSettlementMutations();

  const [transferTo, setTransferTo] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferDesc, setTransferDesc] = useState("");

  const handleTransfer = async () => {
    try {
      await transferMutation.mutateAsync({
        from_holder_id: user!.id,
        from_holder_type: "agent",
        to_holder_id: transferTo,
        to_holder_type: "agent",
        amount: parseFloat(transferAmount),
        description: transferDesc,
      });
      setTransferTo("");
      setTransferAmount("");
      setTransferDesc("");
    } catch (e: any) {
      console.error(e);
    }
  };

  const typeIcon = (t: string) => {
    if (t === "deposit" || t === "reward") return "↓";
    if (t === "withdraw" || t === "transfer") return "↑";
    return "•";
  };

  const typeColor = (t: string) => {
    if (t === "deposit" || t === "reward") return "text-green-600";
    if (t === "withdraw" || t === "transfer") return "text-red-500";
    return "text-gray-500";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-indigo-600 flex items-center justify-center">
          <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">钱包</h1>
      </div>

      {/* Balance Card */}
      <div className="bg-gradient-to-br from-brand-500 via-indigo-600 to-purple-700 rounded-2xl p-6 text-white shadow-lg shadow-brand-500/20">
        <p className="text-sm font-medium opacity-80 mb-1">账户余额</p>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold">{balance?.balance ?? "0"}</span>
          <span className="text-lg opacity-70">coins</span>
        </div>
        <div className="mt-3 flex gap-4 text-sm opacity-80">
          <span>信誉: {balance?.reputation ?? "-"}</span>
          <span>等级: {balance?.trust_level ?? "-"}</span>
        </div>
      </div>

      {/* Transfer */}
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-brand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="7" y2="17" x2="17" y1="7" /><polyline points="7 7 17 7 17 17" /></svg>
          转账
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">接收方</label>
            <input
              value={transferTo}
              onChange={e => setTransferTo(e.target.value)}
              placeholder="账户 ID"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">金额</label>
            <input
              value={transferAmount}
              onChange={e => setTransferAmount(e.target.value)}
              placeholder="金额"
              type="number"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">描述</label>
            <input
              value={transferDesc}
              onChange={e => setTransferDesc(e.target.value)}
              placeholder="描述(可选)"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all outline-none"
            />
          </div>
        </div>
        <button
          onClick={handleTransfer}
          className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-brand-500 to-indigo-600 text-white font-medium hover:shadow-lg hover:shadow-brand-500/25 transition-all duration-200 disabled:opacity-50"
          disabled={!transferTo || !transferAmount || loading}
        >
          转账
        </button>
      </section>

      {/* Transaction history */}
      {transactions.length > 0 && (
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y2="13" x2="8" y1="13" /><line x1="16" y2="17" x2="8" y1="17" /></svg>
            交易记录
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-4 py-3 text-left text-gray-500 font-medium">时间</th>
                  <th className="px-4 py-3 text-left text-gray-500 font-medium">类型</th>
                  <th className="px-4 py-3 text-left text-gray-500 font-medium">金额</th>
                  <th className="px-4 py-3 text-left text-gray-500 font-medium">描述</th>
                  <th className="px-4 py-3 text-left text-gray-500 font-medium">状态</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(t => (
                  <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 text-gray-600">{t.created_at?.slice(0, 19) || "-"}</td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5">
                        <span className={`${typeColor(t.transaction_type)} font-bold`}>{typeIcon(t.transaction_type)}</span>
                        <span className="text-gray-700">{t.transaction_type}</span>
                      </span>
                    </td>
                    <td className={`px-4 py-3 font-semibold ${typeColor(t.transaction_type)}`}>{t.amount}</td>
                    <td className="px-4 py-3 text-gray-600 truncate max-w-[200px]">{t.description}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${
                        t.status === "completed" ? "bg-green-50 text-green-600" :
                        t.status === "pending" ? "bg-yellow-50 text-yellow-600" :
                        "bg-gray-50 text-gray-500"
                      }`}>{t.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
