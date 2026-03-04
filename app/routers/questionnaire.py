from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse

from app.context import templates
from app.dependencies import get_profile_and_admin_config, optional_current_user

router = APIRouter()


@router.get("/questionnaire", response_class=HTMLResponse)
async def questionnaire(request: Request, telegram_user_id: int | None = Depends(optional_current_user)):
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
