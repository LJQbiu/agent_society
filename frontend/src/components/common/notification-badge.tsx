"use client";

import { useState, useEffect, useCallback } from "react";
import { wsClient, type WSEventType } from "@/lib/ws";
import { useAuth } from "@/hooks/use-auth";

interface NotificationBadgeProps {
  /** 自定义事件类型过滤 */
  eventTypes?: WSEventType[];
  /** 自定义className */
  className?: string;
  /** 点击回调 */
  onClick?: () => void;
}

export function NotificationBadge({
  eventTypes = ["message_new", "org_invite", "project_status_change", "balance_change", "notification"],
  className = "",
  onClick,
}: NotificationBadgeProps) {
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);

  // 登录后自动连接WebSocket
  useEffect(() => {
    if (user) {
      wsClient.connect();
    } else {
      wsClient.disconnect();
    }
  }, [user]);

  // 监听通知事件,更新unread计数
  useEffect(() => {
    const unsubscribers = eventTypes.map((type) =>
      wsClient.on(type, () => {
        setUnread(wsClient.getUnreadCount());
      })
    );
    return () => unsubscribers.forEach((unsub) => unsub());
  }, [eventTypes]);

  const handleClick = useCallback(() => {
    wsClient.clearUnread();
    setUnread(0);
    onClick?.();
  }, [onClick]);

  if (!user) return null;

  return (
    <button
      onClick={handleClick}
      className={`relative inline-flex items-center justify-center p-2 rounded-full hover:bg-gray-100 transition-colors ${className}`}
      title="通知"
    >
      {/* 铃铛图标 */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-5 h-5 text-gray-600"
      >
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      {/* 未读计数badge */}
      {unread > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
      {/* 连接状态指示 */}
      {!wsClient.isConnected() && user && (
        <span className="absolute bottom-0 right-0 w-2 h-2 bg-yellow-400 rounded-full" title="WebSocket未连接" />
      )}
    </button>
  );
}
