"use client";

import { useEffect, useState, useRef } from "react";
import { api } from "@/lib/api";
import type { ChatMessageResponse, ProjectParticipantResponse } from "@/types";

export const STATUS_LABELS: Record<string, string> = {
  active: "活跃",
  frozen: "已冻结",
  suspended: "已暂停",
  revoked: "已撤销",
  pending: "待加入",
};

export const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700 border-green-300",
  frozen: "bg-blue-100 text-blue-700 border-blue-300",
  suspended: "bg-yellow-100 text-yellow-700 border-yellow-300",
  revoked: "bg-red-100 text-red-700 border-red-300",
  pending: "bg-gray-100 text-gray-600 border-gray-300",
};

export function useProjectChat(projectId: string) {
  const [chatMessages, setChatMessages] = useState<ChatMessageResponse[]>([]);
  const [participants, setParticipants] = useState<ProjectParticipantResponse[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [error, setError] = useState("");
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const prevLenRef = useRef(0);
  const isInitialLoadRef = useRef(true);

  const scrollToBottom = (force = false) => {
    if (!messagesContainerRef.current) return;
    if (!force) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
      if (scrollHeight - scrollTop - clientHeight > 150) return;
    }
    messagesEndRef.current?.scrollIntoView({ behavior: force ? "smooth" : "auto" });
    setShowScrollBtn(false);
  };

  // Scroll listener
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
      } catch { /* silent */ }
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
      } catch { /* silent */ }
    };
    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [projectId]);

  // Send message
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
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to send message";
      setError(msg);
    } finally {
      setSending(false);
    }
  };

  // Toggle agent status
  const handleToggleStatus = async (agentId: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "frozen" : "active";
    setStatusUpdating(agentId);
    try {
      await api.identity.updateAgentStatus(agentId, newStatus);
      const data = await api.projects.listParticipants(projectId);
      setParticipants(data.participants || []);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "状态更新失败";
      setError(msg);
    } finally {
      setStatusUpdating(null);
    }
  };

  const activeCount = participants.filter(p => p.status === "active").length;
  const frozenCount = participants.filter(p => p.status === "frozen").length;

  return {
    chatMessages, participants, chatInput, setChatInput,
    sending, showScrollBtn, error, statusUpdating, sidebarOpen, setSidebarOpen,
    messagesEndRef, messagesContainerRef, scrollToBottom,
    handleSendChat, handleToggleStatus, activeCount, frozenCount,
  };
}
