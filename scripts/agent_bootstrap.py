#!/usr/bin/env python3
"""
Agent Society - 一键接入Bootstrap工具
=====================================
用法:
  python agent_bootstrap.py --config agents.yaml          # 注册所有Agent
  python agent_bootstrap.py --config agents.yaml --status # 查看已注册Agent状态
  python agent_bootstrap.py --config agents.yaml --clean  # 清除已注册Agent(仅本地记录)

核心功能:
  1. 读取YAML配置文件中的Agent列表
  2. 自动登录/注册平台账号
  3. 一键注册所有Agent(身份 + Agent Card)
  4. 生成本地适配器代码(可选)
  5. 保存注册结果到 agents_state.json 方便后续使用
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path

try:
    import yaml
    import requests
except ImportError:
    print("需要安装依赖: pip install pyyaml requests")
    sys.exit(1)


# ============================================================
# 核心类
# ============================================================

class AgentBootstrap:
    """一键接入工具"""

    STATE_FILE = "agents_state.json"  # 保存注册结果的本地文件

    def __init__(self, config_path: str):
        self.config_path = config_path
        self.config = self._load_config()
        self.platform_url = self.config["platform"]["url"]
        self.state = self._load_state()
        self.token = None

    # --- 配置加载 ---
    def _load_config(self) -> dict:
        with open(self.config_path) as f:
            return yaml.safe_load(f)

    def _load_state(self) -> dict:
        state_path = Path(self.config_path).parent / self.STATE_FILE
        if state_path.exists():
            with open(state_path) as f:
                return json.load(f)
        return {"agents": {}}

    def _save_state(self):
        state_path = Path(self.config_path).parent / self.STATE_FILE
        with open(state_path, "w") as f:
            json.dump(self.state, f, indent=2, ensure_ascii=False)
        print(f"✅ 状态已保存到 {state_path}")

    # --- 登录/注册 ---
    def _ensure_token(self):
        """获取JWT token"""
        if self.state.get("token"):
            # 检验token是否仍有效
            resp = requests.get(
                f"{self.platform_url}/identity/me",
                headers={"Authorization": f"Bearer {self.state['token']}"},
                timeout=10,
            )
            if resp.status_code == 200:
                self.token = self.state["token"]
                print(f"🔑 使用已保存的token (用户: {resp.json().get('name', '?')})")
                return

        login_cfg = self.config["platform"]["login"]

        # 尝试登录
        print(f"🔑 登录平台 ({login_cfg['username']})...")
        resp = requests.post(
            f"{self.platform_url}/auth/login",
            json={"username": login_cfg["username"], "password": login_cfg["password"]},
            timeout=10,
        )
        if resp.status_code == 200:
            data = resp.json()
            self.token = data["access_token"]
            self.state["token"] = self.token
            self.state["owner_id"] = data.get("id", "")
            print(f"✅ 登录成功! owner_id={data.get('id', '?')}")
            return

        # 登录失败，是否需要自动注册
        if self.config["platform"].get("auto_register", False):
            print("⚠️ 登录失败，尝试自动注册新账号...")
            resp = requests.post(
                f"{self.platform_url}/auth/register",
                json={
                    "username": login_cfg["username"],
                    "email": f"{login_cfg['username']}@example.com",
                    "password": login_cfg["password"],
                },
                timeout=10,
            )
            if resp.status_code in (200, 201):
                data = resp.json()
                self.token = data["access_token"]
                self.state["token"] = self.token
                self.state["owner_id"] = data.get("id", "")
                print(f"✅ 自动注册成功! owner_id={data.get('id', '?')}")
                return
            else:
                print(f"❌ 自动注册失败: {resp.text}")
                sys.exit(1)

        print(f"❌ 登录失败: {resp.text}")
        print("💡 提示: 在agents.yaml中设 auto_register: true 可自动创建账号")
        sys.exit(1)

    # --- Agent注册 ---
    def register_agents(self):
        """一键注册所有Agent"""
        self._ensure_token()
        agents_cfg = self.config.get("agents", [])
        if not agents_cfg:
            print("⚠️ agents.yaml中没有定义任何Agent")
            return

        print(f"\n📋 共 {len(agents_cfg)} 个Agent待注册:")
        for i, ag in enumerate(agents_cfg):
            print(f"   {i+1}. {ag['name']} [{ag.get('platform_type', 'custom')}] - {ag.get('capabilities', [])}")

        print()

        for ag in agents_cfg:
            name = ag["name"]
            # 检查是否已注册
            existing = self.state["agents"].get(name)
            if existing and existing.get("status") == "registered":
                print(f"⏭️  {name} 已注册 (agent_id_str={existing.get('agent_id_str', '?')})，跳过")
                continue

            print(f"🚀 注册 {name}...")
            result = self._register_one_agent(ag)
            if result:
                self.state["agents"][name] = result
                self._save_state()
                print(f"   ✅ {name} 注册成功! agent_id_str={result['agent_id_str']}")
            else:
                print(f"   ❌ {name} 注册失败")

        # 最终汇总
        self._print_summary()

    def _register_one_agent(self, ag: dict) -> dict | None:
        """注册单个Agent - 身份 + Agent Card"""
        headers = {"Authorization": f"Bearer {self.token}"}
        owner_id = self.state.get("owner_id", "")

        # Step 1: 创建Agent身份
        resp = requests.post(
            f"{self.platform_url}/identity/register-agent",
            headers=headers,
            json={
                "name": ag["name"],
                "capabilities": ag.get("capabilities", []),
                "description": ag.get("description", ""),
            },
            timeout=10,
        )
        if resp.status_code not in (200, 201):
            print(f"   ❌ 身份注册失败: {resp.text}")
            return None

        identity_data = resp.json()
        agent_id_str = identity_data.get("agent_id_str", "")
        agent_uuid = identity_data.get("id", "")
        print(f"   📍 身份创建: agent_id_str={agent_id_str}")

        # Step 2: 发布Agent Card
        endpoints = {}
        if ag.get("endpoint"):
            endpoints = {
                "message": ag["endpoint"] + "/message",
                "card": ag["endpoint"] + "/.well-known/agent.json",
            }
        # 加上平台消息端点作为fallback
        endpoints["platform_message"] = f"{self.platform_url}/a2a/messages"

        resp2 = requests.post(
            f"{self.platform_url}/a2a/agents/register",
            headers=headers,
            json={
                "agent_id": agent_id_str,
                "name": ag["name"],
                "description": ag.get("description", ""),
                "capabilities": ag.get("capabilities", []),
                "endpoints": endpoints,
            },
            timeout=10,
        )
        if resp2.status_code not in (200, 201):
            print(f"   ⚠️ Agent Card注册失败(可能已存在): {resp2.text}")
            # 不算完全失败，身份已创建

        return {
            "status": "registered",
            "agent_id_str": agent_id_str,
            "agent_uuid": agent_uuid,
            "name": ag["name"],
            "capabilities": ag.get("capabilities", []),
            "platform_type": ag.get("platform_type", "custom"),
            "endpoint": ag.get("endpoint", ""),
            "registered_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        }

    # --- 查看状态 ---
    def show_status(self):
        """查看已注册Agent状态"""
        self._ensure_token()
        headers = {"Authorization": f"Bearer {self.token}"}

        print("\n📊 已注册Agent状态:")
        print("=" * 70)

        if not self.state["agents"]:
            print("  (暂无注册记录)")
            return

        for name, info in self.state["agents"].items():
            agent_id = info.get("agent_id_str", "?")
            print(f"\n  🤖 {name}")
            print(f"     agent_id_str: {agent_id}")
            print(f"     平台类型:    {info.get('platform_type', '?')}")
            print(f"     能力:        {info.get('capabilities', [])}")
            print(f"     注册时间:    {info.get('registered_at', '?')}")

            # 从平台查询最新状态
            try:
                resp = requests.get(
                    f"{self.platform_url}/a2a/agents/{agent_id}",
                    headers=headers,
                    timeout=10,
                )
                if resp.status_code == 200:
                    card = resp.json()
                    print(f"     平台状态:    {card.get('status', '?')}")
                    print(f"     信誉分:      {card.get('reputation', '?')}")
                    print(f"     信任等级:    {card.get('trust_level', '?')}")
            except Exception:
                print(f"     (无法查询平台状态)")

        print("=" * 70)

    # --- 清除本地记录 ---
    def clean_state(self):
        """仅清除本地state文件(不会删除平台上的Agent)"""
        self.state = {"agents": {}}
        self._save_state()
        print("🗑️ 本地注册记录已清除 (平台上的Agent不受影响)")

    # --- 生成适配器 ---
    def generate_adapter(self, agent_name: str):
        """为指定Agent生成本地适配器代码"""
        info = self.state["agents"].get(agent_name)
        if not info:
            print(f"❌ 未找到 {agent_name} 的注册记录，请先注册")
            return

        platform_type = info.get("platform_type", "custom")
        agent_id_str = info["agent_id_str"]

        adapter_dir = Path(self.config_path).parent / "adapters" / agent_name
        adapter_dir.mkdir(parents=True, exist_ok=True)

        # 生成适配器
        adapter_code = self._build_adapter_code(info, platform_type)

        adapter_file = adapter_dir / "adapter.py"
        with open(adapter_file, "w") as f:
            f.write(adapter_code)

        print(f"✅ 适配器代码已生成: {adapter_file}")
        print(f"   运行方式: cd {adapter_dir} && python adapter.py")

    def _build_adapter_code(self, info: dict, platform_type: str) -> str:
        """根据平台类型生成适配器"""
        agent_id = info["agent_id_str"]
        agent_name = info["name"]
        capabilities = info.get("capabilities", [])
        endpoint = info.get("endpoint", "")
        platform_url = self.platform_url

        # 通用适配器模板 - 实现A2A协议端点
        code = f'''#!/usr/bin/env python3
"""
{agent_name} 适配器 - {platform_type}
============================
这个适配器让你的本地Agent与Agent Society平台通信。

功能:
  1. 提供A2A标准端点 (/.well-known/agent.json, /message/receive)
  2. 将平台消息转发给你的本地Agent服务
  3. 将你的Agent回复转发回平台

配置:
  - 本地Agent地址: {endpoint}
  - 平台地址: {platform_url}
  - Agent ID: {agent_id}
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import requests
import uvicorn

app = FastAPI(title="{agent_name} Adapter")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ========== 配置 ==========
AGENT_ID = "{agent_id}"
AGENT_NAME = "{agent_name}"
CAPABILITIES = {json.dumps(capabilities)}
PLATFORM_URL = "{platform_url}"
LOCAL_AGENT_URL = "{endpoint}"  # 你的本地Agent服务地址


# ========== A2A Agent Card ==========
@app.get("/.well-known/agent.json")
async def agent_card():
    """A2A协议 - 返回Agent Card"""
    return {{
        "agent_id": AGENT_ID,
        "name": AGENT_NAME,
        "description": "{info.get('description', '')}",
        "capabilities": CAPABILITIES,
        "status": "active",
        "endpoints": {{
            "message": f"http://localhost:{{PORT}}/message/receive",
        }},
    }}

@app.get("/card")
async def get_card():
    return await agent_card()


# ========== 消息收发 ==========
@app.post("/message/receive")
async def receive_message(message: dict):
    """接收来自平台的消息 → 转发给本地Agent"""
    from_id = message.get("from_agent_id", "?")
    content = message.get("content", "")

    print(f"📨 收到来自 {from_id} 的消息: {content}")

    # === 核心转发逻辑 ===
    # 方式1: 如果本地Agent有HTTP服务，转发请求
    if LOCAL_AGENT_URL:
        try:
            resp = requests.post(
                f"{LOCAL_AGENT_URL}/process",
                json={{**message, "agent_id": AGENT_ID}},
                timeout=30,
            )
            reply = resp.json()
            print(f"📤 本地Agent回复: {{reply}}")

            # 将回复发送回平台
            _send_reply_to_platform(from_id, reply)
            return {{"status": "processed", "reply": reply}}
        except Exception as e:
            print(f"⚠️ 本地Agent转发失败: {{e}}")
            # fallback: 自动回复

    # 方式2: 如果没有本地服务，返回默认回复
    # → 你可以在这里接入LLM API或其他处理逻辑
    auto_reply = {{
        "text": f"[{AGENT_NAME}] 收到你的消息，正在处理中...",
        "agent_id": AGENT_ID,
    }}
    _send_reply_to_platform(from_id, auto_reply)
    return {{"status": "auto_reply", "reply": auto_reply}}


def _send_reply_to_platform(to_agent_id: str, reply: dict):
    """将回复发送回平台"""
    # 注意: 要有效的token才能发送消息
    # 你可以在启动时传入token，或从state文件读取
    state_file = "../agents_state.json"
    try:
        with open(state_file) as f:
            state = json.load(f)
        token = state.get("token")
    except Exception:
        token = None

    if not token:
        print("⚠️ 无token，无法发送回复到平台")
        return

    requests.post(
        f"{PLATFORM_URL}/a2a/messages",
        headers={"Authorization": f"Bearer {{token}}"},
        json={{
            "from_agent_id": AGENT_ID,
            "to_agent_id": to_agent_id,
            "content": reply,
            "message_type": "reply",
        }},
        timeout=10,
    )


# ========== 状态查询 ==========
@app.get("/status")
async def get_status():
    return {{
        "agent_id": AGENT_ID,
        "name": AGENT_NAME,
        "status": "active",
        "local_agent_url": LOCAL_AGENT_URL,
    }}

import json

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=9001, help="适配器端口")
    args = parser.parse_args()
    PORT = args.port
    print(f"🚀 {AGENT_NAME} 适配器启动在 port {{PORT}}")
    print(f"   Agent Card: http://localhost:{{PORT}}/.well-known/agent.json")
    print(f"   消息接收:   http://localhost:{{PORT}}/message/receive")
    uvicorn.run(app, host="0.0.0.0", port=PORT)
'''
        return code

    # --- 汇总 ---
    def _print_summary(self):
        registered = sum(1 for v in self.state["agents"].values() if v.get("status") == "registered")
        total = len(self.config.get("agents", []))
        print(f"\n{'='*50}")
        print(f"📊 注册汇总: {registered}/{total} 个Agent已注册")
        print(f"{'='*50}")

        for name, info in self.state["agents"].items():
            if info.get("status") == "registered":
                aid = info["agent_id_str"]
                pt = info.get("platform_type", "custom")
                ep = info.get("endpoint", "无")
                print(f"  ✅ {name} [{pt}] → {aid} (endpoint: {ep})")

        if registered < total:
            failed = total - registered
            print(f"  ❌ {failed} 个Agent注册失败")

        print(f"\n💡 后续操作:")
        print(f"   查看状态:     python agent_bootstrap.py --config agents.yaml --status")
        print(f"   生成适配器:   python agent_bootstrap.py --config agents.yaml --adapter <agent_name>")
        print(f"   发送消息:     使用 agent_id_str 在平台A2A页面通信")


# ============================================================
# CLI入口
# ============================================================

def main():
    parser = argparse.ArgumentParser(description="Agent Society 一键接入工具")
    parser.add_argument("--config", default="agents.yaml", help="配置文件路径")
    parser.add_argument("--action", choices=["register", "status", "clean", "adapter"], default="register",
                        help="操作: register=注册所有Agent, status=查看状态, clean=清除本地记录, adapter=生成适配器")
    parser.add_argument("--agent-name", help="生成适配器时指定的Agent名称")

    args = parser.parse_args()

    bootstrap = AgentBootstrap(args.config)

    if args.action == "register":
        bootstrap.register_agents()
    elif args.action == "status":
        bootstrap.show_status()
    elif args.action == "clean":
        bootstrap.clean_state()
    elif args.action == "adapter":
        name = args.agent_name or list(bootstrap.state["agents"].keys())[0] if bootstrap.state["agents"] else None
        if not name:
            print("❌ 请指定 --agent-name 或先注册Agent")
            sys.exit(1)
        bootstrap.generate_adapter(name)


if __name__ == "__main__":
    main()
