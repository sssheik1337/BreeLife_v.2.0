from __future__ import annotations

import json
import logging
from dataclasses import dataclass

try:
    import requests
except ModuleNotFoundError:  # pragma: no cover - depends on runtime environment
    requests = None  # type: ignore[assignment]

from config import AI_ENABLED, YANDEX_GPT_API_KEY, YANDEX_GPT_FOLDER_ID

logger = logging.getLogger(__name__)

YANDEX_GPT_PICKER_ENDPOINT = "https://llm.api.cloud.yandex.net/foundationModels/v1/completion"
YANDEX_GPT_PICKER_TIMEOUT_SECONDS = 18
YANDEX_GPT_PICKER_MAX_TOKENS = 800


class MealPickerError(RuntimeError):
    pass


@dataclass(frozen=True)
class SlotCandidate:
    product_id: int
    name: str
    role: str
    kind: str
    group: str
    kcal_100: float


def can_use_yandex_meal_picker() -> bool:
    return bool(AI_ENABLED and YANDEX_GPT_API_KEY and YANDEX_GPT_FOLDER_ID and requests is not None)


def _build_picker_system_prompt() -> str:
    return (
        "\u0422\u044b \u0441\u0442\u0440\u043e\u0433\u0438\u0439 \u0441\u0435\u043b\u0435\u043a\u0442\u043e\u0440 product_id \u0434\u043b\u044f \u043f\u043b\u0430\u043d\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u044f \u043f\u0438\u0442\u0430\u043d\u0438\u044f. "
        "\u0422\u0432\u043e\u044f \u0437\u0430\u0434\u0430\u0447\u0430: \u0432\u044b\u0431\u0440\u0430\u0442\u044c product_id \u0442\u043e\u043b\u044c\u043a\u043e \u0438\u0437 \u043f\u0435\u0440\u0435\u0434\u0430\u043d\u043d\u044b\u0445 \u043a\u0430\u043d\u0434\u0438\u0434\u0430\u0442\u043e\u0432 \u0434\u043b\u044f \u043a\u0430\u0436\u0434\u043e\u0439 \u044f\u0447\u0435\u0439\u043a\u0438. "
        "\u041d\u0435\u043b\u044c\u0437\u044f \u043f\u0440\u0438\u0434\u0443\u043c\u044b\u0432\u0430\u0442\u044c id, \u043c\u0435\u043d\u044f\u0442\u044c \u0441\u0445\u0435\u043c\u0443 \u043e\u0442\u0432\u0435\u0442\u0430 \u0438\u043b\u0438 \u0434\u043e\u0431\u0430\u0432\u043b\u044f\u0442\u044c \u043a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0438. "
        "\u0412\u0435\u0440\u043d\u0438 \u0442\u043e\u043b\u044c\u043a\u043e JSON-\u043e\u0431\u044a\u0435\u043a\u0442 \u0432\u0438\u0434\u0430 {\"slots\":{...}} \u0431\u0435\u0437 markdown \u0438 \u0431\u0435\u0437 \u043b\u044e\u0431\u043e\u0433\u043e \u0434\u043e\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u044c\u043d\u043e\u0433\u043e \u0442\u0435\u043a\u0441\u0442\u0430. "
        "\u041f\u0440\u0430\u0432\u0438\u043b\u0430 \u0441\u043e\u0432\u043c\u0435\u0441\u0442\u0438\u043c\u043e\u0441\u0442\u0438: "
        "1) \u041d\u0435 \u0432\u044b\u0431\u0438\u0440\u0430\u0439 \u043e\u0434\u0438\u043d \u0438 \u0442\u043e\u0442 \u0436\u0435 product_id \u0432 \u0440\u0430\u0437\u043d\u044b\u0435 \u044f\u0447\u0435\u0439\u043a\u0438 \u043e\u0434\u043d\u043e\u0433\u043e \u043f\u0440\u0438\u0451\u043c\u0430 \u043f\u0438\u0449\u0438. "
        "2) \u0414\u043b\u044f \u043e\u0431\u0435\u0434\u0430 \u0438 \u0443\u0436\u0438\u043d\u0430 \u0441\u043e\u0431\u043b\u044e\u0434\u0430\u0439 \u0441\u0442\u0440\u0443\u043a\u0442\u0443\u0440\u0443: \u0431\u0435\u043b\u043e\u043a + \u043e\u0432\u043e\u0449\u0438 + \u043f\u043b\u043e\u0442\u043d\u044b\u0439 \u0443\u0433\u043b\u0435\u0432\u043e\u0434. "
        "3) \u0418\u0437\u0431\u0435\u0433\u0430\u0439 \u0441\u043e\u0447\u0435\u0442\u0430\u043d\u0438\u0439 \u0440\u044b\u0431\u0430/\u043c\u043e\u0440\u0435\u043f\u0440\u043e\u0434\u0443\u043a\u0442\u044b \u0441\u043e \u0441\u043b\u0430\u0434\u043a\u0438\u043c\u0438 \u044f\u0433\u043e\u0434\u0430\u043c\u0438 \u0438\u043b\u0438 \u0444\u0440\u0443\u043a\u0442\u0430\u043c\u0438 \u0432 \u043e\u0434\u043d\u043e\u043c \u043f\u0440\u0438\u0451\u043c\u0435 \u043f\u0438\u0449\u0438. "
        "4) \u041e\u0440\u0435\u0445\u0438, \u0441\u0435\u043c\u0435\u0447\u043a\u0438 \u0438 \u043c\u0430\u0441\u043b\u0430 \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u0439 \u0442\u043e\u043b\u044c\u043a\u043e \u043a\u0430\u043a \u043d\u0435\u0431\u043e\u043b\u044c\u0448\u0443\u044e \u0434\u043e\u0431\u0430\u0432\u043a\u0443."
    )


def _build_picker_user_prompt(
    meal_key: str,
    required_slots: list[str],
    optional_slots: list[str],
    candidates_by_slot: dict[str, list[SlotCandidate]],
    exclude_product_ids: set[int],
    weekly_repeat_limit: int,
    weekly_usage: dict[int, int],
) -> str:
    normalized_candidates: dict[str, list[dict[str, object]]] = {}
    for slot, candidates in candidates_by_slot.items():
        normalized_candidates[slot] = [
            {
                "product_id": int(item.product_id),
                "name": item.name,
                "role": item.role,
                "kind": item.kind,
                "group": item.group,
                "kcal_100": round(float(item.kcal_100), 2),
            }
            for item in candidates[:30]
        ]

    payload = {
        "task": "select_product_ids_for_slots",
        "meal_key": meal_key,
        "required_slots": required_slots,
        "optional_slots": optional_slots,
        "exclude_product_ids": sorted(int(item) for item in exclude_product_ids),
        "weekly_repeat_limit": int(weekly_repeat_limit),
        "weekly_usage_by_product_id": {str(int(pid)): int(count) for pid, count in weekly_usage.items()},
        "candidates_by_slot": normalized_candidates,
        "output_schema": {
            "slots": {
                "<slot_name>": "<int product_id from candidates>",
            }
        },
        "rules": [
            "Use only ids from slot candidates.",
            "Required slots must be present.",
            "Optional slots may be omitted.",
            "Do not output any field except 'slots'.",
            "Output valid JSON object only.",
        ],
    }
    return json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _extract_json_strict(raw_text: str) -> dict[str, object]:
    text = (raw_text or "").strip()
    if not text:
        raise MealPickerError("Empty YandexGPT response text.")
    if text.startswith("```"):
        lines = text.splitlines()
        if len(lines) >= 3 and lines[0].startswith("```") and lines[-1].startswith("```"):
            text = "\n".join(lines[1:-1]).strip()
    if not text.startswith("{") or not text.endswith("}"):
        first = text.find("{")
        last = text.rfind("}")
        if first != -1 and last != -1 and last > first:
            text = text[first:last + 1].strip()
    if not text.startswith("{") or not text.endswith("}"):
        raise MealPickerError("YandexGPT response is not a strict JSON object.")
    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        raise MealPickerError("YandexGPT JSON parse failed.") from exc
    if not isinstance(data, dict):
        raise MealPickerError("YandexGPT JSON root must be object.")
    return data


def _parse_slots_response(
    payload: dict[str, object],
    required_slots: list[str],
    optional_slots: list[str],
    allowed_ids_by_slot: dict[str, set[int]],
) -> dict[str, int]:
    if set(payload.keys()) != {"slots"}:
        raise MealPickerError("YandexGPT payload must contain only 'slots'.")
    slots = payload.get("slots")
    if not isinstance(slots, dict):
        raise MealPickerError("YandexGPT 'slots' must be an object.")

    selected: dict[str, int] = {}
    allowed_slots = set(required_slots) | set(optional_slots)
    for slot_name, raw_value in slots.items():
        if slot_name not in allowed_slots:
            raise MealPickerError(f"Unknown slot in response: {slot_name}")
        if isinstance(raw_value, bool):
            raise MealPickerError(f"Invalid product id for slot {slot_name}")
        try:
            selected_id = int(raw_value)
        except (TypeError, ValueError) as exc:
            raise MealPickerError(f"Invalid product id type for slot {slot_name}") from exc

        allowed_ids = allowed_ids_by_slot.get(slot_name, set())
        if selected_id not in allowed_ids:
            raise MealPickerError(f"Selected id {selected_id} is out of candidates for slot {slot_name}")
        selected[slot_name] = selected_id

    for required_slot in required_slots:
        if required_slot not in selected:
            raise MealPickerError(f"Missing required slot in YandexGPT response: {required_slot}")
    return selected


def pick_slot_product_ids_with_yandex(
    meal_key: str,
    required_slots: list[str],
    optional_slots: list[str],
    candidates_by_slot: dict[str, list[SlotCandidate]],
    exclude_product_ids: set[int],
    weekly_usage_by_product_id: dict[int, int] | None = None,
    weekly_repeat_limit: int = 3,
) -> dict[str, int]:
    if not can_use_yandex_meal_picker():
        raise MealPickerError("Yandex meal picker is disabled.")
    if requests is None:
        raise MealPickerError("Python package 'requests' is not installed.")

    filtered_candidates: dict[str, list[SlotCandidate]] = {}
    allowed_ids_by_slot: dict[str, set[int]] = {}
    for slot_name, candidates in candidates_by_slot.items():
        top = candidates[:30]
        filtered_candidates[slot_name] = top
        allowed_ids_by_slot[slot_name] = {item.product_id for item in top}

    for slot_name in required_slots:
        if not filtered_candidates.get(slot_name):
            raise MealPickerError(f"No candidates for required slot {slot_name}")

    weekly_usage = weekly_usage_by_product_id or {}
    system_prompt = _build_picker_system_prompt()
    user_prompt = _build_picker_user_prompt(
        meal_key=meal_key,
        required_slots=required_slots,
        optional_slots=optional_slots,
        candidates_by_slot=filtered_candidates,
        exclude_product_ids=exclude_product_ids,
        weekly_repeat_limit=weekly_repeat_limit,
        weekly_usage=weekly_usage,
    )

    request_payload = {
        "modelUri": f"gpt://{YANDEX_GPT_FOLDER_ID}/yandexgpt/latest",
        "completionOptions": {
            "stream": False,
            "temperature": 0.0,
            "maxTokens": YANDEX_GPT_PICKER_MAX_TOKENS,
        },
        "messages": [
            {"role": "system", "text": system_prompt},
            {"role": "user", "text": user_prompt},
        ],
    }
    headers = {
        "Authorization": f"Api-Key {YANDEX_GPT_API_KEY}",
        "Content-Type": "application/json",
    }
    response = requests.post(
        YANDEX_GPT_PICKER_ENDPOINT,
        json=request_payload,
        headers=headers,
        timeout=YANDEX_GPT_PICKER_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    body = response.json()
    alternatives = body.get("result", {}).get("alternatives", [])
    if not isinstance(alternatives, list) or not alternatives:
        raise MealPickerError("YandexGPT picker returned empty alternatives.")
    message = alternatives[0].get("message") if isinstance(alternatives[0], dict) else None
    text = message.get("text") if isinstance(message, dict) else None
    if not isinstance(text, str) or not text.strip():
        raise MealPickerError("YandexGPT picker returned empty text.")

    parsed = _extract_json_strict(text)
    selected = _parse_slots_response(
        payload=parsed,
        required_slots=required_slots,
        optional_slots=optional_slots,
        allowed_ids_by_slot=allowed_ids_by_slot,
    )
    logger.debug("Yandex meal picker selected slots for %s: %s", meal_key, selected)
    return selected
