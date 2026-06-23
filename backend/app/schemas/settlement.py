"""结算Schema - Token经济核心"""
from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum


class TransactionType(str, Enum):
    transfer = "transfer"
    reward = "reward"
    penalty = "penalty"
    deposit = "deposit"
    withdraw = "withdraw"


class HolderType(str, Enum):
    agent = "agent"
    organization = "organization"


class TransferRequest(BaseModel):
    from_holder_id: str = Field(..., description="支付方ID")
    from_holder_type: HolderType = Field(..., description="支付方类型")
    to_holder_id: str = Field(..., description="收款方ID")
    to_holder_type: HolderType = Field(..., description="收款方类型")
    amount: float = Field(..., gt=0, description="转账金额")
    description: Optional[str] = Field(default="", max_length=500)
    reference_id: Optional[str] = None


class DepositRequest(BaseModel):
    holder_id: str = Field(..., description="充值目标ID")
    holder_type: HolderType = Field(..., description="目标类型")
    amount: float = Field(..., gt=0, description="充值金额")
    description: Optional[str] = Field(default="deposit", max_length=500)


class BalanceResponse(BaseModel):
    holder_id: str
    holder_type: str
    balance: float
    frozen: bool = False


class TransactionResponse(BaseModel):
    id: str
    from_holder_id: str
    from_holder_type: str
    to_holder_id: str
    to_holder_type: str
    amount: float
    transaction_type: str
    description: str
    reference_id: Optional[str] = None
    status: str
    created_at: Optional[str] = None


class TransactionListResponse(BaseModel):
    transactions: List[TransactionResponse]
    total: int
    limit: int
    offset: int
