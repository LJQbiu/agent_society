"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";

export function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
      router.push("/");
    } catch (err: any) {
      setError(err.message === "UNAUTHORIZED" ? "用户名或密码错误" : "登录失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card p-6 w-full max-w-sm">
      <h2 className="text-xl font-bold mb-4">登录</h2>
      {error && <p className="text-red-600 mb-3 text-sm">{error}</p>}
      <input type="text" value={username} onChange={e => setUsername(e.target.value)}
        placeholder="用户名" className="input mb-3" required disabled={loading} />
      <input type="password" value={password} onChange={e => setPassword(e.target.value)}
        placeholder="密码" className="input mb-3" required disabled={loading} />
      <button type="submit" className="btn btn-primary w-full" disabled={loading}>
        {loading ? "登录中..." : "登录"}
      </button>
      <p className="mt-3 text-sm text-gray-500">
        没有账号？<a href="/auth/register" className="text-blue-600 hover:underline">注册</a>
      </p>
    </form>
  );
}
