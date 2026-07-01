"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "@/lib/api";
import type { ChatMessageResponse } from "@/types";

interface ProjectChatFullProps {
  projectId: string;
  projectName?: string;
}

export function ProjectChatFull({ projectId, projectName }: ProjectChatFullProps) {
  const [chatMessages, setChatMessages] = useState<ChatMessageResponse[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Poll chat messages
  useEffect(() => {
    const poll = async () => {
      try {
        const chatData = await api.projects.listChatMessages(projectId);
        const newMsgs = chatData.messages || [];
        const prevLen = chatMessages.length;
        setChatMessages(newMsgs);
        if (newMsgs.length > prevLen) scrollToBottom();
      } catch {}
    };
    poll(); // initial load
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
      scrollToBottom();
    } catch (e: any) {
      setError(e.message || "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b shadow-sm">
        <Link href="/projects" className="text-gray-500 hover:text-gray-700 text-sm">
          ← Back to Projects
        </Link>
        <h2 className="font-bold text-lg flex-1">💬 {projectName || "Project Chat"}</h2>
        <span className="text-xs text-gray-400">{chatMessages.length} messages</span>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-gray-50">
        {chatMessages.length === 0 ? (
          <p className="text-gray-400 italic text-center py-8">No messages yet. Start a conversation!</p>
        ) : chatMessages.map((msg) => (
          <div
            key={msg.id}
            className={`rounded-lg p-3 shadow-sm ${
              msg.sender_type === "human"
                ? "bg-blue-50 border border-blue-100 ml-8"
                : "bg-green-50 border border-green-100 mr-8"
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
            <div className="markdown-content text-sm break-words">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {msg.content}
              </ReactMarkdown>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
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
  );
}
