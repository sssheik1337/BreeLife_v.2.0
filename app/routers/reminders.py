from fastapi import APIRouter, HTTPException, Request, Response

from app.dependencies import load_profile, require_telegram_user_id
from app.schemas import CreateReminderPayload, ReminderAutoGeneratePayload
from services.reminders import ReminderScheduler

router = APIRouter()


@router.post("/api/reminders/schedule")
async def reminders_schedule(request: Request, response: Response):
    telegram_user_id = require_telegram_user_id(request, response)
    payload = await request.json()
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="INVALID_PAYLOAD")

    reminder_type = payload.get("type")
    when_iso = payload.get("when_iso")
    if not isinstance(reminder_type, str) or not isinstance(when_iso, str):
        raise HTTPException(status_code=400, detail="INVALID_REMINDER_PAYLOAD")

    scheduler = ReminderScheduler(telegram_user_id, load_profile(telegram_user_id))
    result = scheduler.schedule(
        {
            "type": reminder_type,
            "when_iso": when_iso,
        }
    )
    return {"scheduled": result}


@router.get("/api/reminders/list")
async def reminders_list(request: Request, response: Response):
    telegram_user_id = require_telegram_user_id(request, response)
    scheduler = ReminderScheduler(telegram_user_id, load_profile(telegram_user_id))
    return {"reminders": scheduler.list()}


@router.post("/api/reminders/generate")
async def reminders_generate(request: Request, response: Response, payload: CreateReminderPayload):
    telegram_user_id = require_telegram_user_id(request, response)
    scheduler = ReminderScheduler(telegram_user_id, load_profile(telegram_user_id))
    reminder = scheduler.create(payload.type, payload.time, payload.enabled)
    return reminder


@router.post("/api/reminders/auto-generate")
async def reminders_auto_generate(
    request: Request,
    response: Response,
    payload: ReminderAutoGeneratePayload,
):
    telegram_user_id = require_telegram_user_id(request, response)
    scheduler = ReminderScheduler(telegram_user_id, load_profile(telegram_user_id))
    reminders = scheduler.auto_generate(payload.type, payload.timezone_offset)
    return {"reminders": reminders}
