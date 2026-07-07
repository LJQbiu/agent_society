"use client";
import { MessageCircle, Send, Mail, Activity } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/components/common/toast";
import { useMessages, useSendMessage } from "@/hooks/use-queries";
import type { A2AMessage } from "@/types";
import { LoadingList, EmptyState, ErrorAlert, SuccessAlert } from "@/components/ui/status-components";
import { cn } from "@/lib/utils";

export function MessageCenter() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { data: messagesData, isLoading } = useMessages(user?.id || "");
  const sendMessage = useSendMessage();

  const messages: A2AMessage[] = messagesData || [];

  const [recipientId, setRecipientId] = useState("");
  const [msgContent, setMsgContent] = useState("");

  const handleSend = () => {
    if (!recipientId.trim() || !msgContent.trim()) {
      showToast("请填写收件人和内容", "error");
      return;
    }
    sendMessage.mutate(
      { from_agent_id: user?.id || "", to_agent_id: recipientId, content: { text: msgContent }, message_type: "text" },
      {
        onSuccess: () => {
          showToast("消息已发送", "success");
          setRecipientId("");
          setMsgContent("");
        },
        onError: (err: Error) => showToast(`发送失败: ${err.message}`, "error"),
      }
    );
  };

  // ─── Render ───
  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4 sm:p-6">
      {/* === 发送消息 === */}
      <section className="bg-white rounded-xl shadow-card border border-gray-100 p-4 sm:p-6 animate-fadeIn">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-indigo-600 flex items-center justify-center text-white shadow-md">
            <Send className="w-4 h-4" />
          </span>
          发送消息
        </h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">收件人 Agent ID</label>
            <input
              className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition-all"
              placeholder="例如: agent-helper-001"
              value={recipientId}
              onChange={e => setRecipientId(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">内容</label>
            <textarea
              className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition-all"
              placeholder="输入消息内容..."
              value={msgContent}
              onChange={e => setMsgContent(e.target.value)}
              rows={3}
            />
          </div>
          <button
            className={cn("px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-all shadow-card font-medium", sendMessage.isPending && "opacity-50 cursor-not-allowed")}
            onClick={handleSend}
            disabled={sendMessage.isPending}
          >
            {sendMessage.isPending ? "⏳ 发送中..." : "📤 发送"}
          </button>
        </div>
      </section>

      {/* === 消息列表 === */}
      <section className="bg-white rounded-xl shadow-card border border-gray-100 p-4 sm:p-6 animate-fadeIn">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white shadow-md">
            <Mail className="w-4 h-4" />
          </span>
          消息记录
          <span className="text-sm text-gray-400 font-normal">({messages.length})</span>
        </h2>

        {isLoading && <LoadingList />}

        {!isLoading && messages.length === 0 && (
          <EmptyState icon="💬" title="暂无消息" description="发送一条消息开始与其他Agent交流" />
        )}

        {!isLoading && messages.length > 0 && (
          <div className="space-y-3">
            {messages.map((msg, i) => (
              <div key={msg.message_id || i} className="bg-gray-50 rounded-xl p-3 hover:bg-gray-100 transition-all">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="w-3.5 h-3.5 text-brand-500" />
                    <span className="text-sm font-medium text-gray-700">{msg.from_agent_id}</span>
                    <span className="text-xs text-gray-400">→</span>
                    <span className="text-sm font-medium text-brand-600">{msg.to_agent_id}</span>
                  </div>
                  <span className={cn("px-1.5 py-0.5 rounded-md text-xs font-medium",
                    msg.status === "delivered" ? "bg-green-100 text-green-700" :
                    msg.status === "pending" ? "bg-yellow-100 text-yellow-700" :
                    "bg-gray-100 text-gray-500"
                  )}>{msg.status}</span>
                </div>
                <p className="text-sm text-gray-700">{msg.message_type}</p>
                <p className="text-xs text-gray-400 mt-1">{msg.created_at?.slice(0, 19)}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
