"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "@/lib/api";
import type { ChatMessageResponse, ProjectParticipantResponse } from "@/types";

interface ProjectChatFullProps {
  projectId: string;
  projectName?: string;
}

const STATUS_LABELS: Record<string, string> = {
  active: "活跃",
  frozen: "已冻结",
  suspended: "已暂停",
  revoked: "已撤销",
  pending: "待加入",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700 border-green-300",
  frozen: "bg-blue-100 text-blue-700 border-blue-300",
  suspended: "bg-yellow-100 text-yellow-700 border-yellow-300",
  revoked: "bg-red-100 text-red-700 border-red-300",
  pending: "bg-gray-100 text-gray-600 border-gray-300",
};

export function ProjectChatFull({ projectId, projectName }: ProjectChatFullProps) {
  const [chatMessages, setChatMessages] = useState<ChatMessageResponse[]>([]);
  const [participants, setParticipants] = useState<ProjectParticipantResponse[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [error, setError] = useState("");
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null); // agent_id being updated
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const prevLenRef = useRef(0);
  const isInitialLoadRef = useRef(true);

  // Auto-scroll to bottom - only if user is near bottom
  const scrollToBottom = (force = false) => {
    if (!messagesContainerRef.current) return;
    if (!force) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
      if (scrollHeight - scrollTop - clientHeight > 150) return;
    }
    messagesEndRef.current?.scrollIntoView({ behavior: force ? "smooth" : "auto" });
    setShowScrollBtn(false);
  };

  // Listen for scroll events
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const nearBottom = scrollHeight - scrollTop - clientHeight <= 150;
      setShowScrollBtn(!nearBottom);
    };
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  // Load participants
  useEffect(() => {
    const loadParticipants = async () => {
      try {
        const data = await api.projects.listParticipants(projectId);
        setParticipants(data.participants || []);
      } catch {}
    };
    loadParticipants();
    const interval = setInterval(loadParticipants, 10000);
    return () => clearInterval(interval);
  }, [projectId]);

  // Poll chat messages
  useEffect(() => {
    const poll = async () => {
      try {
        const chatData = await api.projects.listChatMessages(projectId);
        const newMsgs = chatData.messages || [];
        const prevLen = prevLenRef.current;
        prevLenRef.current = newMsgs.length;
        setChatMessages(newMsgs);
        if (isInitialLoadRef.current) {
          isInitialLoadRef.current = false;
          return;
        }
        if (newMsgs.length > prevLen) scrollToBottom();
      } catch {}
    };
    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [projectId]);

  // Send chat message
  const handleSendChat = async () => {
    if (!chatInput.trim() || sending) return;
    setSending(true);
    setError("");
    try {
      await api.projects.sendChatMessage(projectId, { content: chatInput.trim(), sender_type: "human" });
      setChatInput("");
      const chatData = await api.projects.listChatMessages(projectId);
      setChatMessages(chatData.messages || []);
      scrollToBottom(true);
    } catch (e: any) {
      setError(e.message || "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  // Toggle agent status (freeze/resume)
  const handleToggleStatus = async (agentId: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "frozen" : "active";
    setStatusUpdating(agentId);
    try {
      await api.identity.updateAgentStatus(agentId, newStatus);
      // Refresh participants
      const data = await api.projects.listParticipants(projectId);
      setParticipants(data.participants || []);
    } catch (e: any) {
      setError(e.message || "状态更新失败");
    } finally {
      setStatusUpdating(null);
    }
  };

  // Count agents by status
  const activeCount = participants.filter(p => p.status === "active").length;
  const frozenCount = participants.filter(p => p.status === "frozen").length;

  return (
    <div className="flex h-[calc(100vh-64px)] sm:h-[calc(100vh-80px)] max-w-6xl mx-auto">
      {/* Main Chat Area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 bg-white border-b shadow-sm">
          <Link href="/projects" className="text-gray-500 hover:text-gray-700 text-sm">
            ← Back
          </Link>
          <h2 className="font-bold text-lg flex-1 truncate">💬 {projectName || "Project Chat"}</h2>
          <span className="text-xs text-gray-400">{chatMessages.length} msg</span>
          {/* Mobile sidebar toggle */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="sm:hidden text-gray-500 hover:text-gray-700 p-1"
          >
            👥
          </button>
        </div>

        {/* Messages Area */}
        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-gray-50 relative">
          {chatMessages.length === 0 ? (
            <p className="text-gray-400 italic text-center py-8">No messages yet. Start a conversation!</p>
          ) : chatMessages.map((msg) => (
            <div
              key={msg.id}
              className={`rounded-lg p-3 shadow-sm ${
                msg.sender_type === "human"
                  ? "bg-blue-50 border border-blue-100 ml-2 sm:ml-8"
                  : "bg-green-50 border border-green-100 mr-2 sm:mr-8"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={`font-semibold text-sm ${
                  msg.sender_type === "human" ? "text-blue-600" : "text-green-600"
                }`}>
                  {msg.sender_type === "human" ? "👤" : "🤖"} {msg.sender_name}
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(msg.created_at).toLocaleString()}
                </span>
              </div>
              <div className="markdown-content text-sm break-words overflow-hidden">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {msg.content}
                </ReactMarkdown>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
          {showScrollBtn && (
            <button
              onClick={() => scrollToBottom(true)}
              className="absolute bottom-4 right-4 bg-blue-600 text-white px-3 py-1.5 rounded-full shadow-lg hover:bg-blue-700 text-sm flex items-center gap-1 z-10"
            >
              ↓ 最新消息
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="px-4 py-1 text-red-500 text-sm">{error}</div>
        )}

        {/* Input Area */}
        <div className="px-4 py-3 bg-white border-t shadow-sm">
          <div className="flex gap-2">
            <textarea
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendChat();
                }
              }}
              placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
              className="border p-2 rounded flex-1 resize-none"
              rows={2}
              disabled={sending}
            />
            <button
              onClick={handleSendChat}
              disabled={sending || !chatInput.trim()}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400 self-end"
            >
              {sending ? "..." : "Send"}
            </button>
          </div>
        </div>
      </div>

      {/* Participant Sidebar - hidden on mobile, toggleable */}
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
              {/* Freeze / Resume button */}
              {(p.status === "active" || p.status === "frozen") && (
                <button
                  onClick={() => handleToggleStatus(p.agent_id, p.status)}
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
    </div>
  );
}
