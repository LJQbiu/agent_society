"use client";

import { cn } from "@/lib/utils";

/** 圆形旋转Spinner */
export function Spinner({ size = "md", className = "" }: { size?: "sm" | "md" | "lg"; className?: string }) {
  const sizes = { sm: "h-4 w-4", md: "h-6 w-6", lg: "h-8 w-8" };
  return (
    <svg className={cn("animate-spin text-brand-500", sizes[size], className)} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

/** 全页居中Loading */
export function LoadingOverlay({ text = "加载中..." }: { text?: string }) {
  return (
    <div className="flex items-center justify-center py-16 animate-fadeIn">
      <Spinner size="lg" />
      <span className="ml-3 text-gray-500 text-sm">{text}</span>
    </div>
  );
}

/** 骨架屏 - shimmer效果 */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={cn("rounded-lg bg-gradient-to-r from-surface-1 via-surface-2 to-surface-1 animate-shimmer bg-[length:200%_100%]", className)} />
  );
}

/** 骨架卡片组合 */
export function LoadingCard() {
  return (
    <div className="rounded-xl border border-surface-3 p-4 space-y-3 shadow-card">
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-full" />
    </div>
  );
}

/** 骨架列表 */
export function LoadingList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3 animate-fadeIn">
      {Array.from({ length: count }).map((_, i) => <LoadingCard key={i} />)}
    </div>
  );
}

/** 空状态展示 */
export function EmptyState({
  icon = "📭",
  title = "暂无数据",
  description = "",
  action,
  size = "md",
}: {
  icon?: string;
  title?: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  size?: "sm" | "md";
}) {
  const sizes = { sm: "py-6", md: "py-12" };
  const iconSizes = { sm: "text-2xl mb-2", md: "text-4xl mb-3" };
  return (
    <div className={cn("flex flex-col items-center justify-center animate-fadeIn", sizes[size])}>
      <span className={iconSizes[size]}>{icon}</span>
      <h3 className="text-gray-600 font-medium text-base">{title}</h3>
      {description && <p className="text-gray-400 text-sm mt-1 max-w-xs text-center">{description}</p>}
      {action && (
        <button onClick={action.onClick} className="mt-4 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors text-sm shadow-card">
          {action.label}
        </button>
      )}
    </div>
  );
}

/** 错误提示条 */
export function ErrorAlert({
  message,
  onRetry,
  onClose,
}: {
  message: string;
  onRetry?: () => void;
  onClose?: () => void;
}) {
  return (
    <div className="bg-danger-500/10 border border-danger-500/30 rounded-lg px-4 py-3 flex items-start gap-3 animate-slideDown">
      <span className="text-danger-500 text-lg">⚠️</span>
      <div className="flex-1">
        <p className="text-danger-600 text-sm font-medium">{message}</p>
      </div>
      {onRetry && (
        <button onClick={onRetry} className="text-danger-600 text-sm underline hover:no-underline">重试</button>
      )}
      {onClose && (
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
      )}
    </div>
  );
}

/** 成功提示条 */
export function SuccessAlert({ message, onClose }: { message: string; onClose?: () => void }) {
  return (
    <div className="bg-success-500/10 border border-success-500/30 rounded-lg px-4 py-3 flex items-center gap-3 animate-slideDown">
      <span className="text-success-500 text-lg">✅</span>
      <p className="text-success-600 text-sm font-medium flex-1">{message}</p>
      {onClose && (
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
      )}
    </div>
  );
}
