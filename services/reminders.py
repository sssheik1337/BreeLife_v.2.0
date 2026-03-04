from __future__ import annotations

from datetime import datetime, timedelta, timezone


# Временное in-memory хранилище напоминаний по пользователям.
REMINDERS_STORE: dict[int, list[dict[str, str | bool]]] = {}


class ReminderScheduler:
    """Простой планировщик-заглушка для API напоминаний."""

    def __init__(self, telegram_user_id: int, profile: dict[str, object] | None = None):
        self.telegram_user_id = int(telegram_user_id)
        self.profile = profile or {}

    def schedule(self, payload: dict[str, str]) -> dict[str, str]:
        reminder_type = payload.get("type")
        when_iso = payload.get("when_iso")
        if not isinstance(reminder_type, str) or not isinstance(when_iso, str):
            return {"status": "invalid_payload"}

        reminders = REMINDERS_STORE.setdefault(self.telegram_user_id, [])
        reminders.append(
            {
                "type": reminder_type,
                "when_iso": when_iso,
                "enabled": True,
            }
        )
        return {"status": "scheduled"}

    def list(self) -> list[dict[str, str | bool]]:
        return list(REMINDERS_STORE.get(self.telegram_user_id, []))

    def create(self, reminder_type: str, time_value: str, enabled: bool = True) -> dict[str, str | bool]:
        if not isinstance(reminder_type, str) or not isinstance(time_value, str):
            return {"status": "invalid_payload"}

        when_iso = self._build_today_iso(time_value)
        reminder = {
            "type": reminder_type,
            "when_iso": when_iso,
            "enabled": bool(enabled),
            "status": "scheduled" if enabled else "disabled",
        }
        reminders = REMINDERS_STORE.setdefault(self.telegram_user_id, [])
        reminders.append(reminder)
        return reminder

    def auto_generate(self, reminder_type: str, timezone_offset: int = 0) -> list[dict[str, str | bool]]:
        if reminder_type == "water":
            return [self.create("water", "10:00", True), self.create("water", "15:00", True)]
        if reminder_type == "sleep":
            return [self.create("sleep_reminder", "22:30", True)]
        if reminder_type == "activity":
            return [self.create("activity", "18:00", True)]
        return []

    def _build_today_iso(self, time_value: str) -> str:
        try:
            hours_str, minutes_str = time_value.split(":", maxsplit=1)
            hours = int(hours_str)
            minutes = int(minutes_str)
        except (ValueError, AttributeError):
            return datetime.now(timezone.utc).isoformat()

        now = datetime.now(timezone.utc)
        local = now + timedelta(hours=0)
        scheduled_local = local.replace(hour=hours, minute=minutes, second=0, microsecond=0)
        if scheduled_local < local:
            scheduled_local = scheduled_local + timedelta(days=1)
        return scheduled_local.isoformat()
