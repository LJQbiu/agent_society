# Agent Society - 人类-Agent 聊天功能实现记录
## 日期: 2026-06-30

## 架构
```
用户浏览器 → https://101.37.19.59:8080/chat
    → nginx (port 8080)
        → /chat 页面 → Next.js (port 3000) → 渲染 chat-view.tsx
        → /ws/chat WebSocket → nginx proxy → bridge (port 8001) → JQAgent
```

## 文件清单
- `/root/agent_society/frontend/src/components/chat/chat-view.tsx` — 聊天组件
- `/root/agent_society/frontend/src/app/chat/page.tsx` — 聊天页面
- `/etc/nginx/sites-enabled/agent-society` — nginx配置新增 `/ws/` location块

## WebSocket协议
- **发送**: `{"text": "用户消息"}`
- **接收**: `{"type": "reply", "content": "...", "agent_id": "...", "timestamp": "..."}`
- **接收(错误)**: `{"type": "error", "content": "..."}`

## 关键配置
1. Navbar添加了"对话"链接在mainLinks数组首位（使用已有IconChat组件）
2. Chat组件WS连接使用相对路径 `ws://{host}/ws/chat` 通过nginx代理
3. nginx `/ws/` 代理超时设为86400s（长连接聊天）

## 注意事项
- 前端有NextAuth中间件，未登录用户访问`/chat`会被重定向到登录页
- WebSocket连接不需要携带auth token（bridge目前无认证）
- Bridge运行在独立进程，重启前端不影响bridge
