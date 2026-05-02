import random
import asyncio
import openai
from config import settings

_FALLBACKS = [
    "Diamond hands since 2021. I buy the dip, every dip, even the ones that keep dipping.",
    "Aping into memecoins since before it was cool. My portfolio is a horror story.",
    "I don't time the market, I am the market. Ask me about my 47x on WIF.",
    "Full-time degen, part-time genius. Currently up 300% on paper.",
    "Solana native. I've seen rugs you wouldn't believe.",
]

_FREE_MODELS = [
    "poolside/laguna-xs.2:free",
    "z-ai/glm-4.5-air:free",
    "openai/gpt-oss-120b:free",
    "minimax/minimax-m2.5:free",
]

async def generate_bio(tx_history: list) -> str:
    if settings.OPENROUTER_API_KEY == "dummy_key":
        return random.choice(_FALLBACKS)

    client = openai.AsyncOpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=settings.OPENROUTER_API_KEY,
    )
    symbols = {tx.get("token_symbol") for tx in tx_history if tx.get("token_symbol")}
    prompt = (
        f"Write a 2-sentence Tinder-style bio for a crypto trader who made {len(tx_history)} trades. "
        f"Tokens they trade: {', '.join(list(symbols)[:5]) or 'unknown coins'}. "
        "Funny, slightly degen, crypto stereotypes. No hashtags."
    )

    for model in _FREE_MODELS:
        try:
            resp = await asyncio.wait_for(
                client.chat.completions.create(
                    model=model,
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=60,
                ),
                timeout=8,
            )
            return resp.choices[0].message.content.strip()
        except Exception:
            continue

    return random.choice(_FALLBACKS)
