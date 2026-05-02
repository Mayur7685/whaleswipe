# WhaleSwipe 🐳

> Gamified copy-trading for Solana. Swipe right on top-performing wallets, paper-trade their moves, and watch the anti-rug guardrail fire in real-time.

**Telegram Mini App + PWA** · Hackathon demo

---

## What It Does

- **Tinder-style swipe UI** — browse whale traders with DiceBear robot avatars, AI-generated bios, win rates, 30-day PnL, and a real net worth sparkline chart
- **Paper trading** — swipe right to instantly copy a whale's position with $100 simulated USDC
- **Anti-rug scoring** — 5-signal composite scorer blocks honeypot trades before they execute
- **Live PnL** — dashboard updates every 60 seconds via batched Birdeye price calls
- **Telegram notifications** — push alerts when a trade is copied or a rug is intercepted
- **Bot commands** — `/start`, `/portfolio`, `/whales` work directly in Telegram chat
- **Demo honeypot** — pre-seeded "Honeypot Harry" triggers the full rug-rejection flow live
- **PWA** — works outside Telegram on desktop for judges

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16, framer-motion, inline styles |
| Backend | FastAPI, APScheduler, SQLModel |
| Database | SQLite (single file, zero infra) |
| Data | Birdeye REST + WebSocket API |
| AI Bios | OpenRouter (poolside/laguna-xs.2:free + fallbacks) |
| Notifications | python-telegram-bot |
| Auth | Telegram initData parsing |
| Encryption | AES wallet addresses at rest |

---

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- Birdeye API key (free tier)
- OpenRouter API key (free tier)
- Telegram Bot token (from @BotFather)

### 1. Backend

```bash
cd backend
python -m venv venv
venv/bin/pip install -r requirements.txt
cp .env.example .env
# Edit .env with your keys
venv/bin/python seed.py
venv/bin/uvicorn main:app --reload --port 8000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000

---

## Environment Variables

```env
# backend/.env
TELEGRAM_BOT_TOKEN=...
FERNET_KEY=...             # python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
BIRDEYE_API_KEY=...
OPENROUTER_API_KEY=...
DATABASE_URL=sqlite:///whaleswipe.db
ADMIN_SECRET=...           # for /admin/* endpoints
MINI_APP_URL=...           # your Vercel URL, used in bot /start command
```

```env
# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/login` | initData | Upsert user from Telegram initData |
| GET | `/whales/feed` | initData | 10 unswiped whale profiles (includes `net_worth_history` for sparkline) |
| POST | `/whales/{id}/swipe?action=LIKE\|PASS` | initData | Record swipe, create demo trade, subscribe to WS |
| GET | `/portfolio/` | initData | Open + closed trades, PnL |
| GET | `/events?user_id=N` | — | SSE stream for real-time rug alerts |
| GET | `/health` | — | Health check |
| POST | `/admin/ingest` | X-Admin-Key | Trigger daily whale ingestion manually |
| POST | `/admin/reseed` | X-Admin-Key | Clear all data and reseed from scratch |

---

## Bot Commands

| Command | Description |
|---|---|
| `/start` | Welcome message + button to open Mini App |
| `/portfolio` | Your net worth, PnL, and open trades in chat |
| `/whales` | Top 5 whale traders with stats |

Bot also sends automatic push notifications:
- 📋 **Trade Copied** — when you swipe right on a whale
- 🚨 **Rug Intercepted** — when a honeypot trade is blocked (with named flags)

---

## Architecture

```
Birdeye WebSocket
      │ wallet txs
      ▼
  WSManager ──► rug_score.py ──► REJECT ──► Telegram push + SSE event
      │                    └──► SAFE  ──► PaperTrade + Telegram push
      │
APScheduler
  ├── update_prices (60s) ──► POST /defi/price_volume/multi ──► PnL update
  └── ingest_new_whales (02:00 UTC) ──► new WhaleProfiles

Swipe LIKE ──► demo PaperTrade created immediately ──► Telegram push
Swipe LIKE on honeypot ──► rug rejection ──► SSE toast + Telegram push
```

---

## Deployment

### Frontend → Vercel
1. Push `frontend/` to GitHub
2. Import on [vercel.com](https://vercel.com)
3. Set env var: `NEXT_PUBLIC_API_URL=https://your-render-url.onrender.com`

### Backend → Render
1. Push `backend/` to GitHub
2. New Web Service on [render.com](https://render.com)
3. Build: `pip install -r requirements.txt && python seed.py`
4. Start: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Set all env vars from `.env`

### Reseed on Render (no shell access needed)
```bash
curl -X POST https://your-backend.onrender.com/admin/reseed \
  -H "X-Admin-Key: your-admin-secret"
```

---

## Project Structure

```
backend/
├── main.py              # FastAPI app, scheduler, SSE endpoint, admin routes
├── auth.py              # Telegram initData parsing
├── bot.py               # Telegram bot commands (/start /portfolio /whales)
├── models.py            # DB schemas
├── ws_manager.py        # Birdeye WebSocket pool + Telegram notifications
├── events.py            # SSE rug event queue (avoids circular imports)
├── seed.py              # One-shot DB seeder
├── routers/
│   ├── auth.py
│   ├── whales.py        # Feed + swipe + demo trade creation
│   └── portfolio.py     # Open + closed trades
└── services/
    ├── birdeye.py       # Birdeye API (rate-limited 1 req/s)
    ├── rug_score.py     # 5-signal anti-rug scorer
    └── ai_bio.py        # OpenRouter bio (tries 4 free models)

frontend/src/
├── app/page.tsx         # Main shell, SSE consumer, error state
├── components/
│   ├── SwipeCard.tsx    # framer-motion drag, LIKE/NOPE stamps, stack peek
│   ├── Dashboard.tsx    # Portfolio with live PnL
│   └── RugAlert.tsx     # Animated rug rejection toast
└── lib/
    ├── api.ts           # Axios client
    └── telegram.ts      # initData extraction with dev bypass
```
