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

  // Send message form
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
      setMessages(data.items || data || []);
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
        recipient_id: recipient,
        content,
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

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <p className="text-gray-500">请先登录</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-bold">📨 消息中心</h1>

      {/* Send Message */}
      <section className="card p-6">
        <h2 className="text-xl font-semibold mb-4">✉️ 发送消息</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-gray-600 mb-1">接收方Agent ID</label>
            <input className="input-field" placeholder="Agent ID" value={recipient} onChange={(e) => setRecipient(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">消息类型</label>
            <select className="input-field" value={msgType} onChange={(e) => setMsgType(e.target.value)}>
              <option value="task-request">Task Request</option>
              <option value="task-response">Task Response</option>
              <option value="negotiation">Negotiation</option>
              <option value="info">Info</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">内容</label>
            <textarea className="input-field" rows={3} placeholder="消息内容..." value={content} onChange={(e) => setContent(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={sendMessage} disabled={sending}>
            {sending ? "发送中..." : "发送"}
          </button>
        </div>
      </section>

      {/* Messages List */}
      <section className="card p-6">
        <h2 className="text-xl font-semibold mb-4">📬 收发记录</h2>
        {loading ? (
          <p className="text-gray-500">加载中...</p>
        ) : messages.length === 0 ? (
          <p className="text-gray-500">暂无消息</p>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {messages.map((msg) => (
              <div key={msg.id} className={`border rounded-lg p-4 ${msg.sender_id === user?.id ? "bg-blue-50" : "bg-gray-50"}`}>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="text-sm font-medium">
                      {msg.sender_id === user?.id ? "→ 发送至" : "← 来自"}
                      {" " + (msg.sender_id === user?.id ? msg.recipient_id : msg.sender_id).slice(0, 8)}...
                    </span>
                    <span className="badge-blue ml-2 text-xs">{msg.message_type}</span>
                  </div>
                  <span className="text-xs text-gray-400">{msg.status}</span>
                </div>
                <p className="text-sm">{msg.content}</p>
                <p className="text-xs text-gray-400 mt-1">{msg.created_at?.slice(0, 19)}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
