"""
Run standalone: venv/bin/python bot.py
Or it auto-starts with the FastAPI app via lifespan.
"""
import asyncio
import json
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, ContextTypes
from config import settings
from database import engine
from sqlmodel import Session, select
from models import User, PaperTrade, WhaleProfile

MINI_APP_URL = settings.MINI_APP_URL  # set in .env

def _get_app():
    if settings.TELEGRAM_BOT_TOKEN in ("dummy_token", ""):
        return None
    return Application.builder().token(settings.TELEGRAM_BOT_TOKEN).build()

async def cmd_start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    kb = InlineKeyboardMarkup([[
        InlineKeyboardButton("🐳 Open WhaleSwipe", web_app={"url": MINI_APP_URL})
    ]])
    await update.message.reply_text(
        "👋 Welcome to *WhaleSwipe*!\n\n"
        "Swipe right on top Solana whale traders and paper-trade their moves.\n"
        "Built-in anti-rug guardrail blocks honeypots before they execute.\n\n"
        "Tap below to open the app 👇",
        parse_mode="Markdown",
        reply_markup=kb,
    )

async def cmd_portfolio(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    telegram_id = str(update.effective_user.id)
    with Session(engine) as s:
        user = s.exec(select(User).where(User.telegram_id == telegram_id)).first()
        if not user:
            await update.message.reply_text("Open the app first to create your account.")
            return
        trades = s.exec(select(PaperTrade).where(PaperTrade.user_id == user.id, PaperTrade.status == "OPEN")).all()

    pnl = sum(t.unrealized_pnl for t in trades)
    net = user.paper_balance + pnl
    lines = [f"💼 *Portfolio*", f"Net Worth: *${net:.2f}*", f"Unrealized PnL: *{'+' if pnl>=0 else ''}${pnl:.2f}*", f"Open trades: *{len(trades)}*"]
    if trades:
        lines.append("")
        for t in trades[:5]:
            emoji = "🟢" if t.unrealized_pnl >= 0 else "🔴"
            lines.append(f"{emoji} {t.token_symbol} — {'+' if t.unrealized_pnl>=0 else ''}${t.unrealized_pnl:.2f}")
    await update.message.reply_text("\n".join(lines), parse_mode="Markdown")

async def cmd_whales(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    with Session(engine) as s:
        whales = s.exec(select(WhaleProfile).where(WhaleProfile.is_honeypot == False).limit(5)).all()
    lines = ["🐳 *Top Whales*", ""]
    for w in whales:
        lines.append(f"*{w.display_name}* — Win: {w.win_rate*100:.0f}% | PnL: {'+' if w.monthly_pnl_pct>=0 else ''}{w.monthly_pnl_pct:.0f}%")
    kb = InlineKeyboardMarkup([[InlineKeyboardButton("Swipe in App →", web_app={"url": MINI_APP_URL})]])
    await update.message.reply_text("\n".join(lines), parse_mode="Markdown", reply_markup=kb)

async def run_bot():
    app = _get_app()
    if not app:
        return
    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("portfolio", cmd_portfolio))
    app.add_handler(CommandHandler("whales", cmd_whales))
    await app.initialize()
    await app.start()
    await app.updater.start_polling()

async def stop_bot():
    app = _get_app()
    if app:
        await app.updater.stop()
        await app.stop()
        await app.shutdown()

if __name__ == "__main__":
    asyncio.run(run_bot())
