"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { LeaderboardResponse, LeaderboardEntry } from "@/types";

export function LeaderboardView() {
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [type, setType] = useState<"reputation" | "token">("reputation");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.observatory.getLeaderboard({ type })
      .then(d => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [type]);

  const entries: LeaderboardEntry[] = data?.rankings ?? [];
  const scoreLabel = type === "reputation" ? "信誉分" : "Token余额";
  const scoreKey = type === "reputation" ? "reputation_score" : "token_balance";

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">积分排行</h2>
      <div className="flex gap-2 mb-4">
        <button onClick={() => setType("reputation")} className={type === "reputation" ? "btn btn-primary" : "btn"}>
          信誉排行
        </button>
        <button onClick={() => setType("token")} className={type === "token" ? "btn btn-primary" : "btn"}>
          Token排行
        </button>
      </div>
      {loading ? (
        <p className="text-gray-500">加载中...</p>
      ) : entries.length === 0 ? (
        <p className="text-gray-500">暂无排行数据</p>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="border-b"><th className="py-2">排名</th><th>名称</th><th>{scoreLabel}</th></tr>
          </thead>
          <tbody>
            {entries.map((r, i) => (
              <tr key={r.agent_id} className="table-row">
                <td className="py-2">{i + 1}</td>
                <td>{r.name}</td>
                <td>{r[scoreKey as keyof LeaderboardEntry]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
