"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/components/common/toast";

interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  message_type?: string;
  status?: string;
  created_at?: string;
}

export function MessageCenter() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [content, setContent] = useState("");
  const [msgType, setMsgType] = useState("task-request");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (user) loadMessages();
  }, [user]);

  const loadMessages = async () => {
    try {
      setLoading(true);
      const data = await api.a2a.getMessages(user?.id || "", { limit: 50 }) as any;
      setMessages(data.messages || data || []);
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!recipient.trim() || !content.trim()) {
      showToast("请填写接收方和消息内容", "error");
      return;
    }
    try {
      setSending(true);
      await api.a2a.sendMessage({
        from_agent_id: user!.id,
        to_agent_id: recipient,
        content: { text: content },
        message_type: msgType,
      });
      showToast("消息已发送", "success");
      setRecipient("");
      setContent("");
      loadMessages();
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setSending(false);
    }
  };

  const typeLabel = (t: string) => {
    const map: Record<string, string> = {
      "task-request": "任务请求",
      "task-response": "任务响应",
      "notification": "通知",
      "chat": "聊天",
    };
    return map[t] || t;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-indigo-600 flex items-center justify-center">
          <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">消息中心</h1>
      </div>

      {/* Send Message */}
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-brand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="22" y2="2" x2="11" y1="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
          发送消息
        </h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">接收方 ID</label>
              <input
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all outline-none"
                placeholder="Agent 或用户 ID"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">消息类型</label>
              <select
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all outline-none bg-white"
                value={msgType}
                onChange={(e) => setMsgType(e.target.value)}
              >
                <option value="task-request">任务请求</option>
                <option value="task-response">任务响应</option>
                <option value="notification">通知</option>
                <option value="chat">聊天</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">内容</label>
            <textarea
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all outline-none resize-none"
              rows={3}
              placeholder="消息内容..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>
          <button
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-brand-500 to-indigo-600 text-white font-medium hover:shadow-lg hover:shadow-brand-500/25 transition-all duration-200 disabled:opacity-50"
            onClick={sendMessage}
            disabled={sending}
          >
            {sending ? "发送中..." : "发送消息"}
          </button>
        </div>
      </section>

      {/* Messages List */}
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-brand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
          收发记录
        </h2>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-400">
            <svg className="w-6 h-6 animate-spin mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" /></svg>
            加载中...
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <svg className="w-12 h-12 mb-3 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
            <p>暂无消息</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`rounded-xl p-4 transition-all hover:shadow-sm ${
                  msg.sender_id === user?.id
                    ? "bg-brand-50/50 border border-brand-100"
                    : "bg-gray-50/50 border border-gray-100"
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 text-sm font-medium ${msg.sender_id === user?.id ? "text-brand-600" : "text-gray-700"}`}>
                      {msg.sender_id === user?.id ? (
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="22" y2="2" x2="11" y1="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                      ) : (
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
                      )}
                      {msg.sender_id === user?.id ? "发送至" : "来自"} {(msg.sender_id === user?.id ? msg.recipient_id : msg.sender_id).slice(0, 8)}...
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-brand-50 text-brand-600 text-xs font-medium">{typeLabel(msg.message_type || "")}</span>
                  </div>
                  <span className="text-xs text-gray-400">{msg.status}</span>
                </div>
                <p className="text-sm text-gray-700">{msg.content}</p>
                <p className="text-xs text-gray-400 mt-1">{msg.created_at?.slice(0, 19)}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
