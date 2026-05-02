from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from auth import validate_initdata
from database import get_session
from models import User

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/login")
def login(telegram_user: dict = Depends(validate_initdata), session: Session = Depends(get_session)):
    """
    Authenticate via Telegram initData.
    Creates a new user if they don't exist.
    """
    telegram_id = str(telegram_user.get("id"))
    
    # Check if user exists
    user = session.exec(select(User).where(User.telegram_id == telegram_id)).first()
    
    if not user:
        # Create new user
        user = User(telegram_id=telegram_id, paper_balance=1000.0)
        session.add(user)
        session.commit()
        session.refresh(user)
        
    return {
        "user_id": user.id,
        "paper_balance": user.paper_balance,
        "status": "success"
    }
