import os
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent


APP_NAME = os.getenv("APP_NAME", "BreeLife")
APP_ENV = os.getenv("APP_ENV", "development").lower()
IS_DEV = APP_ENV == "development"
IS_PROD = APP_ENV == "production"
DEV_TELEGRAM_USER_ID = int(os.getenv("DEV_TELEGRAM_USER_ID", "999001"))
APP_HOST = os.getenv("APP_HOST", "127.0.0.1")
APP_PORT = int(os.getenv("APP_PORT", "8000"))
DEBUG = os.getenv("DEBUG", "false").lower() in {"1", "true", "yes"}
APP_DEBUG = os.getenv("APP_DEBUG", "false").lower() in {"1", "true", "yes"}
AI_ENABLED = os.getenv("AI_ENABLED", "false").lower() in {"1", "true", "yes"}


def env_flag(name: str, default: bool = False) -> bool:
    return os.getenv(name, "1" if default else "0").lower() in {"1", "true", "yes"}


DEV_AUTH_ENABLED = env_flag("DEV_AUTH_ENABLED", False)

# Напоминания включены всегда; настраиваются только интервалы.
try:
    REMINDERS_WORKER_POLL_SECONDS = max(15, int(os.getenv("REMINDERS_WORKER_POLL_SECONDS", "60")))
except ValueError:
    REMINDERS_WORKER_POLL_SECONDS = 60
try:
    WATER_REMINDER_INTERVAL_MINUTES = max(15, int(os.getenv("WATER_REMINDER_INTERVAL_MINUTES", "90")))
except ValueError:
    WATER_REMINDER_INTERVAL_MINUTES = 90
try:
    WAKE_WATER_DELAY_MINUTES = max(0, int(os.getenv("WAKE_WATER_DELAY_MINUTES", "45")))
except ValueError:
    WAKE_WATER_DELAY_MINUTES = 45

# Версия алгоритма рациона. В проекте используется только актуальная версия (переключателя через env нет).
MEAL_PLAN_ALGO_VERSION = "v2"

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_HIDDEN_ADMIN_COMMAND = (
    os.getenv("TELEGRAM_HIDDEN_ADMIN_COMMAND", "adminbreeva").strip().lstrip("/") or "adminbreeva"
)


def normalize_webapp_url(raw_url: str) -> str:
    if not raw_url:
        return ""
    raw_value = raw_url.strip()
    parsed = urlsplit(raw_value)
    if not parsed.scheme or not parsed.netloc:
        return raw_value

    normalized_path = parsed.path or "/"
    if not normalized_path.startswith("/"):
        normalized_path = f"/{normalized_path}"

    normalized = parsed._replace(path=normalized_path, query="", fragment="")
    return urlunsplit(normalized)

def normalize_origin_url(raw_url: str) -> str:
    if not raw_url:
        return ""
    raw_value = raw_url.strip()
    parsed = urlsplit(raw_value)
    if not parsed.scheme or not parsed.netloc:
        return raw_value.rstrip("/")
    return urlunsplit((parsed.scheme, parsed.netloc, "", "", "")).rstrip("/")


_RAW_TELEGRAM_WEBAPP_URL = os.getenv("TELEGRAM_WEBAPP_URL", "").strip()
_RAW_PUBLIC_APP_URL = os.getenv("PUBLIC_APP_URL", "").strip()
_RAW_PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", "").strip()

# Можно указать адрес приложения только один раз:
# - PUBLIC_APP_URL (рекомендуется) или
# - TELEGRAM_WEBAPP_URL (обратная совместимость) или
# - PUBLIC_BASE_URL (если указать только его, MiniApp откроется по / и попадёт в /app/ через редирект).
PUBLIC_APP_URL = normalize_webapp_url(_RAW_PUBLIC_APP_URL or _RAW_TELEGRAM_WEBAPP_URL or _RAW_PUBLIC_BASE_URL)
TELEGRAM_WEBAPP_URL = normalize_webapp_url(_RAW_TELEGRAM_WEBAPP_URL or PUBLIC_APP_URL)

# PUBLIC_BASE_URL нужен для webhook и ссылок в сообщениях. Если не задан, берём origin из PUBLIC_APP_URL.
PUBLIC_BASE_URL = normalize_origin_url(_RAW_PUBLIC_BASE_URL or PUBLIC_APP_URL)

PAYMENT_PROVIDER = os.getenv("PAYMENT_PROVIDER", "")
PAYMENT_PUBLIC_KEY = os.getenv("PAYMENT_PUBLIC_KEY", "")
PAYMENT_SECRET_KEY = os.getenv("PAYMENT_SECRET_KEY", "")

YANDEX_GPT_API_KEY = os.getenv("YANDEX_GPT_API_KEY", "")
YANDEX_GPT_FOLDER_ID = os.getenv("YANDEX_GPT_FOLDER_ID", "")


def _looks_like_rooted_posix_path(path_value: str) -> bool:
    """
    На Windows строка вида "/data/app.sqlite3" не считается абсолютной через Path(...).is_absolute(),
    но по факту это "путь от корня текущего диска" и нормально резолвится в "C:\\data\\...".
    """
    return isinstance(path_value, str) and path_value.startswith("/") and len(path_value) > 1


def _normalize_db_path(value: str) -> str:
    """
    Нормализовать путь к БД.

    Правила:
    - относительные пути запрещены (чтобы не создавать файлы в корне репозитория);
    - на Windows разрешаем "/data/..." и приводим к "C:\\data\\...";
    - абсолютные Windows/UNC и обычные абсолютные пути оставляем как есть.
    """
    raw = (value or "").strip()
    if not raw:
        return ""

    candidate = Path(raw)
    if candidate.is_absolute():
        return raw

    if os.name == "nt":
        # UNC / rooted path: "\data\file" или "\\server\share\file"
        if raw.startswith("\\"):
            return raw
        # POSIX-rooted path on Windows: "/data/file" -> "C:\data\file"
        if _looks_like_rooted_posix_path(raw):
            drive = Path.cwd().drive or os.getenv("SystemDrive", "C:")
            return str(Path(f"{drive}{raw}"))

    return ""


# Путь к базе данных приложения SQLite (обязателен). Не храните БД внутри репозитория.
DB_PATH = os.getenv("DB_PATH")
if not DB_PATH:
    raise RuntimeError("DB_PATH is required. Set it in the environment.")
DB_PATH = _normalize_db_path(DB_PATH)
if not DB_PATH:
    raise RuntimeError("DB_PATH must be an absolute (or rooted) path.")

# Путь к базе данных продуктов (обязателен). Не храните БД внутри репозитория.
PRODUCTS_DB_PATH = os.getenv("PRODUCTS_DB_PATH")
if not PRODUCTS_DB_PATH:
    raise RuntimeError("PRODUCTS_DB_PATH is required. Set it in the environment.")
PRODUCTS_DB_PATH = _normalize_db_path(PRODUCTS_DB_PATH)
if not PRODUCTS_DB_PATH:
    raise RuntimeError("PRODUCTS_DB_PATH must be an absolute (or rooted) path.")

# Данные доступа в админку.
ADMIN_LOGIN = os.getenv("ADMIN_LOGIN", "")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "")
