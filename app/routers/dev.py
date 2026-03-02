from fastapi import APIRouter, HTTPException, Response

from config import APP_ENV, DEV_AUTH_ENABLED, DEV_TELEGRAM_USER_ID
from app.context import TELEGRAM_SESSION_COOKIE, TELEGRAM_SESSION_TTL
from services.storage_db import create_session

router = APIRouter(prefix="/api/dev")


@router.post("/login")
async def dev_login(response: Response):
    if not (APP_ENV == "development" and DEV_AUTH_ENABLED):
        raise HTTPException(status_code=403, detail="DEV_AUTH_DISABLED")

    session = create_session(telegram_user_id=DEV_TELEGRAM_USER_ID)
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
