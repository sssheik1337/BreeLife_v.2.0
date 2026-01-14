import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Literal
from pathlib import Path

import requests
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, Field
from starlette.middleware.base import BaseHTTPMiddleware

from config import (
    AI_ENABLED,
    APP_ENV,
    APP_HOST,
    APP_NAME,
    APP_PORT,
    DEBUG,
    REMINDERS_ENABLED,
    YANDEX_GPT_API_KEY,
    YANDEX_GPT_FOLDER_ID,
)
from services.ai_profile import (
    calculate_deviation_risk,
    generate_food_diary_recommendation,
    generate_profile_recommendation,
    generate_yandex_recommendation,
)
from services.nutrition import (
    calculate_bmr,
    calculate_daily_calories,
    calculate_goal_calories,
)
from services.reminders import ReminderPayload, ReminderScheduler

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title=APP_NAME)

templates = Jinja2Templates(directory="templates")

ADMIN_CONFIG_PATH = Path("config/admin_config.json")
ADMIN_CONFIG_CACHE: dict[str, object] | None = None
ADMIN_CONFIG_MTIME: float | None = None


def loadAdminConfig() -> dict[str, object]:
    """Загрузить админ-конфиг с кешированием и проверкой изменения файла."""
    global ADMIN_CONFIG_CACHE, ADMIN_CONFIG_MTIME
    if not ADMIN_CONFIG_PATH.exists():
        ADMIN_CONFIG_CACHE = {}
        ADMIN_CONFIG_MTIME = None
        return ADMIN_CONFIG_CACHE
    try:
        mtime = ADMIN_CONFIG_PATH.stat().st_mtime
    except OSError:
        return ADMIN_CONFIG_CACHE or {}
    if ADMIN_CONFIG_CACHE is None or ADMIN_CONFIG_MTIME != mtime:
        try:
            ADMIN_CONFIG_CACHE = json.loads(ADMIN_CONFIG_PATH.read_text(encoding="utf-8"))
            ADMIN_CONFIG_MTIME = mtime
        except json.JSONDecodeError:
            ADMIN_CONFIG_CACHE = {}
    return ADMIN_CONFIG_CACHE or {}

# In-memory хранилище напоминаний по telegram_user_id.
reminders_store: dict[int, list[dict[str, str]]] = {}
food_diary_store: dict[int, list[dict[str, object]]] = {}
# In-memory хранилище подписок по telegram_user_id.
subscription_store: dict[int, dict[str, str]] = {}
reminder_scheduler = ReminderScheduler(REMINDERS_ENABLED, reminders_store)


class ReminderScheduleRequest(BaseModel):
    telegram_user_id: int = Field(..., description="Telegram user id")
    type: Literal["food_diary", "water", "weekly_summary", "goal_deadline"]
    when_iso: str


class ReminderGenerateRequest(BaseModel):
    telegram_user_id: int = Field(..., description="Telegram user id")
    user_profile: dict[str, object] = Field(default_factory=dict)


class ReminderAutoGenerateRequest(BaseModel):
    telegram_user_id: int = Field(..., description="Telegram user id")
    user_profile: dict[str, object] = Field(default_factory=dict)
    weekly_review: dict[str, object] = Field(default_factory=dict)


class SubscriptionRequest(BaseModel):
    telegram_user_id: int = Field(..., description="Telegram user id")
    subscription_started_at: str | None = None
    trial_started_at: str | None = None


class PaymentRequest(BaseModel):
    telegram_user_id: int = Field(..., description="Telegram user id")
    days: int = Field(30, description="Срок продления подписки в днях")


class FoodDiaryEntry(BaseModel):
    telegram_user_id: int = Field(..., description="Telegram user id")
    date: str
    calories: float
    protein_g: float
    fat_g: float
    carbs_g: float


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        logger.info("%s %s %s", request.method, request.url.path, response.status_code)
        return response


app.add_middleware(RequestLoggingMiddleware)
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse(
        "index.html",
        {"request": request, "admin_config": loadAdminConfig(), "ai_enabled": AI_ENABLED},
    )


@app.get("/healthz")
async def healthz():
    return {"status": "ok"}


@app.get("/questionnaire", response_class=HTMLResponse)
async def questionnaire(request: Request):
    return templates.TemplateResponse(
        "questionnaire.html",
        {"request": request, "admin_config": loadAdminConfig(), "ai_enabled": AI_ENABLED},
    )


@app.get("/resume", response_class=HTMLResponse)
async def resume(request: Request):
    return templates.TemplateResponse(
        "resume.html",
        {"request": request, "admin_config": loadAdminConfig(), "ai_enabled": AI_ENABLED},
    )


@app.get("/profile", response_class=HTMLResponse)
async def profile(request: Request):
    return templates.TemplateResponse(
        "profile.html",
        {"request": request, "admin_config": loadAdminConfig(), "ai_enabled": AI_ENABLED},
    )


@app.get("/diary", response_class=HTMLResponse)
async def diary(request: Request):
    return templates.TemplateResponse(
        "diary.html",
        {"request": request, "admin_config": loadAdminConfig(), "ai_enabled": AI_ENABLED},
    )


@app.get("/food-diary", response_class=HTMLResponse)
async def food_diary(request: Request):
    return templates.TemplateResponse(
        "food_diary.html",
        {"request": request, "admin_config": loadAdminConfig(), "ai_enabled": AI_ENABLED},
    )


@app.get("/foods", response_class=HTMLResponse)
async def foods(request: Request):
    return templates.TemplateResponse(
        "foods.html",
        {"request": request, "admin_config": loadAdminConfig(), "ai_enabled": AI_ENABLED},
    )


@app.get("/menu", response_class=HTMLResponse)
async def menu(request: Request):
    return templates.TemplateResponse(
        "menu.html",
        {"request": request, "admin_config": loadAdminConfig(), "ai_enabled": AI_ENABLED},
    )


@app.get("/api/calculate")
async def calculate(
    sex: str,
    weight: float,
    height: float,
    age: int,
    activity_factor: float,
    goal_type: str,
):
    try:
        bmr = calculate_bmr(sex=sex, weight=weight, height=height, age=age)
        daily_calories = calculate_daily_calories(bmr, activity_factor)
        goal_calories = calculate_goal_calories(daily_calories, goal_type)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {
        "bmr": bmr,
        "daily_calories": daily_calories,
        "goal_calories": goal_calories,
    }


def normalize_iso_datetime(value: str) -> datetime:
    if value.endswith("Z"):
        value = value.replace("Z", "+00:00")
    return datetime.fromisoformat(value)


def format_goal_label(goal: str | None) -> str:
    goal_map = {
        "lose": "похудение",
        "gain": "набор веса",
        "muscle": "набор мышечной массы",
        "maintain": "поддержание формы",
    }
    return goal_map.get(goal, "здоровый баланс")


def build_reminder_time(base: datetime, hours: int, days: int = 0) -> str:
    scheduled = base + timedelta(days=days)
    scheduled = scheduled.replace(hour=hours, minute=0, second=0, microsecond=0)
    return scheduled.isoformat()


def next_weekday(base: datetime, weekday: int) -> datetime:
    days_ahead = (weekday - base.weekday()) % 7
    if days_ahead == 0:
        days_ahead = 7
    return base + timedelta(days=days_ahead)


def generate_reminders_payload(profile: dict[str, object]) -> list[dict[str, str]]:
    now = datetime.now(timezone.utc)
    reminders: list[dict[str, str]] = []
    admin_config = loadAdminConfig()
    reminder_config = admin_config.get("reminders", {}) if isinstance(admin_config, dict) else {}
    weekly_rules = admin_config.get("weekly_rules", {}) if isinstance(admin_config, dict) else {}
    min_days_logged = (
        weekly_rules.get("min_logged_days", 4) if isinstance(weekly_rules, dict) else 4
    )
    water_min_l = reminder_config.get("water_min_l", 1.5) if isinstance(reminder_config, dict) else 1.5
    deadline_days = reminder_config.get("deadline_days", [7]) if isinstance(reminder_config, dict) else [7]

    goal = format_goal_label(profile.get("goal") if isinstance(profile, dict) else None)
    weekly_stats = profile.get("weekly_stats") if isinstance(profile, dict) else {}
    days_logged = weekly_stats.get("days_logged") if isinstance(weekly_stats, dict) else None
    water_avg = weekly_stats.get("water_avg_l") if isinstance(weekly_stats, dict) else None
    deadline_raw = profile.get("goal_deadline") if isinstance(profile, dict) else None

    if (
        profile.get("food_diary") is True
        and isinstance(days_logged, (int, float))
        and days_logged < min_days_logged
    ):
        reminders.append(
            {
                "type": "food_diary",
                "text": (
                    f"Цель — {goal}. За неделю отмечено только {int(days_logged)} дн. "
                    "Запишите питание сегодня, чтобы видеть прогресс."
                ),
                "suggested_time_iso": build_reminder_time(now, 9, days=1),
            }
        )

    if isinstance(water_avg, (int, float)) and water_avg < water_min_l:
        reminders.append(
            {
                "type": "water",
                "text": (
                    f"Средняя вода за неделю — {round(water_avg, 1)} л. "
                    "Добавьте ещё 1 стакан, чтобы поддержать энергию."
                ),
                "suggested_time_iso": build_reminder_time(now, 12, days=0),
            }
        )

    if deadline_raw:
        try:
            deadline = normalize_iso_datetime(str(deadline_raw))
        except ValueError:
            deadline = None
        if deadline:
            days_left = (deadline - now).days
            for days_before in deadline_days:
                if days_left < days_before:
                    date_label = deadline.strftime("%d.%m")
                    reminders.append(
                        {
                            "type": "goal_deadline",
                            "text": (
                                f"До дедлайна ({date_label}) осталось {max(days_left, 0)} дн. "
                                "Сверьте план на неделю, чтобы удержать цель."
                            ),
                            "suggested_time_iso": build_reminder_time(now, 9, days=0),
                        }
                    )
                    break

    next_monday = next_weekday(now, 0)
    reminders.append(
        {
            "type": "weekly_summary",
            "text": "Еженедельный обзор готов. Посмотрите, как идёт движение к цели.",
            "suggested_time_iso": build_reminder_time(next_monday, 9, days=0),
        }
    )

    return reminders


def generate_auto_reminders_payload(
    profile: dict[str, object],
    weekly_review: dict[str, object],
) -> list[dict[str, str]]:
    now = datetime.now(timezone.utc)
    reminders: list[dict[str, str]] = []
    admin_config = loadAdminConfig()
    reminder_config = admin_config.get("reminders", {}) if isinstance(admin_config, dict) else {}
    weekly_rules = admin_config.get("weekly_rules", {}) if isinstance(admin_config, dict) else {}
    min_days_logged = (
        weekly_rules.get("min_logged_days", 4) if isinstance(weekly_rules, dict) else 4
    )
    water_min_l = reminder_config.get("water_min_l", 1.5) if isinstance(reminder_config, dict) else 1.5
    deadline_days = reminder_config.get("deadline_days", [7]) if isinstance(reminder_config, dict) else [7]

    goal = format_goal_label(profile.get("goal") if isinstance(profile, dict) else None)
    weekly_stats = profile.get("weekly_stats") if isinstance(profile, dict) else {}
    days_logged = weekly_stats.get("days_logged") if isinstance(weekly_stats, dict) else None
    avg_water = weekly_stats.get("water_avg_l") if isinstance(weekly_stats, dict) else None
    deadline_raw = profile.get("goal_deadline") if isinstance(profile, dict) else None

    if (
        profile.get("food_diary") is True
        and isinstance(days_logged, (int, float))
        and days_logged < min_days_logged
    ):
        reminders.append(
            {
                "type": "food_diary",
                "text": (
                    f"Цель — {goal}. За неделю отмечено только {int(days_logged)} дн. "
                    "Запишите питание сегодня, чтобы видеть прогресс."
                ),
                "suggested_time_iso": build_reminder_time(now, 9, days=1),
            }
        )

    if isinstance(avg_water, (int, float)) and avg_water < water_min_l:
        reminders.append(
            {
                "type": "water",
                "text": (
                    f"Средняя вода за неделю — {round(avg_water, 1)} л. "
                    "Добавьте ещё 1 стакан, чтобы поддержать энергию."
                ),
                "suggested_time_iso": build_reminder_time(now, 12, days=0),
            }
        )

    weekly_status = weekly_review.get("status") if isinstance(weekly_review, dict) else None
    weekly_message = weekly_review.get("message") if isinstance(weekly_review, dict) else None
    if weekly_status and weekly_status != "ok":
        reminders.append(
            {
                "type": "weekly_summary",
                "text": weekly_message
                or "Есть отклонения от плана за неделю. Посмотрите краткий обзор.",
                "suggested_time_iso": build_reminder_time(now, 9, days=1),
            }
        )

    if deadline_raw:
        try:
            deadline = normalize_iso_datetime(str(deadline_raw))
        except ValueError:
            deadline = None
        if deadline:
            days_left = (deadline - now).days
            for days_before in deadline_days:
                if days_left < days_before:
                    date_label = deadline.strftime("%d.%m")
                    reminders.append(
                        {
                            "type": "goal_deadline",
                            "text": (
                                f"До дедлайна ({date_label}) осталось {max(days_left, 0)} дн. "
                                "Сверьте план на неделю, чтобы удержать цель."
                            ),
                            "suggested_time_iso": build_reminder_time(now, 9, days=0),
                        }
                    )
                    break

    return reminders


def compute_subscription_status(payload: dict[str, str]) -> dict[str, str | None]:
    subscription_until_raw = payload.get("subscription_until")
    subscription_started_at = payload.get("subscription_started_at")
    trial_started_at = payload.get("trial_started_at")
    if not subscription_until_raw:
        return {
            "subscription_status": "none",
            "subscription_until": None,
            "subscription_started_at": subscription_started_at,
            "trial_started_at": trial_started_at,
        }
    try:
        subscription_until = normalize_iso_datetime(subscription_until_raw)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Некорректная дата подписки.") from exc
    now = datetime.now(timezone.utc)
    status = payload.get("subscription_status") or "trial"
    if now >= subscription_until:
        status = "expired"
    return {
        "subscription_status": status,
        "subscription_until": subscription_until.isoformat(),
        "subscription_started_at": subscription_started_at,
        "trial_started_at": trial_started_at,
    }


@app.get("/api/subscription/status")
async def subscription_status(telegram_user_id: int):
    stored = subscription_store.get(telegram_user_id, {})
    return compute_subscription_status(stored)


@app.get("/api/admin/config")
async def admin_config():
    if APP_ENV != "development" and not DEBUG:
        raise HTTPException(status_code=403, detail="Доступ запрещён.")
    return loadAdminConfig()


@app.post("/api/subscription/start_trial")
async def start_trial(payload: SubscriptionRequest):
    stored = subscription_store.get(payload.telegram_user_id)
    if stored and stored.get("subscription_until"):
        return compute_subscription_status(stored)

    admin_config = loadAdminConfig()
    trial_days = int(admin_config.get("trial_days", 30))
    now = datetime.now(timezone.utc)
    if payload.trial_started_at:
        try:
            started_at = normalize_iso_datetime(payload.trial_started_at)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Некорректная дата старта trial.") from exc
    elif payload.subscription_started_at:
        try:
            started_at = normalize_iso_datetime(payload.subscription_started_at)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Некорректная дата старта подписки.") from exc
    else:
        started_at = now
    trial_until = started_at + timedelta(days=trial_days)
    subscription_store[payload.telegram_user_id] = {
        "subscription_status": "trial",
        "subscription_until": trial_until.isoformat(),
        "subscription_started_at": started_at.isoformat(),
        "trial_started_at": started_at.isoformat(),
        "started_at": now.isoformat(),
    }
    return compute_subscription_status(subscription_store[payload.telegram_user_id])


@app.post("/api/payments/start")
async def start_payment(payload: PaymentRequest):
    if payload.days <= 0:
        raise HTTPException(status_code=400, detail="Срок продления должен быть больше нуля.")

    now = datetime.now(timezone.utc)
    stored = subscription_store.get(payload.telegram_user_id, {})
    current_until_raw = stored.get("subscription_until")
    if current_until_raw:
        try:
            current_until = normalize_iso_datetime(current_until_raw)
        except ValueError:
            current_until = now
    else:
        current_until = now

    base_date = current_until if current_until > now else now
    new_until = base_date + timedelta(days=payload.days)
    subscription_store[payload.telegram_user_id] = {
        "subscription_status": "active",
        "subscription_until": new_until.isoformat(),
        "subscription_started_at": stored.get("subscription_started_at"),
        "trial_started_at": stored.get("trial_started_at"),
        "started_at": stored.get("started_at") or now.isoformat(),
    }

    return {
        "status": "success",
        "subscription_status": "active",
        "subscription_until": new_until.isoformat(),
        "subscription_started_at": stored.get("subscription_started_at"),
        "trial_started_at": stored.get("trial_started_at"),
    }


@app.post("/api/ai/recommendation")
async def ai_recommendation(request: Request):
    try:
        profile = await request.json()
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Некорректный JSON.") from exc

    if not AI_ENABLED:
        return {
            "text": generate_profile_recommendation(profile if isinstance(profile, dict) else {}),
            "source": "stub",
        }

    if not YANDEX_GPT_API_KEY or not YANDEX_GPT_FOLDER_ID:
        raise HTTPException(status_code=500, detail="Не настроен доступ к YandexGPT.")

    try:
        text = generate_yandex_recommendation(
            profile if isinstance(profile, dict) else {},
            api_key=YANDEX_GPT_API_KEY,
            folder_id=YANDEX_GPT_FOLDER_ID,
        )
    except (requests.RequestException, ValueError) as exc:
        raise HTTPException(status_code=502, detail="Не удалось получить ответ YandexGPT.") from exc

    return {
        "text": text,
        "source": "yandex",
    }


@app.post("/api/reminders/schedule")
async def schedule_reminder(payload: ReminderScheduleRequest):
    return reminder_scheduler.schedule(
        ReminderPayload(
            telegram_user_id=payload.telegram_user_id,
            type=payload.type,
            when_iso=payload.when_iso,
        )
    )


@app.get("/api/reminders/list")
async def list_reminders(telegram_user_id: int):
    return reminder_scheduler.list_for_user(telegram_user_id)


@app.post("/api/reminders/generate")
async def generate_reminders(payload: ReminderGenerateRequest):
    profile = payload.user_profile if isinstance(payload.user_profile, dict) else {}
    reminders = generate_reminders_payload(profile)
    return {"reminders": reminders}


@app.post("/api/reminders/auto-generate")
async def auto_generate_reminders(payload: ReminderAutoGenerateRequest):
    profile = payload.user_profile if isinstance(payload.user_profile, dict) else {}
    weekly_review = payload.weekly_review if isinstance(payload.weekly_review, dict) else {}
    reminders = generate_auto_reminders_payload(profile, weekly_review)
    return {"reminders": reminders}


@app.post("/api/food-diary/add")
async def add_food_diary_entry(entry: FoodDiaryEntry):
    entries = food_diary_store.setdefault(entry.telegram_user_id, [])
    entries.append(entry.model_dump())
    return {"status": "saved"}


@app.get("/api/food-diary/list")
async def list_food_diary_entries(telegram_user_id: int):
    return food_diary_store.get(telegram_user_id, [])


@app.post("/api/food-diary/analyze")
async def analyze_food_diary(request: Request):
    try:
        payload = await request.json()
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Некорректный JSON.") from exc

    profile = payload.get("user_profile", {}) if isinstance(payload, dict) else {}
    entries = payload.get("food_entries", []) if isinstance(payload, dict) else []

    if not isinstance(profile, dict) or not isinstance(entries, list):
        raise HTTPException(status_code=400, detail="Некорректные данные дневника.")

    if not AI_ENABLED:
        result = generate_food_diary_recommendation(profile, entries)
        return {
            "insights": result["insights"],
            "advice": result["advice"],
            "deviation_risk": result.get("deviation_risk"),
            "deviation_comment": result.get("deviation_comment"),
            "deviation_weeks_shift": result.get("deviation_weeks_shift"),
            "source": "stub",
        }

    if not YANDEX_GPT_API_KEY or not YANDEX_GPT_FOLDER_ID:
        raise HTTPException(status_code=500, detail="Не настроен доступ к YandexGPT.")

    deviation_info = calculate_deviation_risk(profile, entries)

    try:
        text = generate_yandex_recommendation(
            {
                "food_diary_entries": entries,
                **profile,
            },
            api_key=YANDEX_GPT_API_KEY,
            folder_id=YANDEX_GPT_FOLDER_ID,
        )
    except (requests.RequestException, ValueError) as exc:
        raise HTTPException(status_code=502, detail="Не удалось получить ответ YandexGPT.") from exc

    return {
        "text": text,
        "deviation_risk": deviation_info["risk"],
        "deviation_comment": deviation_info["comment"],
        "deviation_weeks_shift": deviation_info["weeks_shift"],
        "source": "yandex",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=APP_HOST,
        port=APP_PORT,
        reload=DEBUG,
    )
