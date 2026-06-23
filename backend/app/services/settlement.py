"""结算服务 - Token经济核心逻辑"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from app.models.transaction import Transaction
from app.models.agent import Agent
from app.models.organization import Organization
from app.schemas.settlement import TransferRequest, DepositRequest, HolderType
import uuid
from app.services.ws_manager import manager


class SettlementService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _resolve_to_uuid(self, holder_id: str, holder_type: str) -> str:
        """Resolve holder_id to UUID string. If agent uses agent_id_str format, look up UUID."""
        try:
            uuid.UUID(holder_id)
            return holder_id  # Already UUID format
        except ValueError:
            # Not UUID - resolve agent_id_str to UUID via database lookup
            ht = holder_type.value if isinstance(holder_type, HolderType) else holder_type
            if ht == "agent":
                result = await self.db.execute(
                    select(Agent.id).where(Agent.agent_id_str == holder_id)
                )
                uid = result.scalar_one_or_none()
                if uid is None:
                    raise ValueError(f"Agent '{holder_id}' not found (not UUID or agent_id_str)")
                return str(uid)
            raise ValueError(f"holder_id '{holder_id}' is not a valid UUID (only agent supports agent_id_str)")

    async def _get_holder_balance(self, holder_id: str, holder_type: str) -> float:
        """获取持有者余额"""
        resolved_id = await self._resolve_to_uuid(holder_id, holder_type)
        uid = uuid.UUID(resolved_id)
        if holder_type == HolderType.agent:
            result = await self.db.execute(select(Agent.balance).where(Agent.id == uid))
            row = result.scalar_one_or_none()
            if row is None:
                raise ValueError(f"Agent {holder_id} not found")
            return row
        elif holder_type == HolderType.organization:
            result = await self.db.execute(select(Organization).where(Organization.id == uid))
            org = result.scalar_one_or_none()
            if org is None:
                raise ValueError(f"Organization {holder_id} not found")
            return org.balance
        else:
            raise ValueError(f"Unknown holder_type: {holder_type}")

    async def _check_holder_frozen(self, holder_id: str, holder_type: str) -> bool:
        """检查持有者是否冻结"""
        resolved_id = await self._resolve_to_uuid(holder_id, holder_type)
        uid = uuid.UUID(resolved_id)
        if holder_type == HolderType.agent:
            result = await self.db.execute(select(Agent.status).where(Agent.id == uid))
            status = result.scalar_one_or_none()
            return status == "frozen" if status else True
        elif holder_type == HolderType.organization:
            result = await self.db.execute(select(Organization.status).where(Organization.id == uid))
            status = result.scalar_one_or_none()
            return status == "frozen" if status else True
        return True

    async def _update_balance(self, holder_id: str, holder_type: str, delta: float):
        """更新持有者余额 (delta正数加,负数减)"""
        resolved_id = await self._resolve_to_uuid(holder_id, holder_type)
        uid = uuid.UUID(resolved_id)
        if holder_type == HolderType.agent:
            result = await self.db.execute(select(Agent).where(Agent.id == uid))
            agent = result.scalar_one()
            agent.balance += delta
        elif holder_type == HolderType.organization:
            result = await self.db.execute(select(Organization).where(Organization.id == uid))
            org = result.scalar_one()
            org.balance += delta

    async def transfer(self, req: TransferRequest, caller_id: str) -> Transaction:
        """Token转账"""
        # Resolve holder_ids to UUID format (supports both UUID and agent_id_str)
        from_id = await self._resolve_to_uuid(req.from_holder_id, req.from_holder_type)
        to_id = await self._resolve_to_uuid(req.to_holder_id, req.to_holder_type)

        # 自转账校验: 禁止同一持有者向自己转账
        from_type = req.from_holder_type.value if isinstance(req.from_holder_type, HolderType) else req.from_holder_type
        to_type = req.to_holder_type.value if isinstance(req.to_holder_type, HolderType) else req.to_holder_type
        if from_id == to_id and from_type == to_type:
            raise ValueError("Self-transfer is not allowed: sender and recipient must be different")

        # 权限检查: caller必须是from_holder或from_holder的owner
        if caller_id != from_id:
            # 如果from是agent, caller可以是其owner
            if req.from_holder_type == HolderType.agent:
                result = await self.db.execute(
                    select(Agent.owner_id).where(Agent.id == uuid.UUID(from_id))
                )
                owner_id = result.scalar_one_or_none()
                if str(owner_id) != caller_id:
                    raise ValueError("Only the sender or their owner can initiate a transfer")
            else:
                raise ValueError("Only the sender can initiate a transfer")

        # 冻结检查
        if await self._check_holder_frozen(from_id, req.from_holder_type):
            raise ValueError(f"Sender {from_id} is frozen")
        if await self._check_holder_frozen(to_id, req.to_holder_type):
            raise ValueError(f"Recipient {to_id} is frozen")

        # 余额检查
        balance = await self._get_holder_balance(from_id, req.from_holder_type)
        if balance < req.amount:
            raise ValueError(f"Insufficient balance: {balance} < {req.amount}")

        # 执行转账
        await self._update_balance(from_id, req.from_holder_type, -req.amount)
        await self._update_balance(to_id, req.to_holder_type, req.amount)

        # 记录交易
        tx = Transaction(
            from_holder_id=uuid.UUID(from_id),
            from_holder_type=req.from_holder_type,
            to_holder_id=uuid.UUID(to_id),
            to_holder_type=req.to_holder_type,
            amount=req.amount,
            transaction_type="transfer",
            description=req.description or "",
            reference_id=uuid.UUID(req.reference_id) if req.reference_id else None,
            status="completed",
        )
        self.db.add(tx)
        await self.db.commit()
        await self.db.refresh(tx)

        # WebSocket push: notify both sender and receiver about balance change
        try:
            # Notify sender's owner
            from_ht = req.from_holder_type.value if isinstance(req.from_holder_type, HolderType) else req.from_holder_type
            if from_ht == "agent":
                from_agent_result = await self.db.execute(
                    select(Agent).where(Agent.id == uuid.UUID(from_id))
                )
                from_agent = from_agent_result.scalar_one_or_none()
                if from_agent and from_agent.owner_id:
                    await manager.send_to_user(
                        str(from_agent.owner_id),
                        {"type": "balance_change", "data": {"holder_id": from_id, "holder_type": from_ht, "amount": -req.amount, "transaction_id": str(tx.id)}}
                    )
            # Notify receiver's owner
            to_ht = req.to_holder_type.value if isinstance(req.to_holder_type, HolderType) else req.to_holder_type
            if to_ht == "agent":
                to_agent_result = await self.db.execute(
                    select(Agent).where(Agent.id == uuid.UUID(to_id))
                )
                to_agent = to_agent_result.scalar_one_or_none()
                if to_agent and to_agent.owner_id:
                    await manager.send_to_user(
                        str(to_agent.owner_id),
                        {"type": "balance_change", "data": {"holder_id": to_id, "holder_type": to_ht, "amount": req.amount, "transaction_id": str(tx.id)}}
                    )
        except Exception:
            pass  # WebSocket push failure should not affect the transaction

        return tx

    async def deposit(self, req: DepositRequest, caller_id: str) -> Transaction:
        """充值 (admin或self才能操作)"""
        # Resolve holder_id to UUID format
        resolved_id = await self._resolve_to_uuid(req.holder_id, req.holder_type)

        # 冻结检查
        if await self._check_holder_frozen(resolved_id, req.holder_type):
            raise ValueError(f"Target {resolved_id} is frozen")

        # 加余额
        await self._update_balance(resolved_id, req.holder_type, req.amount)

        # 记录交易 (from为system)
        tx = Transaction(
            from_holder_id=uuid.UUID("00000000-0000-0000-0000-000000000000"),  # system
            from_holder_type="system",
            to_holder_id=uuid.UUID(resolved_id),
            to_holder_type=req.holder_type,
            amount=req.amount,
            transaction_type="deposit",
            description=req.description or "deposit",
            status="completed",
        )
        self.db.add(tx)
        await self.db.commit()
        await self.db.refresh(tx)

        # WebSocket push: notify target holder's owner about balance change
        try:
            ht = req.holder_type.value if isinstance(req.holder_type, HolderType) else req.holder_type
            if ht == "agent":
                target_agent_result = await self.db.execute(
                    select(Agent).where(Agent.id == uuid.UUID(resolved_id))
                )
                target_agent = target_agent_result.scalar_one_or_none()
                if target_agent and target_agent.owner_id:
                    await manager.send_to_user(
                        str(target_agent.owner_id),
                        {"type": "balance_change", "data": {"holder_id": resolved_id, "holder_type": ht, "amount": req.amount, "transaction_id": str(tx.id)}}
                    )
        except Exception:
            pass  # WebSocket push failure should not affect the transaction

        return tx

    async def get_balance(self, holder_id: str, holder_type: str) -> dict:
        """查询余额"""
        balance = await self._get_holder_balance(holder_id, holder_type)
        frozen = await self._check_holder_frozen(holder_id, holder_type)
        return {
            "holder_id": holder_id,
            "holder_type": holder_type,
            "balance": balance,
            "frozen": frozen,
        }

    async def get_transactions(self, holder_id: str, holder_type: str, limit: int = 20, offset: int = 0) -> dict:
        """查询交易历史"""
        resolved_id = await self._resolve_to_uuid(holder_id, holder_type)
        uid = uuid.UUID(resolved_id)

        # 查询总数
        count_q = select(func.count()).select_from(Transaction).where(
            (Transaction.from_holder_id == uid) | (Transaction.to_holder_id == uid)
        )
        total = await self.db.scalar(count_q)

        # 查询交易列表
        q = select(Transaction).where(
            (Transaction.from_holder_id == uid) | (Transaction.to_holder_id == uid)
        ).order_by(Transaction.created_at.desc()).limit(limit).offset(offset)
        result = await self.db.execute(q)
        transactions = result.scalars().all()

        return {
            "transactions": [
                {
                    "id": str(tx.id),
                    "from_holder_id": str(tx.from_holder_id),
                    "from_holder_type": tx.from_holder_type,
                    "to_holder_id": str(tx.to_holder_id),
                    "to_holder_type": tx.to_holder_type,
                    "amount": tx.amount,
                    "transaction_type": tx.transaction_type,
                    "description": tx.description,
                    "reference_id": str(tx.reference_id) if tx.reference_id else None,
                    "status": tx.status,
                    "created_at": tx.created_at.isoformat() if tx.created_at else None,
                }
                for tx in transactions
            ],
            "total": total,
            "limit": limit,
            "offset": offset,
        }
