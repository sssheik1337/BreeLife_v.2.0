from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse

from app.context import load_admin_config, templates
from app.dependencies import optional_current_user, require_completed_profile

router = APIRouter()


@router.get("/questionnaire", response_class=HTMLResponse)
async def questionnaire(request: Request, telegram_user_id: int | None = Depends(optional_current_user)):
    if telegram_user_id is None:
        return templates.TemplateResponse(
            "questionnaire.html",
            {"request": request, "admin_config": load_admin_config()},
        )
    require_completed_profile(telegram_user_id)
    return templates.TemplateResponse(
        "questionnaire.html",
        {"request": request, "admin_config": load_admin_config()},
    )
