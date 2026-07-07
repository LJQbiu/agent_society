"use client";

import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useProjectChat } from "./use-project-chat";
import { ChatSidebar } from "./chat-sidebar";

interface ProjectChatFullProps {
  projectId: string;
  projectName?: string;
}

export function ProjectChatFull({ projectId, projectName }: ProjectChatFullProps) {
  const {
    chatMessages, chatInput, setChatInput,
    sending, showScrollBtn, error, statusUpdating,
    sidebarOpen, setSidebarOpen,
    messagesEndRef, messagesContainerRef, scrollToBottom,
    handleSendChat, handleToggleStatus, participants,
    activeCount, frozenCount,
  } = useProjectChat(projectId);

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

      {/* Participant Sidebar */}
      <ChatSidebar
        participants={participants}
        activeCount={activeCount}
        frozenCount={frozenCount}
        statusUpdating={statusUpdating}
        onToggleStatus={handleToggleStatus}
        sidebarOpen={sidebarOpen}
      />
    </div>
  );
}
