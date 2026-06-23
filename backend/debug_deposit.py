
import asyncio, sys, traceback
sys.path.insert(0, '.')

async def debug_deposit_org():
    from app.database import async_session
    from app.services.settlement import SettlementService
    from app.schemas.settlement import DepositRequest, HolderType
    
    org_id = "5848c829-0cac-436f-8a9d-562333c099ac"
    
    async with async_session() as db:
        svc = SettlementService(db)
        req = DepositRequest(
            holder_id=org_id,
            holder_type=HolderType.organization,
            amount=50.0,
            description="test deposit for org"
        )
        try:
            result = await svc.deposit(req, "63c13616-8379-43e1-8322-314f2682721d")
            print(f"SUCCESS: {result}")
        except Exception as e:
            print(f"EXCEPTION: {type(e).__name__}: {e}")
            traceback.print_exc()

asyncio.run(debug_deposit_org())
