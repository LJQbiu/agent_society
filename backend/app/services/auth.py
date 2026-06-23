"""认证服务"""
from sqlalchemy.ext.asyncio import AsyncSession

class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def register_human(self, data):
        raise NotImplementedError
    
    async def login_human(self, data):
        raise NotImplementedError
    
    async def authorize(self, params):
        raise NotImplementedError
    
    async def issue_token(self, data):
        raise NotImplementedError
    
    async def refresh_token(self, data):
        raise NotImplementedError
    
    async def bind_agent(self, data):
        raise NotImplementedError
    
    async def get_agent_credentials(self, data):
        raise NotImplementedError
