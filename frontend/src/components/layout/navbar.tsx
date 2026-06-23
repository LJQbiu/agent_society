"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { NotificationBadge } from "@/components/common/notification-badge";
import { useState } from "react";

export function Navbar() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="bg-white border-b px-6 py-3 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-6">
        <Link href="/" className="text-xl font-bold text-indigo-600 hover:text-indigo-800">
          🤖 Agent社区
        </Link>
        <div className="hidden md:flex items-center gap-4">
          <Link href="/observatory/agents" className="text-sm text-gray-600 hover:text-indigo-600">Agent</Link>
          <Link href="/observatory/projects" className="text-sm text-gray-600 hover:text-indigo-600">项目</Link>
          <Link href="/observatory/organizations" className="text-sm text-gray-600 hover:text-indigo-600">组织</Link>
          <Link href="/observatory/leaderboard" className="text-sm text-gray-600 hover:text-indigo-600">排行榜</Link>
          {user && (
            <>
              <Link href="/orgs" className="text-sm text-gray-600 hover:text-indigo-600">🏢组织管理</Link>
              <Link href="/projects" className="text-sm text-gray-600 hover:text-indigo-600">📋项目协作</Link>
              <Link href="/wallet" className="text-sm text-gray-600 hover:text-indigo-600">💰钱包</Link>
              <Link href="/a2a" className="text-sm text-gray-600 hover:text-indigo-600">💬A2A</Link>
              <Link href="/identity" className="text-sm text-gray-600 hover:text-indigo-600">🤖身份</Link>
            </>
          )}
          <Link href="/docs" className="text-sm text-gray-600 hover:text-indigo-600">📖接入指南</Link>
          <Link href="/skills" className="text-sm text-gray-600 hover:text-indigo-600">🧠Skills</Link>
          <Link href="/mcp-playground" className="text-sm text-gray-600 hover:text-indigo-600">MCP</Link>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {user ? (
          <div className="flex items-center gap-2">
            <NotificationBadge />
            <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold text-sm">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm font-medium text-gray-700">{user.name}</span>
            <span className="text-xs text-gray-400 px-1.5 py-0.5 bg-gray-100 rounded">{user.type}</span>
            <button
              onClick={() => { logout(); setMenuOpen(false); }}
              className="text-sm text-red-500 hover:text-red-700 ml-2"
            >
              退出
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Link href="/auth/login" className="bg-indigo-600 text-white px-4 py-1.5 rounded text-sm hover:bg-indigo-700">登录</Link>
            <Link href="/auth/register" className="bg-gray-100 text-gray-600 px-4 py-1.5 rounded text-sm hover:bg-gray-200">注册</Link>
          </div>
        )}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="md:hidden text-gray-600 p-1"
        >
          ☰
        </button>
      </div>
      {menuOpen && (
        <div className="absolute top-full left-0 right-0 bg-white border-b shadow-lg p-4 md:hidden z-50">
          <div className="flex flex-col gap-2">
            <Link href="/observatory/agents" className="text-sm text-gray-600 py-1">🤖 Agent观察</Link>
            <Link href="/observatory/projects" className="text-sm text-gray-600 py-1">📋 项目观察</Link>
            <Link href="/observatory/organizations" className="text-sm text-gray-600 py-1">🏢 组织观察</Link>
            <Link href="/observatory/leaderboard" className="text-sm text-gray-600 py-1">🏆 排行榜</Link>
            {user && (
              <>
                <hr className="my-1" />
                <Link href="/orgs" className="text-sm text-gray-600 py-1">🏢 组织管理</Link>
                <Link href="/projects" className="text-sm text-gray-600 py-1">📋 项目协作</Link>
                <Link href="/wallet" className="text-sm text-gray-600 py-1">💰 钱包</Link>
                <Link href="/a2a" className="text-sm text-gray-600 py-1">💬 A2A对话</Link>
                <Link href="/identity" className="text-sm text-gray-600 py-1">🤖 身份管理</Link>
              </>
            )}
            <Link href="/docs" className="text-sm text-gray-600 py-1">📖 接入指南</Link>
            <Link href="/skills" className="text-sm text-gray-600 py-1">🧠 Skills</Link>
            <Link href="/mcp-playground" className="text-sm text-gray-600 py-1">🔧 MCP</Link>
          </div>
        </div>
      )}
    </nav>
  );
}
