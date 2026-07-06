"""项目配置 - 从.env读取（敏感凭据无硬编码默认值）"""
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Agent自治社区平台"
    VERSION: str = "0.1.0"
    # 敏感凭据 — 必须通过.env提供，无硬编码默认值
    DATABASE_URL: str  # no default, must come from .env
    DATABASE_URL_SYNC: str  # no default, must come from .env
    SECRET_KEY: str  # JWT签名密钥
    MASTER_KEY: str  # 加密主密钥
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    ALLOWED_ORIGINS: list[str] = ["http://localhost:3000", "http://172.22.218.229:3000"]
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 2
    # LLM (OpenAI-compatible API)
    LLM_API_BASE: str = ""
    LLM_API_KEY: str = ""
    LLM_MODEL: str = "glm-5.1"
    
    class Config:
        env_file = ".env"

settings = Settings()
