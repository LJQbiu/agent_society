"use client";
import { MessageCircle, Send, Mail, Loader2, Activity } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/components/common/toast";
import { useMessages, useSendMessage } from "@/hooks/use-queries";

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
  const { data: messages = [], isLoading } = useMessages(user?.id || "", { limit: 50 });
  const sendMessageMutation = useSendMessage();

  const [recipient, setRecipient] = useState("");
  const [content, setContent] = useState("");
  const [msgType, setMsgType] = useState("task-request");

  const sendMessage = async () => {
    if (!recipient.trim() || !content.trim()) {
      showToast("请填写接收方和消息内容", "error");
      return;
    }
    try {
      await sendMessageMutation.mutateAsync({
        from_agent_id: user!.id,
        to_agent_id: recipient,
        content: { text: content },
        message_type: msgType,
      });
      showToast("消息已发送", "success");
      setRecipient("");
      setContent("");
    } catch (e: any) {
      showToast(e.message, "error");
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
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-indigo-600 flex items-center justify-center text-white shadow-md">
          <MessageCircle className="w-5 h-5" strokeWidth={1.5} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">消息中心</h2>
          <p className="text-sm text-gray-500">A2A 通信与协作</p>
        </div>
      </div>

      {/* Send Message */}
      <section className="glass-card p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Send className="w-5 h-5 text-brand-500" strokeWidth={1.5} />
          发送消息
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">接收方 Agent ID</label>
            <input value={recipient} onChange={e => setRecipient(e.target.value)} placeholder="Agent ID" className="input w-full" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">消息类型</label>
            <select value={msgType} onChange={e => setMsgType(e.target.value)} className="input w-full">
              <option value="task-request">任务请求</option>
              <option value="task-response">任务响应</option>
              <option value="notification">通知</option>
              <option value="chat">聊天</option>
            </select>
          </div>
        </div>
        <div className="mt-4">
          <label className="text-sm font-medium text-gray-700 mb-1 block">内容</label>
          <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="输入消息内容..." className="input w-full min-h-[80px]" />
        </div>
        <button onClick={sendMessage} disabled={sendMessageMutation.isPending} className="btn-primary mt-4 px-6 py-2">
          {sendMessageMutation.isPending ? "发送中..." : "发送"}
        </button>
      </section>

      {/* Messages */}
      <section>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Mail className="w-5 h-5 text-brand-500" strokeWidth={1.5} />
          收发记录
        </h2>
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" strokeWidth={2} />
            加载中...
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <MessageCircle className="w-12 h-12 mb-3 opacity-50" strokeWidth={1} />
            <p>暂无消息</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
            {(messages as Message[]).map((msg) => (
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
                        <Send className="w-4 h-4" strokeWidth={1.5} />
                      ) : (
                        <Activity className="w-4 h-4" strokeWidth={1.5} />
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
