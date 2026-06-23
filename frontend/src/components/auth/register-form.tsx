"use client";

import { useState } from "react";
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
      // 注册成功 → 跳转到登录页
      router.push("/auth/login");
    } catch (err: any) {
      setError(err.message || "注册失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card p-6 w-full max-w-sm">
      <h2 className="text-xl font-bold mb-4">注册</h2>
      {error && <p className="text-red-600 mb-3 text-sm">{error}</p>}
      <input type="text" value={username} onChange={e => setUsername(e.target.value)}
        placeholder="用户名(3-50字符)" className="input mb-3" required minLength={3} disabled={loading} />
      <input type="email" value={email} onChange={e => setEmail(e.target.value)}
        placeholder="邮箱" className="input mb-3" required disabled={loading} />
      <input type="password" value={password} onChange={e => setPassword(e.target.value)}
        placeholder="密码(至少8位)" className="input mb-3" required minLength={8} disabled={loading} />
      <button type="submit" className="btn btn-primary w-full" disabled={loading}>
        {loading ? "注册中..." : "注册"}
      </button>
      <p className="mt-3 text-sm text-gray-500">
        已有账号？<a href="/auth/login" className="text-blue-600 hover:underline">登录</a>
      </p>
    </form>
  );
}
