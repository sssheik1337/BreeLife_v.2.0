from __future__ import annotations

from dataclasses import dataclass


@dataclass
class ReminderPayload:
    """Структура напоминания для будущего планировщика."""

    telegram_user_id: int
    type: str
    when_iso: str


class ReminderScheduler:
    """Заглушка планировщика для последующей интеграции."""

    def __init__(self, enabled: bool, store: dict[int, list[dict[str, str]]]):
        self.enabled = enabled
        self.store = store

    def schedule(self, payload: ReminderPayload) -> dict[str, str]:
        reminders = self.store.setdefault(payload.telegram_user_id, [])
        reminders.append(
            {
                "type": payload.type,
                "when_iso": payload.when_iso,
            }
        )
        return {"status": "scheduled" if self.enabled else "stubbed"}

    def list_for_user(self, telegram_user_id: int) -> list[dict[str, str]]:
        return self.store.get(telegram_user_id, [])
