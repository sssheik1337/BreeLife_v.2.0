from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse

from app.context import templates
from app.dependencies import get_profile_and_admin_config, optional_current_user
from app.spa_rollout import maybe_redirect_to_spa_shell

router = APIRouter()


@router.get("/questionnaire", response_class=HTMLResponse)
async def questionnaire(request: Request, telegram_user_id: int | None = Depends(optional_current_user)):
    spa_redirect = maybe_redirect_to_spa_shell(request)
    if spa_redirect:
        return spa_redirect
    payload = get_profile_and_admin_config(telegram_user_id)
    if telegram_user_id is None:
        return templates.TemplateResponse(
            "questionnaire.html",
            {"request": request, "admin_config": payload["admin_config"]},
        )
    return templates.TemplateResponse(
        "questionnaire.html",
        {"request": request, "admin_config": payload["admin_config"]},
    )
