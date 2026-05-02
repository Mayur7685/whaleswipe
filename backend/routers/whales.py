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

    return {"status": "success", "action": action}
