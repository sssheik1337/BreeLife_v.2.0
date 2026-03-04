from typing import Literal

from pydantic import BaseModel, Field


class TelegramAuthRequest(BaseModel):
    initData: str | None = None


class ProfilePayload(BaseModel):
    data: dict[str, object]


class SubscriptionRequest(BaseModel):
    plan_id: str | None = None


class PaymentRequest(BaseModel):
    plan_id: str
    target_date: str | None = None


class FoodDiaryAddRequest(BaseModel):
    date: str
    meals: list[dict[str, object]] = Field(default_factory=list)
    water_l: float | None = None
    sleep_time: str | None = None
    activity: bool | None = None


class RemindersScheduleRequest(BaseModel):
    type: str
    time_local: str | None = None
    when_iso: str | None = None
    frequency: Literal["daily", "weekdays"] = "daily"
    enabled: bool = True
    timezone: str | None = None
    tz_offset_minutes: int | None = None


class CreateReminderPayload(BaseModel):
    type: Literal["water", "sleep", "sleep_reminder", "sleep_morning_log", "activity"]
    time: str
    enabled: bool = True
    frequency: Literal["daily", "weekdays"] = "daily"
    timezone: str | None = None
    tz_offset_minutes: int | None = None


class ReminderAutoGeneratePayload(BaseModel):
    type: Literal["water", "sleep", "sleep_reminder", "sleep_morning_log", "activity"]
    timezone_offset: int = 0


class UserTimezonePayload(BaseModel):
    tz_name: str | None = None
    tz_offset_minutes: int | None = None


class NotificationConsentPayload(BaseModel):
    allowed: bool
