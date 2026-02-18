from fastapi import APIRouter, Depends, Request
import logging
from fastapi.responses import HTMLResponse, RedirectResponse

from config import AI_ENABLED
from app.context import templates
from app.dependencies import get_profile_and_admin_config, load_profile, optional_current_user, require_completed_profile

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/menu", response_class=HTMLResponse)
async def menu(request: Request, telegram_user_id: int | None = Depends(optional_current_user)):
    payload = get_profile_and_admin_config(telegram_user_id)
    if telegram_user_id is None:
        return templates.TemplateResponse(
            "menu.html",
            {"request": request, "admin_config": payload["admin_config"], "ai_enabled": AI_ENABLED},
        )
    require_completed_profile(telegram_user_id)
    return templates.TemplateResponse(
        "menu.html",
        {"request": request, "admin_config": payload["admin_config"], "ai_enabled": AI_ENABLED},
    )


@router.get("/references", response_class=HTMLResponse)
async def references(request: Request, telegram_user_id: int | None = Depends(optional_current_user)):
    payload = get_profile_and_admin_config(telegram_user_id)
    if telegram_user_id is None:
        return templates.TemplateResponse(
            "references.html",
            {"request": request, "admin_config": payload["admin_config"], "ai_enabled": AI_ENABLED},
        )
    require_completed_profile(telegram_user_id)
    return templates.TemplateResponse(
        "references.html",
        {"request": request, "admin_config": payload["admin_config"], "ai_enabled": AI_ENABLED},
    )


@router.get("/support", response_class=HTMLResponse)
async def support(request: Request, telegram_user_id: int | None = Depends(optional_current_user)):
    payload = get_profile_and_admin_config(telegram_user_id)
    if telegram_user_id is None:
        return templates.TemplateResponse(
            "support.html",
            {"request": request, "admin_config": payload["admin_config"], "ai_enabled": AI_ENABLED},
        )
    require_completed_profile(telegram_user_id)
    return templates.TemplateResponse(
        "support.html",
        {"request": request, "admin_config": payload["admin_config"], "ai_enabled": AI_ENABLED},
    )


@router.get("/plans", response_class=HTMLResponse)
async def plans(request: Request, telegram_user_id: int | None = Depends(optional_current_user)):
    payload = get_profile_and_admin_config(telegram_user_id)
    if telegram_user_id is None:
        return templates.TemplateResponse(
            "plans.html",
            {"request": request, "admin_config": payload["admin_config"], "ai_enabled": AI_ENABLED},
        )
    require_completed_profile(telegram_user_id)
    return templates.TemplateResponse(
        "plans.html",
        {"request": request, "admin_config": payload["admin_config"], "ai_enabled": AI_ENABLED},
    )


@router.get("/settings/reminders", response_class=HTMLResponse)
async def reminders_settings(request: Request, telegram_user_id: int | None = Depends(optional_current_user)):
    payload = get_profile_and_admin_config(telegram_user_id)
    if telegram_user_id is None:
        return templates.TemplateResponse(
            "reminders_settings.html",
            {"request": request, "admin_config": payload["admin_config"], "ai_enabled": AI_ENABLED},
        )
    require_completed_profile(telegram_user_id)
    return templates.TemplateResponse(
        "reminders_settings.html",
        {"request": request, "admin_config": payload["admin_config"], "ai_enabled": AI_ENABLED},
    )


@router.get("/preferences-onboarding", response_class=HTMLResponse)
async def preferences_onboarding(request: Request, telegram_user_id: int | None = Depends(optional_current_user)):
    payload = get_profile_and_admin_config(telegram_user_id)
    if telegram_user_id is None:
        return templates.TemplateResponse(
            "preferences_onboarding.html",
            {"request": request, "admin_config": payload["admin_config"], "ai_enabled": AI_ENABLED},
        )
    profile = load_profile(telegram_user_id)
    if not isinstance(profile, dict) or profile.get("is_completed") is not True:
        # Онбординг предпочтений доступен только после завершения основной анкеты.
        return RedirectResponse(url="/questionnaire", status_code=307)

    logger.info(
        "[analytics] preferences_onboarding_entered telegram_user_id=%s source=page is_completed=%s",
        telegram_user_id,
        True,
    )
    return templates.TemplateResponse(
        "preferences_onboarding.html",
        {"request": request, "admin_config": payload["admin_config"], "ai_enabled": AI_ENABLED},
    )
