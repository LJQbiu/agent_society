"""Rate limiting middleware — 基于 slowapi"""
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from fastapi import Request, Response

# 以客户端IP为限流key
limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])


def add_rate_limiting(app):
    """给FastAPI app添加rate limiting中间件"""
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_middleware(SlowAPIMiddleware)
