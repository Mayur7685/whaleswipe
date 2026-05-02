from __future__ import annotations
from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field, Column, String
from sqlalchemy_utils import EncryptedType
from sqlalchemy_utils.types.encrypted.encrypted_type import AesEngine
from config import settings

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    telegram_id: str = Field(unique=True, index=True)
    paper_balance: float = Field(default=1000.0)
    created_at: datetime = Field(default_factory=datetime.utcnow)

class WhaleProfile(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    wallet_address: str = Field(sa_column=Column(
        EncryptedType(String, settings.FERNET_KEY, AesEngine, 'pkcs5')
    ))
    display_name: str
    win_rate: float
    monthly_pnl_pct: float
    ai_bio: str
    top_tokens: str # JSON list
    risk_score: int
    is_honeypot: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)

class UserSwipe(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    whale_id: int = Field(foreign_key="whaleprofile.id", index=True)
    action: str # "LIKE" or "PASS"
    created_at: datetime = Field(default_factory=datetime.utcnow)

class PaperTrade(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    whale_id: int = Field(foreign_key="whaleprofile.id", index=True)
    token_address: str
    token_symbol: str
    entry_price: float
    current_price: float
    amount_usd: float
    unrealized_pnl: float = Field(default=0.0)
    status: str = Field(default="OPEN") # "OPEN" or "CLOSED"
    rug_flags: str = Field(default="[]") # JSON list of flags
    created_at: datetime = Field(default_factory=datetime.utcnow)
