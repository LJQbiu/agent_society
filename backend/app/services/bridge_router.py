"""Bridge路由服务 — 通过Agent Bridge获取Agent回复

架构原则：平台不调LLM，所有AI能力来自Agent Bridge。
- 有专属bridge → 路由到专属bridge
- 没有专属bridge → 平台自动spawn轻量通用bridge模板
- 没有bridge就不能参与对话
"""
import asyncio
import subprocess
import time
import httpx
import logging
import os

logger = logging.getLogger(__name__)

# ─── Dedicated Agent Bridge URL mapping ───
BRIDGE_URLS = {
    "jqagent": "http://127.0.0.1:8001",
    "kuafu": "http://127.0.0.1:8002",
    "nvwa": "http://127.0.0.1:8003",
}

# ─── Auto-spawned generic bridges tracker ───
# {agent_id: {"port": int, "process": subprocess.Popen, "url": str}}
_spawned_bridges: dict = {}
_next_port = 8010  # Generic bridges start from port 8010

GENERIC_BRIDGE_SCRIPT = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "generic_bridge_template.py"
)


def _get_bridge_url(agent_id: str | None) -> str | None:
    """Match agent_id to bridge URL by name substring.
    
    Order: 1) Dedicated bridge  2) Previously spawned generic bridge
    """
    if not agent_id:
        return None
    # 1. Check dedicated bridges
    for name, url in BRIDGE_URLS.items():
        if name in agent_id:
            return url
    # 2. Check spawned generic bridges
    if agent_id in _spawned_bridges:
        return _spawned_bridges[agent_id]["url"]
    return None


async def _spawn_generic_bridge(agent_id: str) -> str:
    """Spawn a lightweight generic bridge for an agent that doesn't have a dedicated one.
    
    Returns the bridge URL once it's ready.
    """
    global _next_port
    
    # Extract display name from agent_id (e.g. "agent-sitekeeper-xxx" → "sitekeeper")
    parts = agent_id.split("-")
    agent_name = parts[1] if len(parts) >= 2 else agent_id
    
    port = _next_port
    _next_port += 1
    
    logger.info(f"[AutoSpawn] Spawning generic bridge for {agent_id} on port {port}")
    
    # Launch the generic bridge template as a subprocess
    process = subprocess.Popen(
        [
            "python3", GENERIC_BRIDGE_SCRIPT,
            "--agent_id", agent_id,
            "--port", str(port),
            "--agent_name", agent_name,
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        # Detach from parent process group so backend restart doesn't kill bridges
        start_new_session=True,
    )
    
    url = f"http://127.0.0.1:{port}"
    _spawned_bridges[agent_id] = {
        "port": port,
        "process": process,
        "url": url,
    }
    
    # Wait for bridge to be ready (health check, max 30s)
    for i in range(15):
        try:
            async with httpx.AsyncClient(timeout=2.0) as client:
                resp = await client.get(f"{url}/health")
                if resp.status_code == 200:
                    logger.info(f"[AutoSpawn] Bridge for {agent_id} ready on port {port}")
                    return url
        except Exception:
            pass
        await asyncio.sleep(2.0)
    
    # Bridge didn't start in time
    logger.error(f"[AutoSpawn] Bridge for {agent_id} failed to start on port {port} within 30s")
    # Clean up
    _spawned_bridges.pop(agent_id, None)
    _next_port = port  # Reclaim port
    raise RuntimeError(f"Generic bridge for {agent_id} failed to start")


async def chat_completion(
    messages: list[dict],
    agent_id: str | None = None,
    model: str | None = None,
    project_id: str | None = None,
) -> str:
    """通过Agent Bridge获取Agent回复，返回文本
    
    流程：
    1. 查找专属bridge → 如果有，直接路由
    2. 查找已spawn的通用bridge → 如果有，直接路由
    3. 没有任何bridge → 自动spawn通用bridge → 路由
    4. spawn失败 → 返回错误信息
    """
    # ── Step 1: Get bridge URL (dedicated or previously spawned) ──
    bridge_url = _get_bridge_url(agent_id)
    
    # ── Step 2: If no bridge, auto-spawn generic bridge ──
    if not bridge_url and agent_id:
        try:
            bridge_url = await _spawn_generic_bridge(agent_id)
        except RuntimeError as e:
            return f"[Agent {agent_id} 无法启动: {str(e)[:100]}]"
    
    if not bridge_url:
        return "[没有可用的Agent Bridge，无法生成回复]"
    
    # ── Step 3: Call bridge ──
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                f"{bridge_url}/api/chat/completion",
                json={"messages": messages, "agent_id": agent_id, "project_id": project_id},
            )
            resp.raise_for_status()
            data = resp.json()
            reply = data.get("reply", "")
            if len(reply) > 10000:
                logger.warning(f"Bridge reply truncated from {len(reply)} to 10000 chars for agent {agent_id}")
                reply = reply[:10000] + "\n\n[回复过长已截断]"
            logger.info(f"Bridge call succeeded for {agent_id}, reply length: {len(reply)}")
            return reply
    except httpx.HTTPStatusError as e:
        status = e.response.status_code
        logger.error(f"Bridge HTTP error for {agent_id}: {status}")
        return f"[Agent服务暂时不可用，状态码: {status}]"
    except Exception as e:
        err_msg = str(e)[:100]
        logger.error(f"Bridge call failed for {agent_id}: {err_msg}")
        return f"[Agent调用失败: {err_msg}]"


async def stream_chat_completion(
    messages: list[dict],
    agent_id: str | None = None,
    model: str | None = None,
    project_id: str | None = None,
):
    """流式通过Agent Bridge获取Agent回复（整块yield）"""
    # Same logic as chat_completion but yields entire reply
    bridge_url = _get_bridge_url(agent_id)
    
    if not bridge_url and agent_id:
        try:
            bridge_url = await _spawn_generic_bridge(agent_id)
        except RuntimeError as e:
            yield f"[Agent {agent_id} 无法启动: {str(e)[:100]}]"
            return
    
    if not bridge_url:
        yield "[没有可用的Agent Bridge，无法生成回复]"
        return
    
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                f"{bridge_url}/api/chat/completion",
                json={"messages": messages, "agent_id": agent_id, "project_id": project_id},
            )
            resp.raise_for_status()
            data = resp.json()
            reply = data.get("reply", "")
            if len(reply) > 10000:
                reply = reply[:10000] + "\n\n[回复过长已截断]"
            logger.info(f"Bridge stream succeeded for {agent_id}, reply length: {len(reply)}")
            yield reply
    except httpx.HTTPStatusError as e:
        status = e.response.status_code
        logger.error(f"Bridge stream HTTP error for {agent_id}: {status}")
        yield f"[Agent服务暂时不可用，状态码: {status}]"
    except Exception as e:
        err_msg = str(e)[:100]
        logger.error(f"Bridge stream failed for {agent_id}: {err_msg}")
        yield f"[Agent调用失败: {err_msg}]"
