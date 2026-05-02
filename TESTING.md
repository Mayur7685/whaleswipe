# WhaleSwipe — Testing Guide 🧪

---

## 0. Running the Backend

```bash
cd /Users/mayurasodara/Desktop/eye-bird-maetra/backend

# First time only — seed the DB
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

> **Reseed** (if you want fresh data):
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
# → {"status":"ok"}

# Check whales in DB
cd backend && venv/bin/python -c "
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
```

If returns `[]`: swipes exist from a previous session. Clear them:
```bash
venv/bin/python -c "
from database import get_session; from models import UserSwipe; from sqlmodel import delete
s=next(get_session()); s.exec(delete(UserSwipe)); s.commit(); print('cleared')
"
```

---

## 4. Swipe + Honeypot Demo

```bash
# Get honeypot whale ID
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
```

Expected: SSE event fires, RugAlert toast appears in browser, Telegram notification sent.

---

## 5. SSE Rug Events

```bash
# Open SSE stream in one terminal
curl -N "http://localhost:8000/events?user_id=1"

# In another terminal, swipe right on honeypot
curl -X POST "http://localhost:8000/whales/11/swipe?action=LIKE" \
  -H "X-Telegram-Init-Data: dummy_test_data"

# First terminal should receive:
# data: {"type":"rug_rejection","whale":"Honeypot Harry 🍯","token":"SCAM","flags":[...]}
```

---

## 6. Portfolio

```bash
curl http://localhost:8000/portfolio/ \
  -H "X-Telegram-Init-Data: dummy_test_data"
# → {paper_balance, total_unrealized_pnl, net_worth, active_trades, closed_trades}
```

---

## 7. Manual Whale Ingestion

```bash
# Trigger without waiting for 2am cron
curl -X POST http://localhost:8000/admin/ingest
# → {"status":"ingestion started"}
# Watch backend logs for "[scheduler] ingesting new whales..."
```

---

## 8. Live PnL Update

The `update_prices` job runs every 60 seconds. To test immediately:

```bash
venv/bin/python -c "
import asyncio
from main import update_prices
asyncio.run(update_prices())
print('done')
"
```

---

## 9. Reseed from Scratch

```bash
cd backend

# Clear all data
venv/bin/python -c "
from database import get_session; from models import WhaleProfile,UserSwipe,PaperTrade; from sqlmodel import delete
s=next(get_session()); s.exec(delete(PaperTrade)); s.exec(delete(UserSwipe)); s.exec(delete(WhaleProfile)); s.commit(); print('cleared')
"

# Reseed (~25 seconds)
venv/bin/python seed.py
```

---

## 10. Anti-Rug Scorer Unit Test

```bash
venv/bin/python -c "
from services.rug_score import score_token

# Should REJECT
honeypot = {'is_honeypot': True}
print(score_token(honeypot))  # score=100, verdict=REJECT

# Should WARN
risky = {'creator_percentage': 0.5, 'liquidity_usd': 10000}
print(score_token(risky))  # score=55, verdict=WARN

# Should be SAFE
safe = {'creator_percentage': 0.1, 'mint_authority_disabled': True, 'liquidity_usd': 100000}
print(score_token(safe))  # score=0, verdict=SAFE
"
```

---

## Common Issues

| Symptom | Fix |
|---|---|
| Feed returns `[]` | Clear UserSwipe table (see §3) |
| Bio shows error text | OpenRouter key invalid or rate-limited — check `.env` |
| Telegram notification not arriving | Check `TELEGRAM_BOT_TOKEN` in `.env`; user must have started the bot |
| `win=0.00 pnl=0` in seed | Birdeye PnL endpoint returned empty — wallet may have no history |
| Backend 401 on all requests | Using wrong `X-Telegram-Init-Data` header — use `dummy_test_data` in dev |
| Port 8000 already in use | `lsof -ti:8000 \| xargs kill` |
