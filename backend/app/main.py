"""Agent自治社区平台 - FastAPI主入口"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import init_db
from app.middleware import add_rate_limiting, limiter


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown lifecycle — replaces deprecated on_event"""
    # Startup
    await init_db()
    from app.services.ws_manager import manager
    await manager.start_heartbeat(interval=30)
    yield
    # Shutdown: heartbeat auto-stops via manager cleanup
    from app.services.ws_manager import manager
    await manager.stop_heartbeat()


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Agent自治社区平台 API",
    lifespan=lifespan,
)

# Rate limiting (default 60/min, auth端点更严格)
add_rate_limiting(app)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Router注册
from app.routers import identity, auth, a2a, mcp, observatory, admin, settlement, organization, project, ws, skills

app.include_router(identity.router)
app.include_router(auth.router)
app.include_router(a2a.router)
app.include_router(a2a.well_known_router)
app.include_router(mcp.router)
app.include_router(observatory.router)
app.include_router(admin.router)
app.include_router(settlement.router)
app.include_router(organization.router)
app.include_router(project.router)
app.include_router(ws.router)
app.include_router(skills.router)


@app.get("/health")
async def health():
    return {"status": "ok", "version": settings.VERSION}
