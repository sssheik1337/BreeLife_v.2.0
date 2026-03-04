from __future__ import annotations

import math
from datetime import date, datetime

from services.storage_db import read_payload


def _normalize_date_key(value: object) -> str | None:
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if not isinstance(value, str):
        return None
    candidate = value.strip()
    if not candidate:
        return None
    try:
        return date.fromisoformat(candidate[:10]).isoformat()
    except ValueError:
        return None


def _validate_time_local(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    candidate = value.strip()
    if len(candidate) != 5 or ":" not in candidate:
        return None
    hours_str, minutes_str = candidate.split(":", maxsplit=1)
    try:
        hours = int(hours_str)
        minutes = int(minutes_str)
    except ValueError:
        return None
    if not (0 <= hours <= 23 and 0 <= minutes <= 59):
        return None
    return f"{hours:02d}:{minutes:02d}"


def get_water_and_wake_snapshot(telegram_user_id: int, date_key: str) -> tuple[float, str | None]:
    normalized_key = _normalize_date_key(date_key)
    if not normalized_key:
        return 0.0, None

    payload = read_payload("diary_entries", int(telegram_user_id))
    if not isinstance(payload, list):
        return 0.0, None

    max_water = 0.0
    wake_time: str | None = None
    for entry in payload:
        if not isinstance(entry, dict):
            continue
        if _normalize_date_key(entry.get("date")) != normalized_key:
            continue

        raw_water = entry.get("water_l")
        try:
            water_value = float(raw_water)
        except (TypeError, ValueError):
            water_value = 0.0
        if math.isfinite(water_value) and water_value > max_water:
            max_water = water_value

        if wake_time is None:
            wake_time_candidate = _validate_time_local(entry.get("wake_time"))
            if wake_time_candidate:
                wake_time = wake_time_candidate

    return max_water, wake_time


def get_total_water_l(telegram_user_id: int, date_key: str) -> float:
    total_water, _ = get_water_and_wake_snapshot(telegram_user_id, date_key)
    return total_water


def get_wake_time(telegram_user_id: int, date_key: str) -> str | None:
    _, wake_time = get_water_and_wake_snapshot(telegram_user_id, date_key)
    return wake_time

