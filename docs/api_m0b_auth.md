# M0-b: OAuth 2.1 + PKCE 认证体系 API 契约

## 模块职责
- 完整OAuth 2.1授权服务器（authorization_code + PKCE flow）
- 人类用户注册/登录（bcrypt密码哈希）
- Agent身份绑定（Agent关联到Human账户）
- JWT token管理（access + refresh + 过期策略）
- 认证中间件（FastAPI Dependency, 角色提取）

## 接口定义

### 1. 人类注册
```
POST /auth/register
Request Body:
  {
    "username": "string (3-50 chars, alphanumeric + underscore)",
    "email": "string (valid email)",
    "password": "string (8-128 chars, min 1 uppercase, 1 lowercase, 1 digit)",
    "display_name": "string (optional, max 100 chars)"
  }
Response 200:
  {
    "id": "uuid",
    "username": "string",
    "email": "string",
    "display_name": "string",
    "role": "observer",          // 默认角色
    "status": "active",
    "created_at": "datetime"
  }
Response 400:
  { "detail": "Username already exists" }
  { "detail": "Email already registered" }
  { "detail": "Password does not meet requirements" }
```

**不变量**：
- password存储为bcrypt hash，永不存储明文
- 新注册用户默认 role=observer, status=active
- username和email全局唯一

### 2. OAuth 2.1 授权端点（Authorization Endpoint）
```
GET /auth/authorize
Query Params:
  response_type=code          // OAuth 2.1只支持code
  client_id=string            // Agent的agent_id或人类client_id
  redirect_uri=string         // 必须预先注册的URI
  code_challenge=string       // PKCE: S256(base64url(sha256(code_verifier)))
  code_challenge_method=S256  // OAuth 2.1强制S256
  scope=string                // "identity transaction mcp a2a" 等
  state=string                // 防CSRF

Response 302:
  Redirect to redirect_uri?code=AUTHORIZATION_CODE&state=STATE

Error Response 302:
  Redirect to redirect_uri?error=...&error_description=...&state=STATE
```

**不变量**：
- OAuth 2.1禁止implicit flow，只支持authorization_code
- PKCE强制：code_challenge_method必须为S256，禁止plain
- redirect_uri必须精确匹配预注册值（禁止模糊匹配）
- state参数必须原样返回

### 3. Token端点
```
POST /auth/token
Request Body (application/x-www-form-urlencoded):
  grant_type=authorization_code
  code=string                  // 从authorize获取的code
  redirect_uri=string          // 必须与authorize时一致
  client_id=string
  code_verifier=string         // PKCE: 原始verifier，用于验证challenge

Response 200:
  {
    "access_token": "JWT string",
    "token_type": "Bearer",
    "expires_in": 1800,         // 30分钟
    "refresh_token": "JWT string",
    "scope": "identity transaction mcp a2a"
  }

Error 400:
  { "error": "invalid_grant" }        // code无效或过期
  { "error": "invalid_client" }
  { "error": "invalid_code_verifier" } // PKCE验证失败
```

**PKCE验证流程**：
```
1. 存储: authorize时 → 存储 code_challenge + method
2. 验证: token时 → 
   computed_challenge = BASE64URL(SHA256(code_verifier))
   assert computed_challenge == stored_code_challenge
3. code_verifier: 43-128 chars, [A-Z]/[a-z]/[0-9]/[-._~]
```

### 4. Refresh Token
```
POST /auth/token
Request Body:
  grant_type=refresh_token
  refresh_token=string

Response 200:
  {
    "access_token": "new JWT",
    "token_type": "Bearer",
    "expires_in": 1800,
    "refresh_token": "new refresh token"  // rotation: 旧token失效
  }
```

**不变量**：
- Refresh token rotation：每次使用refresh_token后，旧token立即失效，发放新token
- 旧refresh_token检测重用 → 安全事件：撤销该用户所有token

### 5. Agent身份绑定
```
POST /auth/agents/bind
Headers: Authorization: Bearer <access_token>  // 人类用户的token
Request Body:
  {
    "agent_id": "string (unique identifier, format: agent-{name}-{random})",
    "agent_name": "string (1-100 chars)",
    "capabilities": ["string", ...],       // 能力标签
    "description": "string (optional)"
  }
Response 200:
  {
    "id": "uuid",                // agents表主键
    "agent_id": "string",
    "agent_name": "string",
    "human_id": "uuid",          // 绑定的人类ID
    "capabilities": ["string"],
    "reputation_score": 50.0,    // 默认起始分
    "token_balance": 0.0,
    "status": "registered"
  }
Response 401: { "detail": "Not authenticated" }
Response 403: { "detail": "Agent ID already bound" }
```

**不变量**：
- 一个Human可绑定多个Agent
- agent_id全局唯一
- 新Agent默认 status=registered, reputation=50.0

### 6. Agent Token获取（Client Credentials Flow）
```
POST /auth/token
Request Body:
  grant_type=client_credentials
  client_id=agent_id
  client_secret=string        // Agent注册时分配的secret

Response 200:
  {
    "access_token": "JWT string (scope: mcp a2a)",
    "token_type": "Bearer",
    "expires_in": 1800,
    "scope": "mcp a2a"
  }
```

## JWT Token结构
```json
// Access Token Payload
{
  "sub": "agent_id or human_id",   // 主体标识
  "type": "agent | human",         // 主体类型
  "role": "observer | breeder | super_admin",
  "scope": "identity transaction mcp a2a",
  "exp": 1800秒后,
  "iat": 签发时间,
  "jti": "unique token id"         // 防重用
}

// Refresh Token Payload
{
  "sub": "agent_id or human_id",
  "type": "refresh",
  "exp": 7天后,
  "jti": "unique token id"
}
```

## 认证中间件
```python
# backend/app/middleware/auth_middleware.py
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from app.config import settings
from app.schemas.auth import TokenPayload

security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> TokenPayload:
    """提取并验证JWT token，返回payload"""
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        return TokenPayload(**payload)
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

async def require_role(required_role: str, user: TokenPayload = Depends(get_current_user)) -> TokenPayload:
    """要求特定角色"""
    if user.role != required_role and user.role != "super_admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")
    return user
```

## 代码骨架

### backend/app/schemas/auth.py
```python
from pydantic import BaseModel, EmailStr, Field, field_validator
import re

class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, pattern=r'^[a-zA-Z0-9_]+$')
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    display_name: str | None = Field(None, max_length=100)
    
    @field_validator('password')
    @classmethod
    def validate_password(cls, v):
        if not re.search(r'[A-Z]', v): raise ValueError('Must contain uppercase')
        if not re.search(r'[a-z]', v): raise ValueError('Must contain lowercase')
        if not re.search(r'[0-9]', v): raise ValueError('Must contain digit')
        return v

class RegisterResponse(BaseModel):
    id: str
    username: str
    email: str
    display_name: str | None
    role: str
    status: str
    created_at: str

class AuthorizeRequest(BaseModel):
    response_type: str = "code"     # must be "code"
    client_id: str
    redirect_uri: str
    code_challenge: str
    code_challenge_method: str = "S256"
    scope: str
    state: str

class TokenRequest(BaseModel):
    grant_type: str                  # authorization_code | refresh_token | client_credentials
    code: str | None = None
    redirect_uri: str | None = None
    client_id: str | None = None
    code_verifier: str | None = None
    refresh_token: str | None = None
    client_secret: str | None = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "Bearer"
    expires_in: int
    refresh_token: str | None = None
    scope: str

class AgentBindRequest(BaseModel):
    agent_id: str = Field(..., pattern=r'^agent-[a-zA-Z0-9]+-[a-zA-Z0-9]+$')
    agent_name: str = Field(..., min_length=1, max_length=100)
    capabilities: list[str] = Field(default_factory=list)
    description: str | None = None

class AgentBindResponse(BaseModel):
    id: str
    agent_id: str
    agent_name: str
    human_id: str
    capabilities: list[str]
    reputation_score: float
    token_balance: float
    status: str

class TokenPayload(BaseModel):
    sub: str
    type: str           # agent | human | refresh
    role: str | None = None
    scope: str | None = None
    exp: int
    iat: int
    jti: str
```

### backend/app/services/auth_service.py
```python
from passlib.context import CryptContext
from jose import jwt
import hashlib, base64, secrets, os
from datetime import datetime, timedelta, timezone
from app.config import settings
from app.schemas.auth import TokenPayload

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class AuthService:
    @staticmethod
    def hash_password(password: str) -> str:
        return pwd_context.hash(password)
    
    @staticmethod
    def verify_password(plain: str, hashed: str) -> bool:
        return pwd_context.verify(plain, hashed)
    
    @staticmethod
    def create_access_token(subject: str, subject_type: str, role: str, scope: str) -> str:
        now = datetime.now(timezone.utc)
        payload = {
            "sub": subject, "type": subject_type, "role": role, "scope": scope,
            "exp": now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
            "iat": now, "jti": secrets.token_urlsafe(32)
        }
        return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")
    
    @staticmethod
    def create_refresh_token(subject: str) -> str:
        now = datetime.now(timezone.utc)
        payload = {
            "sub": subject, "type": "refresh",
            "exp": now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
            "iat": now, "jti": secrets.token_urlsafe(32)
        }
        return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")
    
    @staticmethod
    def generate_pkce_verifier() -> str:
        """43-128 chars from unreserved charset [A-Z a-z 0-9 - . _ ~]"""
        chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
        length = secrets.choice(range(43, 129))
        return ''.join(secrets.choice(chars) for _ in range(length))
    
    @staticmethod
    def generate_pkce_challenge(verifier: str) -> str:
        """S256: BASE64URL(SHA256(verifier))"""
        digest = hashlib.sha256(verifier.encode('ascii')).digest()
        return base64.urlsafe_b64encode(digest).rstrip(b'=').decode('ascii')
    
    @staticmethod
    def verify_pkce(verifier: str, challenge: str) -> bool:
        return AuthService.generate_pkce_challenge(verifier) == challenge
```

### backend/app/routers/auth.py
```python
from fastapi import APIRouter, Depends, HTTPException, Request
from app.schemas.auth import *
from app.services.auth_service import AuthService
from app.middleware.auth_middleware import get_current_user, require_role

router = APIRouter()

# POST /auth/register - 人类注册
@router.post("/register", response_model=RegisterResponse)
async def register(req: RegisterRequest, db=Depends(get_db)):
    ...

# GET /auth/authorize - OAuth 2.1授权端点
@router.get("/authorize")
async def authorize(req: AuthorizeRequest, db=Depends(get_db)):
    ...

# POST /auth/token - Token端点（authorization_code + PKCE + refresh + client_credentials）
@router.post("/token", response_model=TokenResponse)
async def token(req: TokenRequest, db=Depends(get_db)):
    ...

# POST /auth/agents/bind - Agent身份绑定
@router.post("/agents/bind", response_model=AgentBindResponse)
async def bind_agent(req: AgentBindRequest, user: TokenPayload = Depends(get_current_user), db=Depends(get_db)):
    ...
```

## 不变量
1. OAuth 2.1：只支持authorization_code flow，禁止implicit grant
2. PKCE强制S256，禁止plain method
3. authorization_code有效期 ≤10分钟，一次性使用
4. refresh_token rotation：每次使用后旧token失效+发放新token
5. refresh_token重用检测 → 撤销该用户所有token
6. 密码永不明文存储，bcrypt hash
7. JWT签名使用HS256 + SECRET_KEY（从.env读取）
8. client_id验证：redirect_uri必须精确匹配预注册值

## 验证标准
- [ ] 人类注册成功，密码bcrypt存储
- [ ] PKCE端到端流程：生成verifier → 计算challenge → authorize → token(带verifier) → 验证成功获取access_token
- [ ] PKCE错误验证：错误verifier → token请求失败
- [ ] Refresh token rotation：使用refresh → 新token发放，旧token失效
- [ ] Agent绑定：人类登录后绑定Agent → Agent获得client_credentials
- [ ] 认证中间件：无token请求 → 401，错误角色 → 403
