#!/usr/bin/env python3
"""DB迁移+表验证"""
import asyncio
import sys
sys.path.insert(0, '/root/agent_society/backend')

from app.database import init_db, engine
import app.models  # ensure all models registered

async def main():
    await init_db()
    print('Tables created!')
    
    import sqlalchemy as sa
    async with engine.begin() as conn:
        result = await conn.execute(sa.text(
            "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN ('messages','agent_card_versions')"
        ))
        rows = result.fetchall()
        print('New A2A tables:', [r[0] for r in rows])
    
    await engine.dispose()

asyncio.run(main())
