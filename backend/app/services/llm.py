"""LLM服务 — 调用OpenAI-compatible API生成Agent回复"""
import asyncio
import httpx
import json
import logging
from app.config import settings

logger = logging.getLogger(__name__)

# ─── Agent personality prompts ───
AGENT_SYSTEM_PROMPTS = {
    "agent-jqagent-8d811ba0": "你是JQAgent，李江权的个人AI助手。你具备编程、推理、规划、搜索和文件管理能力。用中文回复，简洁专业。",
    "agent-sitekeeper-fcb189c7": "你是SiteKeeper，一个网站运维助手。你擅长站点部署、监控和故障排查。用中文回复。",
}

DEFAULT_SYSTEM_PROMPT = "你是一个AI助手，在Agent自治社区平台上为用户提供服务。用中文回复，简洁专业。"


async def chat_completion(
    messages: list[dict],
    agent_id: str | None = None,
    model: str | None = None,
) -> str:
    """调用LLM API，返回回复文本
    
    Args:
        messages: 对话历史 [{"role": "user/assistant", "content": "..."}]
        agent_id: Agent ID，用于匹配personality prompt
        model: 模型名，默认用settings.LLM_MODEL
    
    Returns:
        LLM回复的文本内容
    """
    system_prompt = AGENT_SYSTEM_PROMPTS.get(agent_id, DEFAULT_SYSTEM_PROMPT)
    
    full_messages = [{"role": "system", "content": system_prompt}] + messages
    
    url = f"{settings.LLM_API_BASE}/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.LLM_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model or settings.LLM_MODEL,
        "messages": full_messages,
        "max_tokens": 2048,
        "temperature": 0.7,
    }
    
    RETRY_DELAYS = [2.0, 4.0, 8.0]  # Exponential backoff seconds
    
    for attempt in range(len(RETRY_DELAYS) + 1):
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(url, headers=headers, json=payload)
                resp.raise_for_status()
                data = resp.json()
                reply = data["choices"][0]["message"]["content"]
                # Safety truncate: max 10000 chars to avoid DB/display issues
                if len(reply) > 10000:
                    logger.warning(f"LLM reply truncated from {len(reply)} to 10000 chars for agent {agent_id}")
                    reply = reply[:10000] + "\n\n[回复过长已截断]"
                return reply
        except httpx.HTTPStatusError as e:
            status = e.response.status_code
            if status == 429 and attempt < len(RETRY_DELAYS):
                wait = RETRY_DELAYS[attempt]
                logger.warning(f"LLM API rate limited (429), retry {attempt+1}/{len(RETRY_DELAYS)} after {wait}s for agent {agent_id}")
                await asyncio.sleep(wait)
                continue
            err_detail = e.response.text[:200]
            logger.error(f"LLM API error: {status} - {err_detail}")
            return f"[LLM服务暂时不可用，状态码: {status}]"
        except Exception as e:
            err_msg = str(e)[:100]
            logger.error(f"LLM call failed: {err_msg}")
            return f"[LLM调用失败: {err_msg}]"
    
    return "[LLM服务暂时不可用，重试次数已用完]"


async def stream_chat_completion(
    messages: list[dict],
    agent_id: str | None = None,
    model: str | None = None,
):
    """流式调用LLM API，yield增量文本片段（支持429自动重试）"""
    system_prompt = AGENT_SYSTEM_PROMPTS.get(agent_id, DEFAULT_SYSTEM_PROMPT)
    full_messages = [{"role": "system", "content": system_prompt}] + messages
    
    url = f"{settings.LLM_API_BASE}/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.LLM_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model or settings.LLM_MODEL,
        "messages": full_messages,
        "max_tokens": 2048,
        "temperature": 0.7,
        "stream": True,
    }
    
    RETRY_DELAYS = [2.0, 4.0, 8.0]
    for attempt in range(len(RETRY_DELAYS) + 1):
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                async with client.stream("POST", url, headers=headers, json=payload) as resp:
                    resp.raise_for_status()
                    async for line in resp.aiter_lines():
                        if not line.startswith("data: "):
                            continue
                        data_str = line[6:]
                        if data_str == "[DONE]":
                            break
                        try:
                            chunk = json.loads(data_str)
                            delta = chunk["choices"][0]["delta"]
                            if "content" in delta and delta["content"]:
                                yield delta["content"]
                        except (json.JSONDecodeError, KeyError, IndexError):
                            continue
                    return  # Successfully completed streaming
        except httpx.HTTPStatusError as e:
            status = e.response.status_code
            if status == 429 and attempt < len(RETRY_DELAYS):
                wait = RETRY_DELAYS[attempt]
                logger.warning(f"LLM stream rate limited (429), retry {attempt+1}/{len(RETRY_DELAYS)} after {wait}s")
                await asyncio.sleep(wait)
                continue
            err_detail = e.response.text[:200]
            logger.error(f"LLM stream error: {status} - {err_detail}")
            yield f"[LLM服务暂时不可用，状态码: {status}]"
            return
        except Exception as e:
            err_msg = str(e)[:100]
            logger.error(f"LLM stream failed: {err_msg}")
            yield f"[LLM调用失败: {err_msg}]"
            return
    
    yield "[LLM服务暂时不可用，重试次数已用完]"
