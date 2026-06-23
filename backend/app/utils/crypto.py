"""密码哈希+pgcrypto工具"""
import bcrypt

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(12)).decode()

def verify_password(password: str, hash: str) -> bool:
    return bcrypt.checkpw(password.encode(), hash.encode())

def generate_agent_id(name: str, role: str) -> str:
    """生成agent-trader-alpha-7f2a格式ID"""
    import hashlib
    short = hashlib.sha256(f"{name}-{role}".encode()).hexdigest()[:4]
    return f"agent-{role}-{name.lower()}-{short}"
