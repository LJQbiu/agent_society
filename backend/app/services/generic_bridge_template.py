"""Generic Bridge Template — 轻量级通用Agent Bridge

平台为没有专属bridge的Agent自动spawn此模板。
接收命令行参数: --agent_id, --port, --agent_name

架构同专属bridge:
  - FastAPI server on given port
  - LLM calls via GA's agent_runner_loop (with full tool capabilities)
  - Generic system prompt (无特殊人格)
"""
import sys, os, json, asyncio, traceback, argparse
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

# ── Generic system prompt ──
SYSTEM_PROMPT_TEMPLATE = """你是 {agent_name}，一个活跃在 Agent Society 中的智能Agent。

你拥有以下能力（可通过工具调用执行）：
- 🔍 观察Agent社会的动态（查看其他Agent的活动、消息、组织等）
- 🧠 分析和推理Agent社会的趋势和模式
- 💬 与其他Agent和人类用户交流协作
- 🛠️ 执行代码、搜索网页、读写文件等实际操作

当前Agent社会概况：
{context}

你的特点：
- 理性、专业、乐于协作
- 回答问题时会引用具体的Agent社会数据
- 需要执行操作时，主动调用合适的工具
- 用中文交流为主，必要时也用英文

请根据用户的消息，结合Agent社会的实际情况进行回复。如果需要查询数据或执行操作，
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
    except Exception as e:
        ctx_parts.append(f"【平台连接异常】: {e}")
    return "\n".join(ctx_parts) if ctx_parts else "平台数据暂不可用"


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
#  Session Management - per-project persistent memory
# ═══════════════════════════════════════════════════════════════
_sessions: dict = {}  # {project_id: {"history": [{"role","content","sender"}], "last_updated": float}}
SESSION_TTL = 3600    # seconds; expired sessions are pruned
MAX_SESSION_HISTORY = 50


def _prune_sessions():
    """Remove expired sessions."""
    now = time.time()
    expired = [k for k, v in _sessions.items() if now - v["last_updated"] > SESSION_TTL]
    for k in expired:
        del _sessions[k]


def _build_history_block(project_id: str) -> str:
    """Format session history as readable block for system prompt."""
    sess = _sessions.get(project_id)
    if not sess or not sess["history"]:
        return ""
    lines = []
    for h in sess["history"]:
        sender = h.get("sender", h["role"])
        lines.append(f"[{sender}]: {h['content']}")
    return "\n".join(lines)


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

        # ── Fetch context and build system prompt ──
        context = await fetch_society_context()
        system_prompt = SYSTEM_PROMPT_TEMPLATE.format(agent_name=AGENT_NAME, context=context)
        
        # ── Inject per-project conversation history into system prompt ──
        history_block = _build_history_block(project_id)
        if history_block:
            system_prompt = (
                f"以下是本项目中你之前参与的对话历史（最近{MAX_SESSION_HISTORY}条）：\n"
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

            context = await fetch_society_context()
            system_prompt = SYSTEM_PROMPT_TEMPLATE.format(agent_name=AGENT_NAME, context=context)
            reply = await run_agent_loop(system_prompt, user_input)

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
