"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export function ForgotPasswordForm() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [resetToken, setResetToken] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!username && !email) {
      setError("请输入用户名或邮箱");
      return;
    }

    setLoading(true);
    try {
      const result = await api.auth.forgotPassword({
        username: username || undefined,
        email: email || undefined,
      });
      setResetToken(result.reset_token);
      setSuccess(true);
    } catch (err: any) {
      setError(err?.detail || err?.message || "请求失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-xl shadow-lg">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900">重置Token已生成</h2>
            <p className="mt-2 text-sm text-gray-600">
              请复制以下Token，前往重置密码页面设置新密码
            </p>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-xs text-yellow-700 mb-2">⚠️ Token有效期为1小时，请尽快使用</p>
            <div className="bg-white border rounded p-3 font-mono text-sm break-all select-all">
              {resetToken}
            </div>
          </div>
          <button
            onClick={() => router.push(`/auth/reset-password?token=${resetToken}`)}
            className="w-full py-2 px-4 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors font-medium"
          >
            前往重置密码
          </button>
          <p className="text-center text-sm text-gray-500">
            <a href="/auth/login" className="text-brand-500 hover:text-brand-600 hover:underline">返回登录</a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-xl shadow-lg">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">忘记密码</h2>
          <p className="mt-2 text-sm text-gray-600">
            输入用户名或邮箱，获取密码重置Token
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              placeholder="输入用户名（或使用邮箱）"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              placeholder="输入邮箱（或使用用户名）"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors font-medium disabled:opacity-50"
          >
            {loading ? "请求中..." : "获取重置Token"}
          </button>

          <p className="text-center text-sm text-gray-500">
            <a href="/auth/login" className="text-brand-500 hover:text-brand-600 hover:underline">返回登录</a>
          </p>
        </form>
      </div>
    </div>
  );
}
