"""结算路由 - Token经济完整实现"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas.settlement import *
from app.services.settlement import SettlementService
from app.middleware.auth_middleware import get_current_user
from app.schemas.auth import TokenPayload

router = APIRouter(prefix="/settlement", tags=["settlement"])


@router.post("/transfer", response_model=TransactionResponse)
async def transfer(
    data: TransferRequest,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(get_current_user),
):
    """Token转账 - 需认证, caller必须是支付方"""
    try:
        caller_id = current_user.sub
        tx = await SettlementService(db).transfer(data, caller_id)
        return TransactionResponse(
            id=str(tx.id),
            from_holder_id=str(tx.from_holder_id),
            from_holder_type=tx.from_holder_type,
            to_holder_id=str(tx.to_holder_id),
            to_holder_type=tx.to_holder_type,
            amount=tx.amount,
            transaction_type=tx.transaction_type,
            description=tx.description,
            reference_id=str(tx.reference_id) if tx.reference_id else None,
            status=tx.status,
            created_at=tx.created_at.isoformat() if tx.created_at else None,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/deposit", response_model=TransactionResponse)
async def deposit(
    data: DepositRequest,
    db: AsyncSession = Depends(get_db),
    current_user: TokenPayload = Depends(get_current_user),
):
    """充值 - 需认证"""
    try:
        caller_id = current_user.sub
        tx = await SettlementService(db).deposit(data, caller_id)
        return TransactionResponse(
            id=str(tx.id),
            from_holder_id=str(tx.from_holder_id),
            from_holder_type=tx.from_holder_type,
            to_holder_id=str(tx.to_holder_id),
            to_holder_type=tx.to_holder_type,
            amount=tx.amount,
            transaction_type=tx.transaction_type,
            description=tx.description,
            reference_id=str(tx.reference_id) if tx.reference_id else None,
            status=tx.status,
            created_at=tx.created_at.isoformat() if tx.created_at else None,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/balance/{holder_id}", response_model=BalanceResponse)
async def get_balance(
    holder_id: str,
    holder_type: str = Query(default="agent", description="agent|organization"),
    db: AsyncSession = Depends(get_db),
):
    """查询余额 - 公开"""
    try:
        return await SettlementService(db).get_balance(holder_id, holder_type)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/transactions/{holder_id}", response_model=TransactionListResponse)
async def get_transactions(
    holder_id: str,
    holder_type: str = Query(default="agent", description="agent|organization"),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """查询交易历史 - 公开"""
    try:
        return await SettlementService(db).get_transactions(holder_id, holder_type, limit, offset)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
