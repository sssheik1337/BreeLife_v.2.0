from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse, RedirectResponse

from config import AI_ENABLED
from app.context import templates
from app.dependencies import get_profile_and_admin_config, has_products_onboarding_data, optional_current_user, require_completed_profile

router = APIRouter()


@router.get("/foods", response_class=HTMLResponse)
async def foods(request: Request, telegram_user_id: int | None = Depends(optional_current_user)):
    payload = get_profile_and_admin_config(telegram_user_id)
    if telegram_user_id is None:
        return templates.TemplateResponse(
            "foods.html",
            {"request": request, "admin_config": payload["admin_config"], "ai_enabled": AI_ENABLED},
        )
    require_completed_profile(telegram_user_id)
    return templates.TemplateResponse(
        "foods.html",
        {"request": request, "admin_config": payload["admin_config"], "ai_enabled": AI_ENABLED},
    )


@router.get("/my-products", response_class=HTMLResponse)
async def my_products(request: Request, telegram_user_id: int | None = Depends(optional_current_user)):
    payload = get_profile_and_admin_config(telegram_user_id)
    if telegram_user_id is None:
        return templates.TemplateResponse(
            "my_products.html",
            {"request": request, "admin_config": payload["admin_config"], "ai_enabled": AI_ENABLED},
        )
    require_completed_profile(telegram_user_id)
    return templates.TemplateResponse(
        "my_products.html",
        {"request": request, "admin_config": payload["admin_config"], "ai_enabled": AI_ENABLED},
    )


@router.get("/meal-plan", response_class=HTMLResponse)
async def meal_plan(request: Request, telegram_user_id: int | None = Depends(optional_current_user)):
    payload = get_profile_and_admin_config(telegram_user_id)
    if telegram_user_id is None:
        return templates.TemplateResponse(
            "meal_plan.html",
            {"request": request, "admin_config": payload["admin_config"], "ai_enabled": AI_ENABLED},
        )
    profile = require_completed_profile(telegram_user_id)
    if not has_products_onboarding_data(profile):
        # Без заполненных продуктовых предпочтений рацион нельзя корректно рассчитать.
        return RedirectResponse(url="/preferences-onboarding", status_code=307)
    return templates.TemplateResponse(
        "meal_plan.html",
        {"request": request, "admin_config": payload["admin_config"], "ai_enabled": AI_ENABLED},
    )


@router.get("/shopping-list", response_class=HTMLResponse)
async def shopping_list(request: Request, telegram_user_id: int | None = Depends(optional_current_user)):
    payload = get_profile_and_admin_config(telegram_user_id)
    if telegram_user_id is None:
        return templates.TemplateResponse(
            "shopping_list.html",
            {"request": request, "admin_config": payload["admin_config"], "ai_enabled": AI_ENABLED},
        )
    profile = require_completed_profile(telegram_user_id)
    if not has_products_onboarding_data(profile):
        # Без заполненных продуктовых предпочтений список покупок не формируется.
        return RedirectResponse(url="/preferences-onboarding", status_code=307)
    return templates.TemplateResponse(
        "shopping_list.html",
        {"request": request, "admin_config": payload["admin_config"], "ai_enabled": AI_ENABLED},
    )
