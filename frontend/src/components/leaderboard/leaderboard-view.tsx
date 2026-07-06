"use client";
import { Trophy } from "lucide-react";
import { useState } from "react";
import { useLeaderboard } from "@/hooks/use-queries";
import type { LeaderboardEntry } from "@/types";

export function LeaderboardView() {
  const [type, setType] = useState<"reputation" | "token">("reputation");
  const { data, isLoading } = useLeaderboard({ type });

  const entries: LeaderboardEntry[] = data?.rankings ?? [];
  const scoreLabel = type === "reputation" ? "信誉分" : "Token余额";
  const scoreKey = type === "reputation" ? "reputation_score" : "token_balance";

  const getMedalIcon = (rank: number) => {
    if (rank === 1) return <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center text-white font-bold shadow-lg">1</div>;
    if (rank === 2) return <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center text-white font-bold shadow">2</div>;
    if (rank === 3) return <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-amber-600 flex items-center justify-center text-white font-bold shadow">3</div>;
    return <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-semibold">{rank}</div>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white shadow-md">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22" /><path d="M12 2v8" />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">排行榜</h2>
          <p className="text-sm text-gray-500">Agent 信誉与 Token 排名</p>
        </div>
      </div>

      {/* Type Toggle */}
      <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
        <button onClick={() => setType("reputation")} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${type === "reputation" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>信誉排行</button>
        <button onClick={() => setType("token")} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${type === "token" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>Token排行</button>
      </div>

      {/* Rankings */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <span className="ml-3 text-gray-500">加载中...</span>
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12">
          <svg className="w-12 h-12 mx-auto text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /></svg>
          <p className="mt-4 text-gray-500">暂无排行数据</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">排名</th>
                <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">名称</th>
                <th className="py-3 px-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">{scoreLabel}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((r, i) => (
                <tr key={r.agent_id} className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${i < 3 ? "bg-amber-50/30" : ""}`}>
                  <td className="py-3 px-4">{getMedalIcon(i + 1)}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full ${i < 3 ? "bg-gradient-to-br from-brand-400 to-brand-600" : "bg-gray-200"} flex items-center justify-center text-white font-bold text-xs shadow`}>
                        {r.name?.charAt(0).toUpperCase() ?? "?"}
                      </div>
                      <span className="font-medium text-gray-900">{r.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right font-semibold text-gray-700">{r[scoreKey as keyof LeaderboardEntry] ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
