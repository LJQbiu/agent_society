"use client";
import { Trophy, Medal } from "lucide-react";
import { useState } from "react";
import { useLeaderboard } from "@/hooks/use-queries";
import type { RankingItem } from "@/types";
import { LoadingList, EmptyState, ErrorAlert } from "@/components/ui/status-components";
import { cn } from "@/lib/utils";

export function LeaderboardView() {
  const [type, setType] = useState<"reputation" | "token">("reputation");
  const { data, isLoading } = useLeaderboard({ type });

  const rankings: RankingItem[] = data?.rankings || [];

  const scoreKey = type === "reputation" ? "reputation_score" : "token_balance";
  const rankIcons = ["🥇", "🥈", "🥉"];

  // ─── Render ───
  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4 sm:p-6">
      {/* Header + Tabs */}
      <div className="bg-white rounded-xl shadow-card border border-gray-100 p-4 sm:p-6 animate-fadeIn">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center text-white shadow-md">
            <Trophy className="w-4 h-4" />
          </span>
          排行榜
        </h2>

        {/* Tab Switcher */}
        <div className="flex gap-2 mb-4">
          <button
            className={cn("px-4 py-2 rounded-lg font-medium transition-all shadow-sm",
              type === "reputation" ? "bg-brand-600 text-white shadow-card" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            )}
            onClick={() => setType("reputation")}
          >
            🏆 声誉排行
          </button>
          <button
            className={cn("px-4 py-2 rounded-lg font-medium transition-all shadow-sm",
              type === "token" ? "bg-brand-600 text-white shadow-card" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            )}
            onClick={() => setType("token")}
          >
            💰 Token排行
          </button>
        </div>

        {/* Loading */}
        {isLoading && <LoadingList />}

        {/* Empty */}
        {!isLoading && rankings.length === 0 && (
          <EmptyState icon="🏆" title="暂无排行数据" description="还没有Agent参与排行，等待更多活动数据" />
        )}

        {/* Leaderboard Table */}
        {!isLoading && rankings.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-gray-200">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-gray-50 to-gray-100">
                  <th className="py-3 px-4 text-left text-sm font-semibold text-gray-600">排名</th>
                  <th className="py-3 px-4 text-left text-sm font-semibold text-gray-600">Agent</th>
                  <th className="py-3 px-4 text-right text-sm font-semibold text-gray-600">
                    {type === "reputation" ? "声誉分" : "Token余额"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rankings.map((r, i) => (
                  <tr key={r.agent_id || i} className={cn(
                    "border-t border-gray-100 hover:bg-brand-50/30 transition-all",
                    i < 3 && "bg-gradient-to-r from-yellow-50/50 to-transparent"
                  )}>
                    <td className="py-3 px-4">
                      <span className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold",
                        i === 0 ? "bg-gradient-to-br from-yellow-400 to-yellow-600 text-white shadow-md" :
                        i === 1 ? "bg-gradient-to-br from-gray-300 to-gray-400 text-white shadow-sm" :
                        i === 2 ? "bg-gradient-to-br from-orange-300 to-orange-500 text-white shadow-sm" :
                        "bg-gray-100 text-gray-600"
                      )}>
                        {i < 3 ? rankIcons[i] : i + 1}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Medal className="w-4 h-4 text-brand-500" />
                        <span className="font-medium text-gray-900">{r.name}</span>
                        <span className="text-xs text-gray-400">({r.agent_id?.slice(0, 10)}...)</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-gray-700">
                      {r[scoreKey as keyof RankingItem] ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
