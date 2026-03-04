from fastapi import APIRouter, HTTPException, Request, Response

from aiogram import types
from aiogram.utils.web_app import safe_parse_webapp_init_data

from config import APP_NAME, IS_DEV, TELEGRAM_BOT_TOKEN
from app.context import TELEGRAM_SESSION_COOKIE, TELEGRAM_SESSION_TTL
from app.lifespan import get_bot, get_dispatcher
from app.schemas import TelegramAuthRequest
from services.storage_db import create_session

router = APIRouter()


@router.get("/api/telegram/bot-info")
async def telegram_bot_info():
    return {"bot_name": APP_NAME, "is_dev": IS_DEV}


@router.post("/api/auth/telegram")
async def telegram_auth(request: Request, response: Response, payload: TelegramAuthRequest | None = None):
    init_data = None
    parse_type_errors: list[Exception] = []
    parse_value_errors: list[Exception] = []

    raw_init_data = (payload.initData if payload else None) or request.headers.get("X-Telegram-Init-Data") or ""
    if not isinstance(raw_init_data, str) or not raw_init_data.strip():
        raise HTTPException(status_code=400, detail="INIT_DATA_REQUIRED")
    raw_init_data = raw_init_data.strip()

    # Поддержка разных сигнатур aiogram и порядков аргументов между версиями.
    parse_variants = (
        lambda: safe_parse_webapp_init_data(raw_init_data, bot_token=TELEGRAM_BOT_TOKEN),
        lambda: safe_parse_webapp_init_data(raw_init_data, token=TELEGRAM_BOT_TOKEN),
        lambda: safe_parse_webapp_init_data(raw_init_data, TELEGRAM_BOT_TOKEN),
        lambda: safe_parse_webapp_init_data(TELEGRAM_BOT_TOKEN, raw_init_data),
    )

    for parse_variant in parse_variants:
        try:
            init_data = parse_variant()
            break
        except TypeError as error:
            parse_type_errors.append(error)
            continue
        except ValueError as error:
            parse_value_errors.append(error)
            continue

    if init_data is None:
        if parse_value_errors:
            raise HTTPException(status_code=401, detail="INVALID_INIT_DATA_SIGNATURE") from parse_value_errors[-1]
        raise HTTPException(status_code=500, detail="TELEGRAM_PARSER_INCOMPATIBLE") from (
            parse_type_errors[-1] if parse_type_errors else None
        )

    user = init_data.user
    if not user:
        raise HTTPException(status_code=400, detail="USER_NOT_FOUND")
    session = create_session(
        telegram_user_id=user.id,
        telegram_username=user.username,
        telegram_name=user.first_name,
        telegram_last_name=user.last_name,
        telegram_photo_url=user.photo_url,
    )
    response.set_cookie(
        TELEGRAM_SESSION_COOKIE,
        session["token"],
        httponly=True,
        max_age=int(TELEGRAM_SESSION_TTL.total_seconds()),
        samesite="lax",
    )
    return {
        "ok": True,
        "session": session,
    }


@router.post("/telegram/webhook")
async def telegram_webhook(request: Request):
    dispatcher = get_dispatcher()
    bot = get_bot()
    if not dispatcher or not bot:
        raise HTTPException(status_code=503, detail="TELEGRAM_DISABLED")
    update = types.Update.model_validate(await request.json())
    await dispatcher.feed_update(bot=bot, update=update)
    return {"ok": True}


@router.get("/api/health/telegram")
async def telegram_health():
    if not get_dispatcher():
        raise HTTPException(status_code=503, detail="TELEGRAM_DISABLED")
    return {"status": "ok"}
