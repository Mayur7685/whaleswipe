import asyncio
import json
import websockets
from telegram import Bot
from telegram.error import TelegramError
from config import settings
from database import engine
from sqlmodel import Session, select
from models import PaperTrade, WhaleProfile, User

from services.birdeye import get_token_security
from services.rug_score import score_token

# Lazy bot — only instantiated when TELEGRAM_BOT_TOKEN is real
_bot: Bot | None = None

def _get_bot() -> Bot | None:
    global _bot
    if _bot is None and settings.TELEGRAM_BOT_TOKEN not in ("dummy_token", ""):
        _bot = Bot(token=settings.TELEGRAM_BOT_TOKEN)
    return _bot

async def _notify(telegram_id: str, text: str):
    bot = _get_bot()
    if not bot:
        return
    try:
        await bot.send_message(chat_id=telegram_id, text=text, parse_mode="HTML")
    except TelegramError as e:
        print(f"[telegram] notify failed for {telegram_id}: {e}")

class WSManager:
    def __init__(self):
        self.subscriptions: dict[str, set[int]] = {}  # wallet -> {user_id}
        self.tasks: dict[str, asyncio.Task] = {}

    async def subscribe(self, wallet: str, user_id: int):
        if wallet not in self.subscriptions:
            self.subscriptions[wallet] = set()
            self.tasks[wallet] = asyncio.create_task(self._listen(wallet))
        self.subscriptions[wallet].add(user_id)

    async def _listen(self, wallet: str):
        # Correct Birdeye WS URL includes /solana
        url = f"wss://public-api.birdeye.so/socket/solana?x-api-key={settings.BIRDEYE_API_KEY}"
        try:
            async with websockets.connect(
                url,
                additional_headers={
                    "Origin": "wss://public-api.birdeye.so",
                    "Sec-WebSocket-Protocol": "echo-protocol",
                }
            ) as ws:
                await ws.send(json.dumps({
                    "type": "SUBSCRIBE_WALLET_TXS",
                    "data": {"address": wallet}
                }))
                async for message in ws:
                    data = json.loads(message)
                    if data.get("type") == "WALLET_TXS_DATA":
                        await self._handle_tx(wallet, data.get("data", {}))
        except Exception as e:
            print(f"[ws] error for {wallet}: {e}")

    async def _handle_tx(self, wallet: str, tx: dict):
        # Only process swaps (buys)
        if tx.get("type") not in ("swap", "buy"):
            return

        # Determine token address from the quote token (what was bought)
        quote = tx.get("quote", {})
        token_address = quote.get("address")
        token_symbol = quote.get("symbol", "UNKNOWN")
        if not token_address:
            return

        security = await get_token_security(token_address)
        verdict = score_token(security)
        followers = self.subscriptions.get(wallet, set())
        if not followers:
            return

        with Session(engine) as session:
            whale = session.exec(select(WhaleProfile).where(WhaleProfile.wallet_address == wallet)).first()
            if not whale:
                return

            users = session.exec(select(User).where(User.id.in_(list(followers)))).all()
            user_map = {u.id: u for u in users}

            if verdict.verdict == "REJECT":
                flags_text = "\n".join(f"• {f}" for f in verdict.flags)
                for user_id in followers:
                    # Push to SSE queue (imported lazily to avoid circular import)
                    from events import push_rug_event
                    push_rug_event(user_id, {
                        "type": "rug_rejection",
                        "whale": whale.display_name,
                        "token": token_symbol,
                        "flags": verdict.flags,
                    })
                    # Telegram push
                    u = user_map.get(user_id)
                    if u:
                        await _notify(u.telegram_id,
                            f"🚨 <b>Rug Intercepted!</b>\n"
                            f"<b>{whale.display_name}</b> tried to buy <b>{token_symbol}</b>\n\n"
                            f"<b>Flags:</b>\n{flags_text}\n\n"
                            f"Trade blocked by WhaleSwipe Guard ✅"
                        )
            else:
                current_price = tx.get("volumeUSD", 0)
                # Use a fixed $100 paper trade size
                amount_usd = 100.0
                # Estimate entry price from volume / quote amount
                quote_amount = quote.get("uiAmount", 0)
                entry_price = (current_price / quote_amount) if quote_amount else 0
                if entry_price <= 0:
                    return

                for user_id in followers:
                    trade = PaperTrade(
                        user_id=user_id,
                        whale_id=whale.id,
                        token_address=token_address,
                        token_symbol=token_symbol,
                        entry_price=entry_price,
                        current_price=entry_price,
                        amount_usd=amount_usd,
                        rug_flags=json.dumps(verdict.flags),
                    )
                    session.add(trade)
                    # Telegram push
                    u = user_map.get(user_id)
                    if u:
                        await _notify(u.telegram_id,
                            f"📋 <b>Trade Copied!</b>\n"
                            f"<b>{whale.display_name}</b> bought <b>{token_symbol}</b>\n"
                            f"Entry: ${entry_price:.6f} · Size: $100 paper\n"
                            f"Risk: {verdict.verdict}"
                        )
                session.commit()
                print(f"[ws] copied {len(followers)} trades for {token_symbol}")

ws_manager = WSManager()
