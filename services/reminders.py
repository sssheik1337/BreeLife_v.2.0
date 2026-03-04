from __future__ import annotations

import sqlite3
import uuid
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from config import DB_PATH, WAKE_WATER_DELAY_MINUTES, WATER_REMINDER_INTERVAL_MINUTES
from services.storage_db import read_payload

ALLOWED_TYPES = {"water", "sleep_reminder", "sleep_morning_log", "activity"}
ALLOWED_FREQUENCIES = {"daily", "weekdays"}
LEGACY_TYPE_MAP = {"sleep": "sleep_reminder"}


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _normalize_bool(value: object, default: bool = True) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"1", "true", "yes", "on"}:
            return True
        if normalized in {"0", "false", "no", "off"}:
            return False
    return default


def _parse_offset_minutes(value: object) -> int | None:
    if value is None:
        return None
    if isinstance(value, bool):
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


def _parse_iso_datetime(value: object) -> datetime | None:
    if not isinstance(value, str):
        return None
    candidate = value.strip()
    if not candidate:
        return None
    normalized = candidate.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _normalize_reminder_type(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    normalized = value.strip().lower()
    normalized = LEGACY_TYPE_MAP.get(normalized, normalized)
    if normalized not in ALLOWED_TYPES:
        return None
    return normalized


def _normalize_frequency(value: object) -> str:
    if not isinstance(value, str):
        return "daily"
    normalized = value.strip().lower()
    return normalized if normalized in ALLOWED_FREQUENCIES else "daily"


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


def _parse_time_parts(time_local: str) -> tuple[int, int]:
    hours_str, minutes_str = time_local.split(":", maxsplit=1)
    return int(hours_str), int(minutes_str)


def _bump_local_candidate(candidate_local: datetime, now_local: datetime, frequency: str) -> datetime:
    if frequency == "weekdays":
        while candidate_local.weekday() >= 5:
            candidate_local = candidate_local + timedelta(days=1)
    if candidate_local <= now_local:
        candidate_local = candidate_local + timedelta(days=1)
        if frequency == "weekdays":
            while candidate_local.weekday() >= 5:
                candidate_local = candidate_local + timedelta(days=1)
    return candidate_local


def compute_next_run_at_utc(
    time_local: str,
    frequency: str,
    timezone_name: str | None,
    tz_offset_minutes: int | None,
    now_utc: datetime | None = None,
) -> str | None:
    validated_time = _validate_time_local(time_local)
    if validated_time is None:
        return None
    hours, minutes = _parse_time_parts(validated_time)
    current_utc = now_utc or _utc_now()

    if timezone_name:
        try:
            zone = ZoneInfo(timezone_name)
            now_local = current_utc.astimezone(zone)
            candidate_local = now_local.replace(hour=hours, minute=minutes, second=0, microsecond=0)
            candidate_local = _bump_local_candidate(candidate_local, now_local, frequency)
            return candidate_local.astimezone(timezone.utc).isoformat()
        except ZoneInfoNotFoundError:
            pass

    offset_minutes = tz_offset_minutes if isinstance(tz_offset_minutes, int) else 0
    now_local = current_utc - timedelta(minutes=offset_minutes)
    candidate_local = now_local.replace(hour=hours, minute=minutes, second=0, microsecond=0)
    candidate_local = _bump_local_candidate(candidate_local, now_local, frequency)
    candidate_utc = candidate_local + timedelta(minutes=offset_minutes)
    return candidate_utc.replace(tzinfo=timezone.utc).isoformat()


class ReminderScheduler:
    def __init__(self, telegram_user_id: int, profile: dict[str, object] | None = None):
        self.telegram_user_id = int(telegram_user_id)
        self.profile = profile or {}

    def save_user_timezone(self, tz_name: object = None, tz_offset_minutes: object = None) -> dict[str, object]:
        normalized_name = None
        if tz_name is not None:
            if not isinstance(tz_name, str):
                return {"status": "invalid_payload"}
            candidate = tz_name.strip()
            if candidate:
                try:
                    ZoneInfo(candidate)
                    normalized_name = candidate
                except ZoneInfoNotFoundError:
                    return {"status": "invalid_payload"}

        normalized_offset = _parse_offset_minutes(tz_offset_minutes)
        if tz_offset_minutes is not None and normalized_offset is None:
            return {"status": "invalid_payload"}

        now_iso = _utc_now().isoformat()
        with sqlite3.connect(DB_PATH) as connection:
            connection.execute(
                """
                INSERT INTO user_settings (telegram_user_id, tz_name, tz_offset_minutes, updated_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(telegram_user_id)
                DO UPDATE SET
                    tz_name = excluded.tz_name,
                    tz_offset_minutes = excluded.tz_offset_minutes,
                    updated_at = excluded.updated_at
                """,
                (self.telegram_user_id, normalized_name, normalized_offset, now_iso),
            )
            connection.commit()

        return {
            "status": "saved",
            "tz_name": normalized_name,
            "tz_offset_minutes": normalized_offset,
        }

    def save_notifications_consent(self, allowed: object) -> dict[str, object]:
        if not isinstance(allowed, bool):
            return {"status": "invalid_payload"}

        now_iso = _utc_now().isoformat()
        with sqlite3.connect(DB_PATH) as connection:
            connection.execute(
                """
                INSERT INTO user_settings (
                    telegram_user_id,
                    tz_name,
                    tz_offset_minutes,
                    write_access_allowed,
                    write_access_updated_at,
                    updated_at
                )
                VALUES (?, NULL, NULL, ?, ?, ?)
                ON CONFLICT(telegram_user_id)
                DO UPDATE SET
                    write_access_allowed = excluded.write_access_allowed,
                    write_access_updated_at = excluded.write_access_updated_at,
                    updated_at = excluded.updated_at
                """,
                (self.telegram_user_id, 1 if allowed else 0, now_iso, now_iso),
            )
            connection.commit()

        return {
            "status": "saved",
            "allowed": allowed,
            "updated_at": now_iso,
        }

    def get_notifications_consent(self) -> dict[str, object]:
        with sqlite3.connect(DB_PATH) as connection:
            connection.row_factory = sqlite3.Row
            row = connection.execute(
                """
                SELECT write_access_allowed, write_access_updated_at
                FROM user_settings
                WHERE telegram_user_id = ?
                """,
                (self.telegram_user_id,),
            ).fetchone()
        if not row:
            return {"allowed": None, "updated_at": None}

        raw_allowed = row["write_access_allowed"]
        allowed = None if raw_allowed is None else bool(raw_allowed)
        updated_at = row["write_access_updated_at"]
        return {
            "allowed": allowed,
            "updated_at": updated_at if isinstance(updated_at, str) else None,
        }

    def schedule(self, payload: dict[str, object]) -> dict[str, object]:
        if not isinstance(payload, dict):
            return {"status": "invalid_payload"}

        reminder_type = _normalize_reminder_type(payload.get("type"))
        if reminder_type is None:
            return {"status": "invalid_payload"}

        frequency = _normalize_frequency(payload.get("frequency"))
        enabled = _normalize_bool(payload.get("enabled"), default=True)
        timezone_name, offset_minutes = self._resolve_timezone_context(
            payload.get("timezone"),
            payload.get("tz_offset_minutes"),
        )

        time_local = self._extract_time_local(payload, timezone_name, offset_minutes)
        if time_local is None:
            return {"status": "invalid_payload"}

        if reminder_type == "water":
            next_run_at_utc = self._compute_water_initial_next_run_at_utc(
                time_local=time_local,
                frequency=frequency,
                timezone_name=timezone_name,
                tz_offset_minutes=offset_minutes,
            )
        else:
            next_run_at_utc = self._compute_next_run_at_utc(
                time_local=time_local,
                frequency=frequency,
                timezone_name=timezone_name,
                tz_offset_minutes=offset_minutes,
            )
        if next_run_at_utc is None:
            return {"status": "invalid_payload"}

        now_iso = _utc_now().isoformat()
        reminder_id = self._upsert_reminder(
            reminder_type=reminder_type,
            enabled=enabled,
            time_local=time_local,
            frequency=frequency,
            timezone_name=timezone_name,
            next_run_at_utc=next_run_at_utc,
            now_iso=now_iso,
        )
        reminder = self._load_reminder_by_id(reminder_id)
        if reminder is None:
            return {"status": "invalid_payload"}
        return {"status": "scheduled", "reminder": reminder}

    def list(self) -> list[dict[str, object]]:
        with sqlite3.connect(DB_PATH) as connection:
            connection.row_factory = sqlite3.Row
            rows = connection.execute(
                """
                SELECT
                    id,
                    type,
                    enabled,
                    time_local,
                    frequency,
                    timezone,
                    next_run_at_utc,
                    last_sent_at_utc,
                    fail_count,
                    last_error,
                    created_at,
                    updated_at
                FROM reminders
                WHERE telegram_user_id = ?
                ORDER BY type ASC, created_at ASC
                """,
                (self.telegram_user_id,),
            ).fetchall()
        return [self._serialize_row(row) for row in rows]

    def create(
        self,
        reminder_type: str,
        time_value: str,
        enabled: bool = True,
        frequency: str = "daily",
    ) -> dict[str, object]:
        result = self.schedule(
            {
                "type": reminder_type,
                "time_local": time_value,
                "enabled": enabled,
                "frequency": frequency,
            }
        )
        if result.get("status") != "scheduled":
            return {"status": "invalid_payload"}
        return result.get("reminder") if isinstance(result.get("reminder"), dict) else {"status": "invalid_payload"}

    def auto_generate(self, reminder_type: str, timezone_offset: int = 0) -> list[dict[str, object]]:
        if reminder_type == "water":
            created = self.create("water", "10:00", True, "daily")
            return [created] if created.get("status") != "invalid_payload" else []
        if reminder_type == "sleep":
            sleep_evening = self.create("sleep_reminder", "22:30", True, "daily")
            sleep_morning = self.create("sleep_morning_log", "08:30", True, "daily")
            return [item for item in [sleep_evening, sleep_morning] if item.get("status") != "invalid_payload"]
        if reminder_type == "activity":
            created = self.create("activity", "18:00", True, "daily")
            return [created] if created.get("status") != "invalid_payload" else []
        return []

    def _resolve_timezone_context(
        self,
        payload_timezone: object,
        payload_offset: object,
    ) -> tuple[str | None, int | None]:
        settings = self._load_user_settings()

        timezone_name = None
        if isinstance(payload_timezone, str) and payload_timezone.strip():
            candidate = payload_timezone.strip()
            try:
                ZoneInfo(candidate)
                timezone_name = candidate
            except ZoneInfoNotFoundError:
                timezone_name = None
        elif isinstance(settings.get("tz_name"), str):
            candidate = str(settings.get("tz_name")).strip()
            if candidate:
                try:
                    ZoneInfo(candidate)
                    timezone_name = candidate
                except ZoneInfoNotFoundError:
                    timezone_name = None

        offset_minutes = _parse_offset_minutes(payload_offset)
        if offset_minutes is None:
            offset_minutes = _parse_offset_minutes(settings.get("tz_offset_minutes"))

        return timezone_name, offset_minutes

    def _extract_time_local(
        self,
        payload: dict[str, object],
        timezone_name: str | None,
        offset_minutes: int | None,
    ) -> str | None:
        direct_time = _validate_time_local(payload.get("time_local"))
        if direct_time is not None:
            return direct_time

        legacy_time = _validate_time_local(payload.get("time"))
        if legacy_time is not None:
            return legacy_time

        when_iso = _parse_iso_datetime(payload.get("when_iso"))
        if when_iso is None:
            return None

        if timezone_name:
            try:
                zone = ZoneInfo(timezone_name)
                local_dt = when_iso.astimezone(zone)
                return f"{local_dt.hour:02d}:{local_dt.minute:02d}"
            except ZoneInfoNotFoundError:
                pass

        if offset_minutes is not None:
            local_dt = when_iso - timedelta(minutes=offset_minutes)
            return f"{local_dt.hour:02d}:{local_dt.minute:02d}"

        return f"{when_iso.hour:02d}:{when_iso.minute:02d}"

    def _compute_next_run_at_utc(
        self,
        time_local: str,
        frequency: str,
        timezone_name: str | None,
        tz_offset_minutes: int | None,
    ) -> str | None:
        return compute_next_run_at_utc(
            time_local=time_local,
            frequency=frequency,
            timezone_name=timezone_name,
            tz_offset_minutes=tz_offset_minutes,
            now_utc=_utc_now(),
        )

    def _load_diary_entries(self) -> list[dict[str, object]]:
        payload = read_payload("diary_entries", self.telegram_user_id)
        if not isinstance(payload, list):
            return []
        return [entry for entry in payload if isinstance(entry, dict)]

    def _extract_wake_time_for_local_date(self, local_date_key: str) -> str | None:
        entries = self._load_diary_entries()
        for entry in entries:
            if _normalize_date_key(entry.get("date")) != local_date_key:
                continue
            wake_time = _validate_time_local(entry.get("wake_time"))
            if wake_time:
                return wake_time
        return None

    def _compute_water_initial_next_run_at_utc(
        self,
        time_local: str,
        frequency: str,
        timezone_name: str | None,
        tz_offset_minutes: int | None,
    ) -> str | None:
        now_utc = _utc_now()
        local_today = (
            now_utc.astimezone(ZoneInfo(timezone_name)).date()
            if timezone_name
            else (now_utc - timedelta(minutes=tz_offset_minutes or 0)).date()
        )
        wake_time = self._extract_wake_time_for_local_date(local_today.isoformat())
        wake_time_validated = _validate_time_local(wake_time)
        if wake_time_validated is None:
            return self._compute_next_run_at_utc(
                time_local=time_local,
                frequency=frequency,
                timezone_name=timezone_name,
                tz_offset_minutes=tz_offset_minutes,
            )

        wake_hours, wake_minutes = _parse_time_parts(wake_time_validated)

        if timezone_name:
            try:
                zone = ZoneInfo(timezone_name)
                now_local = now_utc.astimezone(zone)
                candidate_local = now_local.replace(
                    hour=wake_hours,
                    minute=wake_minutes,
                    second=0,
                    microsecond=0,
                ) + timedelta(minutes=WAKE_WATER_DELAY_MINUTES)
                if candidate_local <= now_local:
                    candidate_local = now_local + timedelta(minutes=WATER_REMINDER_INTERVAL_MINUTES)
                return candidate_local.astimezone(timezone.utc).isoformat()
            except ZoneInfoNotFoundError:
                pass

        offset = tz_offset_minutes if isinstance(tz_offset_minutes, int) else 0
        now_local = (now_utc - timedelta(minutes=offset)).replace(tzinfo=None)
        candidate_local = now_local.replace(
            hour=wake_hours,
            minute=wake_minutes,
            second=0,
            microsecond=0,
        ) + timedelta(minutes=WAKE_WATER_DELAY_MINUTES)
        if candidate_local <= now_local:
            candidate_local = now_local + timedelta(minutes=WATER_REMINDER_INTERVAL_MINUTES)
        candidate_utc = (candidate_local + timedelta(minutes=offset)).replace(tzinfo=timezone.utc)
        return candidate_utc.isoformat()

    def _upsert_reminder(
        self,
        reminder_type: str,
        enabled: bool,
        time_local: str,
        frequency: str,
        timezone_name: str | None,
        next_run_at_utc: str,
        now_iso: str,
    ) -> str:
        with sqlite3.connect(DB_PATH) as connection:
            connection.row_factory = sqlite3.Row
            existing = connection.execute(
                """
                SELECT id
                FROM reminders
                WHERE telegram_user_id = ? AND type = ?
                ORDER BY created_at ASC
                LIMIT 1
                """,
                (self.telegram_user_id, reminder_type),
            ).fetchone()

            if existing:
                reminder_id = str(existing["id"])
                connection.execute(
                    """
                    UPDATE reminders
                    SET
                        enabled = ?,
                        time_local = ?,
                        frequency = ?,
                        timezone = ?,
                        next_run_at_utc = ?,
                        updated_at = ?
                    WHERE id = ?
                    """,
                    (
                        1 if enabled else 0,
                        time_local,
                        frequency,
                        timezone_name,
                        next_run_at_utc,
                        now_iso,
                        reminder_id,
                    ),
                )
                connection.execute(
                    "DELETE FROM reminders WHERE telegram_user_id = ? AND type = ? AND id <> ?",
                    (self.telegram_user_id, reminder_type, reminder_id),
                )
            else:
                reminder_id = str(uuid.uuid4())
                connection.execute(
                    """
                    INSERT INTO reminders (
                        id,
                        telegram_user_id,
                        type,
                        enabled,
                        time_local,
                        frequency,
                        timezone,
                        next_run_at_utc,
                        last_sent_at_utc,
                        fail_count,
                        last_error,
                        created_at,
                        updated_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, NULL, ?, ?)
                    """,
                    (
                        reminder_id,
                        self.telegram_user_id,
                        reminder_type,
                        1 if enabled else 0,
                        time_local,
                        frequency,
                        timezone_name,
                        next_run_at_utc,
                        now_iso,
                        now_iso,
                    ),
                )

            connection.commit()

        return reminder_id

    def _load_reminder_by_id(self, reminder_id: str) -> dict[str, object] | None:
        with sqlite3.connect(DB_PATH) as connection:
            connection.row_factory = sqlite3.Row
            row = connection.execute(
                """
                SELECT
                    id,
                    type,
                    enabled,
                    time_local,
                    frequency,
                    timezone,
                    next_run_at_utc,
                    last_sent_at_utc,
                    fail_count,
                    last_error,
                    created_at,
                    updated_at
                FROM reminders
                WHERE id = ?
                """,
                (reminder_id,),
            ).fetchone()
        if not row:
            return None
        return self._serialize_row(row)

    def _load_user_settings(self) -> dict[str, object]:
        with sqlite3.connect(DB_PATH) as connection:
            connection.row_factory = sqlite3.Row
            row = connection.execute(
                """
                SELECT
                    tz_name,
                    tz_offset_minutes,
                    write_access_allowed,
                    write_access_updated_at
                FROM user_settings
                WHERE telegram_user_id = ?
                """,
                (self.telegram_user_id,),
            ).fetchone()
        if not row:
            return {}
        return {
            "tz_name": row["tz_name"],
            "tz_offset_minutes": row["tz_offset_minutes"],
            "write_access_allowed": row["write_access_allowed"],
            "write_access_updated_at": row["write_access_updated_at"],
        }

    def _serialize_row(self, row: sqlite3.Row) -> dict[str, object]:
        next_run = row["next_run_at_utc"]
        return {
            "id": row["id"],
            "type": row["type"],
            "enabled": bool(row["enabled"]),
            "time_local": row["time_local"],
            "frequency": row["frequency"],
            "timezone": row["timezone"],
            "next_run_at_utc": next_run,
            "when_iso": next_run,
            "last_sent_at_utc": row["last_sent_at_utc"],
            "fail_count": int(row["fail_count"] or 0),
            "last_error": row["last_error"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        }
