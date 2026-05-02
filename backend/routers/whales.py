import json
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from auth import validate_initdata
from database import get_session
from models import User, WhaleProfile, UserSwipe
from ws_manager import ws_manager, _notify
from events import push_rug_event

router = APIRouter(prefix="/whales", tags=["whales"])

def get_current_user(telegram_user: dict = Depends(validate_initdata), session: Session = Depends(get_session)) -> User:
    telegram_id = str(telegram_user.get("id"))
    user = session.exec(select(User).where(User.telegram_id == telegram_id)).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found. Please call /auth/login first.")
    return user

@router.get("/feed")
def get_feed(user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    swiped_ids = session.exec(select(UserSwipe.whale_id).where(UserSwipe.user_id == user.id)).all()
    query = select(WhaleProfile)
    if swiped_ids:
        query = query.where(WhaleProfile.id.not_in(swiped_ids))
    return session.exec(query.limit(10)).all()

@router.post("/{whale_id}/swipe")
async def swipe_whale(
    whale_id: int,
    action: str,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    action = action.upper()
    if action not in ["LIKE", "PASS"]:
        raise HTTPException(status_code=400, detail="Action must be LIKE or PASS")

    whale = session.exec(select(WhaleProfile).where(WhaleProfile.id == whale_id)).first()
    if not whale:
        raise HTTPException(status_code=404, detail="Whale not found")

    if session.exec(select(UserSwipe).where(UserSwipe.user_id == user.id, UserSwipe.whale_id == whale_id)).first():
        return {"status": "already_swiped"}

    session.add(UserSwipe(user_id=user.id, whale_id=whale_id, action=action))
    session.commit()

    if action == "LIKE":
        # Honeypot: immediately fire rug rejection — don't wait for WS tx
        if whale.is_honeypot:
            flags = [
                "Honeypot detected: sell transactions fail",
                "Creator holds 100% of supply",
                "Mint authority not renounced (supply can be inflated)",
            ]
            push_rug_event(user.id, {
                "type": "rug_rejection",
                "whale": whale.display_name,
                "token": "SCAM",
                "flags": flags,
            })
            await _notify(user.telegram_id,
                f"🚨 <b>Rug Intercepted!</b>\n"
                f"<b>{whale.display_name}</b> tried to buy <b>SCAM</b>\n\n"
                f"<b>Flags:</b>\n" + "\n".join(f"• {f}" for f in flags) +
                f"\n\nTrade blocked by WhaleSwipe Guard ✅"
            )
            return {"status": "rejected", "rug_flags": flags}

        await ws_manager.subscribe(whale.wallet_address, user.id)

        # Create a demo paper trade immediately so portfolio shows activity
        # In production this would come from the WebSocket when the whale actually trades
        import json as _json
        from models import PaperTrade
        top_tokens = _json.loads(whale.top_tokens or "[]")
        token_symbol = top_tokens[0]["symbol"] if top_tokens else "SOL"
        # Use a realistic demo price
        demo_prices = {"SOL": 145.0, "WIF": 2.1, "BONK": 0.000025, "SCAM": 0.001}
        entry_price = demo_prices.get(token_symbol, 1.0)
        trade = PaperTrade(
            user_id=user.id,
            whale_id=whale.id,
            token_address=f"demo_{token_symbol}_{whale.id}",
            token_symbol=token_symbol,
            entry_price=entry_price,
            current_price=entry_price,
            amount_usd=100.0,
            rug_flags=_json.dumps([]),
        )
        session.add(trade)
        session.commit()

        # Telegram push for the copied trade
        await _notify(user.telegram_id,
            f"📋 <b>Trade Copied!</b>\n"
            f"Following <b>{whale.display_name}</b>\n"
            f"Bought <b>{token_symbol}</b> @ ${entry_price:.4f}\n"
            f"Size: $100 paper · Risk: SAFE ✅"
        )

    return {"status": "success", "action": action}
