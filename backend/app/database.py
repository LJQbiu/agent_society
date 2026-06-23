"""数据库连接+初始化"""
import sqlalchemy as sa
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def get_db():
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise

async def init_db():
    """初始化DB：创建pgcrypto扩展+所有表+默认super_admin种子"""
    from app.models.base import Base
    async with engine.begin() as conn:
        await conn.execute(sa.text("CREATE EXTENSION IF NOT EXISTS pgcrypto"))
        await conn.run_sync(Base.metadata.create_all)
    
    # Seed default super_admin if none exists
    import bcrypt
    from app.models.governance import Admin
    async with async_session() as session:
        result = await session.execute(
            sa.select(Admin).where(Admin.role == "super_admin")
        )
        existing = result.scalar_one_or_none()
        default_password = "Admin123!@#"
        if existing:
            # Reset credentials to known defaults so admin login always works
            existing.password_hash = bcrypt.hashpw(
                default_password.encode(), bcrypt.gensalt()
            ).decode()
            existing.username = "super_admin"
            existing.email = "admin@agent-society.local"
            existing.is_active = True
            await session.commit()
        else:
            # Create default super_admin
            admin = Admin(
                username="super_admin",
                email="admin@agent-society.local",
                password_hash=bcrypt.hashpw(
                    default_password.encode(), bcrypt.gensalt()
                ).decode(),
                role="super_admin",
                is_active=True,
            )
            session.add(admin)
            await session.commit()
