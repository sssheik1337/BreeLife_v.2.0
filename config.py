import os

from dotenv import load_dotenv

load_dotenv()


APP_NAME = os.getenv("APP_NAME", "BreeLife")
APP_ENV = os.getenv("APP_ENV", "development")
APP_HOST = os.getenv("APP_HOST", "127.0.0.1")
APP_PORT = int(os.getenv("APP_PORT", "8000"))
DEBUG = os.getenv("DEBUG", "false").lower() in {"1", "true", "yes"}
AI_ENABLED = os.getenv("AI_ENABLED", "false").lower() in {"1", "true", "yes"}
REMINDERS_ENABLED = os.getenv("REMINDERS_ENABLED", "false").lower() in {"1", "true", "yes"}

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_WEBHOOK_URL = os.getenv("TELEGRAM_WEBHOOK_URL", "")
TELEGRAM_WEBAPP_URL = os.getenv("TELEGRAM_WEBAPP_URL", "")

PAYMENT_PROVIDER = os.getenv("PAYMENT_PROVIDER", "")
PAYMENT_PUBLIC_KEY = os.getenv("PAYMENT_PUBLIC_KEY", "")
PAYMENT_SECRET_KEY = os.getenv("PAYMENT_SECRET_KEY", "")

YANDEX_GPT_API_KEY = os.getenv("YANDEX_GPT_API_KEY", "")
YANDEX_GPT_FOLDER_ID = os.getenv("YANDEX_GPT_FOLDER_ID", "")

# reserved for future use
