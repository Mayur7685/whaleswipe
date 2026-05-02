# WhaleSwipe — Testing Guide 🧪

---

## 0. Running the Backend

```bash
cd /Users/mayurasodara/Desktop/eye-bird-maetra/backend

# First time only — seed the DB (~25 seconds)
venv/bin/python seed.py

# Start the server
venv/bin/uvicorn main:app --reload --port 8000
```

In a separate terminal, start the frontend:

```bash
cd /Users/mayurasodara/Desktop/eye-bird-maetra/frontend
npm run dev
```

Open http://localhost:3000

> **Reseed** (wipe all data and start fresh):
> ```bash
> venv/bin/python -c "
> from database import get_session; from models import WhaleProfile,UserSwipe,PaperTrade; from sqlmodel import delete
> s=next(get_session()); s.exec(delete(PaperTrade)); s.exec(delete(UserSwipe)); s.exec(delete(WhaleProfile)); s.commit(); print('cleared')
> "
> venv/bin/python seed.py
> ```

---

## 1. Environment Check

```bash
# Backend health
curl http://localhost:8000/health
# → {"status":"ok","bot_token_suffix":"xxxx"}

# Check whales in DB
venv/bin/python -c "
from database import get_session; from models import WhaleProfile; from sqlmodel import select
s = next(get_session())
for w in s.exec(select(WhaleProfile)).all():
    print(f'{w.display_name} | win={w.win_rate:.2f} | honeypot={w.is_honeypot}')
"
```

---

## 2. Auth

```bash
# Dev bypass (no real Telegram needed)
curl -X POST http://localhost:8000/auth/login \
  -H "X-Telegram-Init-Data: dummy_test_data"
# → {"user_id":1,"paper_balance":1000.0,"status":"success"}
```

---

## 3. Whale Feed

```bash
curl http://localhost:8000/whales/feed \
  -H "X-Telegram-Init-Data: dummy_test_data"
# → array of WhaleProfile objects (max 10, excludes already-swiped)

# Verify real sparkline data is present
curl -s http://localhost:8000/whales/feed \
  -H "X-Telegram-Init-Data: dummy_test_data" | python3 -c "
import sys,json; w=json.load(sys.stdin)
print(f'{w[0][\"display_name\"]} — sparkline points: {len(json.loads(w[0][\"net_worth_history\"]))}')
"
# → Whale #1000 — sparkline points: 30
```

If returns `[]` — clear swipes:
```bash
venv/bin/python -c "
from database import get_session; from models import UserSwipe; from sqlmodel import delete
s=next(get_session()); s.exec(delete(UserSwipe)); s.commit(); print('cleared')
"
```

---

## 4. Swipe Right (creates demo trade + Telegram notification)

```bash
# Get a whale ID first
curl -s http://localhost:8000/whales/feed \
  -H "X-Telegram-Init-Data: dummy_test_data" | python3 -c "
import sys,json; w=json.load(sys.stdin); print(f'ID={w[0][\"id\"]} name={w[0][\"display_name\"]}')
"

# Swipe LIKE (replace 1 with actual ID)
curl -X POST "http://localhost:8000/whales/1/swipe?action=LIKE" \
  -H "X-Telegram-Init-Data: dummy_test_data"
# → {"status":"success","action":"LIKE"}
# Telegram notification: 📋 Trade Copied!
```

---

## 5. Honeypot Demo (the money moment)

```bash
# Get honeypot ID
venv/bin/python -c "
from database import get_session; from models import WhaleProfile; from sqlmodel import select
s=next(get_session())
h = s.exec(select(WhaleProfile).where(WhaleProfile.is_honeypot == True)).first()
print(f'Honeypot ID: {h.id}')
"

# Swipe RIGHT on honeypot (replace 11 with actual ID)
curl -X POST "http://localhost:8000/whales/11/swipe?action=LIKE" \
  -H "X-Telegram-Init-Data: dummy_test_data"
# → {"status":"rejected","rug_flags":["Honeypot detected...","Creator holds 100%...",...]}
# Telegram notification: 🚨 Rug Intercepted!
```

---

## 6. SSE Rug Events (real-time frontend alerts)

```bash
# Open SSE stream in one terminal
curl -N "http://localhost:8000/events?user_id=1"

# In another terminal, swipe right on honeypot
curl -X POST "http://localhost:8000/whales/11/swipe?action=LIKE" \
  -H "X-Telegram-Init-Data: dummy_test_data"

# First terminal receives:
# data: {"type":"rug_rejection","whale":"Honeypot Harry 🍯","token":"SCAM","flags":[...]}
```

---

## 7. Portfolio

```bash
curl http://localhost:8000/portfolio/ \
  -H "X-Telegram-Init-Data: dummy_test_data"
# → {paper_balance, total_unrealized_pnl, net_worth, active_trades, closed_trades}
```

---

## 8. Admin Endpoints

```bash
# Manually trigger whale ingestion (no 2am wait)
curl -X POST http://localhost:8000/admin/ingest \
  -H "X-Admin-Key: whaleswipe-admin-2026"
# → {"status":"ingestion started"}

# Full reseed (clear + re-ingest)
curl -X POST http://localhost:8000/admin/reseed \
  -H "X-Admin-Key: whaleswipe-admin-2026"
# → {"status":"reseed started"}
```

---

## 9. Bot Commands (in Telegram)

Send these to your bot:
- `/start` — welcome + Mini App button
- `/portfolio` — net worth + open trades in chat
- `/whales` — top 5 whales with stats

---

## 10. Live PnL Update

```bash
# Trigger price update immediately (normally runs every 60s)
venv/bin/python -c "
import asyncio
from main import update_prices
asyncio.run(update_prices())
print('done')
"
```

---

## 11. Anti-Rug Scorer Unit Test

```bash
venv/bin/python -c "
from services.rug_score import score_token

print(score_token({'is_honeypot': True}))           # score=100, REJECT
print(score_token({'creator_percentage': 0.5, 'liquidity_usd': 10000}))  # WARN
print(score_token({'creator_percentage': 0.1, 'mint_authority_disabled': True, 'liquidity_usd': 100000}))  # SAFE
"
```

---

## Common Issues

| Symptom | Fix |
|---|---|
| Feed returns `[]` | Clear UserSwipe table (see §3) |
| Bio shows error text | OpenRouter key invalid — check `.env` |
| Telegram notification not arriving | Check `TELEGRAM_BOT_TOKEN` in `.env`; user must have started the bot |
| 401 inside Telegram | Bot token on Render doesn't match BotFather token |
| `win=0.00 pnl=0` in seed | Birdeye PnL returned empty for that wallet |
| Port 8000 in use | `lsof -ti:8000 \| xargs kill` |
| Render 401 | Set all env vars in Render dashboard and redeploy |
