from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import HTMLResponse

from app.context import templates
from app.dependencies import (
    apply_profile_patch,
    load_profile,
    optional_current_user,
    require_completed_profile,
    require_telegram_user_id,
    update_profile,
)

router = APIRouter()


@router.get("/resume", response_class=HTMLResponse)
async def resume(request: Request, telegram_user_id: int | None = Depends(optional_current_user)):
    if telegram_user_id is None:
        return templates.TemplateResponse(
            "resume.html",
            {"request": request},
        )
    require_completed_profile(telegram_user_id)
    return templates.TemplateResponse(
        "resume.html",
        {"request": request},
    )


@router.get("/profile", response_class=HTMLResponse)
async def profile(request: Request, telegram_user_id: int | None = Depends(optional_current_user)):
    if telegram_user_id is None:
        return templates.TemplateResponse(
            "profile.html",
            {"request": request},
        )
    require_completed_profile(telegram_user_id)
    return templates.TemplateResponse(
        "profile.html",
        {"request": request},
    )


@router.get("/profile.html", response_class=HTMLResponse)
async def profile_alias(request: Request, telegram_user_id: int | None = Depends(optional_current_user)):
    return await profile(request, telegram_user_id)


@router.post("/api/profile")
async def api_profile(request: Request, response: Response):
    telegram_user_id = require_telegram_user_id(request, response)
    profile = load_profile(telegram_user_id)
    return profile


@router.get("/api/profile")
async def api_profile_get(request: Request, response: Response):
    telegram_user_id = require_telegram_user_id(request, response)
    return load_profile(telegram_user_id)


@router.post("/api/profile/save")
async def api_profile_save(request: Request, response: Response):
    telegram_user_id = require_telegram_user_id(request, response)
    payload = await request.json()
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="INVALID_PAYLOAD")
    profile = load_profile(telegram_user_id)
    updated = apply_profile_patch(profile, payload)
    update_profile(telegram_user_id, updated)
    return updated


@router.get("/api/profile/get")
async def api_profile_get_alias(request: Request, response: Response):
    return await api_profile_get(request, response)
