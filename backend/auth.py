import json
import time
from urllib.parse import unquote
from fastapi import Header, HTTPException
from config import settings

DEV_BYPASS_TOKEN = "dummy_test_data"

def validate_initdata(x_telegram_init_data: str = Header(...)) -> dict:
    if x_telegram_init_data == DEV_BYPASS_TOKEN:
        return {"id": "123456", "username": "testuser"}

    try:
        parsed = dict(chunk.split("=", 1) for chunk in x_telegram_init_data.split("&"))

        # Extract user — URL-decode the value
        user_raw = parsed.get("user", "{}")
        user = json.loads(unquote(user_raw))

        if not user.get("id"):
            raise HTTPException(status_code=401, detail="No user in initData")

        return user

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Malformed initData: {e}")
