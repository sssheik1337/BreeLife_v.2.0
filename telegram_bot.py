import logging
import os
from typing import Final

from dotenv import load_dotenv
from telegram import KeyboardButton, ReplyKeyboardMarkup, Update, WebAppInfo
from telegram.ext import ApplicationBuilder, CommandHandler, ContextTypes

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

TOKEN: Final[str] = os.getenv("TELEGRAM_BOT_TOKEN", "")
MINIAPP_URL: Final[str] = os.getenv("TELEGRAM_MINIAPP_URL", "")


def _ensure_env() -> None:
    if not TOKEN:
        raise RuntimeError("TELEGRAM_BOT_TOKEN is required.")
    if not MINIAPP_URL:
        raise RuntimeError("TELEGRAM_MINIAPP_URL is required.")


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message:
        return
    keyboard = ReplyKeyboardMarkup(
        [[KeyboardButton(text="Открыть приложение", web_app=WebAppInfo(url=MINIAPP_URL))]],
        resize_keyboard=True,
        one_time_keyboard=False,
    )
    await update.message.reply_text(
        "Нажмите кнопку, чтобы открыть приложение.",
        reply_markup=keyboard,
    )


def main() -> None:
    _ensure_env()
    app = ApplicationBuilder().token(TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    logger.info("Телеграм-бот запущен. Команда /start доступна.")
    app.run_polling()


if __name__ == "__main__":
    main()
