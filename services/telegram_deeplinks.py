from __future__ import annotations

import datetime as dt
import os
from urllib.parse import urlencode, urlsplit, urlunsplit


def _resolve_base_url(explicit_base_url: str | None = None) -> str:
    candidate = (explicit_base_url or "").strip()
    if not candidate:
        candidate = os.getenv("PUBLIC_BASE_URL", "").strip()
    if not candidate:
        candidate = os.getenv("PUBLIC_APP_URL", "").strip()
    if not candidate:
        candidate = os.getenv("TELEGRAM_WEBAPP_URL", "").strip()
    return candidate


def _normalize_base_origin(base_url: str) -> str:
    parsed = urlsplit(base_url)
    if parsed.scheme and parsed.netloc:
        return urlunsplit((parsed.scheme, parsed.netloc, "", "", ""))
    return ""


def _normalize_date_value(target_date: dt.date | str | None) -> str | None:
    if target_date is None:
        return None
    if isinstance(target_date, dt.date):
        return target_date.isoformat()
    value = str(target_date).strip()
    if not value:
        return None
    try:
        return dt.date.fromisoformat(value).isoformat()
    except ValueError:
        return None


def _build_diary_url(query: dict[str, str], base_url: str | None = None) -> str:
    path = "/app/diary"
    query_string = urlencode(query)
    suffix = f"{path}?{query_string}" if query_string else path

    base_candidate = _resolve_base_url(base_url)
    origin = _normalize_base_origin(base_candidate)
    if not origin:
        return suffix
    return f"{origin}{suffix}"


def _build_app_url(path: str, base_url: str | None = None) -> str:
    normalized_path = path if path.startswith("/") else f"/{path}"
    base_candidate = _resolve_base_url(base_url)
    origin = _normalize_base_origin(base_candidate)
    if not origin:
        return normalized_path
    return f"{origin}{normalized_path}"


def build_app_home_url(base_url: str | None = None) -> str:
    return _build_app_url("/app", base_url=base_url)


def build_water_action_url(base_url: str | None = None) -> str:
    return _build_diary_url({"fab": "1", "action": "water"}, base_url=base_url)


def build_bedtime_action_url(
    target_date: dt.date | str | None = None,
    base_url: str | None = None,
) -> str:
    query: dict[str, str] = {"fab": "1", "action": "water"}
    normalized_date = _normalize_date_value(target_date)
    if normalized_date:
        query["date"] = normalized_date
    return _build_diary_url(query, base_url=base_url)


def build_sleep_morning_action_url(base_url: str | None = None) -> str:
    return _build_diary_url({"sleep_morning": "1"}, base_url=base_url)


def build_reminder_action_url(
    reminder_type: str,
    target_date: dt.date | str | None = None,
    base_url: str | None = None,
) -> str | None:
    normalized_type = str(reminder_type or "").strip().lower()
    if normalized_type == "water":
        return build_water_action_url(base_url=base_url)
    if normalized_type == "sleep_morning_log":
        return build_sleep_morning_action_url(base_url=base_url)
    if normalized_type == "activity":
        return build_app_home_url(base_url=base_url)
    return None


def resolve_reminder_cta(
    reminder_type: str,
    target_date: dt.date | str | None = None,
    base_url: str | None = None,
) -> dict[str, str | None]:
    normalized_type = str(reminder_type or "").strip().lower()
    button_by_type: dict[str, str | None] = {
        "water": "Добавить воды",
        "sleep_reminder": None,
        "sleep_morning_log": "Записать сон",
        "activity": "Открыть приложение",
    }
    button_text = button_by_type.get(normalized_type)
    if not button_text:
        return {"button_text": None, "webapp_url": None}
    return {
        "button_text": button_text,
        "webapp_url": build_reminder_action_url(
            reminder_type=normalized_type,
            target_date=target_date,
            base_url=base_url,
        ),
    }
