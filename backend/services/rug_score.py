from dataclasses import dataclass

@dataclass
class RugVerdict:
    score: int          # 0–100. Higher = riskier.
    flags: list[str]    # Human-readable reasons
    verdict: str        # "SAFE" | "WARN" | "REJECT"

def score_token(security_data: dict) -> RugVerdict:
    score = 0
    flags = []

    creator_pct = security_data.get("creator_percentage", 0) * 100
    if creator_pct > 40:
        score += 40
        flags.append(f"Creator holds {creator_pct:.0f}% of supply")

    if not security_data.get("mint_authority_disabled", True): # Assume disabled if missing? Safest to assume disabled if missing to not falsely trigger, but wait, usually missing means we don't know. Let's stick to user's logic.
        score += 25
        flags.append("Mint authority not renounced (supply can be inflated)")

    if security_data.get("freeze_authority_enabled", False):
        score += 20
        flags.append("Freeze authority active (wallets can be frozen)")

    liquidity_usd = security_data.get("liquidity_usd", 0)
    if liquidity_usd < 50_000:
        score += 15
        flags.append(f"Low liquidity: ${liquidity_usd:,.0f}")

    if security_data.get("is_honeypot", False):
        score = 100
        flags.append("Honeypot detected: sell transactions fail")

    verdict = "SAFE" if score < 30 else "WARN" if score < 60 else "REJECT"
    return RugVerdict(score=score, flags=flags, verdict=verdict)
