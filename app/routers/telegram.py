from fastapi import APIRouter, HTTPException, Request, Response

from aiogram import types
from aiogram.utils.web_app import safe_parse_webapp_init_data

from config import APP_NAME, IS_DEV, TELEGRAM_BOT_TOKEN
from app.context import ADMIN_SESSION_TTL, TELEGRAM_SESSION_COOKIE
from app.lifespan import get_bot, get_dispatcher
from app.schemas import TelegramAuthRequest
from services.storage_db import create_session

router = APIRouter()


@router.get("/api/telegram/bot-info")
async def telegram_bot_info():
    return {"bot_name": APP_NAME, "is_dev": IS_DEV}


@router.post("/api/auth/telegram")
async def telegram_auth(request: Request, response: Response, payload: TelegramAuthRequest):
    try:
        init_data = safe_parse_webapp_init_data(payload.initData, bot_token=TELEGRAM_BOT_TOKEN)
    except TypeError:
        try:
            init_data = safe_parse_webapp_init_data(payload.initData, TELEGRAM_BOT_TOKEN)
        except TypeError:
            init_data = safe_parse_webapp_init_data(payload.initData, token=TELEGRAM_BOT_TOKEN)
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
        max_age=int(ADMIN_SESSION_TTL.total_seconds()),
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
