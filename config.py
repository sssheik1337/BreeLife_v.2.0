import os
from urllib.parse import urlsplit, urlunsplit

from dotenv import load_dotenv

load_dotenv()


APP_NAME = os.getenv("APP_NAME", "BreeLife")
APP_ENV = os.getenv("APP_ENV", "development").lower()
IS_DEV = APP_ENV == "development"
IS_PROD = APP_ENV == "production"
DEV_TELEGRAM_USER_ID = int(os.getenv("DEV_TELEGRAM_USER_ID", "999001"))
APP_HOST = os.getenv("APP_HOST", "127.0.0.1")
APP_PORT = int(os.getenv("APP_PORT", "8000"))
DEBUG = os.getenv("DEBUG", "false").lower() in {"1", "true", "yes"}
AI_ENABLED = os.getenv("AI_ENABLED", "false").lower() in {"1", "true", "yes"}
REMINDERS_ENABLED = os.getenv("REMINDERS_ENABLED", "false").lower() in {"1", "true", "yes"}

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")


def normalize_webapp_url(raw_url: str) -> str:
    if not raw_url:
        return ""
    parsed = urlsplit(raw_url)
    if not parsed.scheme or not parsed.netloc:
        return raw_url
    normalized = parsed._replace(path="/", query="", fragment="")
    return urlunsplit(normalized)


TELEGRAM_WEBAPP_URL = normalize_webapp_url(os.getenv("TELEGRAM_WEBAPP_URL", ""))
PUBLIC_APP_URL = normalize_webapp_url(os.getenv("PUBLIC_APP_URL", TELEGRAM_WEBAPP_URL))
PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", "")

PAYMENT_PROVIDER = os.getenv("PAYMENT_PROVIDER", "")
PAYMENT_PUBLIC_KEY = os.getenv("PAYMENT_PUBLIC_KEY", "")
PAYMENT_SECRET_KEY = os.getenv("PAYMENT_SECRET_KEY", "")

YANDEX_GPT_API_KEY = os.getenv("YANDEX_GPT_API_KEY", "")
YANDEX_GPT_FOLDER_ID = os.getenv("YANDEX_GPT_FOLDER_ID", "")

# Путь к базе данных SQLite (обязателен через переменные окружения).
DB_PATH = os.getenv("DB_PATH")
if not DB_PATH:
    raise RuntimeError("DB_PATH is required. Set it in the environment.")

# Путь к базе данных продуктов.
PRODUCTS_DB_PATH = os.getenv("PRODUCTS_DB_PATH", "static/data/products.db")

# Путь к файлу с тарифами.
PLANS_PATH = os.getenv("PLANS_PATH", "config/plans.json")

# Данные доступа в админку.
ADMIN_LOGIN = os.getenv("ADMIN_LOGIN", "")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "")
