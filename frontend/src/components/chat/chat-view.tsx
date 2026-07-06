"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { JSX } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "@/lib/api";
import type { AgentItem } from "@/types";

/* ─── Types ─── */
interface ChatMessage {
  id: string;
  role: "user" | "agent";
  content: string;
  agentId?: string;
  timestamp: string;
}

import { Send, Bot, User, ChevronDown } from "lucide-react";

/* ─── WS URL ─── */
function getWsUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws/chat`;
}

/* ─── Chat View Component ─── */
export function ChatView(): JSX.Element {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("agent-jqagent-8d811ba0");
  const [agentDropdownOpen, setAgentDropdownOpen] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch agents list
  useEffect(() => {
    api.observatory.listAgents({})
      .then(data => {
        const agentList = data.agents || [];
        setAgents(agentList);
        // Auto-select first active agent if default not in list
        if (agentList.length > 0 && !agentList.find(a => a.agent_id === selectedAgentId)) {
          const activeAgent = agentList.find(a => a.status === "active") || agentList[0];
          setSelectedAgentId(activeAgent.agent_id);
        }
      })
      .catch(() => setAgents([]));
  }, []);

  const selectedAgent = agents.find(a => a.agent_id === selectedAgentId);
  const agentDisplayName = selectedAgent?.name || "JQAgent";

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    setConnecting(true);
    const ws = new WebSocket(getWsUrl());

    ws.onopen = () => {
      setConnected(true);
      setConnecting(false);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "reply") {
          setMessages((prev) => [
            ...prev,
            { id: `agent-${Date.now()}`, role: "agent", content: data.content, agentId: data.agent_id, timestamp: data.timestamp },
          ]);
        } else if (data.type === "connected") {
          // Backend confirms connection with agent_id
          if (data.agent_id && data.agent_id !== selectedAgentId) {
            setSelectedAgentId(data.agent_id);
          }
        } else if (data.type === "error") {
          setMessages((prev) => [
            ...prev,
            { id: `err-${Date.now()}`, role: "agent", content: `⚠️ ${data.content || "发生错误"}`, timestamp: new Date().toISOString() },
          ]);
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          { id: `agent-${Date.now()}`, role: "agent", content: event.data, timestamp: new Date().toISOString() },
        ]);
      }
    };

    ws.onclose = () => {
      setConnected(false);
      setConnecting(false);
      setTimeout(() => {
        if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) connect();
      }, 3000);
    };

    ws.onerror = () => {
      setConnecting(false);
    };

    wsRef.current = ws;
  }, []);

  useEffect(() => {
    connect();
    return () => { wsRef.current?.close(); };
  }, [connect]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const sendMessage = () => {
    const text = input.trim();
    if (!text) return;
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) { connect(); return; }

    setMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, role: "user", content: text, timestamp: new Date().toISOString() },
    ]);

    wsRef.current.send(JSON.stringify({ text, agent_id: selectedAgentId }));
    setInput("");
    inputRef.current?.focus();
  };

  const selectAgent = (agentId: string) => {
    setSelectedAgentId(agentId);
    setAgentDropdownOpen(false);
    // Clear conversation history on agent switch
    setMessages([]);
  };

  const formatTime = (ts: string) => {
    try {
      return new Date(ts).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
    } catch { return ""; }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] sm:h-[calc(100vh-80px)] max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-indigo-600 flex items-center justify-center text-white">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            {/* Agent selector dropdown */}
            <div className="relative">
              <button
                onClick={() => setAgentDropdownOpen(!agentDropdownOpen)}
                className="flex items-center gap-1 text-lg font-semibold text-gray-900 hover:text-brand-600 transition-colors"
              >
                {agentDisplayName} 对话
                <ChevronDown className="w-4 h-4" />
              </button>
              {agentDropdownOpen && agents.length > 0 && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-xl shadow-lg border border-gray-200 z-50 py-1">
                  {agents.map(agent => (
                    <button
                      key={agent.agent_id}
                      onClick={() => selectAgent(agent.agent_id)}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-brand-50 transition-colors flex items-center justify-between ${
                        agent.agent_id === selectedAgentId ? "bg-brand-50 text-brand-700 font-medium" : "text-gray-700"
                      }`}
                    >
                      <span>{agent.name}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        agent.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                      }`}>
                        {agent.status === "active" ? "在线" : agent.status}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500">
              {connected ? (
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> 已连接</span>
              ) : connecting ? (
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500 inline-block animate-pulse" /> 连接中...</span>
              ) : (
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> 未连接</span>
              )}
            </p>
          </div>
        </div>
        {!connected && !connecting && (
          <button onClick={connect} className="px-3 py-1.5 text-sm rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition-colors">重连</button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-brand-500 to-indigo-600 flex items-center justify-center text-white">
              <Bot className="w-8 h-8" />
            </div>
            <p className="text-gray-500 text-sm">向 {agentDisplayName} 发送消息开始对话</p>
            <p className="text-gray-400 text-xs mt-1">选择不同的Agent，体验不同的对话风格</p>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "agent" && (
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-indigo-600 flex items-center justify-center text-white flex-shrink-0">
                <Bot className="w-4 h-4" />
              </div>
            )}
            <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${msg.role === "user" ? "bg-brand-500 text-white rounded-br-sm" : "bg-gray-100 text-gray-900 rounded-bl-sm"}`}>
              {msg.role === "agent" ? (
                <div className="text-sm leading-relaxed chat-md">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                      h1: ({ children }) => <h1 className="text-xl font-bold mb-2">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-lg font-bold mb-2">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-base font-bold mb-1">{children}</h3>,
                      ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>,
                      li: ({ children }) => <li>{children}</li>,
                      strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                      em: ({ children }) => <em className="italic">{children}</em>,
                      code: ({ className, children, ...props }) => {
                        const isInline = !className;
                        return isInline
                          ? <code className="bg-gray-200 text-brand-700 px-1 py-0.5 rounded text-xs font-mono" {...props}>{children}</code>
                          : <code className="block bg-gray-200 text-gray-800 p-3 rounded-lg text-xs font-mono overflow-x-auto max-w-full mb-2" {...props}>{children}</code>;
                      },
                      pre: ({ children }) => <pre className="bg-gray-200 p-3 rounded-lg overflow-x-auto max-w-full mb-2">{children}</pre>,
                      blockquote: ({ children }) => <blockquote className="border-l-3 border-brand-400 pl-4 italic mb-2">{children}</blockquote>,
                      a: ({ href, children }) => <a href={href} className="text-brand-600 underline hover:text-brand-700" target="_blank" rel="noopener noreferrer">{children}</a>,
                      table: ({ children }) => <table className="w-full border-collapse mb-2">{children}</table>,
                      th: ({ children }) => <th className="border border-gray-300 px-2 py-1 bg-gray-50 font-bold text-left">{children}</th>,
                      td: ({ children }) => <td className="border border-gray-300 px-2 py-1">{children}</td>,
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm leading-relaxed">{msg.content}</p>
              )}
              <p className={`text-xs mt-1 ${msg.role === "user" ? "text-white/70" : "text-gray-400"}`}>{formatTime(msg.timestamp)}</p>
            </div>
            {msg.role === "user" && (
              <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center text-gray-500 flex-shrink-0">
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-200 bg-white">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder={`向 ${agentDisplayName} 发送消息...`}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none text-sm transition-colors"
            disabled={!connected}
          />
          <button
            onClick={sendMessage}
            disabled={!connected || !input.trim()}
            className="w-10 h-10 rounded-xl bg-brand-500 text-white flex items-center justify-center hover:bg-brand-600 disabled:bg-gray-200 disabled:text-gray-400 transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
