from contextlib import asynccontextmanager
import json
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlmodel import Session, select
from database import create_db_and_tables, engine
from routers import auth, whales, portfolio
from models import PaperTrade, WhaleProfile
from services.birdeye import (
    get_price_multi, get_gainers_losers, get_wallet_pnl_summary,
    get_wallet_txs, get_token_security
)
from services.ai_bio import generate_bio
from services.rug_score import score_token

from events import rug_event_queues, push_rug_event

# ── Scheduler jobs ───────────────────────────────────────────────────────────

async def update_prices():
    """Every 60s: batch-fetch prices for all open trades, update PnL."""
    with Session(engine) as session:
        open_trades = session.exec(select(PaperTrade).where(PaperTrade.status == "OPEN")).all()
        if not open_trades:
            return
        addresses = list({t.token_address for t in open_trades})
        prices = await get_price_multi(addresses)
        for trade in open_trades:
            data = prices.get(trade.token_address)
            if data:
                cp = data.get("price", trade.current_price)
                trade.current_price = cp
                trade.unrealized_pnl = (cp - trade.entry_price) * (trade.amount_usd / trade.entry_price)
        session.commit()
        print(f"[scheduler] updated {len(open_trades)} trades")

async def ingest_new_whales():
    """Daily 02:00 UTC: fetch top 15 gainers, upsert WhaleProfiles."""
    print("[scheduler] ingesting new whales...")
    try:
        gainers = await get_gainers_losers(limit=15)
    except Exception as e:
        print(f"[scheduler] gainers fetch failed: {e}")
        return

    with Session(engine) as session:
        existing = {w.wallet_address for w in session.exec(select(WhaleProfile)).all()}
        new_count = 0
        for i, g in enumerate(gainers):
            wallet = g.get("address")
            if not wallet or wallet in existing:
                continue
            try:
                pnl = await get_wallet_pnl_summary(wallet)
                txs = await get_wallet_txs(wallet, limit=50)
                bio = await generate_bio(txs)
                # Pre-score top token
                top_tokens = []
                if txs:
                    seen = {}
                    for tx in txs:
                        sym = tx.get("token_symbol", "")
                        addr = tx.get("token_address", "")
                        if sym and addr and addr not in seen:
                            seen[addr] = sym
                    top_tokens = [{"symbol": s, "pnl_pct": 0} for a, s in list(seen.items())[:3]]
                    # Score first token for risk
                    first_addr = list(seen.keys())[0] if seen else None
                    risk_score = 10
                    if first_addr:
                        sec = await get_token_security(first_addr)
                        risk_score = score_token(sec).score
                else:
                    risk_score = 10

                profile = WhaleProfile(
                    wallet_address=wallet,
                    display_name=f"Whale #{1000 + i}",
                    win_rate=pnl.get("winRate", 0) or pnl.get("win_rate", 0),
                    monthly_pnl_pct=pnl.get("pnlUSD", 0) or 0,
                    ai_bio=bio,
                    top_tokens=json.dumps(top_tokens),
                    risk_score=risk_score,
                )
                session.add(profile)
                new_count += 1
            except Exception as e:
                print(f"[scheduler] skipping {wallet}: {e}")
        session.commit()
        print(f"[scheduler] ingested {new_count} new whales")

# ── App lifespan ─────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    scheduler = AsyncIOScheduler()
    scheduler.add_job(update_prices, "interval", seconds=60)
    scheduler.add_job(ingest_new_whales, "cron", hour=2, minute=0)
    scheduler.start()
    from bot import run_bot, stop_bot
    await run_bot()
    yield
    await stop_bot()
    scheduler.shutdown()

app = FastAPI(title="WhaleSwipe API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://*.telegram.org", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(whales.router)
app.include_router(portfolio.router)

@app.get("/health")
def health_check():
    # Show last 4 chars of token to verify correct bot is configured
    token = settings.TELEGRAM_BOT_TOKEN
    return {"status": "ok", "bot_token_suffix": token[-4:] if len(token) > 4 else "not set"}

@app.post("/admin/ingest")
async def manual_ingest(x_admin_key: str = Header(...)):
    if x_admin_key != settings.ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Forbidden")
    asyncio.create_task(ingest_new_whales())
    return {"status": "ingestion started"}

@app.post("/admin/reseed")
async def reseed(x_admin_key: str = Header(...)):
    if x_admin_key != settings.ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Forbidden")
    from sqlmodel import delete as sql_delete
    from models import WhaleProfile, UserSwipe, PaperTrade
    with Session(engine) as s:
        s.exec(sql_delete(PaperTrade))
        s.exec(sql_delete(UserSwipe))
        s.exec(sql_delete(WhaleProfile))
        s.commit()
    asyncio.create_task(ingest_new_whales())
    return {"status": "reseed started"}

# ── SSE endpoint for real-time rug events ────────────────────────────────────

@app.get("/events")
async def sse_events(user_id: int):
    """Server-Sent Events stream. Frontend polls this for rug rejection alerts."""
    import asyncio

    async def generator():
        yield "data: {\"type\":\"connected\"}\n\n"
        while True:
            events = rug_event_queues.pop(user_id, [])
            for ev in events:
                yield f"data: {json.dumps(ev)}\n\n"
            await asyncio.sleep(1)

    return StreamingResponse(generator(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
