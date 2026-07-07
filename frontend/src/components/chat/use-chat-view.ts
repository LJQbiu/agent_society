"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAgents } from "@/hooks/use-queries";
import type { AgentItem } from "@/types";
import { getWSBaseUrl } from "@/lib/ws";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

export function useChatView() {
  const { data: agentsData, isLoading: agentsLoading } = useAgents();
  const agents: AgentItem[] = agentsData?.agents || [];

  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // ─── WebSocket Connection ───
  const connect = useCallback(async () => {
    if (!selectedAgent) return;
    setConnecting(true);

    try {
      const tokenRes = await fetch("/api/auth/ws-token", { method: "POST", credentials: "include" });
      if (!tokenRes.ok) throw new Error(`认证失败: ${tokenRes.status}`);
      const { ws_token } = await tokenRes.json();

      const wsUrl = `${getWSBaseUrl()}/ws/chat/${selectedAgent}?token=${ws_token}`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setConnected(true);
        setConnecting(false);
        setMessages(prev => [...prev, { id: Date.now().toString(), role: "system", content: "已连接到 Agent，开始对话", timestamp: Date.now() }]);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: "assistant",
            content: data.content || data.message || event.data,
            timestamp: Date.now(),
          }]);
        } catch {
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: "assistant",
            content: event.data,
            timestamp: Date.now(),
          }]);
        }
      };

      ws.onerror = () => {
        setConnecting(false);
        setMessages(prev => [...prev, { id: Date.now().toString(), role: "system", content: "连接出错，请重试", timestamp: Date.now() }]);
      };

      ws.onclose = () => {
        setConnected(false);
        setConnecting(false);
      };

      wsRef.current = ws;
    } catch (err) {
      setConnecting(false);
      setMessages(prev => [...prev, { id: Date.now().toString(), role: "system", content: `连接失败: ${(err as Error).message}`, timestamp: Date.now() }]);
    }
  }, [selectedAgent]);

  // Disconnect on agent change
  useEffect(() => {
    if (wsRef.current) wsRef.current.close();
    setConnected(false);
    setMessages([]);
  }, [selectedAgent]);

  const sendMessage = () => {
    if (!input.trim() || !connected) return;
    const userMsg: ChatMessage = { id: Date.now().toString(), role: "user", content: input.trim(), timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    wsRef.current?.send(JSON.stringify({ content: input.trim(), type: "chat" }));
    setInput("");
  };

  return {
    agents, agentsLoading,
    selectedAgent, setSelectedAgent,
    messages, input, setInput,
    connected, connecting,
    connect, sendMessage, wsRef, scrollRef,
  };
}
