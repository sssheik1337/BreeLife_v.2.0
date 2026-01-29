import hashlib
import hmac
import json
import logging
from contextlib import asynccontextmanager
import secrets
import uuid
from urllib.parse import parse_qsl
from datetime import datetime, timedelta, timezone
from typing import Literal
from pathlib import Path

import requests
from aiogram import Bot, Dispatcher, types
from aiogram.filters import Command
from fastapi import Depends, FastAPI, Form, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
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
    DEV_TELEGRAM_USER_ID,
    IS_DEV,
    IS_PROD,
    REMINDERS_ENABLED,
    YANDEX_GPT_API_KEY,
    YANDEX_GPT_FOLDER_ID,
    TELEGRAM_BOT_TOKEN,
    PUBLIC_APP_URL,
    PUBLIC_BASE_URL,
    ADMIN_LOGIN,
    ADMIN_PASSWORD,
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
from services.storage_db import (
    create_session,
    get_session_user,
    init_db,
    read_payload,
    write_payload,
)
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

bot = None
dispatcher = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 FastAPI started")
    global bot, dispatcher
    if not TELEGRAM_BOT_TOKEN:
        logger.error("TELEGRAM_BOT_TOKEN не задан. Бот не будет запущен.")
        yield
        return
    if not PUBLIC_BASE_URL:
        logger.error("PUBLIC_BASE_URL не задан. Вебхук не будет установлен.")
        yield
        return
    bot = Bot(token=TELEGRAM_BOT_TOKEN)
    dispatcher = Dispatcher()

    @dispatcher.message(Command("start"))
    async def handle_start(message: types.Message) -> None:
        user_id = message.from_user.id if message.from_user else "unknown"
        logger.info("INFO: /start получен от пользователя %s", user_id)
        keyboard = types.InlineKeyboardMarkup(
            inline_keyboard=[
                [
                    types.InlineKeyboardButton(
                        text="Открыть приложение",
                        web_app=types.WebAppInfo(url=PUBLIC_APP_URL),
                    )
                ]
            ]
        )
        logger.info("INFO: Отправлена кнопка WebApp с URL: %s", PUBLIC_APP_URL)
        await message.answer(
            "Добро пожаловать! Откройте приложение 👇",
            reply_markup=keyboard,
        )

    webhook_url = f"{PUBLIC_BASE_URL.rstrip('/')}/telegram/webhook"
    try:
        result = await bot.set_webhook(webhook_url)
        logger.info("INFO: Webhook установлен: %s (result=%s)", webhook_url, result)
    except Exception as exc:
        logger.error("Не удалось установить webhook: %s", exc)
        yield
        return
    logger.info("INFO: Telegram bot started (webhook): %s", webhook_url)
    yield
    try:
        await bot.delete_webhook(drop_pending_updates=True)
        logger.info("INFO: Webhook удалён")
    except Exception as exc:
        logger.error("Не удалось удалить webhook: %s", exc)
    await bot.session.close()


app = FastAPI(title=APP_NAME, lifespan=lifespan)

templates = Jinja2Templates(directory="templates")
templates.env.globals["APP_NAME"] = APP_NAME

init_db()

ADMIN_CONFIG_PATH = Path("config/admin_config.json")
ADMIN_PRODUCTS_PATH = Path("static/data/products.json")
ADMIN_CONFIG_CACHE: dict[str, object] | None = None
ADMIN_CONFIG_MTIME: float | None = None
ADMIN_SESSION_COOKIE = "admin_session"
TELEGRAM_SESSION_COOKIE = "telegram_session"
ADMIN_SESSION_TTL = timedelta(hours=12)
ADMIN_SESSIONS: dict[str, datetime] = {}


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


def loadAdminProducts() -> list[dict[str, object]]:
    """Загрузить список продуктов из файла, если он доступен."""
    if not ADMIN_PRODUCTS_PATH.exists():
        return []
    try:
        data = json.loads(ADMIN_PRODUCTS_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []
    if not isinstance(data, list):
        return []
    return [item for item in data if isinstance(item, dict)]


def normalizeProductName(value: str) -> str:
    return value.strip().lower()


def search_products(query: str) -> dict[str, list[dict[str, object]]]:
    normalized_query = normalizeProductName(query)
    if not normalized_query:
        return {"exact": [], "similar": []}
    products = loadAdminProducts()
    exact = []
    similar = []
    for item in products:
        name = item.get("name")
        if not isinstance(name, str):
            continue
        normalized_name = normalizeProductName(name)
        if normalized_name == normalized_query:
            exact.append(item)
        elif normalized_query in normalized_name:
            similar.append(item)
    return {"exact": exact, "similar": similar}


def saveAdminProducts(products: list[dict[str, object]]) -> None:
    """Сохранить список продуктов в файл."""
    ADMIN_PRODUCTS_PATH.write_text(
        json.dumps(products, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def updateAdminConfig(data: dict[str, object]) -> None:
    """Сохранить админ-конфиг в файл."""
    ADMIN_CONFIG_PATH.write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def isAdminAuthenticated(request: Request) -> bool:
    """Проверить, что текущая сессия имеет доступ в админку."""
    token = request.cookies.get(ADMIN_SESSION_COOKIE)
    if not token:
        return False
    expires_at = ADMIN_SESSIONS.get(token)
    if not expires_at:
        return False
    if datetime.now(timezone.utc) >= expires_at:
        ADMIN_SESSIONS.pop(token, None)
        return False
    return True


def verifyAdminCredentials(login: str, password: str) -> bool:
    """Проверить логин и пароль админки."""
    if not ADMIN_LOGIN or not ADMIN_PASSWORD:
        return False
    login_ok = secrets.compare_digest(login, ADMIN_LOGIN)
    password_ok = secrets.compare_digest(password, ADMIN_PASSWORD)
    return login_ok and password_ok


def normalize_group_list(values: object) -> list[str]:
    if not isinstance(values, list):
        return []
    groups = []
    for item in values:
        if isinstance(item, str):
            normalized = item.strip()
            if normalized and normalized not in groups:
                groups.append(normalized)
    return groups


def collect_product_groups(
    products: list[dict[str, object]],
    config: dict[str, object],
) -> list[str]:
    groups = normalize_group_list(config.get("product_groups"))
    for item in products:
        group = item.get("group")
        if isinstance(group, str):
            normalized = group.strip()
            if normalized and normalized not in groups:
                groups.append(normalized)
    return sorted(groups)


def renderAdminIndex(
    request: Request,
    error: str | None = None,
    success: str | None = None,
) -> HTMLResponse:
    return templates.TemplateResponse(
        "admin_index.html",
        {
            "request": request,
            "error": error,
            "success": success,
        },
    )


def renderAdminProducts(
    request: Request,
    error: str | None = None,
    success: str | None = None,
) -> HTMLResponse:
    products = loadAdminProducts()
    config = loadAdminConfig()
    groups = collect_product_groups(products, config if isinstance(config, dict) else {})
    return templates.TemplateResponse(
        "admin_products.html",
        {
            "request": request,
            "products": products,
            "groups": groups,
            "error": error,
            "success": success,
        },
    )


def renderAdminGroups(
    request: Request,
    error: str | None = None,
    success: str | None = None,
) -> HTMLResponse:
    config = loadAdminConfig()
    groups = normalize_group_list(config.get("product_groups") if isinstance(config, dict) else [])
    return templates.TemplateResponse(
        "admin_groups.html",
        {
            "request": request,
            "groups": sorted(groups),
            "error": error,
            "success": success,
        },
    )


def renderAdminNorms(
    request: Request,
    error: str | None = None,
    success: str | None = None,
) -> HTMLResponse:
    config = loadAdminConfig()
    norms = config.get("norms") if isinstance(config, dict) else {}
    if not isinstance(norms, dict):
        norms = {}
    return templates.TemplateResponse(
        "admin_norms.html",
        {
            "request": request,
            "norms": {
                "water_l": norms.get("water_l", 2),
                "sleep_hours": norms.get("sleep_hours", 8),
                "fiber_g": norms.get("fiber_g", 25),
            },
            "error": error,
            "success": success,
        },
    )


def buildFoodDiaryAggregates(
    entries: list[dict[str, object]],
    profile: dict[str, object],
) -> dict[str, object]:
    """Сформировать агрегаты дневника без сырых записей."""
    recent = sorted(entries, key=lambda item: item.get("date", ""))[-7:]
    calories = [
        item.get("calories")
        for item in recent
        if isinstance(item, dict) and isinstance(item.get("calories"), (int, float))
    ]
    avg_calories = sum(calories) / len(calories) if calories else None
    tdee = profile.get("tdee_calories") if isinstance(profile, dict) else None
    deviation_kcal = None
    deviation_ratio = None
    if isinstance(avg_calories, (int, float)) and isinstance(tdee, (int, float)) and tdee:
        deviation_kcal = avg_calories - tdee
        deviation_ratio = deviation_kcal / tdee

    trend = "нет данных"
    if len(calories) >= 4:
        midpoint = len(calories) // 2
        first_avg = sum(calories[:midpoint]) / midpoint
        second_avg = sum(calories[midpoint:]) / (len(calories) - midpoint)
        diff = second_avg - first_avg
        if abs(diff) < 50:
            trend = "стабильно"
        elif diff > 0:
            trend = "рост"
        else:
            trend = "снижение"

    return {
        "days_count": len({item.get("date") for item in recent if isinstance(item, dict)}),
        "avg_calories": avg_calories,
        "deviation": {
            "kcal": deviation_kcal,
            "ratio": deviation_ratio,
        },
        "trend": trend,
    }

# In-memory хранилище напоминаний по telegram_user_id.
reminders_store: dict[int, list[dict[str, str]]] = {}
reminder_scheduler = ReminderScheduler(REMINDERS_ENABLED, reminders_store)


class ReminderScheduleRequest(BaseModel):
    telegram_user_id: int = Field(..., description="Telegram user id")
    type: Literal[
        "food_diary",
        "water",
        "weekly_summary",
        "goal_deadline",
        "sleep",
        "sleep_reminder",
        "activity",
    ]
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


class ProfileSaveRequest(BaseModel):
    telegram_user_id: int = Field(..., description="Telegram user id")
    user_profile: dict[str, object] = Field(default_factory=dict)


class DiaryEntriesPayload(BaseModel):
    telegram_user_id: int = Field(..., description="Telegram user id")
    entries: list[dict[str, object]] = Field(default_factory=list)


class WaterEntriesPayload(BaseModel):
    telegram_user_id: int = Field(..., description="Telegram user id")
    entries: list[dict[str, object]] = Field(default_factory=list)


class SleepEntriesPayload(BaseModel):
    telegram_user_id: int = Field(..., description="Telegram user id")
    entries: list[dict[str, object]] = Field(default_factory=list)


class HabitEntriesPayload(BaseModel):
    telegram_user_id: int = Field(..., description="Telegram user id")
    habits: dict[str, object] = Field(default_factory=dict)


class FoodDiaryEntry(BaseModel):
    telegram_user_id: int = Field(..., description="Telegram user id")
    date: str
    calories: float
    protein_g: float
    fat_g: float
    carbs_g: float
    carbs_simple_g: float = 0
    carbs_complex_g: float = 0


class TelegramAuthRequest(BaseModel):
    initData: str = Field(..., description="Init data из Telegram WebApp")


def verify_telegram_init_data(init_data: str, bot_token: str) -> dict[str, object]:
    """Проверить initData Telegram WebApp и вернуть полезную нагрузку."""
    if not init_data:
        raise ValueError("initData отсутствует.")
    if not bot_token:
        raise ValueError("TELEGRAM_BOT_TOKEN не задан.")
    parsed = dict(parse_qsl(init_data, keep_blank_values=True))
    received_hash = parsed.pop("hash", None)
    if not received_hash:
        raise ValueError("Hash отсутствует.")
    data_check_string = "\n".join(
        f"{key}={value}" for key, value in sorted(parsed.items())
    )
    secret_key = hashlib.sha256(bot_token.encode("utf-8")).digest()
    calculated_hash = hmac.new(
        secret_key,
        data_check_string.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    if not secrets.compare_digest(calculated_hash, received_hash):
        raise ValueError("initData не прошёл проверку.")
    return parsed


def resolve_session_user(
    request: Request,
    *,
    required: bool,
    allow_dev_user: bool = False,
) -> int | None:
    """Получить telegram_user_id из cookie или пропустить в DEV режиме."""
    session_id = request.cookies.get(TELEGRAM_SESSION_COOKIE)
    if not session_id:
        if IS_DEV:
            logger.info("DEV MODE: Telegram validation skipped")
            return DEV_TELEGRAM_USER_ID if allow_dev_user else None
        if required:
            raise HTTPException(status_code=401, detail="Сессия не найдена.")
        return None
    telegram_user_id = get_session_user(session_id)
    if not telegram_user_id:
        if IS_DEV:
            logger.info("DEV MODE: Telegram validation skipped")
            return DEV_TELEGRAM_USER_ID if allow_dev_user else None
        if required:
            raise HTTPException(status_code=401, detail="Сессия недействительна.")
        return None
    return telegram_user_id


def get_current_user(request: Request) -> int:
    """Получить telegram_user_id из сессионной cookie."""
    telegram_user_id = resolve_session_user(request, required=True, allow_dev_user=True)
    if telegram_user_id is None:
        raise HTTPException(status_code=401, detail="Сессия недействительна.")
    return telegram_user_id


def optional_current_user(request: Request) -> int | None:
    """Получить telegram_user_id из cookie или вернуть None."""
    return resolve_session_user(request, required=False)


def is_profile_completed(telegram_user_id: int) -> bool:
    """Проверить, заполнен ли профиль пользователя."""
    profile = read_payload("profiles", telegram_user_id)
    if not isinstance(profile, dict):
        return False
    return profile.get("completed") is True


def require_completed_profile(telegram_user_id: int) -> None:
    """Проверить заполнение профиля или вернуть ошибку."""
    if not is_profile_completed(telegram_user_id):
        raise HTTPException(status_code=409, detail="PROFILE_INCOMPLETE")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        logger.info("%s %s %s", request.method, request.url.path, response.status_code)
        return response


app.add_middleware(RequestLoggingMiddleware)
app.mount("/static", StaticFiles(directory="static"), name="static")
# HTTP 304 (Not Modified) для статики — это не ошибка, а корректный ответ кэша.


@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse(
        "index.html",
        {"request": request, "admin_config": loadAdminConfig(), "ai_enabled": AI_ENABLED},
    )


@app.get("/index", response_class=HTMLResponse)
async def index_alias(request: Request):
    return templates.TemplateResponse(
        "index.html",
        {"request": request, "admin_config": loadAdminConfig(), "ai_enabled": AI_ENABLED},
    )


@app.get("/healthz")
async def healthz():
    return {"status": "ok"}


@app.get("/api/me/status")
async def me_status(request: Request):
    session_id = request.cookies.get(TELEGRAM_SESSION_COOKIE)
    if not session_id:
        if IS_DEV:
            logger.info("DEV MODE: Telegram validation skipped")
            return {
                "authorized": True,
                "profile_completed": is_profile_completed(DEV_TELEGRAM_USER_ID),
                "telegram_user_id": DEV_TELEGRAM_USER_ID,
            }
        return {"authorized": False, "profile_completed": False, "telegram_user_id": None}
    telegram_user_id = get_session_user(session_id)
    if not telegram_user_id:
        if IS_DEV:
            logger.info("DEV MODE: Telegram validation skipped")
            return {
                "authorized": True,
                "profile_completed": is_profile_completed(DEV_TELEGRAM_USER_ID),
                "telegram_user_id": DEV_TELEGRAM_USER_ID,
            }
        return {"authorized": False, "profile_completed": False, "telegram_user_id": None}
    return {
        "authorized": True,
        "profile_completed": is_profile_completed(telegram_user_id),
        "telegram_user_id": telegram_user_id,
    }


@app.get("/api/session")
async def session_status(request: Request):
    session_id = request.cookies.get(TELEGRAM_SESSION_COOKIE)
    if not session_id:
        if IS_DEV:
            logger.info("DEV MODE: Telegram validation skipped")
            return {
                "telegram_user_id": DEV_TELEGRAM_USER_ID,
                "profile_completed": is_profile_completed(DEV_TELEGRAM_USER_ID),
            }
        return {"telegram_user_id": None, "profile_completed": False}
    telegram_user_id = get_session_user(session_id)
    if not telegram_user_id:
        if IS_DEV:
            logger.info("DEV MODE: Telegram validation skipped")
            return {
                "telegram_user_id": DEV_TELEGRAM_USER_ID,
                "profile_completed": is_profile_completed(DEV_TELEGRAM_USER_ID),
            }
        return {"telegram_user_id": None, "profile_completed": False}
    return {
        "telegram_user_id": telegram_user_id,
        "profile_completed": is_profile_completed(telegram_user_id),
    }


@app.get("/api/telegram/bot-info")
async def telegram_bot_info():
    if not TELEGRAM_BOT_TOKEN:
        raise HTTPException(status_code=500, detail="TELEGRAM_BOT_TOKEN не задан.")
    try:
        response = requests.get(
            f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getMe",
            timeout=10,
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail="Не удалось получить данные бота.") from exc
    data = response.json()
    if not data.get("ok"):
        raise HTTPException(status_code=502, detail="Bot API вернул ошибку.")
    result = data.get("result", {})
    return {
        "username": result.get("username"),
        "name": result.get("first_name"),
    }


@app.get("/api/app/public-url")
async def app_public_url():
    return {"app_url": PUBLIC_APP_URL}


@app.get("/api/app/config")
async def app_config():
    return {
        "mode": APP_ENV,
        "is_dev": IS_DEV,
        "is_prod": IS_PROD,
        "dev_user": {"id": "dev-user", "first_name": "Developer"},
        "dev_telegram_user_id": DEV_TELEGRAM_USER_ID,
    }


@app.post("/api/auth/telegram")
async def auth_telegram(payload: TelegramAuthRequest):
    if IS_DEV:
        logger.info("DEV MODE: Telegram validation skipped")
        return {"ok": True, "telegram_user_id": DEV_TELEGRAM_USER_ID}
    try:
        parsed = verify_telegram_init_data(payload.initData, TELEGRAM_BOT_TOKEN)
    except ValueError as exc:
        logger.info("INFO: initData невалидна: %s", exc)
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    user_raw = parsed.get("user")
    if not user_raw:
        raise HTTPException(status_code=400, detail="Пользователь не найден в initData.")
    try:
        user_data = json.loads(user_raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Некорректный формат пользователя.") from exc
    telegram_user_id = user_data.get("id")
    if not telegram_user_id:
        raise HTTPException(status_code=400, detail="telegram_user_id отсутствует.")
    logger.info("INFO: initData валидна для user_id=%s", telegram_user_id)
    session_id = create_session(int(telegram_user_id))
    response = JSONResponse(
        {
            "ok": True,
            "telegram_user_id": telegram_user_id,
            "username": user_data.get("username"),
        }
    )
    response.set_cookie(
        TELEGRAM_SESSION_COOKIE,
        session_id,
        httponly=True,
        samesite="lax",
        secure=IS_PROD,
    )
    return response


@app.post("/telegram/webhook")
async def telegram_webhook(update: dict):
    if not bot or not dispatcher:
        logger.error("Telegram webhook вызван без инициализированного бота.")
        raise HTTPException(status_code=503, detail="Бот не инициализирован.")
    update_type = update.get("message") and "message" or update.get("callback_query") and "callback_query" or "unknown"
    from_user = None
    if update.get("message") and isinstance(update["message"], dict):
        from_user = update["message"].get("from", {}).get("id")
    logger.info("INFO: Получен webhook update (type=%s, from=%s)", update_type, from_user)
    update_obj = types.Update.model_validate(update)
    await dispatcher.feed_update(bot, update_obj)
    return {"ok": True}


@app.get("/api/health/telegram")
async def telegram_health():
    if not TELEGRAM_BOT_TOKEN:
        raise HTTPException(status_code=500, detail="TELEGRAM_BOT_TOKEN не задан.")
    base_url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}"
    try:
        me_response = requests.get(f"{base_url}/getMe", timeout=10)
        webhook_response = requests.get(f"{base_url}/getWebhookInfo", timeout=10)
        me_response.raise_for_status()
        webhook_response.raise_for_status()
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail="Не удалось получить статус Telegram API.") from exc
    return {
        "getMe": me_response.json(),
        "getWebhookInfo": webhook_response.json(),
    }


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
async def profile(request: Request, telegram_user_id: int | None = Depends(optional_current_user)):
    if telegram_user_id is None:
        return templates.TemplateResponse(
            "profile.html",
            {"request": request, "admin_config": loadAdminConfig(), "ai_enabled": AI_ENABLED},
        )
    require_completed_profile(telegram_user_id)
    return templates.TemplateResponse(
        "profile.html",
        {"request": request, "admin_config": loadAdminConfig(), "ai_enabled": AI_ENABLED},
    )


@app.get("/profile.html", response_class=HTMLResponse)
async def profile_legacy(request: Request, telegram_user_id: int | None = Depends(optional_current_user)):
    if telegram_user_id is None:
        return templates.TemplateResponse(
            "profile.html",
            {"request": request, "admin_config": loadAdminConfig(), "ai_enabled": AI_ENABLED},
        )
    require_completed_profile(telegram_user_id)
    # Поддержка старого пути, чтобы не ловить 404 при прямом заходе.
    return templates.TemplateResponse(
        "profile.html",
        {"request": request, "admin_config": loadAdminConfig(), "ai_enabled": AI_ENABLED},
    )


@app.get("/diary", response_class=HTMLResponse)
async def diary(request: Request, telegram_user_id: int | None = Depends(optional_current_user)):
    if telegram_user_id is None:
        return templates.TemplateResponse(
            "diary.html",
            {"request": request, "admin_config": loadAdminConfig(), "ai_enabled": AI_ENABLED},
        )
    require_completed_profile(telegram_user_id)
    return templates.TemplateResponse(
        "diary.html",
        {"request": request, "admin_config": loadAdminConfig(), "ai_enabled": AI_ENABLED},
    )


@app.get("/food-diary")
async def food_diary():
    return RedirectResponse(url="/diary?mode=products")


@app.get("/foods", response_class=HTMLResponse)
async def foods(request: Request, telegram_user_id: int | None = Depends(optional_current_user)):
    if telegram_user_id is None:
        return templates.TemplateResponse(
            "foods.html",
            {"request": request, "admin_config": loadAdminConfig(), "ai_enabled": AI_ENABLED},
        )
    require_completed_profile(telegram_user_id)
    return templates.TemplateResponse(
        "foods.html",
        {"request": request, "admin_config": loadAdminConfig(), "ai_enabled": AI_ENABLED},
    )


@app.get("/my-products", response_class=HTMLResponse)
async def my_products(request: Request, telegram_user_id: int | None = Depends(optional_current_user)):
    if telegram_user_id is None:
        return templates.TemplateResponse(
            "my_products.html",
            {"request": request, "admin_config": loadAdminConfig(), "ai_enabled": AI_ENABLED},
        )
    require_completed_profile(telegram_user_id)
    return templates.TemplateResponse(
        "my_products.html",
        {"request": request, "admin_config": loadAdminConfig(), "ai_enabled": AI_ENABLED},
    )

@app.get("/meal-plan", response_class=HTMLResponse)
async def meal_plan(request: Request, telegram_user_id: int | None = Depends(optional_current_user)):
    if telegram_user_id is None:
        return templates.TemplateResponse(
            "meal_plan.html",
            {"request": request, "admin_config": loadAdminConfig(), "ai_enabled": AI_ENABLED},
        )
    require_completed_profile(telegram_user_id)
    return templates.TemplateResponse(
        "meal_plan.html",
        {"request": request, "admin_config": loadAdminConfig(), "ai_enabled": AI_ENABLED},
    )


@app.get("/shopping-list", response_class=HTMLResponse)
async def shopping_list(request: Request, telegram_user_id: int | None = Depends(optional_current_user)):
    if telegram_user_id is None:
        return templates.TemplateResponse(
            "shopping_list.html",
            {"request": request, "admin_config": loadAdminConfig(), "ai_enabled": AI_ENABLED},
        )
    require_completed_profile(telegram_user_id)
    return templates.TemplateResponse(
        "shopping_list.html",
        {"request": request, "admin_config": loadAdminConfig(), "ai_enabled": AI_ENABLED},
    )


@app.get("/menu", response_class=HTMLResponse)
async def menu(request: Request, telegram_user_id: int | None = Depends(optional_current_user)):
    if telegram_user_id is None:
        return templates.TemplateResponse(
            "menu.html",
            {"request": request, "admin_config": loadAdminConfig(), "ai_enabled": AI_ENABLED},
        )
    require_completed_profile(telegram_user_id)
    return templates.TemplateResponse(
        "menu.html",
        {"request": request, "admin_config": loadAdminConfig(), "ai_enabled": AI_ENABLED},
    )


@app.get("/admin", response_class=HTMLResponse)
async def admin(request: Request):
    if not isAdminAuthenticated(request):
        return templates.TemplateResponse(
            "admin_login.html",
            {"request": request, "error": None},
        )
    return renderAdminIndex(request)


@app.get("/admin/products", response_class=HTMLResponse)
async def admin_products(request: Request):
    if not isAdminAuthenticated(request):
        return RedirectResponse(url="/admin", status_code=303)
    return renderAdminProducts(request)


@app.get("/admin/groups", response_class=HTMLResponse)
async def admin_groups(request: Request):
    if not isAdminAuthenticated(request):
        return RedirectResponse(url="/admin", status_code=303)
    return renderAdminGroups(request)


@app.get("/admin/norms", response_class=HTMLResponse)
async def admin_norms(request: Request):
    if not isAdminAuthenticated(request):
        return RedirectResponse(url="/admin", status_code=303)
    return renderAdminNorms(request)


@app.post("/admin/login", response_class=HTMLResponse)
async def admin_login(request: Request, login: str = Form(...), password: str = Form(...)):
    if not verifyAdminCredentials(login, password):
        return templates.TemplateResponse(
            "admin_login.html",
            {"request": request, "error": "Неверный логин или пароль."},
        )
    token = secrets.token_urlsafe(32)
    ADMIN_SESSIONS[token] = datetime.now(timezone.utc) + ADMIN_SESSION_TTL
    response = RedirectResponse(url="/admin", status_code=303)
    response.set_cookie(
        ADMIN_SESSION_COOKIE,
        token,
        httponly=True,
        max_age=int(ADMIN_SESSION_TTL.total_seconds()),
        samesite="lax",
    )
    return response


@app.post("/admin/logout")
async def admin_logout(request: Request):
    token = request.cookies.get(ADMIN_SESSION_COOKIE)
    if token:
        ADMIN_SESSIONS.pop(token, None)
    response = RedirectResponse(url="/admin", status_code=303)
    response.delete_cookie(ADMIN_SESSION_COOKIE)
    return response


@app.post("/admin/products/add", response_class=HTMLResponse)
async def admin_products_add(
    request: Request,
    name: str = Form(...),
    group: str = Form(...),
    kcal: float = Form(...),
    protein_g: float = Form(...),
    fat_g: float = Form(...),
    carbs_simple_g: float = Form(...),
    carbs_complex_g: float = Form(...),
    fiber_g: float = Form(...),
):
    if not isAdminAuthenticated(request):
        return RedirectResponse(url="/admin", status_code=303)
    carbs_g = max(0, carbs_simple_g + carbs_complex_g)
    products = loadAdminProducts()
    next_id = max((item.get("id", 0) for item in products if isinstance(item.get("id"), int)), default=0) + 1
    products.append(
        {
            "id": next_id,
            "name": name.strip(),
            "group": group.strip(),
            "kcal": kcal,
            "protein_g": protein_g,
            "fat_g": fat_g,
            "carbs_g": carbs_g,
            "carbs_simple_g": carbs_simple_g,
            "carbs_complex_g": carbs_complex_g,
            "fiber_g": fiber_g,
            "tags": [],
            "health_level": "neutral",
        }
    )
    saveAdminProducts(products)
    config = loadAdminConfig()
    if isinstance(config, dict):
        groups = normalize_group_list(config.get("product_groups"))
        if group.strip() and group.strip() not in groups:
            config["product_groups"] = sorted(groups + [group.strip()])
            updateAdminConfig(config)
    return renderAdminProducts(request, success="Продукт добавлен.")


@app.post("/admin/products/update", response_class=HTMLResponse)
async def admin_products_update(
    request: Request,
    product_id: int = Form(...),
    name: str = Form(...),
    group: str = Form(...),
    kcal: float = Form(...),
    protein_g: float = Form(...),
    fat_g: float = Form(...),
    carbs_simple_g: float = Form(...),
    carbs_complex_g: float = Form(...),
    fiber_g: float = Form(...),
):
    if not isAdminAuthenticated(request):
        return RedirectResponse(url="/admin", status_code=303)
    carbs_g = max(0, carbs_simple_g + carbs_complex_g)
    products = loadAdminProducts()
    updated = False
    for item in products:
        if item.get("id") == product_id:
            item["name"] = name.strip()
            item["group"] = group.strip()
            item["kcal"] = kcal
            item["protein_g"] = protein_g
            item["fat_g"] = fat_g
            item["carbs_g"] = carbs_g
            item["carbs_simple_g"] = carbs_simple_g
            item["carbs_complex_g"] = carbs_complex_g
            item["fiber_g"] = fiber_g
            updated = True
            break
    if not updated:
        return renderAdminProducts(request, error="Продукт не найден.")
    saveAdminProducts(products)
    config = loadAdminConfig()
    if isinstance(config, dict):
        groups = normalize_group_list(config.get("product_groups"))
        if group.strip() and group.strip() not in groups:
            config["product_groups"] = sorted(groups + [group.strip()])
            updateAdminConfig(config)
    return renderAdminProducts(request, success="Продукт обновлён.")


@app.post("/admin/products/delete", response_class=HTMLResponse)
async def admin_products_delete(request: Request, product_id: int = Form(...)):
    if not isAdminAuthenticated(request):
        return RedirectResponse(url="/admin", status_code=303)
    products = loadAdminProducts()
    filtered = [item for item in products if item.get("id") != product_id]
    if len(filtered) == len(products):
        return renderAdminProducts(request, error="Продукт не найден.")
    saveAdminProducts(filtered)
    return renderAdminProducts(request, success="Продукт удалён.")


@app.post("/admin/norms", response_class=HTMLResponse)
async def admin_norms_update(
    request: Request,
    water_l: float = Form(...),
    sleep_hours: float = Form(...),
    fiber_g: float = Form(...),
):
    if not isAdminAuthenticated(request):
        return RedirectResponse(url="/admin", status_code=303)
    config = loadAdminConfig()
    if not isinstance(config, dict):
        config = {}
    config["norms"] = {
        "water_l": water_l,
        "sleep_hours": sleep_hours,
        "fiber_g": fiber_g,
    }
    updateAdminConfig(config)
    return renderAdminNorms(request, success="Нормы обновлены.")


@app.post("/admin/groups/add", response_class=HTMLResponse)
async def admin_groups_add(request: Request, name: str = Form(...)):
    if not isAdminAuthenticated(request):
        return RedirectResponse(url="/admin", status_code=303)
    normalized = name.strip()
    if not normalized:
        return renderAdminGroups(request, error="Название группы не может быть пустым.")
    config = loadAdminConfig()
    if not isinstance(config, dict):
        config = {}
    groups = normalize_group_list(config.get("product_groups"))
    if normalized in groups:
        return renderAdminGroups(request, error="Такая группа уже существует.")
    groups.append(normalized)
    config["product_groups"] = sorted(groups)
    updateAdminConfig(config)
    return renderAdminGroups(request, success="Группа добавлена.")


@app.post("/admin/groups/delete", response_class=HTMLResponse)
async def admin_groups_delete(request: Request, name: str = Form(...)):
    if not isAdminAuthenticated(request):
        return RedirectResponse(url="/admin", status_code=303)
    normalized = name.strip()
    config = loadAdminConfig()
    if not isinstance(config, dict):
        config = {}
    groups = normalize_group_list(config.get("product_groups"))
    updated = [group for group in groups if group != normalized]
    if len(updated) == len(groups):
        return renderAdminGroups(request, error="Группа не найдена.")
    config["product_groups"] = sorted(updated)
    updateAdminConfig(config)
    return renderAdminGroups(request, success="Группа удалена.")


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
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        # Если таймзона не указана, считаем дату в UTC, чтобы избежать смешения типов.
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


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


def parse_sleep_target(target: object) -> tuple[int, int] | None:
    if not isinstance(target, str):
        return None
    parts = target.split(":")
    if len(parts) != 2:
        return None
    try:
        hours = int(parts[0])
        minutes = int(parts[1])
    except ValueError:
        return None
    if hours < 0 or hours > 23 or minutes < 0 or minutes > 59:
        return None
    return hours, minutes


def has_sleep_logged_today(telegram_user_id: int, today_key: str) -> bool:
    entries = load_sleep_entries(telegram_user_id)
    return any(
        isinstance(entry, dict)
        and entry.get("date") == today_key
        and entry.get("sleep_time")
        for entry in entries
    )


def has_reminder_today(entries: list[dict[str, str]], reminder_type: str, today_key: str) -> bool:
    for entry in entries:
        if entry.get("type") != reminder_type:
            continue
        when_iso = entry.get("when_iso")
        if not when_iso:
            continue
        try:
            when_dt = normalize_iso_datetime(str(when_iso))
        except ValueError:
            continue
        if when_dt.date().isoformat() == today_key:
            return True
    return False


def build_sleep_reminder(
    profile: dict[str, object],
    telegram_user_id: int,
    now: datetime,
) -> dict[str, str] | None:
    reminder_settings = profile.get("reminder_settings") if isinstance(profile, dict) else None
    sleep_settings = (
        reminder_settings.get("sleep") if isinstance(reminder_settings, dict) else None
    )
    if not isinstance(sleep_settings, dict) or not sleep_settings.get("enabled"):
        return None
    admin_config = loadAdminConfig()
    reminder_config = admin_config.get("reminders", {}) if isinstance(admin_config, dict) else {}
    sleep_target_raw = reminder_config.get("sleep_target", "23:30")
    target_time = parse_sleep_target(sleep_target_raw)
    if not target_time:
        return None
    target_hours, target_minutes = target_time
    target_dt = now.replace(hour=target_hours, minute=target_minutes, second=0, microsecond=0)
    threshold = target_dt - timedelta(minutes=30)
    if now < threshold:
        return None
    today_key = now.date().isoformat()
    if has_sleep_logged_today(telegram_user_id, today_key):
        return None
    stored = load_reminder_entries(telegram_user_id)
    if has_reminder_today(stored, "sleep_reminder", today_key):
        return None
    return {
        "type": "sleep_reminder",
        "text": "Пора готовиться ко сну 🌙 Завтра будет легче, если лечь вовремя",
        "suggested_time_iso": now.isoformat(),
    }


def generate_reminders_payload(
    profile: dict[str, object],
    telegram_user_id: int | None = None,
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

    if telegram_user_id is not None:
        sleep_reminder = build_sleep_reminder(profile, telegram_user_id, now)
        if sleep_reminder:
            reminders.append(sleep_reminder)

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
    telegram_user_id: int | None = None,
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
    if not deadline_raw:
        return []
    try:
        deadline = normalize_iso_datetime(str(deadline_raw))
    except ValueError:
        return []

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

    if telegram_user_id is not None:
        sleep_reminder = build_sleep_reminder(profile, telegram_user_id, now)
        if sleep_reminder:
            reminders.append(sleep_reminder)

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


def load_subscription(telegram_user_id: int) -> dict[str, str]:
    data = read_payload("subscriptions", telegram_user_id)
    return data if isinstance(data, dict) else {}


def save_subscription(telegram_user_id: int, payload: dict[str, str]) -> None:
    write_payload("subscriptions", telegram_user_id, payload)


def load_profile(telegram_user_id: int) -> dict[str, object] | None:
    data = read_payload("profiles", telegram_user_id)
    return data if isinstance(data, dict) else None


def save_profile_data(telegram_user_id: int, profile: dict[str, object]) -> None:
    write_payload("profiles", telegram_user_id, profile)


def load_food_diary_entries(telegram_user_id: int) -> list[dict[str, object]]:
    data = read_payload("food_diary_entries", telegram_user_id)
    return data if isinstance(data, list) else []


def save_food_diary_entries(telegram_user_id: int, entries: list[dict[str, object]]) -> None:
    write_payload("food_diary_entries", telegram_user_id, entries)


def load_diary_entries(telegram_user_id: int) -> list[dict[str, object]]:
    data = read_payload("diary_entries", telegram_user_id)
    return data if isinstance(data, list) else []


def save_diary_entries(telegram_user_id: int, entries: list[dict[str, object]]) -> None:
    write_payload("diary_entries", telegram_user_id, entries)


def load_water_entries(telegram_user_id: int) -> list[dict[str, object]]:
    data = read_payload("water_entries", telegram_user_id)
    return data if isinstance(data, list) else []


def save_water_entries(telegram_user_id: int, entries: list[dict[str, object]]) -> None:
    write_payload("water_entries", telegram_user_id, entries)


def load_sleep_entries(telegram_user_id: int) -> list[dict[str, object]]:
    data = read_payload("sleep_entries", telegram_user_id)
    return data if isinstance(data, list) else []


def save_sleep_entries(telegram_user_id: int, entries: list[dict[str, object]]) -> None:
    write_payload("sleep_entries", telegram_user_id, entries)


def load_habit_entries(telegram_user_id: int) -> dict[str, object]:
    data = read_payload("habit_entries", telegram_user_id)
    return data if isinstance(data, dict) else {}


def save_habit_entries(telegram_user_id: int, entries: dict[str, object]) -> None:
    write_payload("habit_entries", telegram_user_id, entries)


def load_reminder_entries(telegram_user_id: int) -> list[dict[str, str]]:
    data = read_payload("reminder_entries", telegram_user_id)
    return data if isinstance(data, list) else []


def save_reminder_entries(telegram_user_id: int, entries: list[dict[str, str]]) -> None:
    write_payload("reminder_entries", telegram_user_id, entries)


def ensure_entry_ids(entries: list[dict[str, object]]) -> list[dict[str, object]]:
    normalized: list[dict[str, object]] = []
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        if not entry.get("id"):
            entry = {**entry, "id": uuid.uuid4().hex}
        normalized.append(entry)
    return normalized


@app.get("/api/subscription/status")
async def subscription_status(telegram_user_id: int):
    stored = load_subscription(telegram_user_id)
    return compute_subscription_status(stored)


@app.get("/api/admin/config")
async def admin_config():
    if IS_PROD and not DEBUG:
        raise HTTPException(status_code=403, detail="Доступ запрещён.")
    return loadAdminConfig()


@app.get("/api/products/search")
async def products_search(q: str):
    query = q.strip()
    if len(query) < 2:
        return {"exact": [], "similar": []}
    results = search_products(query)
    def normalize_item(item: dict[str, object]) -> dict[str, object]:
        return {
            "id": item.get("id"),
            "name": item.get("name"),
            "kcal": item.get("kcal") or 0,
            "protein_g": item.get("protein_g") or 0,
            "fat_g": item.get("fat_g") or 0,
            "carbs_g": item.get("carbs_g") or 0,
            "fiber_g": item.get("fiber_g") or 0,
        }
    return {
        "exact": [normalize_item(item) for item in results["exact"]],
        "similar": [normalize_item(item) for item in results["similar"]],
    }


@app.post("/api/subscription/start_trial")
async def start_trial(payload: SubscriptionRequest):
    stored = load_subscription(payload.telegram_user_id)
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
    subscription_payload = {
        "subscription_status": "trial",
        "subscription_until": trial_until.isoformat(),
        "subscription_started_at": started_at.isoformat(),
        "trial_started_at": started_at.isoformat(),
        "started_at": now.isoformat(),
    }
    save_subscription(payload.telegram_user_id, subscription_payload)
    return compute_subscription_status(subscription_payload)


@app.post("/api/payments/start")
async def start_payment(payload: PaymentRequest):
    if payload.days <= 0:
        raise HTTPException(status_code=400, detail="Срок продления должен быть больше нуля.")

    now = datetime.now(timezone.utc)
    stored = load_subscription(payload.telegram_user_id)
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
    subscription_payload = {
        "subscription_status": "active",
        "subscription_until": new_until.isoformat(),
        "subscription_started_at": stored.get("subscription_started_at"),
        "trial_started_at": stored.get("trial_started_at"),
        "started_at": stored.get("started_at") or now.isoformat(),
    }
    save_subscription(payload.telegram_user_id, subscription_payload)

    return {
        "status": "success",
        "subscription_status": "active",
        "subscription_until": new_until.isoformat(),
        "subscription_started_at": subscription_payload.get("subscription_started_at"),
        "trial_started_at": subscription_payload.get("trial_started_at"),
    }


@app.post("/api/profile")
async def save_profile(payload: ProfileSaveRequest):
    profile = payload.user_profile if isinstance(payload.user_profile, dict) else {}
    save_profile_data(payload.telegram_user_id, profile)
    return {"status": "ok"}


@app.get("/api/profile")
async def get_profile(telegram_user_id: int):
    profile = load_profile(telegram_user_id)
    if not profile:
        return {"status": "not_found"}
    return profile


@app.post("/api/profile/save")
async def save_profile_legacy(payload: ProfileSaveRequest):
    return await save_profile(payload)


@app.get("/api/profile/get")
async def get_profile_legacy(telegram_user_id: int):
    return await get_profile(telegram_user_id)


@app.get("/api/diary")
async def get_diary(telegram_user_id: int):
    entries = load_diary_entries(telegram_user_id)
    if not entries:
        return {"status": "not_found", "entries": []}
    return {"entries": entries}


@app.post("/api/diary")
async def save_diary(payload: DiaryEntriesPayload):
    entries = payload.entries if isinstance(payload.entries, list) else []
    normalized = ensure_entry_ids(entries)
    save_diary_entries(payload.telegram_user_id, normalized)
    return {"status": "ok", "entries": normalized}


@app.delete("/api/diary/{entry_id}")
async def delete_diary_entry(entry_id: str, telegram_user_id: int):
    entries = load_diary_entries(telegram_user_id)
    updated = [entry for entry in entries if entry.get("id") != entry_id]
    save_diary_entries(telegram_user_id, updated)
    return {"status": "ok"}


@app.get("/api/water")
async def get_water_entries(telegram_user_id: int):
    entries = load_water_entries(telegram_user_id)
    if not entries:
        return {"status": "not_found", "entries": []}
    return {"entries": entries}


@app.post("/api/water")
async def save_water_entries_endpoint(payload: WaterEntriesPayload):
    entries = payload.entries if isinstance(payload.entries, list) else []
    normalized = ensure_entry_ids(entries)
    save_water_entries(payload.telegram_user_id, normalized)
    return {"status": "ok", "entries": normalized}


@app.delete("/api/water/{entry_id}")
async def delete_water_entry(entry_id: str, telegram_user_id: int):
    entries = load_water_entries(telegram_user_id)
    updated = [entry for entry in entries if entry.get("id") != entry_id]
    save_water_entries(telegram_user_id, updated)
    return {"status": "ok"}


@app.get("/api/sleep")
async def get_sleep_entries(telegram_user_id: int):
    entries = load_sleep_entries(telegram_user_id)
    if not entries:
        return {"status": "not_found", "entries": []}
    return {"entries": entries}


@app.post("/api/sleep")
async def save_sleep_entries_endpoint(payload: SleepEntriesPayload):
    entries = payload.entries if isinstance(payload.entries, list) else []
    normalized = ensure_entry_ids(entries)
    save_sleep_entries(payload.telegram_user_id, normalized)
    return {"status": "ok", "entries": normalized}


@app.delete("/api/sleep/{entry_id}")
async def delete_sleep_entry(entry_id: str, telegram_user_id: int):
    entries = load_sleep_entries(telegram_user_id)
    updated = [entry for entry in entries if entry.get("id") != entry_id]
    save_sleep_entries(telegram_user_id, updated)
    return {"status": "ok"}


@app.get("/api/habits")
async def get_habits(telegram_user_id: int):
    habits = load_habit_entries(telegram_user_id)
    if not habits:
        return {"status": "not_found", "habits": {}}
    return {"habits": habits}


@app.post("/api/habits")
async def save_habits(payload: HabitEntriesPayload):
    habits = payload.habits if isinstance(payload.habits, dict) else {}
    save_habit_entries(payload.telegram_user_id, habits)
    return {"status": "ok"}


@app.get("/api/diary/get")
async def get_diary_legacy(telegram_user_id: int):
    return await get_diary(telegram_user_id)


@app.post("/api/diary/save")
async def save_diary_legacy(payload: DiaryEntriesPayload):
    return await save_diary(payload)


@app.get("/api/habits/get")
async def get_habits_legacy(telegram_user_id: int):
    return await get_habits(telegram_user_id)


@app.post("/api/habits/save")
async def save_habits_legacy(payload: HabitEntriesPayload):
    return await save_habits(payload)


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
    stored = load_reminder_entries(payload.telegram_user_id)
    stored.append({"type": payload.type, "when_iso": payload.when_iso})
    save_reminder_entries(payload.telegram_user_id, stored)
    return reminder_scheduler.schedule(
        ReminderPayload(
            telegram_user_id=payload.telegram_user_id,
            type=payload.type,
            when_iso=payload.when_iso,
        )
    )


@app.get("/api/reminders/list")
async def list_reminders(telegram_user_id: int):
    stored = load_reminder_entries(telegram_user_id)
    if stored:
        return stored
    return reminder_scheduler.list_for_user(telegram_user_id)


@app.post("/api/reminders/generate")
async def generate_reminders(payload: ReminderGenerateRequest):
    profile = payload.user_profile if isinstance(payload.user_profile, dict) else {}
    reminders = generate_reminders_payload(profile, payload.telegram_user_id)
    return {"reminders": reminders}


@app.post("/api/reminders/auto-generate")
async def auto_generate_reminders(payload: ReminderAutoGenerateRequest):
    profile = payload.user_profile if isinstance(payload.user_profile, dict) else {}
    weekly_review = payload.weekly_review if isinstance(payload.weekly_review, dict) else {}
    try:
        reminders = generate_auto_reminders_payload(
            profile,
            weekly_review,
            payload.telegram_user_id,
        )
    except Exception as exc:
        logger.warning("Ошибка при генерации авто-напоминаний: %s", exc, exc_info=True)
        return {"reminders": []}
    return {"reminders": reminders}


@app.post("/api/food-diary/add")
async def add_food_diary_entry(entry: FoodDiaryEntry):
    entries = load_food_diary_entries(entry.telegram_user_id)
    entries.append(entry.model_dump())
    save_food_diary_entries(entry.telegram_user_id, entries)
    return {"status": "saved"}


@app.get("/api/food-diary/list")
async def list_food_diary_entries(telegram_user_id: int):
    return load_food_diary_entries(telegram_user_id)


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

    unique_days = {
        entry.get("date")
        for entry in entries
        if isinstance(entry, dict) and entry.get("date")
    }
    aggregates = buildFoodDiaryAggregates(entries, profile)
    logger.info(
        "Запрос анализа дневника: записей=%s, дней=%s, AI_ENABLED=%s",
        len(entries),
        len(unique_days),
        AI_ENABLED,
    )
    logger.debug(
        "Профиль для анализа дневника: ключи=%s",
        sorted(profile.keys()),
    )
    logger.debug("Агрегаты дневника для анализа: %s", aggregates)

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
        logger.info("Отправка запроса в YandexGPT для анализа дневника.")
        text = generate_yandex_recommendation(
            {
                "food_diary_aggregates": aggregates,
                **profile,
            },
            api_key=YANDEX_GPT_API_KEY,
            folder_id=YANDEX_GPT_FOLDER_ID,
        )
        logger.info("Ответ YandexGPT для анализа дневника получен.")
    except (requests.RequestException, ValueError) as exc:
        logger.warning("Ошибка запроса YandexGPT при анализе дневника: %s", exc, exc_info=True)
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
