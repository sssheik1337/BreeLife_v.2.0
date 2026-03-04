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

TOKEN: Final[str] = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
HIDDEN_ADMIN_COMMAND: Final[str] = (
    os.getenv("TELEGRAM_HIDDEN_ADMIN_COMMAND", "adminbreeva").strip().lstrip("/") or "adminbreeva"
)
APP_NAME: Final[str] = os.getenv("APP_NAME", "BreeLife").strip() or "BreeLife"


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


def normalize_origin_url(raw_url: str) -> str:
    if not raw_url:
        return ""
    raw_value = raw_url.strip()
    parsed = urlsplit(raw_value)
    if not parsed.scheme or not parsed.netloc:
        return raw_value.rstrip("/")
    return urlunsplit((parsed.scheme, parsed.netloc, "", "", "")).rstrip("/")


_RAW_TELEGRAM_WEBAPP_URL = os.getenv("TELEGRAM_WEBAPP_URL", "").strip()
_RAW_PUBLIC_APP_URL = os.getenv("PUBLIC_APP_URL", "").strip()
_RAW_PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", "").strip()

# Достаточно указать один адрес (например PUBLIC_APP_URL). Остальные значения будут выведены автоматически.
APP_URL: Final[str] = normalize_webapp_url(_RAW_PUBLIC_APP_URL or _RAW_TELEGRAM_WEBAPP_URL or _RAW_PUBLIC_BASE_URL)
PUBLIC_BASE_URL: Final[str] = normalize_origin_url(_RAW_PUBLIC_BASE_URL or APP_URL)


def resolve_admin_panel_url() -> str:
    if PUBLIC_BASE_URL:
        return f"{PUBLIC_BASE_URL.rstrip('/')}/admin"
    parsed = urlsplit(APP_URL)
    if parsed.scheme and parsed.netloc:
        return urlunsplit((parsed.scheme, parsed.netloc, "/admin", "", ""))
    return "/admin"


def _ensure_env() -> None:
    if not TOKEN:
        raise RuntimeError("TELEGRAM_BOT_TOKEN is required.")
    if not APP_URL:
        raise RuntimeError(
            "Публичный URL приложения не задан. Укажите PUBLIC_APP_URL (или TELEGRAM_WEBAPP_URL, или PUBLIC_BASE_URL)."
        )


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
                web_app=types.WebAppInfo(url=APP_URL),
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