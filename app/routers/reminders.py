from fastapi import APIRouter, HTTPException, Request, Response

from app.dependencies import load_profile, require_telegram_user_id
from app.schemas import CreateReminderPayload, ReminderAutoGeneratePayload, RemindersScheduleRequest
from services.reminders import ReminderScheduler

router = APIRouter()


@router.post("/api/reminders/schedule")
async def reminders_schedule(request: Request, response: Response, payload: RemindersScheduleRequest):
    telegram_user_id = require_telegram_user_id(request, response)
    profile = load_profile(telegram_user_id)
    scheduler = ReminderScheduler(telegram_user_id, profile)
    scheduled = scheduler.schedule(payload.timezone_offset)
    return {"scheduled": scheduled}


@router.get("/api/reminders/list")
async def reminders_list(request: Request, response: Response):
    telegram_user_id = require_telegram_user_id(request, response)
    profile = load_profile(telegram_user_id)
    scheduler = ReminderScheduler(telegram_user_id, profile)
    return {"reminders": scheduler.list()}


@router.post("/api/reminders/generate")
async def reminders_generate(request: Request, response: Response, payload: CreateReminderPayload):
    telegram_user_id = require_telegram_user_id(request, response)
    profile = load_profile(telegram_user_id)
    scheduler = ReminderScheduler(telegram_user_id, profile)
    reminder = scheduler.create(payload.type, payload.time, payload.enabled)
    return reminder


@router.post("/api/reminders/auto-generate")
async def reminders_auto_generate(
    request: Request,
    response: Response,
    payload: ReminderAutoGeneratePayload,
):
    telegram_user_id = require_telegram_user_id(request, response)
    profile = load_profile(telegram_user_id)
    scheduler = ReminderScheduler(telegram_user_id, profile)
    reminders = scheduler.auto_generate(payload.type, payload.timezone_offset)
    return {"reminders": reminders}


@router.post("/api/reminders/schedule")
async def schedule_reminders(request: Request, response: Response, payload: RemindersScheduleRequest):
    telegram_user_id = require_telegram_user_id(request, response)
    profile = load_profile(telegram_user_id)
    scheduler = ReminderScheduler(telegram_user_id, profile)
    result = scheduler.schedule(payload.timezone_offset)
    return result


@router.post("/api/reminders/list")
async def list_reminders(request: Request, response: Response):
    telegram_user_id = require_telegram_user_id(request, response)
    scheduler = ReminderScheduler(telegram_user_id, load_profile(telegram_user_id))
    return scheduler.list()


@router.post("/api/reminders/generate")
async def generate_reminders(request: Request, response: Response):
    telegram_user_id = require_telegram_user_id(request, response)
    payload = await request.json()
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="INVALID_PAYLOAD")
    reminders = payload.get("reminders", [])
    return reminders


@router.post("/api/reminders/auto-generate")
async def auto_generate_reminders(request: Request, response: Response):
    telegram_user_id = require_telegram_user_id(request, response)
    payload = await request.json()
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="INVALID_PAYLOAD")
    timezone_offset = payload.get("timezone_offset", 0)
    scheduler = ReminderScheduler(telegram_user_id, load_profile(telegram_user_id))
    reminders = scheduler.auto_generate(timezone_offset)
    return reminders
