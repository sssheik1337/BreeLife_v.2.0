import logging
from datetime import datetime, timedelta, timezone

from fastapi.templating import Jinja2Templates

from config import APP_ENV, APP_NAME, BASE_DIR, IS_DEV
from services.storage_db import (
    load_admin_config_kv,
    load_plans_config_kv,
    save_admin_config_kv,
    save_plans_config_kv,
)

logger = logging.getLogger(__name__)

templates = Jinja2Templates(directory="templates")
templates.env.globals["APP_NAME"] = APP_NAME
if IS_DEV:
    templates.env.globals["APP_ENV"] = APP_ENV

STATIC_DIR = (BASE_DIR / "static").resolve()


def static_mtime(relative_path: str) -> int:
    """Cache-busting helper for templates: returns mtime for /static assets."""
    if not isinstance(relative_path, str):
        return 0
    candidate = Path(relative_path)
    if candidate.is_absolute() or ".." in candidate.parts:
        return 0
    try:
        full_path = (STATIC_DIR / candidate).resolve()
    except OSError:
        return 0
    if full_path != STATIC_DIR and STATIC_DIR not in full_path.parents:
        return 0
    try:
        return int(full_path.stat().st_mtime)
    except OSError:
        return 0


templates.env.globals["static_mtime"] = static_mtime

ADMIN_SESSION_COOKIE = "admin_session"
TELEGRAM_SESSION_COOKIE = "telegram_session"
ADMIN_SESSION_TTL = timedelta(hours=12)
TELEGRAM_SESSION_TTL = timedelta(hours=12)
ADMIN_SESSIONS: dict[str, datetime] = {}


def load_admin_config() -> dict[str, object]:
    """Загрузить админ-настройки из базы данных."""
    return load_admin_config_kv()


def update_admin_config(data: dict[str, object]) -> None:
    """Сохранить админ-настройки в базе данных."""
    save_admin_config_kv(data)


def load_plans_config() -> list[dict[str, object]]:
    """Загрузить список тарифов из базы данных."""
    return load_plans_config_kv()


def update_plans_config(plans: list[dict[str, object]]) -> None:
    """Сохранить список тарифов в базе данных."""
    save_plans_config_kv(plans)


def reset_admin_session(token: str | None) -> None:
    if not token:
        return
    ADMIN_SESSIONS[token] = datetime.now(timezone.utc) + ADMIN_SESSION_TTL
