"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/status-components";
import type { TodoCreate, TodoUpdate, TodoClaimRequest, MutationAction, SimpleMutation } from "@/types";

interface TodoItem {
  id: string;
  title: string;
  description?: string;
  priority: string;
  status: string;
  claimed_by?: string;
  claimed_by_name?: string;
  claimed_at?: string;
  created_at: string;
}

interface ProjectTodoPanelProps {
  todos: TodoItem[];
  projectId: string;
  agentId: string | undefined;
  todoBorderColor: (s: string) => string;
  createTodo: MutationAction<{ id: string; data: TodoCreate }>;
  claimTodo: SimpleMutation<{ id: string; todoId: string; data: TodoClaimRequest }>;
  updateTodo: MutationAction<{ id: string; todoId: string; data: TodoUpdate }>;
  deleteTodo: MutationAction<{ id: string; todoId: string }>;
  hasAgents: boolean;
  onSuccessMsg: (msg: string) => void;
}

export function ProjectTodoPanel({
  todos, projectId, agentId, todoBorderColor,
  createTodo, claimTodo, updateTodo, deleteTodo, hasAgents, onSuccessMsg,
}: ProjectTodoPanelProps) {
  const [showTodoForm, setShowTodoForm] = useState(false);
  const [todoForm, setTodoForm] = useState({ title: "", description: "", priority: "medium" });

  // Edit state per todo
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ title: string; description: string; priority: "low" | "medium" | "high" | "critical" }>({ title: "", description: "", priority: "medium" });

  // Delete confirmation
  const [deletingTodoId, setDeletingTodoId] = useState<string | null>(null);

  const handleCreateTodo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !agentId) return;
    createTodo.mutate({ id: projectId, data: todoForm as TodoCreate }, {
      onSuccess: () => { setTodoForm({ title: "", description: "", priority: "medium" }); setShowTodoForm(false); onSuccessMsg("TODO已创建！"); },
    });
  };

  const handleClaimTodo = (todoId: string) => {
    if (!projectId || !agentId) return;
    claimTodo.mutate({ id: projectId, todoId, data: { claimer_type: "agent", agent_id: agentId } });
  };

  const handleUpdateTodoStatus = (todoId: string, status: string) => {
    if (!projectId || !agentId) return;
    updateTodo.mutate({ id: projectId, todoId, data: { status: status as "open" | "in_progress" | "completed" | "cancelled", agent_id: agentId } });
  };

  const handleEditStart = (todo: TodoItem) => {
    setEditingTodoId(todo.id);
    setEditForm({ title: todo.title, description: todo.description || "", priority: todo.priority as "low" | "medium" | "high" | "critical" });
  };

  const handleEditCancel = () => {
    setEditingTodoId(null);
  };

  const handleEditSave = (todoId: string) => {
    if (!projectId || !editForm.title.trim()) return;
    updateTodo.mutate({ id: projectId, todoId, data: { title: editForm.title.trim(), description: editForm.description, priority: editForm.priority } }, {
      onSuccess: () => { setEditingTodoId(null); onSuccessMsg("TODO已更新！"); },
    });
  };

  const handleDeleteConfirm = (todoId: string) => {
    if (!projectId) return;
    deleteTodo.mutate({ id: projectId, todoId }, {
      onSuccess: () => { setDeletingTodoId(null); onSuccessMsg("TODO已删除！"); },
    });
  };

  return (
    <div className="bg-white p-5 rounded-xl shadow-card border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-gray-800">📋 TODO列表</h3>
        {hasAgents && (
          <button onClick={() => setShowTodoForm(!showTodoForm)}
            className="bg-purple-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-purple-700 transition-all shadow-sm">
            ➕ 新TODO
          </button>
        )}
      </div>
      {showTodoForm && (
        <form onSubmit={handleCreateTodo} className="bg-gray-50 p-3 rounded-lg mb-3 space-y-2 animate-slideDown border border-gray-200">
          <input value={todoForm.title} onChange={e => setTodoForm(f => ({ ...f, title: e.target.value }))}
            placeholder="标题" className="border border-gray-200 p-2 rounded-lg w-full focus:border-brand-500" required />
          <textarea value={todoForm.description} onChange={e => setTodoForm(f => ({ ...f, description: e.target.value }))}
            placeholder="描述" className="border border-gray-200 p-2 rounded-lg w-full focus:border-brand-500" rows={2} />
          <select value={todoForm.priority}
            onChange={e => setTodoForm(f => ({ ...f, priority: e.target.value as "low" | "medium" | "high" | "critical" }))}
            className="border border-gray-200 p-2 rounded-lg focus:border-brand-500">
            <option value="low">低</option>
            <option value="medium">中</option>
            <option value="high">高</option>
            <option value="critical">紧急</option>
          </select>
          <div className="flex gap-2">
            <button type="submit" className="bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700 transition-all shadow-sm">创建</button>
            <button type="button" onClick={() => setShowTodoForm(false)} className="bg-gray-200 px-3 py-1.5 rounded-lg text-gray-600 hover:bg-gray-300 transition-all">取消</button>
          </div>
        </form>
      )}
      <div className="space-y-2 max-h-72 overflow-y-auto">
        {todos.length === 0 ? (
          <EmptyState icon="📋" title="暂无TODO" description="创建第一个任务项" size="sm" />
        ) : todos.map(todo => (
          <div key={todo.id} className={cn("p-2.5 rounded-lg border-l-4", todoBorderColor(todo.status))}>
            {editingTodoId === todo.id ? (
              /* ── 编辑模式 ── */
              <div className="space-y-2">
                <input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="标题" className="border border-gray-200 p-1.5 rounded-lg w-full text-sm focus:border-brand-500" />
                <textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="描述" className="border border-gray-200 p-1.5 rounded-lg w-full text-sm focus:border-brand-500" rows={1} />
                <select value={editForm.priority}
                  onChange={e => setEditForm(f => ({ ...f, priority: e.target.value as "low" | "medium" | "high" | "critical" }))}
                  className="border border-gray-200 p-1.5 rounded-lg text-sm focus:border-brand-500">
                  <option value="low">低</option>
                  <option value="medium">中</option>
                  <option value="high">高</option>
                  <option value="critical">紧急</option>
                </select>
                <div className="flex gap-1">
                  <button onClick={() => handleEditSave(todo.id)}
                    className="bg-green-500 text-white px-2 py-1 rounded-lg text-xs hover:bg-green-600 transition-all">💾 保存</button>
                  <button onClick={handleEditCancel}
                    className="bg-gray-200 px-2 py-1 rounded-lg text-xs text-gray-600 hover:bg-gray-300 transition-all">取消</button>
                </div>
              </div>
            ) : deletingTodoId === todo.id ? (
              /* ── 删除确认 ── */
              <div className="flex items-center gap-2">
                <span className="text-sm text-red-600">确认删除 "{todo.title}"？</span>
                <button onClick={() => handleDeleteConfirm(todo.id)}
                  className="bg-red-600 text-white px-2 py-1 rounded-lg text-xs hover:bg-red-700 transition-all">确认删除</button>
                <button onClick={() => setDeletingTodoId(null)}
                  className="bg-gray-200 px-2 py-1 rounded-lg text-xs hover:bg-gray-300 transition-all">取消</button>
              </div>
            ) : (
              /* ── 正常显示 ── */
              <div>
                <div className="flex items-center justify-between">
                  <div>
                    <span className={cn("font-semibold text-sm",
                      todo.priority === "critical" ? "text-red-600" : todo.priority === "high" ? "text-orange-600" : "text-gray-700"
                    )}>
                      [{todo.priority}] {todo.title}
                    </span>
                    {todo.description && <p className="text-xs text-gray-500 mt-1">{todo.description}</p>}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    {/* 状态操作按钮 */}
                    {todo.status === "open" && (
                      <button onClick={() => handleClaimTodo(todo.id)}
                        className="bg-blue-500 text-white px-2 py-1 rounded-lg text-xs hover:bg-blue-600 transition-all shadow-sm">
                        🤝 认领
                      </button>
                    )}
                    {todo.status === "claimed" && (
                      <button onClick={() => handleUpdateTodoStatus(todo.id, "in_progress")}
                        className="bg-yellow-500 text-white px-2 py-1 rounded-lg text-xs hover:bg-yellow-600 transition-all shadow-sm">
                        ▶ 开始
                      </button>
                    )}
                    {todo.status === "in_progress" && (
                      <button onClick={() => handleUpdateTodoStatus(todo.id, "completed")}
                        className="bg-green-500 text-white px-2 py-1 rounded-lg text-xs hover:bg-green-600 transition-all shadow-sm">
                        ✅ 完成
                      </button>
                    )}
                    {/* 退回按钮 - 已完成/已取消可退回待处理 */}
                    {(todo.status === "completed" || todo.status === "cancelled") && (
                      <button onClick={() => handleUpdateTodoStatus(todo.id, "open")}
                        className="bg-gray-400 text-white px-2 py-1 rounded-lg text-xs hover:bg-gray-500 transition-all shadow-sm">
                        ↩ 退回
                      </button>
                    )}
                    {/* 编辑按钮 */}
                    {hasAgents && (
                      <button onClick={() => handleEditStart(todo)}
                        className="bg-indigo-100 text-indigo-600 px-2 py-1 rounded-lg text-xs hover:bg-indigo-200 transition-all">
                        ✏️
                      </button>
                    )}
                    {/* 删除按钮 */}
                    {hasAgents && (
                      <button onClick={() => setDeletingTodoId(todo.id)}
                        className="bg-red-100 text-red-500 px-2 py-1 rounded-lg text-xs hover:bg-red-200 transition-all">
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
                {todo.claimed_by && (
                  <div className="text-xs text-blue-500 mt-1">
                    认领者: {todo.claimed_by_name || todo.claimed_by} {todo.claimed_at && `于 ${new Date(todo.claimed_at).toLocaleString()}`}
                  </div>
                )}
                <div className="text-xs text-gray-400 mt-1">
                  创建: {new Date(todo.created_at).toLocaleString()} · 状态: {todo.status}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
