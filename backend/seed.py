import asyncio
import json
from database import create_db_and_tables, get_session
from models import WhaleProfile
from sqlmodel import select
from services.birdeye import get_gainers_losers, get_wallet_pnl_summary, get_wallet_net_worth
from services.ai_bio import generate_bio

async def seed_whales():
    create_db_and_tables()
    session = next(get_session())

    if session.exec(select(WhaleProfile)).first():
        print("Already seeded. Run clear first.")
        return

    print("Fetching top gainers...")
    gainers = await get_gainers_losers(limit=10)  # 1 call
    print(f"Got {len(gainers)} gainers")

    for i, gainer in enumerate(gainers):
        wallet = gainer.get("address")
        if not wallet:
            continue
        print(f"[{i+1}/10] {wallet[:20]}...")

        pnl = await get_wallet_pnl_summary(wallet)  # 1 call per whale
        net_worth_history = await get_wallet_net_worth(wallet)  # 1 call per whale
        summary = pnl.get("summary", {})
        win_rate = summary.get("counts", {}).get("win_rate", 0)
        monthly_pnl = summary.get("pnl", {}).get("realized_profit_percent", 0)
        # Also use gainer's pnl field as fallback
        if monthly_pnl == 0:
            monthly_pnl = gainer.get("pnl", 0)

        bio = await generate_bio([])  # no txs needed — uses prompt without token list

        session.add(WhaleProfile(
            wallet_address=wallet,
            display_name=f"Whale #{i+1000}",
            win_rate=win_rate,
            monthly_pnl_pct=monthly_pnl,
            ai_bio=bio,
            top_tokens=json.dumps([{"symbol": "SOL", "pnl_pct": 0}]),
            risk_score=10,
            net_worth_history=json.dumps(net_worth_history),
        ))
        print(f"  ✓ win={win_rate:.2f} pnl={monthly_pnl:.0f}")

    # Honeypot for demo
    session.add(WhaleProfile(
        wallet_address="HoneyPotDemoWallet11111111111111111111111",
        display_name="Honeypot Harry 🍯",
        win_rate=0.999, monthly_pnl_pct=10000.0,
        ai_bio="I literally only trade rugs. Don't copy me.",
        top_tokens=json.dumps([{"symbol": "SCAM", "pnl_pct": 500}]),
        risk_score=100, is_honeypot=True,
    ))

    session.commit()
    print("Done.")

if __name__ == "__main__":
    asyncio.run(seed_whales())
