/**
 * WebSocket客户端 — 自动获取WS token + 自动重连 + 事件分发
 *
 * 认证流程:
 * 1. 调用 /api/auth/ws-token (通过httpOnly Cookie代理到后端)
 * 2. 后端验证Cookie发放5分钟WS token
 * 3. 用ws_token连接 ws://backend:8000/ws?token=xxx
 */

export type WSEventType =
  | "connected"
  | "ping"
  | "pong"
  | "message_new"
  | "org_invite"
  | "project_status_change"
  | "balance_change"
  | "notification"
  | "error";

interface WSMessage {
  type: WSEventType;
  [key: string]: unknown;
}

type EventCallback = (data: WSMessage) => void;

// WS后端地址 — 直连后端(不经过Next.js proxy,因为WS无法走HTTP代理)
function getWSBaseUrl(): string {
  // 开发环境直连后端; 生产环境需配置
  const backendUrl = process.env.NEXT_PUBLIC_WS_URL;
  if (backendUrl) return backendUrl;

  // 自动推断: 前端当前host + 后端端口8000
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${host}:8000`;
  }
  return "ws://localhost:8000";
}

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private listeners: Map<WSEventType, Set<EventCallback>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalClose = false;
  private unreadCount = 0;

  /** 获取WS连接token (通过httpOnly Cookie认证) */
  private async fetchWsToken(): Promise<string> {
    const res = await fetch("/api/auth/ws-token", {
      method: "POST",
      credentials: "include", // 携带httpOnly Cookie
    });
    if (!res.ok) {
      throw new Error(`Failed to get WS token: ${res.status}`);
    }
    const data = await res.json();
    return data.ws_token;
  }

  /** 连接WebSocket */
  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    try {
      const token = await this.fetchWsToken();
      const baseUrl = getWSBaseUrl();
      this.ws = new WebSocket(`${baseUrl}/ws?token=${token}`);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.emit({ type: "connected" });
      };

      this.ws.onmessage = (event) => {
        try {
          const msg: WSMessage = JSON.parse(event.data);
          // pong只是心跳响应,不触发事件
          if (msg.type === "pong") return;
          // ping需要回复pong
          if (msg.type === "ping") {
            this.ws?.send(JSON.stringify({ type: "pong" }));
            return;
          }
          // 通知类事件增加unread计数
          if (
            msg.type === "message_new" ||
            msg.type === "org_invite" ||
            msg.type === "project_status_change" ||
            msg.type === "balance_change" ||
            msg.type === "notification"
          ) {
            this.unreadCount++;
          }
          this.emit(msg);
        } catch {
          // 非JSON消息忽略
        }
      };

      this.ws.onclose = () => {
        this.ws = null;
        if (!this.intentionalClose) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = () => {
        // onclose会随后触发,不需要额外处理
      };
    } catch (err) {
      console.error("[WS] Connection failed:", err);
      this.scheduleReconnect();
    }
  }

  /** 主动断开 */
  disconnect(): void {
    this.intentionalClose = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /** 计划重连 */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn("[WS] Max reconnect attempts reached");
      return;
    }
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;
    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    this.reconnectTimer = setTimeout(() => {
      this.intentionalClose = false;
      this.connect();
    }, delay);
  }

  /** 注册事件监听 */
  on(type: WSEventType, callback: EventCallback): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(callback);
    return () => this.listeners.get(type)?.delete(callback);
  }

  /** 分发事件 */
  private emit(msg: WSMessage): void {
    const callbacks = this.listeners.get(msg.type);
    if (callbacks) {
      Array.from(callbacks).forEach(cb => cb(msg));
    }
    // 同时触发通用notification监听
    const generalCallbacks = this.listeners.get("notification");
    if (generalCallbacks && msg.type !== "notification") {
      Array.from(generalCallbacks).forEach(cb => cb(msg));
    }
  }

  /** 获取未读通知数 */
  getUnreadCount(): number {
    return this.unreadCount;
  }

  /** 清除未读计数 */
  clearUnread(): void {
    this.unreadCount = 0;
  }

  /** 连接状态 */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// 全局单例
export const wsClient = new WebSocketClient();
