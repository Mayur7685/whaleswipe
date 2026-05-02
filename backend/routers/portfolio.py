from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from database import get_session
from models import User, PaperTrade
from routers.whales import get_current_user

router = APIRouter(prefix="/portfolio", tags=["portfolio"])

@router.get("/")
def get_portfolio(user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    open_trades = session.exec(
        select(PaperTrade).where(PaperTrade.user_id == user.id, PaperTrade.status == "OPEN")
    ).all()
    closed_trades = session.exec(
        select(PaperTrade).where(PaperTrade.user_id == user.id, PaperTrade.status == "CLOSED")
        .order_by(PaperTrade.created_at.desc()).limit(20)
    ).all()

    total_unrealized = sum(t.unrealized_pnl for t in open_trades)
    total_realized = sum(t.unrealized_pnl for t in closed_trades)  # stored at close time

    return {
        "paper_balance": user.paper_balance,
        "total_unrealized_pnl": total_unrealized,
        "total_realized_pnl": total_realized,
        "net_worth": user.paper_balance + total_unrealized,
        "active_trades": open_trades,
        "closed_trades": closed_trades,
    }
