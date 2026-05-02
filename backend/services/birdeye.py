import httpx
import asyncio
import time
from config import settings

BIRDEYE_BASE_URL = "https://public-api.birdeye.so"
_TIMEOUT = 15
_rate_lock = asyncio.Lock()  # 1 req/sec — free tier limit

def get_headers():
    return {
        "X-API-KEY": settings.BIRDEYE_API_KEY,
        "x-chain": "solana",
        "accept": "application/json",
    }

async def _get(path: str, params: dict = None) -> dict:
    async with _rate_lock:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            r = await client.get(f"{BIRDEYE_BASE_URL}{path}", headers=get_headers(), params=params)
    await asyncio.sleep(1.1)  # outside lock — don't block other waiters while sleeping
    return r.json() if r.status_code == 200 else {}

async def _post(path: str, body: dict) -> dict:
    async with _rate_lock:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            r = await client.post(f"{BIRDEYE_BASE_URL}{path}", headers=get_headers(), json=body)
    await asyncio.sleep(1.1)
    return r.json() if r.status_code == 200 else {}

# ── Cache for token security (5 min) ────────────────────────────────────────
_security_cache: dict[str, tuple[dict, float]] = {}

async def get_gainers_losers(type="1W", sort_by="PnL", sort_type="desc", offset=0, limit=15):
    data = await _get("/trader/gainers-losers", {"type": type, "sort_by": sort_by, "sort_type": sort_type, "offset": offset, "limit": limit})
    return data.get("data", {}).get("items", [])

async def get_wallet_pnl_summary(wallet: str):
    data = await _get("/wallet/v2/pnl/summary", {"wallet": wallet})
    return data.get("data", {})

async def get_wallet_net_worth(wallet: str, count: int = 30):
    """Fetch 30-day net worth history for sparkline."""
    data = await _get("/wallet/v2/net-worth", {"wallet": wallet, "count": count, "type": "1d", "direction": "back"})
    items = data.get("data", {}).get("history", [])
    # Return oldest→newest, just the net_worth values
    return [{"net_worth": h["net_worth"]} for h in reversed(items)]

async def get_wallet_txs(wallet: str, limit=50):
    data = await _get("/defi/v3/txs", {"wallet": wallet, "limit": limit})
    return data.get("data", {}).get("items", [])

async def get_token_security(address: str):
    now = time.time()
    if address in _security_cache:
        cached, ts = _security_cache[address]
        if now - ts < 300:
            return cached
    data = await _get("/defi/token_security", {"address": address})
    result = data.get("data", {})
    _security_cache[address] = (result, now)
    return result

async def get_price_multi(addresses: list[str]):
    if not addresses:
        return {}
    data = await _post("/defi/price_volume/multi", {"list_address": ",".join(addresses[:50]), "type": "24h"})
    return data.get("data", {})
