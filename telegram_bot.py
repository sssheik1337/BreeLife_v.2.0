import logging
import os
from typing import Final

from dotenv import load_dotenv
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update, WebAppInfo
from telegram.ext import Application, ApplicationBuilder, CommandHandler, ContextTypes

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

TOKEN: Final[str] = os.getenv("TELEGRAM_BOT_TOKEN", "")
WEBAPP_URL: Final[str] = os.getenv("TELEGRAM_WEBAPP_URL", "")


def _ensure_env() -> None:
    if not TOKEN:
        raise RuntimeError("TELEGRAM_BOT_TOKEN is required.")
    if not WEBAPP_URL:
        raise RuntimeError("TELEGRAM_WEBAPP_URL is required.")


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message:
        return
    user = update.effective_user
    user_id = user.id if user else "unknown"
    logger.info("📩 /start получен от пользователя %s", user_id)
    keyboard = InlineKeyboardMarkup(
        [[InlineKeyboardButton(text="Открыть приложение", web_app=WebAppInfo(url=WEBAPP_URL))]]
    )
    await update.message.reply_text(
        "Добро пожаловать! Откройте приложение 👇",
        reply_markup=keyboard,
    )


def build_application() -> Application:
    _ensure_env()
    app = ApplicationBuilder().token(TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    return app


async def run_bot() -> Application:
    app = build_application()
    await app.initialize()
    await app.start()
    if app.updater:
        await app.updater.start_polling()
    logger.info("🤖 Telegram bot started (polling)")
    return app


async def stop_bot(app: Application | None) -> None:
    if not app:
        return
    if app.updater:
        await app.updater.stop()
    await app.stop()
    await app.shutdown()
