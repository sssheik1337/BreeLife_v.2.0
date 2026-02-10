from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import HTMLResponse

from config import APP_ENV, APP_HOST, APP_NAME, APP_PORT, DEBUG, IS_PROD, PUBLIC_APP_URL
from app.context import TELEGRAM_SESSION_COOKIE, load_admin_config, load_plans_config, templates
from services.storage_db import get_session_user, read_payload

router = APIRouter()


@router.get("/", response_class=HTMLResponse)
async def index(request: Request):
    if IS_PROD and not DEBUG:
        return templates.TemplateResponse(
            "index.html",
            {"request": request, "APP_NAME": APP_NAME},
        )
    return templates.TemplateResponse(
        "index.html",
        {"request": request, "APP_NAME": APP_NAME},
    )


@router.get("/index", response_class=HTMLResponse)
async def index_alias(request: Request):
    return await index(request)


@router.get("/healthz")
async def healthz():
    return {"status": "ok"}


@router.get("/api/me/status")
async def api_me_status(request: Request):
    token = request.cookies.get(TELEGRAM_SESSION_COOKIE)
    session = get_session_user(token) if token else None
    profile_completed = False
    if session:
        profile = read_payload("profiles", int(session.get("telegram_user_id"))) or {}
        profile_completed = bool(profile.get("is_completed") or profile.get("completed") or profile.get("profile_completed"))
    return {
        "authorized": bool(session),
        "telegram_user_id": session.get("telegram_user_id") if session else None,
        "profile_completed": profile_completed,
        "first_name": session.get("first_name") if session else None,
        "last_name": session.get("last_name") if session else None,
        "username": session.get("username") if session else None,
    }


@router.get("/api/session")
async def api_session(request: Request):
    token = request.cookies.get(TELEGRAM_SESSION_COOKIE)
    session = get_session_user(token) if token else None
    return {
        "authorized": bool(session),
        "first_name": session.get("first_name") if session else None,
        "last_name": session.get("last_name") if session else None,
        "username": session.get("username") if session else None,
    }


@router.get("/api/app/public-url")
async def get_public_url():
    return {"url": PUBLIC_APP_URL}


@router.get("/api/app/config")
async def get_app_config():
    return {
        "app_env": APP_ENV,
        "app_host": APP_HOST,
        "app_port": APP_PORT,
    }


@router.get("/api/admin/config")
async def admin_config():
    if IS_PROD and not DEBUG:
        raise HTTPException(status_code=403, detail="Доступ запрещён.")
    return load_admin_config()


@router.get("/api/plans")
async def plans_public():
    admin_config = load_admin_config()
    plans = load_plans_config()
    trial_days = int(admin_config.get("trial_days", 30))
    if not isinstance(plans, list) or not plans:
        plans = [
            {
                "id": "trial",
                "title": "Пробный период",
                "duration_days": trial_days,
                "price_current": "0 ₽",
                "price_old": "",
                "price_old_enabled": False,
                "features": [],
            },
            {
                "id": "premium",
                "title": "Подписка",
                "duration_days": 30,
                "price_current": "399 ₽ / месяц",
                "price_old": "",
                "price_old_enabled": False,
                "features": [],
            },
        ]
    normalized: list[dict[str, object]] = []
    for plan in plans:
        if not isinstance(plan, dict):
            continue
        normalized.append(
            {
                "id": plan.get("id"),
                "title": plan.get("title"),
                "duration_days": plan.get("duration_days", 0),
                "price_current": plan.get("price_current", plan.get("price", "")),
                "price_old": plan.get("price_old", ""),
                "price_old_enabled": plan.get("price_old_enabled", False),
                "features": plan.get("features", []),
            }
        )
    return normalized
