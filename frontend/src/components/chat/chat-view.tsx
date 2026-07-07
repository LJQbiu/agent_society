"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useChatView, type ChatMessage } from "./use-chat-view";
import { LoadingList, EmptyState } from "@/components/ui/status-components";
import { cn } from "@/lib/utils";

export function ChatView() {
  const {
    agents, agentsLoading,
    selectedAgent, setSelectedAgent,
    messages, input, setInput,
    connected, connecting,
    connect, sendMessage, wsRef, scrollRef,
  } = useChatView();

  return (
    <div className="max-w-4xl mx-auto flex flex-col h-[calc(100vh-120px)] p-4 sm:p-6 animate-fadeIn">
      {/* Agent Selection + Connection Header */}
      <div className="bg-white rounded-xl shadow-card border border-gray-100 p-3 mb-3 flex items-center gap-3 flex-wrap">
        <span className="text-sm font-semibold text-gray-700">Agent:</span>

        {agentsLoading && <LoadingList />}

        {!agentsLoading && agents.length === 0 && (
          <EmptyState icon="🤖" title="暂无可用Agent" description="请先注册Agent再开始对话" size="sm" />
        )}

        {!agentsLoading && agents.length > 0 && (
          <select
            className="px-3 py-1.5 rounded-lg border border-gray-200 focus:border-brand-500 outline-none text-sm bg-gray-50 hover:bg-gray-100 transition-all"
            value={selectedAgent}
            onChange={e => setSelectedAgent(e.target.value)}
          >
            <option value="">选择 Agent...</option>
            {agents.map(a => (
              <option key={a.agent_id} value={a.agent_id}>{a.name} ({a.agent_id.slice(0, 12)}...)</option>
            ))}
          </select>
        )}

        {selectedAgent && !connected && !connecting && (
          <button onClick={connect} className="px-3 py-1.5 text-sm rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition-all shadow-sm font-medium">🔗 连接</button>
        )}
        {connecting && <span className="text-sm text-brand-500 animate-pulse">⏳ 连接中...</span>}
        {connected && <span className="text-sm text-green-600 font-medium">✅ 已连接</span>}
        {connected && !connecting && (
          <button onClick={() => wsRef.current?.close()} className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all font-medium">断开</button>
        )}
        {!connected && !connecting && selectedAgent && (
          <button onClick={connect} className="px-3 py-1.5 text-sm rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition-all shadow-sm font-medium">重连</button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto bg-white rounded-xl shadow-card border border-gray-100 p-4 space-y-4 mb-3">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-brand-500 to-indigo-600 flex items-center justify-center text-white shadow-md">
              🤖
            </div>
            <p className="text-gray-500 font-medium">选择一个Agent并连接开始对话</p>
            <p className="text-sm text-gray-400 mt-1">消息将通过WebSocket实时传输</p>
          </div>
        )}

        {messages.map((msg: ChatMessage) => (
          <div key={msg.id} className={cn(
            "flex",
            msg.role === "user" ? "justify-end" : "justify-start"
          )}>
            <div className={cn(
              "max-w-[75%] rounded-xl px-4 py-3 shadow-sm",
              msg.role === "user" ? "bg-brand-600 text-white" :
              msg.role === "system" ? "bg-gray-100 text-gray-500 text-sm" :
              "bg-white border border-gray-200 text-gray-900"
            )}>
              {msg.role === "system" ? (
                <p className="text-center text-xs">{msg.content}</p>
              ) : msg.role === "assistant" ? (
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p>{msg.content}</p>
              )}
              <p className={cn(
                "text-xs mt-1",
                msg.role === "user" ? "text-white/70" : "text-gray-400"
              )}>{new Date(msg.timestamp).toLocaleTimeString()}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Input Area */}
      <div className="bg-white rounded-xl shadow-card border border-gray-100 p-3 flex items-center gap-3">
        <input
          className="flex-1 px-4 py-2 rounded-lg border border-gray-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition-all"
          placeholder={connected ? "输入消息..." : "请先连接Agent"}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
          disabled={!connected}
        />
        <button
          onClick={sendMessage}
          disabled={!connected || !input.trim()}
          className={cn(
            "px-6 py-2 rounded-lg font-medium transition-all shadow-sm",
            connected && input.trim()
              ? "bg-brand-600 text-white hover:bg-brand-700"
              : "bg-gray-200 text-gray-400 cursor-not-allowed"
          )}
        >
          发送
        </button>
      </div>
    </div>
  );
}
