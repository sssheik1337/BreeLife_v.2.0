from __future__ import annotations

import hashlib
import json
from datetime import date, timedelta

from fastapi import APIRouter, HTTPException, Query, Request, Response

from app.dependencies import load_profile, require_telegram_user_id
from app.meal_plan_common import (
    build_seed_value,
    distribute_meal_targets,
    ensure_preferences_completed,
    normalize_profile_id_set,
    resolve_requested_date,
    resolve_targets,
    resolve_week_start,
)
from config import APP_DEBUG, MEAL_PLAN_ALGO_VERSION
from services.meal_plan_generator_v2 import generate_day_meal_plan_v2
from services.products_db import load_admin_products
from services.products_heuristics import classify_kind
from services.storage_db import (
    build_meal_plan_inputs_hash,
    read_meal_plan_day,
    upsert_meal_plan_day,
)

router = APIRouter()
WEEKLY_PRODUCT_REPEAT_LIMIT = 3


def _resolve_day_targets(
    safe_profile: dict[str, object],
) -> tuple[dict[str, object] | None, dict[str, object], dict[str, int | None]]:
    targets, targets_diagnostics = resolve_targets(safe_profile)
    meals, _ = distribute_meal_targets(targets)
    meal_targets: dict[str, int | None] = {}
    for meal in meals:
        if not isinstance(meal, dict):
            continue
        meal_key = str(meal.get("key") or "").strip()
        if not meal_key:
            continue
        target_value = meal.get("target_calories")
        meal_targets[meal_key] = int(target_value) if isinstance(target_value, int) else None
    return targets, targets_diagnostics, meal_targets


def _resolve_top_level_target_status(targets_diagnostics: dict[str, object]) -> tuple[str, str]:
    top_level_targets_source = (
        "profile.calories_target"
        if targets_diagnostics.get("calories_source") == "profile.calories_target"
        else "missing"
    )
    target_status = "ok" if top_level_targets_source == "profile.calories_target" else "target_not_computed"
    return top_level_targets_source, target_status


def _normalize_v2_payload_for_contract(payload: dict[str, object]) -> dict[str, object]:
    normalized = dict(payload)
    meals = normalized.get("meals")
    if not isinstance(meals, list):
        normalized["meals"] = []
        return normalized

    normalized_meals: list[dict[str, object]] = []
    for meal in meals:
        if not isinstance(meal, dict):
            continue
        normalized_meal = dict(meal)

        items = normalized_meal.get("items")
        if not isinstance(items, list):
            normalized_meal["items"] = []
            normalized_meals.append(normalized_meal)
            continue

        normalized_items: list[dict[str, object]] = []
        for item in items:
            if not isinstance(item, dict):
                continue
            normalized_item = dict(item)

            if "name" not in normalized_item:
                normalized_item["name"] = ""
            if "product_id" not in normalized_item:
                normalized_item["product_id"] = None

            amount = _extract_numeric_amount(normalized_item.get("amount"))
            unit = str(normalized_item.get("unit") or "").strip().lower()
            grams = _extract_numeric_amount(normalized_item.get("grams"))
            if grams is None and amount is not None and unit == "g":
                normalized_item["grams"] = int(round(amount))

            normalized_items.append(normalized_item)

        normalized_meal["items"] = normalized_items
        normalized_meals.append(normalized_meal)

    normalized["meals"] = normalized_meals
    return normalized


def _build_v2_day_payload(
    resolved_date: date,
    safe_profile: dict[str, object],
    raw_products: list[dict[str, object]],
    total_products_count: int | None,
    telegram_user_id: int,
    effective_excluded_ids: set[int],
    weekly_usage_counts: dict[int, int] | None,
    weekly_repeat_limit: int,
    date_parse_error: bool,
) -> dict[str, object]:
    targets, targets_diagnostics, meal_targets = _resolve_day_targets(safe_profile)
    seed_value = build_seed_value(telegram_user_id, resolved_date, version=MEAL_PLAN_ALGO_VERSION)

    generated = generate_day_meal_plan_v2(
        products=raw_products,
        seed_value=seed_value,
        meal_targets=meal_targets,
        excluded_product_ids=effective_excluded_ids,
        weekly_usage_by_product_id=weekly_usage_counts,
        weekly_repeat_limit=weekly_repeat_limit,
        use_yandex_picker=True,
    )
    if not isinstance(generated, dict):
        raise ValueError("v2_generator_returned_invalid_payload")

    normalized_generated = _normalize_v2_payload_for_contract(generated)
    meals = normalized_generated.get("meals")
    totals = normalized_generated.get("totals")
    meta_raw = normalized_generated.get("meta")
    meta = dict(meta_raw) if isinstance(meta_raw, dict) else {}

    top_level_targets_source, target_status = _resolve_top_level_target_status(targets_diagnostics)
    meta.update(
        {
            "seed": seed_value,
            "algo_version": MEAL_PLAN_ALGO_VERSION,
            "targets_source": targets_diagnostics.get("targets_source"),
            "missing_fields": targets_diagnostics.get("missing_fields", []),
            "date_parse_error": date_parse_error,
            "catalog_size": len(raw_products),
            "catalog_size_total": int(total_products_count) if isinstance(total_products_count, int) else len(raw_products),
            "catalog_size_favorites": len(raw_products),
            "excluded_ids_count": len(effective_excluded_ids),
            "generator": "v2",
            "fallback_reason": None,
        },
    )

    return {
        "date": resolved_date.isoformat(),
        "targets": targets,
        "targets_source": top_level_targets_source,
        "target_status": target_status,
        "meals": meals if isinstance(meals, list) else [],
        "totals": totals if isinstance(totals, dict) else {"calories": 0, "protein_g": 0, "fat_g": 0, "carbs_g": 0},
        "meta": meta,
    }


def _normalize_number(value: object) -> float | None:
    if isinstance(value, bool):
        return None
    try:
        return round(float(value), 4)
    except (TypeError, ValueError):
        return None


def _build_products_catalog_hash(raw_products: list[dict[str, object]]) -> str:
    snapshot: list[dict[str, object]] = []
    for item in raw_products:
        product_id = item.get("id")
        if isinstance(product_id, bool):
            continue
        try:
            normalized_id = int(product_id)
        except (TypeError, ValueError):
            continue
        snapshot.append(
            {
                "id": normalized_id,
                "name": str(item.get("name") or ""),
                "group": str(item.get("group") or ""),
                "kcal_per_100g": _normalize_number(item.get("kcal_per_100g") or item.get("kcal")),
                "protein_g": _normalize_number(item.get("protein_g")),
                "fat_g": _normalize_number(item.get("fat_g")),
                "carbs_g": _normalize_number(item.get("carbs_g")),
                "fiber_g": _normalize_number(item.get("fiber_g")),
            },
        )

    snapshot.sort(key=lambda row: int(row["id"]))
    serialized = json.dumps(snapshot, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def _filter_products_by_ids(
    raw_products: list[dict[str, object]],
    allowed_ids: set[int],
) -> list[dict[str, object]]:
    if not allowed_ids:
        return []

    filtered: list[dict[str, object]] = []
    for item in raw_products:
        product_id = item.get("id")
        if isinstance(product_id, bool):
            continue
        try:
            normalized_id = int(product_id)
        except (TypeError, ValueError):
            continue
        if normalized_id in allowed_ids:
            filtered.append(item)
    return filtered


def _extract_product_ids_from_payload(payload: dict[str, object]) -> set[int]:
    selected_ids: set[int] = set()
    meals = payload.get("meals")
    if not isinstance(meals, list):
        return selected_ids

    for meal in meals:
        if not isinstance(meal, dict):
            continue
        items = meal.get("items")
        if not isinstance(items, list):
            continue
        for item in items:
            if not isinstance(item, dict):
                continue
            product_id = item.get("product_id")
            if isinstance(product_id, bool):
                continue
            try:
                selected_ids.add(int(product_id))
            except (TypeError, ValueError):
                continue
    return selected_ids


def _increment_usage_counts(usage_counts: dict[int, int], payload: dict[str, object]) -> None:
    for product_id in _extract_product_ids_from_payload(payload):
        usage_counts[product_id] = int(usage_counts.get(product_id, 0)) + 1


def _collect_weekly_blocked_ids(
    weekly_usage_counts: dict[int, int] | None,
    weekly_repeat_limit: int,
) -> set[int]:
    if not isinstance(weekly_usage_counts, dict):
        return set()
    if weekly_repeat_limit <= 0:
        return set()
    blocked: set[int] = set()
    for product_id, count in weekly_usage_counts.items():
        try:
            normalized_id = int(product_id)
            normalized_count = int(count)
        except (TypeError, ValueError):
            continue
        if normalized_count >= weekly_repeat_limit:
            blocked.add(normalized_id)
    return blocked


def _build_effective_excluded_ids(
    base_excluded_ids: set[int],
    extra_excluded_ids: set[int] | None,
    weekly_usage_counts: dict[int, int] | None,
    weekly_repeat_limit: int,
) -> tuple[set[int], set[int], set[int]]:
    rebuild_excluded = set(extra_excluded_ids or set())
    weekly_blocked_ids = _collect_weekly_blocked_ids(weekly_usage_counts, weekly_repeat_limit)
    effective = set(base_excluded_ids)
    if rebuild_excluded:
        effective.update(rebuild_excluded)
    if weekly_blocked_ids:
        effective.update(weekly_blocked_ids)
    return effective, rebuild_excluded, weekly_blocked_ids


def _normalize_reason(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    normalized = value.strip()
    if not normalized:
        return None
    if normalized.lower() in {"ok", "none", "null", "not_executed"}:
        return None
    return normalized


def _collect_payload_picker_usage(payload: dict[str, object]) -> tuple[bool, bool]:
    yandex_attempted = False
    yandex_used = False

    meta = payload.get("meta")
    if isinstance(meta, dict) and meta.get("yandex_picker_enabled") is True:
        yandex_attempted = True

    meals = payload.get("meals")
    if isinstance(meals, list):
        for meal in meals:
            if not isinstance(meal, dict):
                continue
            meal_meta = meal.get("meta")
            if not isinstance(meal_meta, dict):
                continue
            yandex_attempted = yandex_attempted or bool(meal_meta.get("yandex_attempted") is True)
            yandex_used = yandex_used or bool(meal_meta.get("yandex_used") is True)

    return yandex_attempted, yandex_used


def _collect_payload_rebuild_reasons(payload: dict[str, object]) -> list[str]:
    reasons: set[str] = set()
    meta = payload.get("meta")
    if isinstance(meta, dict):
        for key in ("fallback_reason", "yandex_fallback_reason", "deterministic_last_sanity_reason", "sanity_reason"):
            normalized = _normalize_reason(meta.get(key))
            if normalized:
                reasons.add(normalized)

    meals = payload.get("meals")
    if isinstance(meals, list):
        for meal in meals:
            if not isinstance(meal, dict):
                continue
            meal_meta = meal.get("meta")
            if not isinstance(meal_meta, dict):
                continue
            for key in ("yandex_fallback_reason", "deterministic_last_sanity_reason", "sanity_reason"):
                normalized = _normalize_reason(meal_meta.get(key))
                if normalized:
                    reasons.add(normalized)

    return sorted(reasons)


def _attach_debug_diagnostics(
    payload: dict[str, object],
    base_excluded_ids: set[int],
    rebuild_excluded_ids: set[int],
    weekly_blocked_ids: set[int],
) -> dict[str, object]:
    response_payload = dict(payload)
    meta_raw = response_payload.get("meta")
    meta = dict(meta_raw) if isinstance(meta_raw, dict) else {}

    yandex_attempted, yandex_used = _collect_payload_picker_usage(payload)
    debug_diagnostics = {
        "excluded_products_total": len(base_excluded_ids | rebuild_excluded_ids | weekly_blocked_ids),
        "excluded_products_profile_count": len(base_excluded_ids),
        "excluded_products_rebuild_count": len(rebuild_excluded_ids),
        "excluded_products_weekly_blocked_count": len(weekly_blocked_ids),
        "yandex_picker_attempted": yandex_attempted,
        "yandex_picker_used": yandex_used,
        "rebuild_reasons": _collect_payload_rebuild_reasons(payload),
    }
    meta["debug_diagnostics"] = debug_diagnostics
    response_payload["meta"] = meta
    return response_payload


def _extract_numeric_amount(value: object) -> float | None:
    if isinstance(value, bool):
        return None
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    if parsed <= 0:
        return None
    return parsed


def _resolve_item_amount_and_unit(item: dict[str, object], product_kind: str) -> tuple[float, str] | None:
    amount = _extract_numeric_amount(item.get("amount"))
    unit_raw = str(item.get("unit") or "").strip().lower()
    if amount is not None:
        if product_kind == "beverage":
            unit = "ml" if unit_raw not in {"ml", "g"} else ("ml" if unit_raw == "g" else unit_raw)
            return amount, unit
        return amount, "g" if unit_raw not in {"g", "ml"} else ("g" if unit_raw == "ml" else unit_raw)

    grams = _extract_numeric_amount(item.get("grams"))
    if grams is not None:
        if product_kind == "beverage":
            return grams, "ml"
        return grams, "g"

    return None


def _build_product_lookup() -> dict[int, dict[str, object]]:
    lookup: dict[int, dict[str, object]] = {}
    for product in load_admin_products():
        product_id = product.get("id")
        if isinstance(product_id, bool):
            continue
        try:
            normalized_id = int(product_id)
        except (TypeError, ValueError):
            continue
        lookup[normalized_id] = product
    return lookup


def _resolve_item_kind_and_group(
    item: dict[str, object],
    products_lookup: dict[int, dict[str, object]],
) -> tuple[str, str]:
    product_id = item.get("product_id")
    product: dict[str, object] | None = None
    if not isinstance(product_id, bool):
        try:
            normalized_id = int(product_id)
            product = products_lookup.get(normalized_id)
        except (TypeError, ValueError):
            product = None

    if isinstance(product, dict):
        product_kind = classify_kind(product)
        product_group = str(product.get("group") or "").strip() or "Без группы"
        return product_kind, product_group

    fallback_product = {
        "name": item.get("name"),
        "group": item.get("group"),
        "tags": item.get("tags") if isinstance(item.get("tags"), list) else [],
        "kcal": item.get("calories"),
    }
    product_kind = classify_kind(fallback_product)
    product_group = str(item.get("group") or "").strip() or "Без группы"
    return product_kind, product_group


def _aggregate_shopping_items(
    payloads: list[dict[str, object]],
    products_lookup: dict[int, dict[str, object]],
) -> tuple[dict[str, list[dict[str, object]]], list[dict[str, object]]]:
    food_totals: dict[tuple[str, str], dict[str, object]] = {}
    beverage_totals: dict[str, dict[str, object]] = {}

    for payload in payloads:
        meals = payload.get("meals")
        if not isinstance(meals, list):
            continue
        for meal in meals:
            if not isinstance(meal, dict):
                continue
            items = meal.get("items")
            if not isinstance(items, list):
                continue
            for item in items:
                if not isinstance(item, dict):
                    continue
                name = str(item.get("name") or "").strip()
                if not name:
                    continue

                product_kind, product_group = _resolve_item_kind_and_group(item, products_lookup)
                if product_kind == "water":
                    continue

                amount_and_unit = _resolve_item_amount_and_unit(item, product_kind)
                if amount_and_unit is None:
                    continue
                amount_raw, unit = amount_and_unit
                amount = int(round(amount_raw))
                if amount <= 0:
                    continue

                product_id_value = item.get("product_id")
                product_id = None
                if not isinstance(product_id_value, bool):
                    try:
                        product_id = int(product_id_value)
                    except (TypeError, ValueError):
                        product_id = None

                if product_kind == "beverage":
                    key = name
                    current = beverage_totals.get(key) or {
                        "product_id": product_id,
                        "name": name,
                        "amount": 0,
                        "unit": "ml",
                        "count": 0,
                    }
                    current["amount"] = int(current["amount"]) + amount
                    current["count"] = int(current["count"]) + 1
                    beverage_totals[key] = current
                    continue

                food_key = (product_group, name)
                current_food = food_totals.get(food_key) or {
                    "product_id": product_id,
                    "name": name,
                    "group": product_group,
                    "amount": 0,
                    "unit": "g",
                    "count": 0,
                }
                current_food["amount"] = int(current_food["amount"]) + amount
                current_food["count"] = int(current_food["count"]) + 1
                food_totals[food_key] = current_food

    grouped_food: dict[str, list[dict[str, object]]] = {}
    for item in food_totals.values():
        group_name = str(item.get("group") or "Без группы")
        grouped_food.setdefault(group_name, []).append(item)

    for group_name, group_items in grouped_food.items():
        grouped_food[group_name] = sorted(group_items, key=lambda entry: str(entry.get("name") or ""))

    beverages = sorted(beverage_totals.values(), key=lambda entry: str(entry.get("name") or ""))
    return grouped_food, beverages


def _load_generation_context(telegram_user_id: int) -> dict[str, object]:
    profile = load_profile(telegram_user_id)
    safe_profile = profile if isinstance(profile, dict) else {}
    admin_products = load_admin_products()

    favorite_ids = normalize_profile_id_set(safe_profile.get("favorite_product_ids"))
    excluded_ids = normalize_profile_id_set(safe_profile.get("excluded_product_ids"))
    ensure_preferences_completed(safe_profile, favorite_ids)

    raw_products = _filter_products_by_ids(admin_products, favorite_ids)
    if not raw_products:
        raise HTTPException(status_code=422, detail={"reason": "favorite_products_not_found"})

    products_catalog_hash = _build_products_catalog_hash(raw_products)
    inputs_hash = build_meal_plan_inputs_hash(
        profile=safe_profile,
        algo_version=MEAL_PLAN_ALGO_VERSION,
        products_catalog_hash=products_catalog_hash,
    )

    return {
        "telegram_user_id": telegram_user_id,
        "safe_profile": safe_profile,
        "raw_products": raw_products,
        "total_products_count": len(admin_products),
        "favorite_ids": favorite_ids,
        "excluded_ids": excluded_ids,
        "inputs_hash": inputs_hash,
    }


def _generate_day_payload(
    context: dict[str, object],
    resolved_date: date,
    regen_nonce: int,
    debug_enabled: bool,
    date_parse_error: bool,
    extra_excluded_ids: set[int] | None = None,
    weekly_usage_counts: dict[int, int] | None = None,
    weekly_repeat_limit: int = WEEKLY_PRODUCT_REPEAT_LIMIT,
) -> dict[str, object]:
    raw_products = context["raw_products"]
    safe_profile = context["safe_profile"]
    base_excluded_ids = context["excluded_ids"]
    total_products_count = context.get("total_products_count")
    telegram_user_id = int(context["telegram_user_id"])

    effective_excluded_ids, _, weekly_blocked_ids = _build_effective_excluded_ids(
        base_excluded_ids=set(base_excluded_ids),
        extra_excluded_ids=extra_excluded_ids,
        weekly_usage_counts=weekly_usage_counts,
        weekly_repeat_limit=weekly_repeat_limit,
    )

    if extra_excluded_ids or weekly_blocked_ids:
        has_available_food = False
        for product in raw_products:
            product_id = product.get("id")
            if not isinstance(product_id, int):
                continue
            if product_id in effective_excluded_ids:
                continue
            if classify_kind(product) != "food":
                continue
            has_available_food = True
            break
        if not has_available_food:
            raise HTTPException(
                status_code=409,
                detail={"reason": "rebuild_not_possible_with_current_constraints"},
            )

    payload = _build_v2_day_payload(
        resolved_date=resolved_date,
        safe_profile=safe_profile,
        raw_products=raw_products,
        total_products_count=int(total_products_count) if isinstance(total_products_count, int) else None,
        telegram_user_id=telegram_user_id,
        effective_excluded_ids=effective_excluded_ids,
        weekly_usage_counts=weekly_usage_counts,
        weekly_repeat_limit=weekly_repeat_limit,
        date_parse_error=date_parse_error,
    )

    meta = payload.get("meta")
    if isinstance(meta, dict):
        meta["regen_nonce"] = int(regen_nonce)
        meta["weekly_repeat_limit"] = int(weekly_repeat_limit)
        meta["weekly_blocked_products_count"] = len(weekly_blocked_ids)
    return payload


def _get_or_build_day_plan(
    context: dict[str, object],
    resolved_date: date,
    debug_enabled: bool,
    debug_requested: bool,
    date_parse_error: bool,
    weekly_usage_counts: dict[int, int] | None = None,
    weekly_repeat_limit: int = WEEKLY_PRODUCT_REPEAT_LIMIT,
) -> dict[str, object]:
    telegram_user_id = int(context["telegram_user_id"])
    inputs_hash = str(context["inputs_hash"])

    existing = read_meal_plan_day(telegram_user_id, resolved_date)
    if (
        isinstance(existing, dict)
        and existing.get("inputs_hash") == inputs_hash
        and existing.get("algo_version") == MEAL_PLAN_ALGO_VERSION
        and isinstance(existing.get("payload"), dict)
    ):
        payload = existing["payload"]
        if not debug_requested:
            return payload
        base_excluded_ids = set(context["excluded_ids"])
        _, rebuild_excluded_ids, weekly_blocked_ids = _build_effective_excluded_ids(
            base_excluded_ids=base_excluded_ids,
            extra_excluded_ids=None,
            weekly_usage_counts=weekly_usage_counts,
            weekly_repeat_limit=weekly_repeat_limit,
        )
        return _attach_debug_diagnostics(payload, base_excluded_ids, rebuild_excluded_ids, weekly_blocked_ids)

    regen_nonce = int(existing.get("regen_nonce", 0)) if isinstance(existing, dict) else 0
    payload = _generate_day_payload(
        context=context,
        resolved_date=resolved_date,
        regen_nonce=regen_nonce,
        debug_enabled=debug_enabled,
        date_parse_error=date_parse_error,
        weekly_usage_counts=weekly_usage_counts,
        weekly_repeat_limit=weekly_repeat_limit,
    )
    upsert_meal_plan_day(
        telegram_user_id=telegram_user_id,
        plan_date=resolved_date,
        payload=payload,
        inputs_hash=inputs_hash,
        regen_nonce=regen_nonce,
        algo_version=MEAL_PLAN_ALGO_VERSION,
    )
    if not debug_requested:
        return payload
    base_excluded_ids = set(context["excluded_ids"])
    _, rebuild_excluded_ids, weekly_blocked_ids = _build_effective_excluded_ids(
        base_excluded_ids=base_excluded_ids,
        extra_excluded_ids=None,
        weekly_usage_counts=weekly_usage_counts,
        weekly_repeat_limit=weekly_repeat_limit,
    )
    return _attach_debug_diagnostics(payload, base_excluded_ids, rebuild_excluded_ids, weekly_blocked_ids)


@router.get("/api/meal-plan/v2")
async def meal_plan_v2_day_api(
    request: Request,
    response: Response,
    date_value: str | None = Query(default=None, alias="date"),
    app_debug: bool | None = Query(default=None, alias="app_debug"),
) -> dict[str, object]:
    telegram_user_id = require_telegram_user_id(request, response)
    resolved_date, date_parse_error = resolve_requested_date(date_value)
    context = _load_generation_context(telegram_user_id)
    debug_requested = bool(app_debug)
    debug_enabled = bool(APP_DEBUG) or debug_requested
    return _get_or_build_day_plan(
        context=context,
        resolved_date=resolved_date,
        debug_enabled=debug_enabled,
        debug_requested=debug_requested,
        date_parse_error=date_parse_error,
    )


@router.get("/api/meal-plan/v2/week")
async def meal_plan_v2_week_api(
    request: Request,
    response: Response,
    week_start: str | None = Query(default=None, alias="week_start"),
    app_debug: bool | None = Query(default=None, alias="app_debug"),
) -> dict[str, object]:
    telegram_user_id = require_telegram_user_id(request, response)
    resolved_week_start, start_parse_error = resolve_week_start(week_start)
    context = _load_generation_context(telegram_user_id)
    debug_requested = bool(app_debug)
    debug_enabled = bool(APP_DEBUG) or debug_requested
    weekly_usage_counts: dict[int, int] = {}
    weekly_repeat_limit = WEEKLY_PRODUCT_REPEAT_LIMIT

    days: list[dict[str, object]] = []
    for day_index in range(7):
        current_date = resolved_week_start + timedelta(days=day_index)
        day_payload = _get_or_build_day_plan(
            context=context,
            resolved_date=current_date,
            debug_enabled=debug_enabled,
            debug_requested=debug_requested,
            date_parse_error=start_parse_error and day_index == 0,
            weekly_usage_counts=weekly_usage_counts,
            weekly_repeat_limit=weekly_repeat_limit,
        )
        days.append(day_payload)
        _increment_usage_counts(weekly_usage_counts, day_payload)

    week_targets_source = (
        "profile.calories_target"
        if all(day.get("targets_source") == "profile.calories_target" for day in days)
        else "missing"
    )
    return {
        "week_start": resolved_week_start.isoformat(),
        "targets_source": week_targets_source,
        "target_status": "ok" if week_targets_source == "profile.calories_target" else "target_not_computed",
        "weekly_repeat_limit": weekly_repeat_limit,
        "days": days,
    }


@router.post("/api/meal-plan/v2/rebuild")
async def meal_plan_v2_rebuild_day_api(
    request: Request,
    response: Response,
    date_value: str | None = Query(default=None, alias="date"),
    app_debug: bool | None = Query(default=None, alias="app_debug"),
) -> dict[str, object]:
    telegram_user_id = require_telegram_user_id(request, response)
    resolved_date, date_parse_error = resolve_requested_date(date_value)
    context = _load_generation_context(telegram_user_id)
    debug_requested = bool(app_debug)
    debug_enabled = bool(APP_DEBUG) or debug_requested

    existing = read_meal_plan_day(telegram_user_id, resolved_date)
    previous_payload: dict[str, object] | None = None
    if isinstance(existing, dict) and isinstance(existing.get("payload"), dict):
        previous_payload = existing["payload"]

    if previous_payload is None:
        previous_payload = _get_or_build_day_plan(
            context=context,
            resolved_date=resolved_date,
            debug_enabled=debug_enabled,
            debug_requested=False,
            date_parse_error=date_parse_error,
        )
        existing = read_meal_plan_day(telegram_user_id, resolved_date)

    previous_product_ids = _extract_product_ids_from_payload(previous_payload)
    next_regen_nonce = int(existing.get("regen_nonce", 0)) + 1 if isinstance(existing, dict) else 1

    payload = _generate_day_payload(
        context=context,
        resolved_date=resolved_date,
        regen_nonce=next_regen_nonce,
        debug_enabled=debug_enabled,
        date_parse_error=date_parse_error,
        extra_excluded_ids=previous_product_ids,
        weekly_repeat_limit=WEEKLY_PRODUCT_REPEAT_LIMIT,
    )
    upsert_meal_plan_day(
        telegram_user_id=telegram_user_id,
        plan_date=resolved_date,
        payload=payload,
        inputs_hash=str(context["inputs_hash"]),
        regen_nonce=next_regen_nonce,
        algo_version=MEAL_PLAN_ALGO_VERSION,
    )
    if debug_requested:
        base_excluded_ids = set(context["excluded_ids"])
        _, rebuild_excluded_ids, weekly_blocked_ids = _build_effective_excluded_ids(
            base_excluded_ids=base_excluded_ids,
            extra_excluded_ids=previous_product_ids,
            weekly_usage_counts=None,
            weekly_repeat_limit=WEEKLY_PRODUCT_REPEAT_LIMIT,
        )
        return _attach_debug_diagnostics(payload, base_excluded_ids, rebuild_excluded_ids, weekly_blocked_ids)
    return payload


@router.get("/api/shopping-list/v2")
async def shopping_list_v2_api(
    request: Request,
    response: Response,
    date_value: str | None = Query(default=None, alias="date"),
    week_start: str | None = Query(default=None, alias="week_start"),
) -> dict[str, object]:
    telegram_user_id = require_telegram_user_id(request, response)
    if date_value and week_start:
        raise HTTPException(status_code=400, detail={"reason": "invalid_query", "message": "Use either date or week_start"})

    products_lookup = _build_product_lookup()
    payloads: list[dict[str, object]] = []
    missing_dates: list[str] = []

    if week_start:
        resolved_week_start, _ = resolve_week_start(week_start)
        for day_index in range(7):
            current_date = resolved_week_start + timedelta(days=day_index)
            row = read_meal_plan_day(telegram_user_id, current_date)
            if not (isinstance(row, dict) and isinstance(row.get("payload"), dict)):
                missing_dates.append(current_date.isoformat())
                continue
            payloads.append(row["payload"])
        grouped_food, beverages = _aggregate_shopping_items(payloads, products_lookup)
        groups_payload = [
            {"name": group_name, "items": grouped_food[group_name]}
            for group_name in sorted(grouped_food.keys())
        ]
        return {
            "range": "week",
            "week_start": resolved_week_start.isoformat(),
            "days_used": len(payloads),
            "missing_dates": missing_dates,
            "groups": groups_payload,
            "beverages": beverages,
        }

    resolved_date, _ = resolve_requested_date(date_value)
    row = read_meal_plan_day(telegram_user_id, resolved_date)
    if isinstance(row, dict) and isinstance(row.get("payload"), dict):
        payloads.append(row["payload"])
    else:
        missing_dates.append(resolved_date.isoformat())

    grouped_food, beverages = _aggregate_shopping_items(payloads, products_lookup)
    groups_payload = [
        {"name": group_name, "items": grouped_food[group_name]}
        for group_name in sorted(grouped_food.keys())
    ]
    return {
        "range": "day",
        "date": resolved_date.isoformat(),
        "days_used": len(payloads),
        "missing_dates": missing_dates,
        "groups": groups_payload,
        "beverages": beverages,
    }
