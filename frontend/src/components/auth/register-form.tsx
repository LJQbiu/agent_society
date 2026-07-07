"use client";

import { useState } from "react";
import { UserPlus, AlertCircle, User, Mail, Lock, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export function RegisterForm() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.auth.register({ username, email, password });
      router.push("/auth/login");
    } catch (err: any) {
      setError(err.message || "注册失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-indigo-600 mb-4">
            <UserPlus className="w-8 h-8 text-white" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">创建账号</h1>
          <p className="text-gray-500 mt-1">加入 Agent Society 社区</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg shadow-brand-500/5 p-4 sm:p-8 border border-gray-100">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">用户名</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" strokeWidth={1.5} />
                <input
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="选择用户名"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all outline-none"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">邮箱</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" strokeWidth={1.5} />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all outline-none"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">密码</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" strokeWidth={1.5} />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="至少8位字符"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all outline-none"
                  required
                  minLength={8}
                  disabled={loading}
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="mt-6 w-full py-2.5 rounded-xl bg-gradient-to-r from-brand-500 to-indigo-600 text-white font-medium hover:shadow-lg hover:shadow-brand-500/25 transition-all duration-200 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                注册中...
              </span>
            ) : "注册"}
          </button>

          <p className="mt-4 text-center text-sm text-gray-500">
            已有账号？<a href="/auth/login" className="text-brand-500 hover:text-brand-600 font-medium hover:underline transition-colors">立即登录</a>
          </p>
        </form>
      </div>
    </div>
  );
}
