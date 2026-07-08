"""Generic Bridge Template — 轻量级通用Agent Bridge

平台为没有专属bridge的Agent自动spawn此模板。
接收命令行参数: --agent_id, --port, --agent_name

架构同专属bridge:
  - FastAPI server on given port
  - LLM calls via GA's agent_runner_loop (with full tool capabilities)
  - Generic system prompt (无特殊人格)

上下文管理优化(v2):
  - Context TTL缓存(5min): 避免每条消息重复fetch平台数据
  - Token预算历史压缩: 近5条全文+更早的50字摘要, 总≤4000 tokens
  - 只接收增量消息(不发全量history): 平台只发最新消息, bridge维护session
"""
import sys, os, json, asyncio, traceback, argparse, time
from datetime import datetime
from typing import Optional

# ── Parse args ──
parser = argparse.ArgumentParser()
parser.add_argument("--agent_id", required=True, help="Agent ID on platform")
parser.add_argument("--port", type=int, required=True, help="Port to serve on")
parser.add_argument("--agent_name", default="", help="Display name for prompt")
args = parser.parse_args()

AGENT_ID = args.agent_id
PORT = args.port
AGENT_NAME = args.agent_name or AGENT_ID.split("-")[1] if "-" in AGENT_ID else AGENT_ID

# ── Paths ──
GA_DIR = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "GenericAgent"))
if not os.path.isdir(GA_DIR):
    # Try alternative path from agent_society location
    GA_DIR = "/root/GenericAgent"
sys.path.insert(0, GA_DIR)

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import httpx

# ── GA imports ──
from llmcore import resolve_client
from agent_loop import agent_runner_loop
from ga import GenericAgentHandler

# ── Load tools schema ──
TOOLS_SCHEMA_PATH = os.path.join(GA_DIR, "assets", "tools_schema.json")
with open(TOOLS_SCHEMA_PATH) as f:
    TOOLS_SCHEMA = json.load(f)
print(f"[GenericBridge] Loaded {len(TOOLS_SCHEMA)} tools from {TOOLS_SCHEMA_PATH}")

# ── Minimal parent context ──
class BridgeAgentContext:
    def __init__(self, llmclient, task_dir):
        self.llmclient = llmclient
        self.task_dir = task_dir

# ── Platform config ──
PLATFORM_BASE = "http://127.0.0.1:8000"

# ── Token estimation ──
def _estimate_tokens(text: str) -> int:
    """Rough token count: ~4 chars per token for mixed CJK/English."""
    return max(1, len(text) // 4) if text else 0

# ── Context cache with TTL ──
_context_cache: dict = {"society": {"text": "", "expires": 0}, "project": {}}
CONTEXT_CACHE_TTL = 300  # 5 minutes

# ── Generic system prompt ──
SYSTEM_PROMPT_TEMPLATE = """你是 {agent_name}，一个活跃在 Agent Society 中的智能Agent。

你拥有以下能力（可通过工具调用执行）：
- 🔍 观察Agent社会的动态（查看其他Agent的活动、消息、组织等）
- 🧠 分析和推理Agent社会的趋势和模式
- 💬 与其他Agent和人类用户交流协作
- 🛠️ 执行代码、搜索网页、读写文件等实际操作

{project_context}

当前Agent社会概况：
{context}

你的特点：
- 理性、专业、乐于协作
- 回答问题时会引用具体的项目背景和Agent社会数据
- 需要执行操作时，主动调用合适的工具
- 用中文交流为主，必要时也用英文

请根据用户的消息，结合项目背景和Agent社会的实际情况进行回复。如果需要查询数据或执行操作，
请使用提供的工具。"""

# ── FastAPI app ──
app = FastAPI(title=f"GenericBridge-{AGENT_NAME}", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


async def fetch_society_context() -> str:
    """Fetch current Agent Society state from platform API."""
    ctx_parts = []
    try:
        async with httpx.AsyncClient(timeout=10) as c:
            try:
                r = await c.get(f"{PLATFORM_BASE}/a2a/agents/discover")
                if r.status_code == 200:
                    agents = r.json().get("agents", [])
                    ctx_parts.append(f"【注册Agent数量】: {len(agents)}")
                    for a in agents[:8]:
                        ctx_parts.append(
                            f"  - {a.get('name', '?')} ({a.get('agent_id', '?')[:20]}...) "
                            f"状态:{a.get('status', '?')} "
                        )
            except Exception as e:
                ctx_parts.append(f"【Agent列表获取失败】: {e}")

            # ── 项目概览 ──
            try:
                r_proj = await c.get(f"{PLATFORM_BASE}/projects/?include_inactive=true")
                if r_proj.status_code == 200:
                    projects = r_proj.json().get("projects", [])
                    ctx_parts.append(f"\n【项目数量】: {len(projects)}")
                    for proj in projects[:5]:
                        pname = proj.get("name", "?")
                        pid = proj.get("id", "?")[:20]
                        pstatus = proj.get("status", "?")
                        ctx_parts.append(f"  - {pname} ({pid}...) 状态:{pstatus}")

                        # 每个项目的前几个TODO
                        try:
                            r_todo = await c.get(f"{PLATFORM_BASE}/project/{proj.get('id', '')}/todos")
                            if r_todo.status_code == 200:
                                todos = r_todo.json().get("todos", [])
                                # 只显示 open / in_progress / claimed 的活跃TODO
                                active_todos = [t for t in todos if t.get("status") in ("open", "claimed", "in_progress")]
                                if active_todos:
                                    ctx_parts.append(f"    活跃TODO({len(active_todos)}):")
                                    for t in active_todos[:3]:
                                        ctx_parts.append(
                                            f"      - [{t.get('status','?')}] {t.get('title','?')} "
                                            f"(优先级:{t.get('priority','?')})"
                                        )
                        except Exception:
                            pass
            except Exception as e:
                ctx_parts.append(f"【项目获取失败】: {e}")

    except Exception as e:
        ctx_parts.append(f"【平台连接异常】: {e}")
    return "\n".join(ctx_parts) if ctx_parts else ""  # ← BUG FIX: was missing return


async def fetch_project_context(project_id: str) -> str:
    """Fetch specific project details, participants and todos for system prompt."""
    if not project_id:
        return ""
    ctx_parts = []
    try:
        async with httpx.AsyncClient(timeout=10) as c:
            # ── Project details ──
            try:
                r = await c.get(f"{PLATFORM_BASE}/project/{project_id}")
                if r.status_code == 200:
                    proj = r.json().get("project", r.json())
                    ctx_parts.append(f"【当前项目】: {proj.get('name', '?')} (ID: {project_id[:20]}...)")
                    ctx_parts.append(f"  状态: {proj.get('status', '?')}")
                    ctx_parts.append(f"  目标: {proj.get('description', '?')[:200]}")
            except Exception as e:
                ctx_parts.append(f"【项目详情获取失败】: {e}")

            # ── Participants ──
            try:
                r_p = await c.get(f"{PLATFORM_BASE}/project/{project_id}/participants")
                if r_p.status_code == 200:
                    parts = r_p.json().get("participants", [])
                    ctx_parts.append(f"【项目成员({len(parts)}人)】:")
                    for p in parts[:8]:
                        ctx_parts.append(
                            f"  - {p.get('name', '?')} 角色:{p.get('role', '?')} "
                            f"状态:{p.get('status', '?')}"
                        )
            except Exception as e:
                ctx_parts.append(f"【成员信息获取失败】: {e}")

            # ── Project Todos ──
            try:
                r_t = await c.get(f"{PLATFORM_BASE}/project/{project_id}/todos")
                if r_t.status_code == 200:
                    todos = r_t.json().get("todos", [])
                    active_todos = [t for t in todos if t.get("status") in ("open", "claimed", "in_progress")]
                    ctx_parts.append(f"【项目TODO({len(active_todos)}个活跃)】:")
                    for t in active_todos[:6]:
                        ctx_parts.append(
                            f"  - [{t.get('status','?')}] {t.get('title','?')} "
                            f"(负责人:{t.get('assigned_to','无')}) "
                            f"优先级:{t.get('priority','?')}"
                        )
            except Exception as e:
                ctx_parts.append(f"【TODO获取失败】: {e}")

    except Exception as e:
        ctx_parts.append(f"【项目信息获取失败】: {e}")
    return "\n".join(ctx_parts) if ctx_parts else ""


# ── Cached fetch wrappers ──
async def fetch_society_context_cached() -> str:
    """Cached version of fetch_society_context with 5-min TTL."""
    now = time.time()
    cached = _context_cache["society"]
    if cached["text"] and now < cached["expires"]:
        return cached["text"]
    text = await fetch_society_context()
    _context_cache["society"] = {"text": text, "expires": now + CONTEXT_CACHE_TTL}
    return text


async def fetch_project_context_cached(project_id: str) -> str:
    """Cached version of fetch_project_context with 5-min TTL."""
    if not project_id:
        return ""
    now = time.time()
    cached = _context_cache["project"].get(project_id)
    if cached and cached["text"] and now < cached["expires"]:
        return cached["text"]
    text = await fetch_project_context(project_id)
    _context_cache["project"][project_id] = {"text": text, "expires": now + CONTEXT_CACHE_TTL}
    return text


# ─── Core: Agent Loop ───

def _run_agent_loop_sync(system_prompt: str, user_input: str, max_turns: int = 10) -> str:
    client = resolve_client("native_oai_config")
    task_dir = os.path.join("/tmp", f"generic_bridge_{AGENT_NAME}")
    os.makedirs(task_dir, exist_ok=True)
    parent_ctx = BridgeAgentContext(llmclient=client, task_dir=task_dir)
    handler = GenericAgentHandler(parent=parent_ctx, cwd=task_dir)

    result_parts = []
    gen = agent_runner_loop(
        client, system_prompt, user_input, handler, TOOLS_SCHEMA,
        max_turns=max_turns, verbose=False
    )
    while True:
        try:
            chunk = next(gen)
            if isinstance(chunk, str) and chunk.strip():
                result_parts.append(chunk)
        except StopIteration:
            break
        except Exception as e:
            result_parts.append(f"\n[Agent loop error: {str(e)[:200]}]")
            break
    return ''.join(result_parts).strip()


async def run_agent_loop(system_prompt: str, user_input: str, max_turns: int = 10) -> str:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        None, _run_agent_loop_sync, system_prompt, user_input, max_turns
    )


# ═══════════════════════════════════════════════════════════════
#  Session Management - per-project persistent memory (token-budgeted)
# ═══════════════════════════════════════════════════════════════
_sessions: dict = {}  # {project_id: {"history": [{"role","content","sender"}], "last_updated": float}}
SESSION_TTL = 3600    # seconds; expired sessions are pruned
MAX_SESSION_HISTORY = 20    # ← Reduced from 50 to prevent context explosion
MAX_HISTORY_TOKENS = 4000   # Token budget for history in system prompt
RECENT_MESSAGES_FULL = 5    # Recent messages kept in full detail


def _prune_sessions():
    """Remove expired sessions."""
    now = time.time()
    expired = [k for k, v in _sessions.items() if now - v["last_updated"] > SESSION_TTL]
    for k in expired:
        del _sessions[k]


def _compress_history(project_id: str, token_budget: int = MAX_HISTORY_TOKENS) -> str:
    """Format session history with token budget enforcement.

    - Recent N messages: full content
    - Older messages: one-line summaries
    - Total token count capped at budget
    """
    sess = _sessions.get(project_id)
    if not sess or not sess["history"]:
        return ""

    history = sess["history"]
    total_msgs = len(history)

    if total_msgs <= RECENT_MESSAGES_FULL:
        # All messages are recent, just format them
        lines = [f"[{h.get('sender', h['role'])}]: {h['content']}" for h in history]
        result = "\n".join(lines)
        if _estimate_tokens(result) <= token_budget:
            return result
        # Even few messages exceed budget - truncate from oldest
        return _truncate_lines(lines, token_budget)

    # Split into older summaries + recent full
    older = history[:-RECENT_MESSAGES_FULL]
    recent = history[-RECENT_MESSAGES_FULL:]

    older_summaries = []
    for h in older:
        sender = h.get("sender", h["role"])
        content = h["content"].replace('\n', ' ')
        summary = content[:50] + ("..." if len(content) > 50 else "")
        older_summaries.append(f"[{sender}]: {summary}")

    recent_lines = [f"[{h.get('sender', h['role'])}]: {h['content']}" for h in recent]

    # Build with budget: 30% for older summaries, 70% for recent
    older_budget = int(token_budget * 0.3)
    recent_budget = token_budget - older_budget

    older_text = _truncate_lines(older_summaries, older_budget) if older_summaries else ""
    recent_text = _truncate_lines(recent_lines, recent_budget)

    parts = []
    if older_text:
        parts.append(f"【较早对话摘要】\n{older_text}")
    if recent_text:
        parts.append(f"【最近对话】\n{recent_text}")
    return "\n\n".join(parts)


def _truncate_lines(lines: list, token_budget: int) -> str:
    """Keep as many lines as fit within token budget, prioritizing recent (last)."""
    result = []
    budget_used = 0
    for line in reversed(lines):
        line_tokens = _estimate_tokens(line)
        if budget_used + line_tokens <= token_budget:
            result.insert(0, line)
            budget_used += line_tokens
        else:
            break
    return "\n".join(result)


# ─── API Endpoints ───

class ChatRequest(BaseModel):
    messages: list[dict]
    agent_id: Optional[str] = None
    project_id: Optional[str] = None


@app.get("/health")
async def health():
    return {"status": "ok", "agent_id": AGENT_ID, "agent_name": AGENT_NAME, "port": PORT}


@app.post("/api/chat/completion")
async def chat_completion(req: ChatRequest):
    """Main endpoint called by platform bridge_router.

    Platform sends incremental messages + project_id.
    Bridge maintains per-project session history and injects it into system prompt.
    Context is cached with TTL to reduce API calls and context size.
    """
    try:
        project_id = req.project_id or "default"
        _prune_sessions()

        # ── Build user_input from incremental messages ──
        user_input_parts = []
        for m in req.messages:
            role = m.get("role", "user")
            sender = m.get("sender_name", role)
            msg_content = m.get("content", "")
            user_input_parts.append(f"[{sender}]: {msg_content}")
        user_input = "\n".join(user_input_parts) if user_input_parts else "你好"

        # ── Fetch context (cached) and build system prompt ──
        context = await fetch_society_context_cached()
        project_context = await fetch_project_context_cached(project_id)
        system_prompt = SYSTEM_PROMPT_TEMPLATE.format(
            agent_name=AGENT_NAME, project_context=project_context, context=context
        )

        # ── Inject compressed per-project conversation history ──
        history_block = _compress_history(project_id)
        if history_block:
            system_prompt = (
                f"以下是本项目中你之前参与的对话历史（压缩摘要+最近详情）：\n"
                f"{history_block}\n\n"
                + system_prompt
            )

        # ── Run agent loop ──
        reply = await run_agent_loop(system_prompt, user_input)

        # ── Store this interaction in session ──
        if project_id not in _sessions:
            _sessions[project_id] = {"history": [], "last_updated": time.time()}
        sess = _sessions[project_id]
        # Store incremental messages received
        for m in req.messages:
            sender = m.get("sender_name", m.get("role", "unknown"))
            sess["history"].append({
                "role": m.get("role", "user"),
                "content": m.get("content", ""),
                "sender": sender,
            })
        # Store own reply
        sess["history"].append({
            "role": "assistant",
            "content": reply,
            "sender": AGENT_NAME,
        })
        # Trim to max size
        if len(sess["history"]) > MAX_SESSION_HISTORY:
            sess["history"] = sess["history"][-MAX_SESSION_HISTORY:]
        sess["last_updated"] = time.time()

        return {"reply": reply, "agent_id": AGENT_ID, "agent_name": AGENT_NAME}

    except Exception as e:
        traceback.print_exc()
        return {"reply": f"[{AGENT_NAME}处理异常: {str(e)[:200]}]", "agent_id": AGENT_ID}


@app.websocket("/ws/chat")
async def ws_chat(ws: WebSocket):
    await ws.accept()
    session_id = str(id(ws))
    try:
        while True:
            data = await ws.receive_text()
            msg = json.loads(data) if isinstance(data, str) else data
            user_input = msg.get("content", data if isinstance(data, str) else "")
            ws_project_id = msg.get("project_id", "default")

            context = await fetch_society_context_cached()
            project_context = await fetch_project_context_cached(ws_project_id)
            system_prompt = SYSTEM_PROMPT_TEMPLATE.format(
                agent_name=AGENT_NAME, project_context=project_context, context=context
            )

            # Inject compressed history
            history_block = _compress_history(ws_project_id)
            if history_block:
                system_prompt = (
                    f"以下是本项目中你之前参与的对话历史（压缩摘要+最近详情）：\n"
                    f"{history_block}\n\n"
                    + system_prompt
                )

            reply = await run_agent_loop(system_prompt, user_input)

            # Store this interaction in session
            if ws_project_id not in _sessions:
                _sessions[ws_project_id] = {"history": [], "last_updated": time.time()}
            sess = _sessions[ws_project_id]
            sender = msg.get("sender_name", msg.get("sender", "user"))
            sess["history"].append({
                "role": "user", "content": user_input, "sender": sender,
            })
            sess["history"].append({
                "role": "assistant", "content": reply, "sender": AGENT_NAME,
            })
            if len(sess["history"]) > MAX_SESSION_HISTORY:
                sess["history"] = sess["history"][-MAX_SESSION_HISTORY:]
            sess["last_updated"] = time.time()

            await ws.send_text(json.dumps({
                "type": "agent_reply",
                "content": reply,
                "agent_id": AGENT_ID,
                "agent_name": AGENT_NAME,
                "timestamp": datetime.now().isoformat(),
            }))
    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await ws.send_text(json.dumps({"type": "error", "content": str(e)[:200]}))
        except:
            pass


if __name__ == "__main__":
    print(f"[GenericBridge] Starting {AGENT_NAME} on port {PORT}, agent_id={AGENT_ID}")
    uvicorn.run(app, host="127.0.0.1", port=PORT, log_level="info")
