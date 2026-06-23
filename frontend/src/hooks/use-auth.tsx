"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { api } from "@/lib/api";
import type { HumanProfile } from "@/types";

interface AuthContextType {
  user: HumanProfile | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null, login: async () => {}, logout: async () => {}, isLoading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<HumanProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // httpOnly Cookie模式：不再检查localStorage，直接尝试获取profile
  useEffect(() => {
    api.identity.getProfile()
      .then(setUser)
      .catch(() => setUser(null)); // Cookie无效 → 未登录
    setIsLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    // login API会通过Set-Cookie写入httpOnly Cookie
    await api.auth.login({ username, password });
    const profile = await api.identity.getProfile();
    setUser(profile);
  };

  const logout = async () => {
    // logout API会通过Set-Cookie清除httpOnly Cookie
    await api.auth.logout().catch(() => {}); // 即使失败也清除本地状态
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, login, logout, isLoading }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
