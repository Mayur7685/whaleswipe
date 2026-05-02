# WhaleSwipe 🐳

> Gamified copy-trading for Solana. Swipe right on top-performing wallets, paper-trade their moves, and watch the anti-rug guardrail fire in real-time.

**Telegram Mini App + PWA** · Built for hackathon demo

---

## What It Does

- **Tinder-style swipe UI** — browse whale traders with AI-generated bios, win rates, and 30-day PnL
- **Paper trading** — swipe right to copy a whale's next trade with $100 simulated USDC
- **Anti-rug scoring** — 5-signal composite scorer blocks honeypot trades before they execute
- **Live PnL** — dashboard updates every 60 seconds via batched Birdeye price calls
- **Telegram notifications** — push alerts when a rug is intercepted or a trade is copied
- **Demo honeypot** — pre-seeded "Honeypot Harry" triggers the full rug-rejection flow live

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16, framer-motion, Tailwind v4 |
| Backend | FastAPI, APScheduler, SQLModel |
| Database | SQLite (single file, zero infra) |
| Data | Birdeye REST + WebSocket API |
| AI Bios | OpenRouter (poolside/laguna-xs.2:free) |
| Notifications | python-telegram-bot |
| Auth | Telegram initData HMAC validation |
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

# Create venv and install
python -m venv venv
venv/bin/pip install -r requirements.txt

# Configure
cp .env.example .env
# Edit .env with your keys

# Seed the database (~25 seconds)
venv/bin/python seed.py

# Start
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
TELEGRAM_BOT_TOKEN=...     # From @BotFather
FERNET_KEY=...             # Generate: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
BIRDEYE_API_KEY=...        # From birdeye.so
OPENROUTER_API_KEY=...     # From openrouter.ai
DATABASE_URL=sqlite:///whaleswipe.db
```

```env
# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/auth/login` | Upsert user from Telegram initData |
| GET | `/whales/feed` | 10 unswiped whale profiles |
| POST | `/whales/{id}/swipe?action=LIKE\|PASS` | Record swipe, subscribe to WS |
| GET | `/portfolio/` | Open + closed trades, PnL |
| GET | `/events?user_id=N` | SSE stream for real-time rug alerts |
| GET | `/health` | Health check |
| POST | `/admin/ingest` | Manually trigger whale ingestion |

---

## Architecture

```
Birdeye WebSocket
      │ wallet txs
      ▼
  WSManager ──► rug_score.py ──► REJECT ──► Telegram push + SSE event
      │                    └──► SAFE  ──► PaperTrade created
      │
APScheduler
  ├── update_prices (60s) ──► GET /defi/price_volume/multi ──► PnL update
  └── ingest_new_whales (02:00 UTC) ──► new WhaleProfiles
```

---

## Project Structure

```
backend/
├── main.py              # FastAPI app, scheduler, SSE endpoint
├── auth.py              # Telegram HMAC validation
├── models.py            # DB schemas (User, WhaleProfile, UserSwipe, PaperTrade)
├── ws_manager.py        # Birdeye WebSocket pool + Telegram notifications
├── seed.py              # One-shot DB seeder
├── routers/
│   ├── auth.py
│   ├── whales.py        # Feed + swipe (honeypot rug demo here)
│   └── portfolio.py
└── services/
    ├── birdeye.py       # All Birdeye API calls (rate-limited 1 req/s)
    ├── rug_score.py     # 5-signal anti-rug scorer
    └── ai_bio.py        # OpenRouter bio generation

frontend/src/
├── app/
│   ├── page.tsx         # Main shell, tab nav, SSE consumer
│   └── layout.tsx
├── components/
│   ├── SwipeCard.tsx    # framer-motion drag cards, LIKE/NOPE stamps
│   ├── Dashboard.tsx    # Portfolio with live PnL
│   └── RugAlert.tsx     # Animated rug rejection toast
└── lib/
    ├── api.ts           # Axios client with initData header
    └── telegram.ts      # Telegram WebApp init + dev bypass
```
