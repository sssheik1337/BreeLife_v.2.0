from fastapi import APIRouter, Request, Response

from app.dependencies import load_profile, require_telegram_user_id
from app.schemas import (
    CreateReminderPayload,
    NotificationConsentPayload,
    ReminderAutoGeneratePayload,
    UserTimezonePayload,
)
from services.reminders import ReminderScheduler

router = APIRouter()


@router.post("/api/reminders/schedule")
async def reminders_schedule(request: Request, response: Response):
    telegram_user_id = require_telegram_user_id(request, response)
    payload = await request.json()
    if not isinstance(payload, dict):
        return {"scheduled": {"status": "invalid_payload"}}

    scheduler = ReminderScheduler(telegram_user_id, load_profile(telegram_user_id))
    result = scheduler.schedule(payload)
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
    result = scheduler.schedule(
        {
            "type": payload.type,
            "time_local": payload.time,
            "enabled": payload.enabled,
            "frequency": payload.frequency,
            "timezone": payload.timezone,
            "tz_offset_minutes": payload.tz_offset_minutes,
        }
    )
    if result.get("status") != "scheduled":
        return {"status": "invalid_payload"}
    reminder = result.get("reminder")
    return reminder if isinstance(reminder, dict) else {"status": "invalid_payload"}


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


@router.post("/api/user/timezone")
async def user_timezone(request: Request, response: Response, payload: UserTimezonePayload):
    telegram_user_id = require_telegram_user_id(request, response)
    scheduler = ReminderScheduler(telegram_user_id, load_profile(telegram_user_id))
    result = scheduler.save_user_timezone(payload.tz_name, payload.tz_offset_minutes)
    if result.get("status") == "invalid_payload":
        return {"status": "invalid_payload"}
    return result


@router.get("/api/user/notifications/consent")
async def notifications_consent(request: Request, response: Response):
    telegram_user_id = require_telegram_user_id(request, response)
    scheduler = ReminderScheduler(telegram_user_id, load_profile(telegram_user_id))
    return scheduler.get_notifications_consent()


@router.post("/api/user/notifications/consent")
async def save_notifications_consent(
    request: Request,
    response: Response,
    payload: NotificationConsentPayload,
):
    telegram_user_id = require_telegram_user_id(request, response)
    scheduler = ReminderScheduler(telegram_user_id, load_profile(telegram_user_id))
    result = scheduler.save_notifications_consent(payload.allowed)
    if result.get("status") == "invalid_payload":
        return {"status": "invalid_payload"}
    return result
