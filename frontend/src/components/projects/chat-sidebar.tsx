"use client";

import type { ProjectParticipantResponse } from "@/types";
import { STATUS_LABELS, STATUS_COLORS } from "./use-project-chat";

interface ChatSidebarProps {
  participants: ProjectParticipantResponse[];
  activeCount: number;
  frozenCount: number;
  statusUpdating: string | null;
  onToggleStatus: (agentId: string, currentStatus: string) => void;
  sidebarOpen: boolean;
}

export function ChatSidebar({ participants, activeCount, frozenCount, statusUpdating, onToggleStatus, sidebarOpen }: ChatSidebarProps) {
  return (
    <div className={`${sidebarOpen ? 'flex' : 'hidden'} sm:flex w-64 bg-white border-l shadow-sm flex-col absolute sm:relative right-0 top-0 h-full z-20 sm:z-auto shadow-lg sm:shadow-none`}>
      <div className="px-4 py-3 border-b">
        <h3 className="font-bold text-sm">👥 参与者</h3>
        <div className="flex gap-2 mt-1 text-xs">
          <span className="text-green-600">{activeCount} 活跃</span>
          {frozenCount > 0 && <span className="text-blue-600">{frozenCount} 已冻结</span>}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {participants.length === 0 ? (
          <p className="text-gray-400 italic text-center py-6 text-sm">暂无参与者</p>
        ) : participants.map((p) => (
          <div key={p.id} className="px-4 py-2.5 border-b hover:bg-gray-50">
            <div className="flex items-center gap-2">
              <span className="text-sm">🤖</span>
              <span className="font-medium text-sm flex-1 truncate">{p.agent_name || p.agent_id}</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs px-2 py-0.5 rounded border ${STATUS_COLORS[p.status] || STATUS_COLORS.pending}`}>
                {STATUS_LABELS[p.status] || p.status}
              </span>
              <span className="text-xs text-gray-400">{p.role}</span>
            </div>
            {(p.status === "active" || p.status === "frozen") && (
              <button
                onClick={() => onToggleStatus(p.agent_id, p.status)}
                disabled={statusUpdating === p.agent_id}
                className={`mt-1.5 text-xs px-2 py-1 rounded border transition-colors ${
                  p.status === "active"
                    ? "bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100"
                    : "bg-green-50 text-green-600 border-green-200 hover:bg-green-100"
                } disabled:opacity-50`}
              >
                {statusUpdating === p.agent_id ? "..." : (
                  p.status === "active" ? "❄️ 叫停" : "▶️ 恢复"
                )}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
