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
    timezone_offset: int = 0


class CreateReminderPayload(BaseModel):
    type: Literal["water", "sleep", "activity"]
    time: str
    enabled: bool = True


class ReminderAutoGeneratePayload(BaseModel):
    type: Literal["water", "sleep", "activity"]
    timezone_offset: int = 0
