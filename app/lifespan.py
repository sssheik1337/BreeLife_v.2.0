import asyncio
import logging
from contextlib import asynccontextmanager, suppress
from urllib.parse import urlsplit, urlunsplit

from aiogram import Bot, Dispatcher, types
from aiogram.filters import Command, CommandStart
from fastapi import FastAPI

from config import (
    APP_NAME,
    DEBUG,
    PUBLIC_APP_URL,
    PUBLIC_BASE_URL,
    REMINDERS_WORKER_POLL_SECONDS,
    TELEGRAM_BOT_TOKEN,
    TELEGRAM_HIDDEN_ADMIN_COMMAND,
)
from services.products_db import ensure_products_db, migrate_products_kcal

logger = logging.getLogger(__name__)

bot: Bot | None = None
dispatcher: Dispatcher | None = None
reminders_worker_task: asyncio.Task | None = None
reminders_worker_stop_event: asyncio.Event | None = None


async def run_inline_reminders_worker_loop(stop_event: asyncio.Event) -> None:
    try:
        from services.reminders_worker import run_once
    except Exception as exc:
        logger.error("Не удалось импортировать reminders_worker: %s", exc)
        return

    logger.info(
        "Inline reminders worker started: poll=%ss",
        REMINDERS_WORKER_POLL_SECONDS,
    )
    while not stop_event.is_set():
        try:
            stats = await asyncio.to_thread(run_once)
            if (
                stats.get("checked_due", 0) > 0
                or stats.get("failed", 0) > 0
                or stats.get("disabled", 0) > 0
            ):
                logger.info(
                    "Inline reminders worker tick: due=%s sent=%s failed=%s disabled=%s",
                    stats.get("checked_due"),
                    stats.get("sent"),
                    stats.get("failed"),
                    stats.get("disabled"),
                )
        except Exception:
            logger.exception("Inline reminders worker iteration failed")

        try:
            await asyncio.wait_for(stop_event.wait(), timeout=REMINDERS_WORKER_POLL_SECONDS)
        except asyncio.TimeoutError:
            continue

    logger.info("Inline reminders worker stopped")


def resolve_admin_panel_url() -> str:
    if PUBLIC_BASE_URL:
        return f"{PUBLIC_BASE_URL.rstrip('/')}/admin"
    parsed = urlsplit(PUBLIC_APP_URL or "")
    if parsed.scheme and parsed.netloc:
        return urlunsplit((parsed.scheme, parsed.netloc, "/admin", "", ""))
    return "/admin"


def register_telegram_handlers(dispatcher_instance: Dispatcher) -> None:
    @dispatcher_instance.message(CommandStart())
    async def handle_start(message: types.Message) -> None:
        user_id = message.from_user.id if message.from_user else "unknown"
        logger.info(
            "INFO: /start получен от пользователя %s (text=%s)",
            user_id,
            message.text,
        )
        try:
            await message.answer(
                "Добро пожаловать! Откройте приложение через кнопку меню бота 👇",
            )
        except Exception as exc:
            logger.error("Не удалось отправить ответ на /start: %s", exc)


    @dispatcher_instance.message(Command(TELEGRAM_HIDDEN_ADMIN_COMMAND))
    async def handle_hidden_admin(message: types.Message) -> None:
        user_id = message.from_user.id if message.from_user else "unknown"
        logger.info(
            "INFO: /%s received from user %s",
            TELEGRAM_HIDDEN_ADMIN_COMMAND,
            user_id,
        )
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
        await message.answer(
            "Доступ в админ-панель:",
            reply_markup=keyboard,
        )


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 FastAPI started")
    ensure_products_db()
    migrate_products_kcal()
    global bot, dispatcher, reminders_worker_task, reminders_worker_stop_event
    if not TELEGRAM_BOT_TOKEN:
        logger.error("TELEGRAM_BOT_TOKEN не задан. Бот не будет запущен.")
        yield
        return
    if not PUBLIC_BASE_URL:
        logger.error("PUBLIC_BASE_URL не задан. Вебхук не будет установлен.")
        yield
        return
    bot = Bot(token=TELEGRAM_BOT_TOKEN)
    dispatcher = Dispatcher()
    register_telegram_handlers(dispatcher)
    allowed_updates = dispatcher.resolve_used_update_types()
    logger.info("INFO: Разрешённые типы обновлений: %s", allowed_updates)
    try:
        await bot.set_chat_menu_button(
            menu_button=types.MenuButtonWebApp(
                text=APP_NAME,
                web_app=types.WebAppInfo(url=PUBLIC_APP_URL),
            )
        )
        logger.info("INFO: Кнопка приложения установлена в меню чата")
    except Exception as exc:
        logger.error("Не удалось установить кнопку приложения в меню чата: %s", exc)

    webhook_url = f"{PUBLIC_BASE_URL.rstrip('/')}/telegram/webhook"
    try:
        result = await bot.set_webhook(
            webhook_url,
            drop_pending_updates=not DEBUG,
            allowed_updates=allowed_updates,
        )
        logger.info("INFO: Webhook установлен: %s (result=%s)", webhook_url, result)
    except Exception as exc:
        logger.error("Не удалось установить webhook: %s", exc)
        yield
        if bot:
            await bot.session.close()
        return
    logger.info("INFO: Telegram bot started (webhook): %s", webhook_url)

    reminders_worker_stop_event = asyncio.Event()
    reminders_worker_task = asyncio.create_task(
        run_inline_reminders_worker_loop(reminders_worker_stop_event)
    )

    yield

    if reminders_worker_stop_event is not None:
        reminders_worker_stop_event.set()
    if reminders_worker_task is not None:
        with suppress(asyncio.CancelledError):
            await reminders_worker_task
    reminders_worker_stop_event = None
    reminders_worker_task = None

    try:
        await bot.delete_webhook(drop_pending_updates=not DEBUG)
        logger.info("INFO: Webhook удалён")
    except Exception as exc:
        logger.error("Не удалось удалить webhook: %s", exc)
    await bot.session.close()


def get_dispatcher() -> Dispatcher | None:
    return dispatcher


def get_bot() -> Bot | None:
    return bot
