from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse

from config import AI_ENABLED
from app.context import templates, load_admin_config
from app.dependencies import optional_current_user, require_completed_profile

router = APIRouter()


@router.get("/menu", response_class=HTMLResponse)
async def menu(request: Request, telegram_user_id: int | None = Depends(optional_current_user)):
    if telegram_user_id is None:
        return templates.TemplateResponse(
            "menu.html",
            {"request": request, "admin_config": load_admin_config(), "ai_enabled": AI_ENABLED},
        )
    require_completed_profile(telegram_user_id)
    return templates.TemplateResponse(
        "menu.html",
        {"request": request, "admin_config": load_admin_config(), "ai_enabled": AI_ENABLED},
    )


@router.get("/references", response_class=HTMLResponse)
async def references(request: Request, telegram_user_id: int | None = Depends(optional_current_user)):
    if telegram_user_id is None:
        return templates.TemplateResponse(
            "references.html",
            {"request": request, "admin_config": load_admin_config(), "ai_enabled": AI_ENABLED},
        )
    require_completed_profile(telegram_user_id)
    return templates.TemplateResponse(
        "references.html",
        {"request": request, "admin_config": load_admin_config(), "ai_enabled": AI_ENABLED},
    )


@router.get("/support", response_class=HTMLResponse)
async def support(request: Request, telegram_user_id: int | None = Depends(optional_current_user)):
    if telegram_user_id is None:
        return templates.TemplateResponse(
            "support.html",
            {"request": request, "admin_config": load_admin_config(), "ai_enabled": AI_ENABLED},
        )
    require_completed_profile(telegram_user_id)
    return templates.TemplateResponse(
        "support.html",
        {"request": request, "admin_config": load_admin_config(), "ai_enabled": AI_ENABLED},
    )


@router.get("/plans", response_class=HTMLResponse)
async def plans(request: Request, telegram_user_id: int | None = Depends(optional_current_user)):
    if telegram_user_id is None:
        return templates.TemplateResponse(
            "plans.html",
            {"request": request, "admin_config": load_admin_config(), "ai_enabled": AI_ENABLED},
        )
    require_completed_profile(telegram_user_id)
    return templates.TemplateResponse(
        "plans.html",
        {"request": request, "admin_config": load_admin_config(), "ai_enabled": AI_ENABLED},
    )


@router.get("/settings/reminders", response_class=HTMLResponse)
async def reminders_settings(request: Request, telegram_user_id: int | None = Depends(optional_current_user)):
    if telegram_user_id is None:
        return templates.TemplateResponse(
            "reminders_settings.html",
            {"request": request, "admin_config": load_admin_config(), "ai_enabled": AI_ENABLED},
        )
    require_completed_profile(telegram_user_id)
    return templates.TemplateResponse(
        "reminders_settings.html",
        {"request": request, "admin_config": load_admin_config(), "ai_enabled": AI_ENABLED},
    )
