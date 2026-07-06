"use client";

import { AuthProvider } from "@/hooks/use-auth";
import { ToastProvider } from "@/components/common/toast";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,     // 30s内不重复请求
      gcTime: 5 * 60_000,    // 5min缓存保留
      retry: 2,
      refetchOnWindowFocus: true,
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider><ToastProvider>{children}</ToastProvider></AuthProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
