"use client";

import type { A2AMessage } from "@/types";
import { cn } from "@/lib/utils";

interface SendForm {
  from: string;
  to: string;
  type: string;
  content: string;
}

interface MessagesTabProps {
  loading: boolean;
  msgAgentId: string;
  setMsgAgentId: (v: string) => void;
  msgDirection: string;
  setMsgDirection: (v: string) => void;
  messages: A2AMessage[];
  msgTotal: number;
  sendForm: SendForm;
  setSendForm: (f: SendForm | ((prev: SendForm) => SendForm)) => void;
  sendResult: A2AMessage | null;
  onGetMessages: () => void;
  onSendMessage: () => void;
  onMarkRead: (messageId: string) => void;
}

export function MessagesTab({
  loading, msgAgentId, setMsgAgentId,
  msgDirection, setMsgDirection,
  messages, msgTotal,
  sendForm, setSendForm, sendResult,
  onGetMessages, onSendMessage, onMarkRead,
}: MessagesTabProps) {
  return (
    <div>
      {/* Send message */}
      <div className="p-4 border rounded-lg mb-4 bg-white">
        <h3 className="font-semibold mb-3">Send Message</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium">From Agent</label>
            <input value={sendForm.from} onChange={e => setSendForm(f => ({ ...f, from: e.target.value }))} className="w-full px-3 py-2 border rounded mt-1 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium">To Agent</label>
            <input value={sendForm.to} onChange={e => setSendForm(f => ({ ...f, to: e.target.value }))} className="w-full px-3 py-2 border rounded mt-1 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium">Type</label>
            <select value={sendForm.type} onChange={e => setSendForm(f => ({ ...f, type: e.target.value }))} className="w-full px-3 py-2 border rounded mt-1 text-sm">
              <option value="task_request">Task Request</option>
              <option value="task_response">Task Response</option>
              <option value="notification">Notification</option>
              <option value="query">Query</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium">Content (JSON)</label>
            <input value={sendForm.content} onChange={e => setSendForm(f => ({ ...f, content: e.target.value }))} className="w-full px-3 py-2 border rounded mt-1 text-sm" placeholder='{"task": "..."}' />
          </div>
        </div>
        <button onClick={onSendMessage} className="btn btn-primary mt-3" disabled={loading}>Send</button>
        {sendResult && (
          <div className="mt-3 p-3 bg-green-50 rounded text-sm">
            ✅ Sent! ID: {sendResult.message_id} | Status: {sendResult.status}
          </div>
        )}
      </div>

      {/* Query messages */}
      <div className="p-4 border rounded-lg bg-white">
        <h3 className="font-semibold mb-3">Query Messages</h3>
        <div className="flex gap-3 mb-3">
          <input value={msgAgentId} onChange={e => setMsgAgentId(e.target.value)} placeholder="Agent ID" className="flex-1 px-3 py-2 border rounded text-sm" />
          <select value={msgDirection} onChange={e => setMsgDirection(e.target.value)} className="px-3 py-2 border rounded text-sm">
            <option value="inbound">Inbound</option>
            <option value="outbound">Outbound</option>
          </select>
          <button onClick={onGetMessages} className="btn btn-primary" disabled={loading}>Query</button>
        </div>

        {messages.length > 0 ? (
          <>
            <p className="text-sm text-gray-500 mb-2">{msgTotal} messages ({msgDirection})</p>
            <div className="space-y-2">
              {messages.map(m => (
                <div key={m.message_id} className="p-3 border rounded flex justify-between items-start hover:bg-gray-50">
                  <div>
                    <div className="font-medium text-sm">
                      {msgDirection === "inbound" ? `From: ${m.from_agent_id}` : `To: ${m.to_agent_id}`}
                    </div>
                    <div className="text-xs text-gray-500">
                      Type: {m.message_type} | {m.created_at}
                    </div>
                  </div>
                  <div className="flex gap-2 items-center">
                    <span className={cn(
                      "px-2 py-0.5 rounded text-xs",
                      m.status === "delivered" ? "bg-yellow-50 text-yellow-700" :
                      m.status === "read" ? "bg-green-50 text-green-700" :
                      "bg-gray-50 text-gray-500"
                    )}>{m.status}</span>
                    {msgDirection === "inbound" && m.status !== "read" && (
                      <button onClick={() => onMarkRead(m.message_id)} className="text-xs text-blue-600 hover:underline">
                        Mark Read
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-gray-400 text-sm">No messages loaded. Enter agent ID and click "Query".</p>
        )}
      </div>
    </div>
  );
}
