import json
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi.templating import Jinja2Templates

from config import APP_ENV, APP_NAME, IS_DEV, PLANS_PATH

logger = logging.getLogger(__name__)

templates = Jinja2Templates(directory="templates")
templates.env.globals["APP_NAME"] = APP_NAME
if IS_DEV:
    templates.env.globals["APP_ENV"] = APP_ENV

ADMIN_CONFIG_PATH = Path("config/admin_config.json")
ADMIN_CONFIG_CACHE: dict[str, object] | None = None
ADMIN_CONFIG_MTIME: float | None = None

PLANS_CONFIG_PATH = Path(PLANS_PATH)
PLANS_CONFIG_CACHE: list[dict[str, object]] | None = None
PLANS_CONFIG_MTIME: float | None = None

ADMIN_SESSION_COOKIE = "admin_session"
TELEGRAM_SESSION_COOKIE = "telegram_session"
ADMIN_SESSION_TTL = timedelta(hours=12)
TELEGRAM_SESSION_TTL = timedelta(hours=12)
ADMIN_SESSIONS: dict[str, datetime] = {}


def load_admin_config() -> dict[str, object]:
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


def update_admin_config(data: dict[str, object]) -> None:
    """Сохранить админ-конфиг в файл."""
    ADMIN_CONFIG_PATH.write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def load_plans_config() -> list[dict[str, object]]:
    """Загрузить список тарифов с кешированием и проверкой изменения файла."""
    global PLANS_CONFIG_CACHE, PLANS_CONFIG_MTIME
    if not PLANS_CONFIG_PATH.exists():
        PLANS_CONFIG_CACHE = []
        PLANS_CONFIG_MTIME = None
        return []
    try:
        mtime = PLANS_CONFIG_PATH.stat().st_mtime
    except OSError:
        return PLANS_CONFIG_CACHE or []
    if PLANS_CONFIG_CACHE is None or PLANS_CONFIG_MTIME != mtime:
        try:
            data = json.loads(PLANS_CONFIG_PATH.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            data = []
        PLANS_CONFIG_CACHE = data if isinstance(data, list) else []
        PLANS_CONFIG_MTIME = mtime
    return PLANS_CONFIG_CACHE or []


def update_plans_config(plans: list[dict[str, object]]) -> None:
    """Сохранить список тарифов в файл."""
    PLANS_CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    PLANS_CONFIG_PATH.write_text(
        json.dumps(plans, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def reset_admin_session(token: str | None) -> None:
    if not token:
        return
    ADMIN_SESSIONS[token] = datetime.now(timezone.utc) + ADMIN_SESSION_TTL
