from __future__ import annotations

import argparse
import logging
import math
import sqlite3
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from config import DB_PATH, WAKE_WATER_DELAY_MINUTES, WATER_REMINDER_INTERVAL_MINUTES
from services.diary_queries import get_water_and_wake_snapshot
from services.reminders import compute_next_run_at_utc
from services.storage_db import init_db, read_payload
from services.telegram_deeplinks import resolve_reminder_cta
from services.targets import calculate_water_target_l

LOGGER = logging.getLogger(__name__)

DEFAULT_BATCH_LIMIT = 100
MIN_BATCH_LIMIT = 50
MAX_BATCH_LIMIT = 200

AUTH_FAILURE_CODES = {401, 403}
MAX_AUTH_FAILURES = 3
AUTH_RETRY_HOURS = 24
TRANSIENT_RETRY_MINUTES = 15
WATER_WAKE_WINDOW_END_HOUR = 23
WATER_WAKE_WINDOW_END_MINUTE = 0

MESSAGE_BY_TYPE: dict[str, str] = {
    "water": "Пора добавить воды.",
    "sleep_reminder": "Время готовиться ко сну.",
    "sleep_morning_log": "Доброе утро. Во сколько вы сегодня проснулись и во сколько легли?",
    "activity": "Небольшая активность сейчас пойдет на пользу.",
}

SELECT_DUE_SQL = """
SELECT
    r.id,
    r.telegram_user_id,
    r.type,
    r.time_local,
    r.frequency,
    r.timezone AS reminder_timezone,
    r.next_run_at_utc,
    r.fail_count,
    u.tz_name AS user_tz_name,
    u.tz_offset_minutes
FROM reminders r
LEFT JOIN user_settings u ON u.telegram_user_id = r.telegram_user_id
WHERE r.enabled = 1
  AND r.next_run_at_utc IS NOT NULL
  AND r.next_run_at_utc <= ?
  AND COALESCE(u.write_access_allowed, 0) = 1
ORDER BY r.next_run_at_utc ASC
LIMIT ?
"""


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _clamp_batch_limit(value: int) -> int:
    if value < MIN_BATCH_LIMIT:
        return MIN_BATCH_LIMIT
    if value > MAX_BATCH_LIMIT:
        return MAX_BATCH_LIMIT
    return value


def _parse_optional_int(value: object) -> int | None:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    if isinstance(value, str):
        stripped = value.strip()
        if not stripped:
            return None
        try:
            return int(float(stripped))
        except ValueError:
            return None
    return None


def _normalize_timezone_name(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    candidate = value.strip()
    if not candidate:
        return None
    try:
        ZoneInfo(candidate)
        return candidate
    except ZoneInfoNotFoundError:
        return None


def _resolve_timezone_context(row: sqlite3.Row) -> tuple[str | None, int | None]:
    reminder_timezone = _normalize_timezone_name(row["reminder_timezone"])
    user_timezone = _normalize_timezone_name(row["user_tz_name"])
    timezone_name = reminder_timezone or user_timezone
    tz_offset_minutes = _parse_optional_int(row["tz_offset_minutes"])
    return timezone_name, tz_offset_minutes


def _resolve_local_date(now_utc: datetime, timezone_name: str | None, tz_offset_minutes: int | None) -> date:
    if timezone_name:
        try:
            return now_utc.astimezone(ZoneInfo(timezone_name)).date()
        except ZoneInfoNotFoundError:
            pass
    offset_minutes = tz_offset_minutes if isinstance(tz_offset_minutes, int) else 0
    return (now_utc - timedelta(minutes=offset_minutes)).date()


def _resolve_local_now(now_utc: datetime, timezone_name: str | None, tz_offset_minutes: int | None) -> datetime:
    if timezone_name:
        try:
            return now_utc.astimezone(ZoneInfo(timezone_name))
        except ZoneInfoNotFoundError:
            pass
    offset_minutes = tz_offset_minutes if isinstance(tz_offset_minutes, int) else 0
    return (now_utc - timedelta(minutes=offset_minutes)).replace(tzinfo=None)


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


def _parse_time_parts(time_local: str) -> tuple[int, int]:
    hours_str, minutes_str = time_local.split(":", maxsplit=1)
    return int(hours_str), int(minutes_str)


def _build_local_datetime(
    local_date: date,
    hours: int,
    minutes: int,
    timezone_name: str | None,
) -> datetime:
    if timezone_name:
        try:
            return datetime(
                local_date.year,
                local_date.month,
                local_date.day,
                hours,
                minutes,
                tzinfo=ZoneInfo(timezone_name),
            )
        except ZoneInfoNotFoundError:
            pass
    return datetime(local_date.year, local_date.month, local_date.day, hours, minutes)


def _local_to_utc(local_dt: datetime, timezone_name: str | None, tz_offset_minutes: int | None) -> datetime:
    if timezone_name and local_dt.tzinfo is not None:
        return local_dt.astimezone(timezone.utc)
    offset_minutes = tz_offset_minutes if isinstance(tz_offset_minutes, int) else 0
    return (local_dt + timedelta(minutes=offset_minutes)).replace(tzinfo=timezone.utc)


def _is_weekday_allowed(local_date: date, frequency: str) -> bool:
    if str(frequency).strip().lower() != "weekdays":
        return True
    return local_date.weekday() < 5


def _next_allowed_date(local_date: date, frequency: str) -> date:
    candidate = local_date
    if _is_weekday_allowed(candidate, frequency):
        return candidate
    while candidate.weekday() >= 5:
        candidate = candidate + timedelta(days=1)
    return candidate


def _normalize_profile_for_targets(raw_profile: object) -> dict[str, object]:
    if not isinstance(raw_profile, dict):
        return {}
    profile = dict(raw_profile)
    nested_profile = profile.get("user_profile")
    if isinstance(nested_profile, dict):
        profile = {**profile, **nested_profile}
    if profile.get("weight_kg") is None and profile.get("currentWeight") is not None:
        profile["weight_kg"] = profile.get("currentWeight")
    if profile.get("activity_factor") is None and profile.get("activityLevel") is not None:
        profile["activity_factor"] = profile.get("activityLevel")
    if profile.get("goal") is None and profile.get("goalType") is not None:
        profile["goal"] = profile.get("goalType")
    return profile


def _load_water_target_l(telegram_user_id: int) -> float | None:
    profile = _normalize_profile_for_targets(read_payload("profiles", telegram_user_id))
    target = calculate_water_target_l(profile)
    if target is None:
        return None
    target_value = float(target)
    if not math.isfinite(target_value) or target_value <= 0:
        return None
    return target_value


def _compute_first_water_check_local(
    local_date: date,
    wake_time_local: str | None,
    fallback_time_local: str,
    timezone_name: str | None,
) -> datetime | None:
    wake_time_validated = _validate_time_local(wake_time_local)
    if wake_time_validated:
        wake_hours, wake_minutes = _parse_time_parts(wake_time_validated)
        wake_local = _build_local_datetime(
            local_date=local_date,
            hours=wake_hours,
            minutes=wake_minutes,
            timezone_name=timezone_name,
        )
        return wake_local + timedelta(minutes=WAKE_WATER_DELAY_MINUTES)

    fallback_validated = _validate_time_local(fallback_time_local)
    if fallback_validated is None:
        return None
    fallback_hours, fallback_minutes = _parse_time_parts(fallback_validated)
    return _build_local_datetime(
        local_date=local_date,
        hours=fallback_hours,
        minutes=fallback_minutes,
        timezone_name=timezone_name,
    )


def _compute_next_water_morning_run_utc(
    now_utc: datetime,
    local_today: date,
    wake_time_today: str | None,
    fallback_time_local: str,
    frequency: str,
    timezone_name: str | None,
    tz_offset_minutes: int | None,
) -> str | None:
    next_date = _next_allowed_date(local_today + timedelta(days=1), frequency)
    local_candidate = _compute_first_water_check_local(
        local_date=next_date,
        wake_time_local=wake_time_today,
        fallback_time_local=fallback_time_local,
        timezone_name=timezone_name,
    )
    if local_candidate is None:
        return compute_next_run_at_utc(
            time_local=str(fallback_time_local),
            frequency=str(frequency),
            timezone_name=timezone_name,
            tz_offset_minutes=tz_offset_minutes,
            now_utc=now_utc,
        )
    return _local_to_utc(local_candidate, timezone_name, tz_offset_minutes).isoformat()


def _compute_next_water_after_send_utc(
    now_utc: datetime,
    local_now: datetime,
    local_today: date,
    wake_time_today: str | None,
    fallback_time_local: str,
    frequency: str,
    timezone_name: str | None,
    tz_offset_minutes: int | None,
) -> str | None:
    wake_end_local = _build_local_datetime(
        local_date=local_today,
        hours=WATER_WAKE_WINDOW_END_HOUR,
        minutes=WATER_WAKE_WINDOW_END_MINUTE,
        timezone_name=timezone_name,
    )
    next_check_local = local_now + timedelta(minutes=WATER_REMINDER_INTERVAL_MINUTES)
    if next_check_local.date() == local_today and next_check_local < wake_end_local:
        return _local_to_utc(next_check_local, timezone_name, tz_offset_minutes).isoformat()
    return _compute_next_water_morning_run_utc(
        now_utc=now_utc,
        local_today=local_today,
        wake_time_today=wake_time_today,
        fallback_time_local=fallback_time_local,
        frequency=frequency,
        timezone_name=timezone_name,
        tz_offset_minutes=tz_offset_minutes,
    )


def _build_reminder_text(reminder_type: str) -> str:
    normalized_type = str(reminder_type or "").strip().lower()
    return MESSAGE_BY_TYPE.get(normalized_type, "Напоминание от BreeLife.")


def _send_reminder_message(
    telegram_user_id: int,
    text: str,
    button_text: str | None,
    webapp_url: str | None,
) -> dict[str, object]:
    try:
        from services.telegram_notify import send_reminder
    except Exception as exc:
        return {"ok": False, "error": f"NOTIFIER_IMPORT_ERROR: {exc}"}

    return send_reminder(
        chat_id=str(telegram_user_id),
        text=text,
        button_text=button_text,
        webapp_url=webapp_url,
    )

def _is_auth_failure(response: dict[str, object]) -> bool:
    error_code = _parse_optional_int(response.get("error_code"))
    if error_code in AUTH_FAILURE_CODES:
        return True

    error_text = str(response.get("error") or "").lower()
    if "401" in error_text or "403" in error_text:
        return True
    if "bot was blocked" in error_text or "user is deactivated" in error_text:
        return True
    return False


def _format_error(response: dict[str, object]) -> str:
    code = _parse_optional_int(response.get("error_code"))
    text = str(response.get("error") or "UNKNOWN_SEND_ERROR").strip()
    if code is None:
        return text[:500]
    return f"{code}: {text}"[:500]


def _compute_retry_next_run_at_utc(now_utc: datetime, auth_failure: bool) -> str:
    if auth_failure:
        return (now_utc + timedelta(hours=AUTH_RETRY_HOURS)).isoformat()
    return (now_utc + timedelta(minutes=TRANSIENT_RETRY_MINUTES)).isoformat()


def _mark_success(
    connection: sqlite3.Connection,
    row: sqlite3.Row,
    now_iso: str,
    next_run_at_utc: str | None,
) -> None:
    connection.execute(
        """
        UPDATE reminders
        SET
            last_sent_at_utc = ?,
            next_run_at_utc = ?,
            fail_count = 0,
            last_error = NULL,
            updated_at = ?
        WHERE id = ?
        """,
        (now_iso, next_run_at_utc, now_iso, row["id"]),
    )


def _mark_failure(
    connection: sqlite3.Connection,
    row: sqlite3.Row,
    now_iso: str,
    fail_count: int,
    last_error: str,
    enabled: bool,
    next_run_at_utc: str | None,
) -> None:
    connection.execute(
        """
        UPDATE reminders
        SET
            enabled = ?,
            fail_count = ?,
            last_error = ?,
            next_run_at_utc = ?,
            updated_at = ?
        WHERE id = ?
        """,
        (1 if enabled else 0, fail_count, last_error, next_run_at_utc, now_iso, row["id"]),
    )


def _mark_rescheduled(
    connection: sqlite3.Connection,
    row: sqlite3.Row,
    now_iso: str,
    next_run_at_utc: str | None,
) -> None:
    connection.execute(
        """
        UPDATE reminders
        SET
            next_run_at_utc = ?,
            fail_count = 0,
            last_error = NULL,
            updated_at = ?
        WHERE id = ?
        """,
        (next_run_at_utc, now_iso, row["id"]),
    )


def _process_water_due_row(
    connection: sqlite3.Connection,
    row: sqlite3.Row,
    now_utc: datetime,
    timezone_name: str | None,
    tz_offset_minutes: int | None,
) -> str:
    now_iso = now_utc.isoformat()
    fallback_time_local = _validate_time_local(row["time_local"]) or "10:00"
    frequency = str(row["frequency"] or "daily")
    local_now = _resolve_local_now(now_utc, timezone_name, tz_offset_minutes)
    local_today = local_now.date()
    local_today_key = local_today.isoformat()

    water_actual_l, wake_time_today = get_water_and_wake_snapshot(
        int(row["telegram_user_id"]),
        local_today_key,
    )
    first_check_local = _compute_first_water_check_local(
        local_date=local_today,
        wake_time_local=wake_time_today,
        fallback_time_local=fallback_time_local,
        timezone_name=timezone_name,
    )
    if first_check_local is not None and local_now < first_check_local:
        _mark_rescheduled(
            connection=connection,
            row=row,
            now_iso=now_iso,
            next_run_at_utc=_local_to_utc(first_check_local, timezone_name, tz_offset_minutes).isoformat(),
        )
        return "skipped"

    wake_end_local = _build_local_datetime(
        local_date=local_today,
        hours=WATER_WAKE_WINDOW_END_HOUR,
        minutes=WATER_WAKE_WINDOW_END_MINUTE,
        timezone_name=timezone_name,
    )
    if local_now >= wake_end_local:
        next_run_at_utc = _compute_next_water_morning_run_utc(
            now_utc=now_utc,
            local_today=local_today,
            wake_time_today=wake_time_today,
            fallback_time_local=fallback_time_local,
            frequency=frequency,
            timezone_name=timezone_name,
            tz_offset_minutes=tz_offset_minutes,
        )
        if not next_run_at_utc:
            _mark_failure(
                connection=connection,
                row=row,
                now_iso=now_iso,
                fail_count=int(row["fail_count"] or 0) + 1,
                last_error="WATER_NEXT_RUN_COMPUTE_FAILED",
                enabled=False,
                next_run_at_utc=None,
            )
            return "failed"
        _mark_rescheduled(connection=connection, row=row, now_iso=now_iso, next_run_at_utc=next_run_at_utc)
        return "skipped"

    water_target_l = _load_water_target_l(int(row["telegram_user_id"]))
    if water_target_l is not None and water_actual_l >= water_target_l:
        next_run_at_utc = _compute_next_water_morning_run_utc(
            now_utc=now_utc,
            local_today=local_today,
            wake_time_today=wake_time_today,
            fallback_time_local=fallback_time_local,
            frequency=frequency,
            timezone_name=timezone_name,
            tz_offset_minutes=tz_offset_minutes,
        )
        if not next_run_at_utc:
            _mark_failure(
                connection=connection,
                row=row,
                now_iso=now_iso,
                fail_count=int(row["fail_count"] or 0) + 1,
                last_error="WATER_NEXT_RUN_COMPUTE_FAILED",
                enabled=False,
                next_run_at_utc=None,
            )
            return "failed"
        _mark_rescheduled(connection=connection, row=row, now_iso=now_iso, next_run_at_utc=next_run_at_utc)
        return "skipped"

    reminder_type = str(row["type"])
    cta = resolve_reminder_cta(reminder_type=reminder_type, target_date=local_today)
    reminder_text = _build_reminder_text(reminder_type)
    send_response = _send_reminder_message(
        telegram_user_id=int(row["telegram_user_id"]),
        text=reminder_text,
        button_text=cta["button_text"],
        webapp_url=cta["webapp_url"],
    )
    if send_response.get("ok") is True:
        next_run_at_utc = _compute_next_water_after_send_utc(
            now_utc=now_utc,
            local_now=local_now,
            local_today=local_today,
            wake_time_today=wake_time_today,
            fallback_time_local=fallback_time_local,
            frequency=frequency,
            timezone_name=timezone_name,
            tz_offset_minutes=tz_offset_minutes,
        )
        if not next_run_at_utc:
            _mark_failure(
                connection=connection,
                row=row,
                now_iso=now_iso,
                fail_count=int(row["fail_count"] or 0) + 1,
                last_error="WATER_NEXT_RUN_COMPUTE_FAILED",
                enabled=False,
                next_run_at_utc=None,
            )
            return "failed"
        _mark_success(connection=connection, row=row, now_iso=now_iso, next_run_at_utc=next_run_at_utc)
        return "sent"

    next_fail_count = int(row["fail_count"] or 0) + 1
    auth_failure = _is_auth_failure(send_response)
    disable_reminder = auth_failure and next_fail_count >= MAX_AUTH_FAILURES
    next_run_at_utc = None if disable_reminder else _compute_retry_next_run_at_utc(now_utc, auth_failure=auth_failure)
    _mark_failure(
        connection=connection,
        row=row,
        now_iso=now_iso,
        fail_count=next_fail_count,
        last_error=_format_error(send_response),
        enabled=not disable_reminder,
        next_run_at_utc=next_run_at_utc,
    )
    return "disabled" if disable_reminder else "failed"


def _process_due_row(connection: sqlite3.Connection, row: sqlite3.Row, now_utc: datetime) -> str:
    timezone_name, tz_offset_minutes = _resolve_timezone_context(row)
    reminder_type = str(row["type"])
    if reminder_type == "water":
        return _process_water_due_row(
            connection=connection,
            row=row,
            now_utc=now_utc,
            timezone_name=timezone_name,
            tz_offset_minutes=tz_offset_minutes,
        )
    local_date = _resolve_local_date(now_utc, timezone_name, tz_offset_minutes)
    cta = resolve_reminder_cta(reminder_type=reminder_type, target_date=local_date)
    reminder_text = _build_reminder_text(reminder_type)
    send_response = _send_reminder_message(
        telegram_user_id=int(row["telegram_user_id"]),
        text=reminder_text,
        button_text=cta["button_text"],
        webapp_url=cta["webapp_url"],
    )

    now_iso = now_utc.isoformat()
    if send_response.get("ok") is True:
        next_run_at_utc = compute_next_run_at_utc(
            time_local=str(row["time_local"]),
            frequency=str(row["frequency"]),
            timezone_name=timezone_name,
            tz_offset_minutes=tz_offset_minutes,
            now_utc=now_utc,
        )
        if not next_run_at_utc:
            _mark_failure(
                connection=connection,
                row=row,
                now_iso=now_iso,
                fail_count=int(row["fail_count"] or 0) + 1,
                last_error="NEXT_RUN_COMPUTE_FAILED",
                enabled=False,
                next_run_at_utc=None,
            )
            return "failed"
        _mark_success(connection=connection, row=row, now_iso=now_iso, next_run_at_utc=next_run_at_utc)
        return "sent"

    next_fail_count = int(row["fail_count"] or 0) + 1
    auth_failure = _is_auth_failure(send_response)
    disable_reminder = auth_failure and next_fail_count >= MAX_AUTH_FAILURES
    next_run_at_utc = None if disable_reminder else _compute_retry_next_run_at_utc(now_utc, auth_failure=auth_failure)

    _mark_failure(
        connection=connection,
        row=row,
        now_iso=now_iso,
        fail_count=next_fail_count,
        last_error=_format_error(send_response),
        enabled=not disable_reminder,
        next_run_at_utc=next_run_at_utc,
    )
    return "disabled" if disable_reminder else "failed"


def run_once(batch_limit: int = DEFAULT_BATCH_LIMIT) -> dict[str, int]:
    init_db()
    limit = _clamp_batch_limit(int(batch_limit))
    now_utc = _utc_now()

    sent = 0
    failed = 0
    disabled = 0
    skipped = 0
    due_count = 0

    with sqlite3.connect(DB_PATH) as connection:
        connection.row_factory = sqlite3.Row
        due_rows = connection.execute(SELECT_DUE_SQL, (now_utc.isoformat(), limit)).fetchall()
        due_count = len(due_rows)

        for row in due_rows:
            outcome = _process_due_row(connection, row, now_utc)
            if outcome == "sent":
                sent += 1
            elif outcome == "skipped":
                skipped += 1
            elif outcome == "disabled":
                disabled += 1
            else:
                failed += 1

        connection.commit()

    return {
        "checked_due": due_count,
        "sent": sent,
        "skipped": skipped,
        "failed": failed,
        "disabled": disabled,
    }


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Process due reminders and send Telegram notifications.")
    parser.add_argument("--limit", type=int, default=DEFAULT_BATCH_LIMIT, help="Due reminders batch size (50..200).")
    return parser.parse_args()


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    args = _parse_args()
    stats = run_once(batch_limit=args.limit)
    LOGGER.info(
        "reminders_worker done: due=%s sent=%s skipped=%s failed=%s disabled=%s",
        stats["checked_due"],
        stats["sent"],
        stats["skipped"],
        stats["failed"],
        stats["disabled"],
    )


if __name__ == "__main__":
    main()
