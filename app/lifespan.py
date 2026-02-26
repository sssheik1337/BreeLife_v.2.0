import logging
from contextlib import asynccontextmanager

from aiogram import Bot, Dispatcher, types
from aiogram.filters import CommandStart
from fastapi import FastAPI

from config import APP_NAME, DEBUG, PUBLIC_APP_URL, PUBLIC_BASE_URL, TELEGRAM_BOT_TOKEN
from services.products_db import ensure_products_db, migrate_products_kcal

logger = logging.getLogger(__name__)

bot: Bot | None = None
dispatcher: Dispatcher | None = None


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


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 FastAPI started")
    ensure_products_db()
    migrate_products_kcal()
    global bot, dispatcher
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
    yield
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
