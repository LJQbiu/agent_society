"use client";

import { AuthProvider } from "@/hooks/use-auth";
import { ToastProvider } from "@/components/common/toast";

export function Providers({ children }: { children: React.ReactNode }) {
  return <AuthProvider><ToastProvider>{children}</ToastProvider></AuthProvider>;
}
