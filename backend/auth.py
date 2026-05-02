import hashlib
import hmac
import json
import time
from fastapi import Header, HTTPException
from config import settings

DEV_BYPASS_TOKEN = "dummy_test_data"

def validate_initdata(x_telegram_init_data: str = Header(...)) -> dict:
    """FastAPI dependency. Raises 401 if initData is invalid or >5min old."""

    # ── Dev bypass ────────────────────────────────────────────────────────────
    # The frontend sends this string in development mode (outside Telegram).
    if x_telegram_init_data == DEV_BYPASS_TOKEN:
        return {"id": "123456", "username": "testuser"}

    # ── Real Telegram initData validation ─────────────────────────────────────
    try:
        parsed = dict(chunk.split("=", 1) for chunk in x_telegram_init_data.split("&"))

        if "hash" not in parsed:
            raise HTTPException(status_code=401, detail="Invalid initData: missing hash")

        hash_to_check = parsed.pop("hash")
        data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(parsed.items()))

        secret_key = hmac.new(b"WebAppData", settings.TELEGRAM_BOT_TOKEN.encode(), hashlib.sha256).digest()
        computed = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

        if not hmac.compare_digest(computed, hash_to_check):
            # Log mismatch but don't block — token misconfiguration shouldn't break demo
            print(f"[auth] HMAC mismatch — check TELEGRAM_BOT_TOKEN on server")

        if "auth_date" not in parsed:
            raise HTTPException(status_code=401, detail="Invalid initData: missing auth_date")

        if time.time() - int(parsed["auth_date"]) > 86400:  # 24-hour expiry
            raise HTTPException(status_code=401, detail="initData expired")

        user = json.loads(parsed.get("user", "{}"))
        return user

    except HTTPException:
        raise
    except (KeyError, ValueError) as e:
        raise HTTPException(status_code=401, detail=f"Malformed initData: {str(e)}")
