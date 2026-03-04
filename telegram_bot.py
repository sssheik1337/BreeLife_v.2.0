import asyncio
import logging
import os
from dataclasses import dataclass
from typing import Final
from urllib.parse import urlsplit, urlunsplit

from aiogram import Bot, Dispatcher, types
from aiogram.filters import Command
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

TOKEN: Final[str] = os.getenv("TELEGRAM_BOT_TOKEN", "")
HIDDEN_ADMIN_COMMAND: Final[str] = (
    os.getenv("TELEGRAM_HIDDEN_ADMIN_COMMAND", "adminbreeva").strip().lstrip("/") or "adminbreeva"
)


def normalize_webapp_url(raw_url: str) -> str:
    if not raw_url:
        return ""
    raw_value = raw_url.strip()
    parsed = urlsplit(raw_value)
    if not parsed.scheme or not parsed.netloc:
        return raw_value

    normalized_path = parsed.path or "/"
    if not normalized_path.startswith("/"):
        normalized_path = f"/{normalized_path}"

    normalized = parsed._replace(path=normalized_path, query="", fragment="")
    return urlunsplit(normalized)


WEBAPP_URL: Final[str] = normalize_webapp_url(os.getenv("TELEGRAM_WEBAPP_URL", ""))
PUBLIC_BASE_URL: Final[str] = os.getenv("PUBLIC_BASE_URL", "").strip()
APP_NAME: Final[str] = os.getenv("APP_NAME", "BreeLife")


def resolve_admin_panel_url() -> str:
    if PUBLIC_BASE_URL:
        return f"{PUBLIC_BASE_URL.rstrip('/')}/admin"
    parsed = urlsplit(WEBAPP_URL)
    if parsed.scheme and parsed.netloc:
        return urlunsplit((parsed.scheme, parsed.netloc, "/admin", "", ""))
    return "/admin"


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
        await message.answer("Откройте приложение через кнопку меню бота.")

    @dispatcher.message(Command(HIDDEN_ADMIN_COMMAND))
    async def hidden_admin(message: types.Message) -> None:
        user_id = message.from_user.id if message.from_user else "unknown"
        logger.info("INFO: /%s received from user %s", HIDDEN_ADMIN_COMMAND, user_id)
        keyboard = types.InlineKeyboardMarkup(
            inline_keyboard=[
                [
                    types.InlineKeyboardButton(
                        text="Открыть админ-панель",
                        web_app=types.WebAppInfo(url=resolve_admin_panel_url()),
                    )
                ]
            ]
        )
        await message.answer("Доступ в админ-панель:", reply_markup=keyboard)

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