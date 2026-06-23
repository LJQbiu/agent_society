"""项目配置 - 从.env读取"""
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Agent自治社区平台"
    VERSION: str = "0.1.0"
    DATABASE_URL: str = "postgresql+asyncpg://agent_admin:DevOnly2025!@localhost:5432/agent_society"
    DATABASE_URL_SYNC: str = "postgresql://agent_admin:DevOnly2025!@localhost:5432/agent_society"
    SECRET_KEY: str = "agent-society-dev-secret-2025-change-in-production"  # JWT签名密钥
    MASTER_KEY: str = "agent-society-master-key-2025-change-in-production"  # 加密主密钥
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    ALLOWED_ORIGINS: list[str] = ["http://localhost:3000", "http://172.22.218.229:3000"]
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 2
    
    class Config:
        env_file = ".env"

settings = Settings()
