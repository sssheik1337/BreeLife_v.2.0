import asyncio
import logging
import os
from urllib.parse import urlsplit, urlunsplit
from dataclasses import dataclass
from typing import Final

from aiogram import Bot, Dispatcher, types
from aiogram.filters import Command
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

TOKEN: Final[str] = os.getenv("TELEGRAM_BOT_TOKEN", "")


def normalize_webapp_url(raw_url: str) -> str:
    if not raw_url:
        return ""
    parsed = urlsplit(raw_url)
    if not parsed.scheme or not parsed.netloc:
        return raw_url
    normalized = parsed._replace(path="/", query="", fragment="")
    return urlunsplit(normalized)


WEBAPP_URL: Final[str] = normalize_webapp_url(os.getenv("TELEGRAM_WEBAPP_URL", ""))
APP_NAME: Final[str] = os.getenv("APP_NAME", "BreeLife")


def _ensure_env() -> None:
    if not TOKEN:
        raise RuntimeError("TELEGRAM_BOT_TOKEN is required.")
    if not WEBAPP_URL:
        raise RuntimeError("TELEGRAM_WEBAPP_URL is required.")


@dataclass
class BotState:
    bot: Bot
    dispatcher: Dispatcher
    task: asyncio.Task | None


def build_dispatcher() -> Dispatcher:
    dispatcher = Dispatcher()

    @dispatcher.message(Command("start"))
    async def start(message: types.Message) -> None:
        user_id = message.from_user.id if message.from_user else "unknown"
        logger.info("INFO: /start received from user %s", user_id)
        keyboard = types.InlineKeyboardMarkup(
            inline_keyboard=[
                [
                    types.InlineKeyboardButton(
                        text=APP_NAME,
                        web_app=types.WebAppInfo(url=WEBAPP_URL),
                    )
                ]
            ]
        )
        logger.info("INFO: WebApp button sent with URL: %s", WEBAPP_URL)
        await message.answer(
            "Откройте приложение для управления питанием",
            reply_markup=keyboard,
        )

    return dispatcher


async def run_bot() -> BotState:
    _ensure_env()
    bot = Bot(token=TOKEN)
    try:
        await bot.set_chat_menu_button(
            menu_button=types.MenuButtonWebApp(
                text=APP_NAME,
                web_app=types.WebAppInfo(url=WEBAPP_URL),
            )
        )
        logger.info("INFO: Кнопка приложения установлена в меню чата")
    except Exception as exc:
        logger.error("Не удалось установить кнопку приложения в меню чата: %s", exc)
    dispatcher = build_dispatcher()
    task = asyncio.create_task(dispatcher.start_polling(bot))
    logger.info("INFO: Telegram bot started (aiogram)")
    return BotState(bot=bot, dispatcher=dispatcher, task=task)


async def stop_bot(state: BotState | None) -> None:
    if not state:
        return
    if state.task:
        state.task.cancel()
        try:
            await state.task
        except asyncio.CancelledError:
            pass
    await state.bot.session.close()
