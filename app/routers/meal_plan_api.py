from datetime import date, timedelta
import hashlib
import random

from fastapi import APIRouter, HTTPException, Query, Request, Response

from config import APP_DEBUG, MEAL_PLAN_ALGO_VERSION
from app.dependencies import load_profile, require_telegram_user_id
from services.products_db import load_admin_products
from services.storage_db import read_cache_payload, write_cache_payload
from services.targets import calculate_tdee_kcal

router = APIRouter()


MEAL_SLOTS = [
    {"key": "breakfast", "title": "Завтрак"},
    {"key": "lunch", "title": "Обед"},
    {"key": "snack", "title": "Перекус"},
    {"key": "dinner", "title": "Ужин"},
]

BASE_MEAL_SHARES = {"breakfast": 0.25, "lunch": 0.35, "snack": 0.15, "dinner": 0.25}
LOW_CALORIE_MEAL_SHARES = {"breakfast": 0.25, "lunch": 0.35, "snack": 0.10, "dinner": 0.30}
HIGH_CALORIE_MEAL_SHARES = {"breakfast": 0.25, "lunch": 0.33, "snack": 0.20, "dinner": 0.22}

MEAL_PLAN_CACHE_TTL_SECONDS = 24 * 60 * 60


def build_seed_value(telegram_user_id: int, day_date: date, version: str = MEAL_PLAN_ALGO_VERSION) -> str:
    """Построить детерминированный seed как sha256(user_id:date:version)."""
    raw_value = f"{telegram_user_id}:{day_date.isoformat()}:{version}"
    return hashlib.sha256(raw_value.encode("utf-8")).hexdigest()


def build_day_cache_key(telegram_user_id: int, day_date: date) -> str:
    """Построить ключ кэша для дневного рациона."""
    return f"mealplan:day:{telegram_user_id}:{day_date.isoformat()}:{MEAL_PLAN_ALGO_VERSION}"


def build_week_cache_key(telegram_user_id: int, week_start: date) -> str:
    """Построить ключ кэша для недельного рациона."""
    return f"mealplan:week:{telegram_user_id}:{week_start.isoformat()}:{MEAL_PLAN_ALGO_VERSION}"


def build_empty_meals() -> list[dict[str, object]]:
    """Собрать пустую структуру приёмов пищи по финальному контракту API."""
    meals: list[dict[str, object]] = []
    for slot in MEAL_SLOTS:
        meals.append(
            {
                "key": slot["key"],
                "title": slot["title"],
                "target_calories": None,
                "items": [],
                "suggestion": "Сборный приём пищи",
            },
        )
    return meals


def parse_positive_number(value: object) -> float | None:
    """Преобразовать значение к положительному числу, иначе вернуть None."""
    if isinstance(value, bool) or value is None:
        return None
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    if parsed <= 0:
        return None
    return parsed


def normalize_profile_id_set(value: object) -> set[int]:
    """Нормализовать id из профиля к множеству целых чисел без дублей."""
    if not isinstance(value, list):
        return set()
    normalized: set[int] = set()
    for item in value:
        if isinstance(item, bool):
            continue
        try:
            normalized.add(int(item))
        except (TypeError, ValueError):
            continue
    return normalized


def normalize_shares(raw_shares: dict[str, float]) -> dict[str, float]:
    """Нормализовать доли так, чтобы сумма была равна 1.0."""
    total = sum(raw_shares.values())
    if total <= 0:
        return dict(BASE_MEAL_SHARES)
    return {key: value / total for key, value in raw_shares.items()}


def resolve_meal_shares(calories_target: int | None) -> dict[str, float]:
    """Подобрать адаптивные доли калорий по приёмам пищи."""
    if isinstance(calories_target, int) and calories_target > 0:
        if calories_target < 1600:
            return normalize_shares(LOW_CALORIE_MEAL_SHARES)
        if calories_target > 2600:
            return normalize_shares(HIGH_CALORIE_MEAL_SHARES)
    return normalize_shares(BASE_MEAL_SHARES)


def distribute_meal_targets(targets: dict[str, object] | None) -> tuple[list[dict[str, object]], dict[str, object]]:
    """Распределить дневные цели по приёмам пищи с теми же долями для макросов."""
    meal_shares = resolve_meal_shares(targets.get("calories") if isinstance(targets, dict) else None)
    meals = build_empty_meals()

    calories_target = targets.get("calories") if isinstance(targets, dict) else None
    macros_target = targets.get("macros") if isinstance(targets, dict) else None

    meal_macros_targets: dict[str, dict[str, int] | None] = {}
    for meal in meals:
        meal_key = str(meal["key"])
        share = meal_shares.get(meal_key, 0)

        if isinstance(calories_target, int) and calories_target > 0:
            meal["target_calories"] = int(round(calories_target * share))

        meal_macros_targets[meal_key] = None
        if isinstance(macros_target, dict):
            protein = macros_target.get("protein_g")
            fat = macros_target.get("fat_g")
            carbs = macros_target.get("carbs_g")
            if isinstance(protein, int) and isinstance(fat, int) and isinstance(carbs, int):
                meal_macros_targets[meal_key] = {
                    "protein_g": int(round(protein * share)),
                    "fat_g": int(round(fat * share)),
                    "carbs_g": int(round(carbs * share)),
                }

    diagnostics = {"meal_shares": meal_shares, "meal_macros_targets": meal_macros_targets}
    return meals, diagnostics


def apply_goal_to_tdee(tdee_kcal: float, goal: object) -> int:
    """Применить поправку цели к TDEE и вернуть целевые калории."""
    normalized_goal = str(goal).strip().lower() if isinstance(goal, str) else ""
    if normalized_goal == "lose":
        return max(1200, int(round(tdee_kcal * 0.85)))
    if normalized_goal == "gain":
        return int(round(tdee_kcal * 1.10))
    return int(round(tdee_kcal))


def resolve_calories_target(profile: dict[str, object]) -> tuple[int | None, str]:
    """Определить целевые калории по приоритетам профиля."""
    direct_target = parse_positive_number(profile.get("calories_target"))
    if direct_target is not None:
        return int(round(direct_target)), "profile.calories_target"

    required_target = parse_positive_number(profile.get("required_calories_target"))
    if required_target is not None:
        return int(round(required_target)), "profile.required_calories_target"

    tdee_from_profile = parse_positive_number(profile.get("tdee_calories"))
    if tdee_from_profile is not None:
        return apply_goal_to_tdee(tdee_from_profile, profile.get("goal")), "profile.tdee_calories"

    tdee_calculated = calculate_tdee_kcal(profile)
    if isinstance(tdee_calculated, int) and tdee_calculated > 0:
        return apply_goal_to_tdee(float(tdee_calculated), profile.get("goal")), "calculated_tdee"

    return None, "unresolved"


def normalize_macros_payload(value: object) -> dict[str, int] | None:
    """Нормализовать готовые макросы из профиля до целых граммов."""
    if not isinstance(value, dict):
        return None
    protein = parse_positive_number(value.get("protein_g"))
    fat = parse_positive_number(value.get("fat_g"))
    carbs = parse_positive_number(value.get("carbs_g"))
    if protein is None and fat is None and carbs is None:
        return None
    return {"protein_g": int(round(protein or 0)), "fat_g": int(round(fat or 0)), "carbs_g": int(round(carbs or 0))}


def calculate_macros_target(calories_target: int, weight_kg: float) -> dict[str, int]:
    """Рассчитать целевые макросы: белок 1.6 г/кг, жир 0.8 г/кг, углеводы — остаток."""
    protein_g = max(0, int(round(weight_kg * 1.6)))
    fat_g = max(0, int(round(weight_kg * 0.8)))

    calories_left = calories_target - (protein_g * 4 + fat_g * 9)
    carbs_g = int(round(calories_left / 4))

    if carbs_g < 0:
        # Если углеводы отрицательные, снижаем жир до минимально разумного уровня.
        fat_min_g = max(30, int(round(weight_kg * 0.6)))
        fat_g = max(fat_min_g, 0)
        calories_left = calories_target - (protein_g * 4 + fat_g * 9)
        carbs_g = int(round(calories_left / 4))

        if carbs_g < 0:
            carbs_g = 0
            fat_available = calories_target - protein_g * 4
            fat_g = max(0, int(round(fat_available / 9)))

    return {"protein_g": protein_g, "fat_g": fat_g, "carbs_g": max(0, carbs_g)}


def resolve_targets(profile: dict[str, object]) -> tuple[dict[str, object] | None, dict[str, object]]:
    """Определить целевые калории и БЖУ с прозрачным источником и списком missing-полей."""
    calories_target, calories_source = resolve_calories_target(profile)
    if calories_target is None:
        missing_fields = collect_missing_target_fields(profile)
        return None, {
            "targets_source": {"calories": None, "macros": None},
            "missing_fields": missing_fields,
            "calories_source": calories_source,
            "macros_source": "unresolved",
        }

    macros_from_profile = normalize_macros_payload(profile.get("macros_target"))
    if macros_from_profile is not None:
        return {"calories": calories_target, "macros": macros_from_profile}, {
            "targets_source": {"calories": calories_source, "macros": "profile.macros_target"},
            "missing_fields": [],
            "calories_source": calories_source,
            "macros_source": "profile.macros_target",
        }

    weight_kg = parse_positive_number(profile.get("weight_kg"))
    if weight_kg is None:
        missing_fields = collect_missing_target_fields(profile)
        if "weight_kg" not in missing_fields:
            missing_fields.append("weight_kg")
        return None, {
            "targets_source": {"calories": calories_source, "macros": None},
            "missing_fields": missing_fields,
            "calories_source": calories_source,
            "macros_source": "weight_missing",
        }

    return {"calories": calories_target, "macros": calculate_macros_target(calories_target, weight_kg)}, {
        "targets_source": {"calories": calories_source, "macros": "calculated_from_weight"},
        "missing_fields": [],
        "calories_source": calories_source,
        "macros_source": "calculated_from_weight",
    }


def resolve_product_kcal_100(item: dict[str, object]) -> float | None:
    """Получить калорийность на 100 г из поддерживаемых полей продукта."""
    kcal = parse_positive_number(item.get("kcal_per_100g"))
    if kcal is not None:
        return kcal
    return parse_positive_number(item.get("kcal"))


def build_products_pool(
    products: list[dict[str, object]],
    favorite_ids: set[int],
    excluded_ids: set[int],
) -> tuple[list[dict[str, object]], bool, dict[str, int]]:
    """Построить пул продуктов: сначала kcal>0, потом excluded, затем favorites при доступности."""
    total = len(products)

    kcal_filtered: list[dict[str, object]] = []
    filtered_kcal_zero = 0
    for item in products:
        product_id = item.get("id")
        if not isinstance(product_id, int):
            continue
        kcal_100 = resolve_product_kcal_100(item)
        if kcal_100 is None or kcal_100 <= 0:
            filtered_kcal_zero += 1
            continue
        kcal_filtered.append(item)

    available = [item for item in kcal_filtered if item.get("id") not in excluded_ids]
    after_excluded = len(available)

    if favorite_ids:
        favorite_products = [item for item in available if item.get("id") in favorite_ids]
        if favorite_products:
            return favorite_products, True, {
                "total": total,
                "filtered_kcal_zero": filtered_kcal_zero,
                "after_excluded": after_excluded,
                "after_favorites": len(favorite_products),
            }

    return available, False, {
        "total": total,
        "filtered_kcal_zero": filtered_kcal_zero,
        "after_excluded": after_excluded,
        "after_favorites": len(available),
    }


def prepare_products_for_planning(products: list[dict[str, object]]) -> list[dict[str, object]]:
    """Подготовить и отфильтровать продукты для эвристики (только kcal > 0)."""
    prepared: list[dict[str, object]] = []
    for item in products:
        product_id = item.get("id")
        if not isinstance(product_id, int):
            continue

        kcal_100 = resolve_product_kcal_100(item)
        if kcal_100 is None or kcal_100 <= 0:
            continue

        protein_100 = parse_positive_number(item.get("protein_g")) or 0.0
        fat_100 = parse_positive_number(item.get("fat_g")) or 0.0
        carbs_100 = parse_positive_number(item.get("carbs_g")) or 0.0

        name = str(item.get("name") or "").strip()
        group_name = str(item.get("group") or "").strip().lower()
        tags = item.get("tags") if isinstance(item.get("tags"), list) else []
        tags_text = " ".join(str(tag).lower() for tag in tags)
        marker = f"{name.lower()} {group_name} {tags_text}"

        prepared.append(
            {
                "id": product_id,
                "name": name or f"Продукт {product_id}",
                "group": item.get("group"),
                "kcal_100": kcal_100,
                "protein_100": protein_100,
                "fat_100": fat_100,
                "carbs_100": carbs_100,
                "protein_density": protein_100 / max(kcal_100, 1.0),
                "fat_density": fat_100 / max(kcal_100, 1.0),
                "carb_density": carbs_100 / max(kcal_100, 1.0),
                "marker": marker,
            },
        )
    return prepared


def choose_best_product(
    candidates: list[dict[str, object]],
    used_ids: set[int],
    score_key: str,
    rng: random.Random,
) -> dict[str, object] | None:
    """Выбрать лучший продукт по заданному скорингу, избегая дублирования в одном meal."""
    shuffled_candidates = list(candidates)
    rng.shuffle(shuffled_candidates)
    sorted_candidates = sorted(
        shuffled_candidates,
        key=lambda item: (float(item.get(score_key) or 0.0), float(item.get("kcal_100") or 0.0)),
        reverse=True,
    )
    top_candidates = sorted_candidates[:3]
    rng.shuffle(top_candidates)
    for product in top_candidates:
        product_id = product.get("id")
        if isinstance(product_id, int) and product_id not in used_ids:
            return product
    for product in sorted_candidates:
        product_id = product.get("id")
        if isinstance(product_id, int) and product_id not in used_ids:
            return product
    return None


def find_meal_components(
    products: list[dict[str, object]],
    rng: random.Random,
) -> tuple[dict[str, object] | None, dict[str, object] | None, dict[str, object] | None]:
    """Подобрать компоненты meal: белковая база, углеводная часть, опциональный жир."""
    used_ids: set[int] = set()

    protein_candidates = [
        item for item in products if float(item.get("protein_100") or 0) >= 8 or float(item.get("protein_density") or 0) >= 0.08
    ]
    protein_base = choose_best_product(protein_candidates or products, used_ids, "protein_density", rng)
    if protein_base and isinstance(protein_base.get("id"), int):
        used_ids.add(int(protein_base["id"]))

    carb_candidates = [
        item
        for item in products
        if float(item.get("carbs_100") or 0) >= 8
        or "овощ" in str(item.get("marker"))
        or "круп" in str(item.get("marker"))
        or "фрукт" in str(item.get("marker"))
    ]
    carb_base = choose_best_product(carb_candidates or products, used_ids, "carb_density", rng)
    if carb_base and isinstance(carb_base.get("id"), int):
        used_ids.add(int(carb_base["id"]))

    fat_candidates = [
        item for item in products if float(item.get("fat_100") or 0) >= 10 or float(item.get("fat_density") or 0) >= 0.06
    ]
    fat_addon = choose_best_product(fat_candidates, used_ids, "fat_density", rng)
    return protein_base, carb_base, fat_addon


def round_grams(value: float) -> int:
    """Округлить граммовку до шага 10 г и ограничить минимумом 10 г."""
    return max(10, int(round(value / 10.0) * 10))


def build_item_from_product(product: dict[str, object], grams: int) -> dict[str, object]:
    """Сформировать элемент meal с расчётом КБЖУ от граммовки."""
    factor = grams / 100.0
    calories = int(round(float(product.get("kcal_100") or 0.0) * factor))
    p_g = int(round(float(product.get("protein_100") or 0.0) * factor))
    f_g = int(round(float(product.get("fat_100") or 0.0) * factor))
    c_g = int(round(float(product.get("carbs_100") or 0.0) * factor))
    return {
        "product_id": product.get("id"),
        "name": product.get("name"),
        "grams": grams,
        "calories": calories,
        "p_g": p_g,
        "f_g": f_g,
        "c_g": c_g,
    }


def sum_items(items: list[dict[str, object]]) -> dict[str, int]:
    """Посчитать сумму калорий и макросов по списку элементов."""
    totals = {"calories": 0, "protein_g": 0, "fat_g": 0, "carbs_g": 0}
    for item in items:
        totals["calories"] += int(item.get("calories") or 0)
        totals["protein_g"] += int(item.get("p_g") or 0)
        totals["fat_g"] += int(item.get("f_g") or 0)
        totals["carbs_g"] += int(item.get("c_g") or 0)
    return totals


def calc_deviation_pct(actual: int, target: int | None) -> float | None:
    """Посчитать отклонение в процентах относительно целевого значения."""
    if not isinstance(target, int) or target <= 0:
        return None
    return round(((actual - target) / target) * 100, 2)


def adjust_meal_grams(
    meal_items: list[dict[str, object]],
    meal_target_calories: int | None,
    products_by_id: dict[int, dict[str, object]],
) -> list[dict[str, object]]:
    """Итеративно подправить граммовки до попадания в коридор по калориям ±7%."""
    if not isinstance(meal_target_calories, int) or meal_target_calories <= 0:
        return meal_items

    for _ in range(10):
        totals = sum_items(meal_items)
        delta = meal_target_calories - totals["calories"]
        tolerance = meal_target_calories * 0.07
        if abs(delta) <= tolerance:
            break

        step = 20 if abs(delta) > meal_target_calories * 0.15 else 10
        # При недоборе добавляем сначала углеводный продукт, затем белковый.
        if delta > 0:
            order = [1, 0, 2]
            sign = 1
        else:
            order = [2, 1, 0]
            sign = -1

        changed = False
        for index in order:
            if index >= len(meal_items):
                continue
            item = meal_items[index]
            current_grams = int(item.get("grams") or 0)
            min_grams = 20 if index == 0 else 10
            new_grams = current_grams + sign * step
            if new_grams < min_grams:
                continue

            product_id = item.get("product_id")
            if not isinstance(product_id, int):
                continue
            product = products_by_id.get(product_id)
            if not product:
                continue

            meal_items[index] = build_item_from_product(product, new_grams)
            changed = True
            break

        if not changed:
            break

    return meal_items


def build_meal_items(
    meal_target_calories: int | None,
    meal_macro_target: dict[str, int] | None,
    prepared_products: list[dict[str, object]],
    rng: random.Random,
) -> tuple[list[dict[str, object]], dict[str, object]]:
    """Собрать продукты и граммовки для одного приёма пищи."""
    if not prepared_products:
        return [], {"strategy": "no_products"}

    protein_base, carb_base, fat_addon = find_meal_components(prepared_products, rng)
    chosen_products = [item for item in [protein_base, carb_base, fat_addon] if isinstance(item, dict)]
    chosen_products = chosen_products[:3]

    # Для более вариативного приёма пищи можем добавить 4-й продукт,
    # если целевая калорийность высокая и есть свободные кандидаты.
    if isinstance(meal_target_calories, int) and meal_target_calories >= 550 and len(chosen_products) >= 3:
        used_ids = {int(item.get("id")) for item in chosen_products if isinstance(item.get("id"), int)}
        extra_candidates = [item for item in prepared_products if isinstance(item.get("id"), int) and int(item.get("id")) not in used_ids]
        if extra_candidates:
            rng.shuffle(extra_candidates)
            chosen_products.append(extra_candidates[0])

    if len(chosen_products) < 2:
        # Fallback для бедного каталога: берём первые 2 валидных продукта.
        fallback = list(prepared_products)
        rng.shuffle(fallback)
        fallback = fallback[:2]
        chosen_products = [item for item in fallback if isinstance(item, dict)]

    if not chosen_products:
        return [], {"strategy": "no_candidates"}

    meal_items: list[dict[str, object]] = []
    products_by_id = {int(item["id"]): item for item in chosen_products if isinstance(item.get("id"), int)}

    protein_target = meal_macro_target.get("protein_g") if isinstance(meal_macro_target, dict) else None

    for index, product in enumerate(chosen_products):
        kcal_100 = float(product.get("kcal_100") or 0.0)
        protein_100 = float(product.get("protein_100") or 0.0)

        if index == 0:
            # Белковой базе пытаемся дать 50–65% целевого белка meal.
            if isinstance(protein_target, int) and protein_target > 0 and protein_100 > 0:
                grams = round_grams((protein_target * 0.6 / protein_100) * 100)
            elif isinstance(meal_target_calories, int) and meal_target_calories > 0 and kcal_100 > 0:
                grams = round_grams((meal_target_calories * 0.40 / kcal_100) * 100)
            else:
                grams = 120
        elif index == 1:
            if isinstance(meal_target_calories, int) and meal_target_calories > 0 and kcal_100 > 0:
                grams = round_grams((meal_target_calories * 0.45 / kcal_100) * 100)
            else:
                grams = 150
        else:
            grams = 20

        meal_items.append(build_item_from_product(product, grams))

    meal_items = adjust_meal_grams(meal_items, meal_target_calories, products_by_id)
    totals = sum_items(meal_items)

    protein_target = meal_macro_target.get("protein_g") if isinstance(meal_macro_target, dict) else None
    fat_target = meal_macro_target.get("fat_g") if isinstance(meal_macro_target, dict) else None
    carbs_target = meal_macro_target.get("carbs_g") if isinstance(meal_macro_target, dict) else None

    kcal_deviation = calc_deviation_pct(totals["calories"], meal_target_calories)
    protein_deviation = calc_deviation_pct(totals["protein_g"], protein_target)
    fat_deviation = calc_deviation_pct(totals["fat_g"], fat_target)
    carbs_deviation = calc_deviation_pct(totals["carbs_g"], carbs_target)

    kcal_within = (abs(kcal_deviation) <= 7) if isinstance(kcal_deviation, float) else None
    protein_within = (abs(protein_deviation) <= 8) if isinstance(protein_deviation, float) else None
    fat_within = (abs(fat_deviation) <= 12) if isinstance(fat_deviation, float) else None
    carbs_within = (abs(carbs_deviation) <= 12) if isinstance(carbs_deviation, float) else None

    diagnostics = {
        "strategy": "heuristic_v1",
        "selected_product_ids": [item.get("product_id") for item in meal_items],
        "kcal_deviation": kcal_deviation,
        "protein_deviation": protein_deviation,
        "fat_deviation": fat_deviation,
        "carbs_deviation": carbs_deviation,
        "within_tolerance": {
            "kcal_7pct": kcal_within,
            "protein_8pct": protein_within,
            "fat_12pct": fat_within,
            "carbs_12pct": carbs_within,
        },
        # Приоритет калориям: если макросы не попали, но калории в коридоре,
        # считаем результат допустимым для эвристики v1.
        "calories_priority_applied": bool(kcal_within is True and (protein_within is False or fat_within is False or carbs_within is False)),
    }
    return meal_items, diagnostics


def calculate_day_totals(meals: list[dict[str, object]]) -> dict[str, int]:
    """Посчитать суммарные КБЖУ за день по всем meals."""
    totals = {"calories": 0, "protein_g": 0, "fat_g": 0, "carbs_g": 0}
    for meal in meals:
        for item in meal.get("items", []):
            totals["calories"] += int(item.get("calories") or 0)
            totals["protein_g"] += int(item.get("p_g") or 0)
            totals["fat_g"] += int(item.get("f_g") or 0)
            totals["carbs_g"] += int(item.get("c_g") or 0)
    return totals




def has_any_keyword(text: str, keywords: tuple[str, ...]) -> bool:
    """Проверить, содержит ли текст хотя бы одно ключевое слово."""
    return any(keyword in text for keyword in keywords)


def build_meal_suggestion(selected_product_ids: list[int], products_by_id: dict[int, dict[str, object]]) -> str:
    """Подобрать человекочитаемое название блюда по простым шаблонам."""
    markers: list[str] = []
    for product_id in selected_product_ids:
        product = products_by_id.get(product_id)
        if not isinstance(product, dict):
            continue
        marker = str(product.get("marker") or "").lower()
        if marker:
            markers.append(marker)

    if not markers:
        return "Сборный приём пищи"

    joined = " ".join(markers)

    has_eggs = has_any_keyword(joined, ("яйц",))
    has_milk_or_cheese = has_any_keyword(joined, ("молок", "сыр", "брынз", "моцарел"))
    has_curd = has_any_keyword(joined, ("творог",))
    has_fruit = has_any_keyword(joined, ("фрукт", "ягод", "банан", "яблок", "груш", "апельсин"))
    has_poultry = has_any_keyword(joined, ("куриц", "индейк"))
    has_grain = has_any_keyword(joined, ("круп", "греч", "рис", "булгур", "киноа", "овсян", "макарон"))
    has_fish = has_any_keyword(joined, ("рыб", "лосос", "тунец", "треск", "форел", "хек"))
    has_vegetables = has_any_keyword(joined, ("овощ", "салат", "брокк", "капуст", "огур", "помид", "перец", "морков"))
    has_oatmeal = has_any_keyword(joined, ("овсян",))
    has_yogurt = has_any_keyword(joined, ("йогурт",))

    if has_eggs and has_milk_or_cheese:
        return "Омлет"
    if has_curd and has_fruit:
        return "Творожная миска"
    if has_poultry and has_grain:
        return "Тарелка с курицей и гарниром"
    if has_fish and has_vegetables:
        return "Рыба с овощами"
    if has_oatmeal and has_milk_or_cheese:
        return "Овсянка"
    if has_yogurt and has_fruit:
        return "Йогурт с фруктами"

    return "Сборный приём пищи"


def build_meals_with_products(
    meals: list[dict[str, object]],
    distribution_diagnostics: dict[str, object],
    products_pool: list[dict[str, object]],
    seed_value: str,
) -> tuple[list[dict[str, object]], dict[str, object], dict[str, object]]:
    """Сформировать наполненные meals и дневные totals по эвристике v1."""
    rng = random.Random(seed_value)
    prepared_products = prepare_products_for_planning(products_pool)
    rng.shuffle(prepared_products)

    meal_macros_targets = distribution_diagnostics.get("meal_macros_targets")
    if not isinstance(meal_macros_targets, dict):
        meal_macros_targets = {}

    products_by_id = {
        int(product.get("id")): product
        for product in prepared_products
        if isinstance(product.get("id"), int)
    }

    meal_generation: dict[str, object] = {}
    for meal in meals:
        meal_key = str(meal.get("key") or "")
        meal_macro_target = meal_macros_targets.get(meal_key)
        meal_items, meal_diag = build_meal_items(
            meal_target_calories=meal.get("target_calories") if isinstance(meal.get("target_calories"), int) else None,
            meal_macro_target=meal_macro_target if isinstance(meal_macro_target, dict) else None,
            prepared_products=prepared_products,
            rng=rng,
        )
        meal["items"] = meal_items

        selected_ids = [
            int(product_id)
            for product_id in meal_diag.get("selected_product_ids", [])
            if isinstance(product_id, int)
        ]
        meal["suggestion"] = build_meal_suggestion(selected_ids, products_by_id)
        meal_generation[meal_key] = meal_diag

    day_totals = calculate_day_totals(meals)
    day_diagnostics = {
        "valid_products_count": len(prepared_products),
        "meal_generation": meal_generation,
    }
    return meals, day_totals, day_diagnostics




def is_profile_valid_for_targets(profile: dict[str, object]) -> bool:
    """Проверить, хватает ли данных профиля для расчёта целевых калорий."""
    if parse_positive_number(profile.get("calories_target")) is not None:
        return True
    if parse_positive_number(profile.get("required_calories_target")) is not None:
        return True
    if parse_positive_number(profile.get("tdee_calories")) is not None:
        return True

    required_fields = ("sex", "birth_date", "height_cm", "weight_kg", "activity_factor")
    for field in required_fields:
        value = profile.get(field)
        if field in {"height_cm", "weight_kg", "activity_factor"}:
            if parse_positive_number(value) is None:
                return False
        else:
            if not isinstance(value, str) or not value.strip():
                return False
    return True


def collect_missing_target_fields(profile: dict[str, object]) -> list[str]:
    """Собрать список отсутствующих полей, мешающих расчёту целевых значений."""
    missing: list[str] = []
    if parse_positive_number(profile.get("calories_target")) is None:
        missing.append("calories_target")
    if parse_positive_number(profile.get("required_calories_target")) is None:
        missing.append("required_calories_target")
    if parse_positive_number(profile.get("tdee_calories")) is None:
        missing.append("tdee_calories")

    required_fields = ("sex", "birth_date", "height_cm", "weight_kg", "activity_factor")
    for field in required_fields:
        value = profile.get(field)
        if field in {"height_cm", "weight_kg", "activity_factor"}:
            if parse_positive_number(value) is None:
                missing.append(field)
        else:
            if not isinstance(value, str) or not value.strip():
                missing.append(field)

    # Убираем дубли, сохраняя порядок.
    return list(dict.fromkeys(missing))


def collect_selected_product_ids(meals: list[dict[str, object]]) -> set[int]:
    """Собрать set product_id, использованных в сгенерированном рационе."""
    selected_ids: set[int] = set()
    for meal in meals:
        items = meal.get("items") if isinstance(meal, dict) else []
        if not isinstance(items, list):
            continue
        for item in items:
            if not isinstance(item, dict):
                continue
            product_id = item.get("product_id")
            if isinstance(product_id, int):
                selected_ids.add(product_id)
    return selected_ids


def build_self_checks(
    profile: dict[str, object],
    targets: dict[str, object] | None,
    totals: dict[str, int],
    meals: list[dict[str, object]],
    excluded_ids: set[int],
    favorite_ids: set[int],
    used_favorites_only: bool,
) -> dict[str, object]:
    """Собрать минимальные проверки качества генерации рациона."""
    selected_ids = collect_selected_product_ids(meals)
    target_calories = targets.get("calories") if isinstance(targets, dict) else None

    day_kcal_within_5pct = None
    if isinstance(target_calories, int) and target_calories > 0:
        day_delta = abs(totals.get("calories", 0) - target_calories) / target_calories
        day_kcal_within_5pct = day_delta <= 0.05

    checks = {
        "valid_profile": is_profile_valid_for_targets(profile),
        "targets_calories_not_null": isinstance(target_calories, int) and target_calories > 0,
        "day_kcal_within_5pct": day_kcal_within_5pct,
        "excluded_not_in_meals": selected_ids.isdisjoint(excluded_ids),
        "favorites_only_respected": (not used_favorites_only) or selected_ids.issubset(favorite_ids),
    }

    if checks["valid_profile"] and not checks["targets_calories_not_null"]:
        checks["valid_profile_targets_expectation_failed"] = True

    return checks





def ensure_preferences_completed(profile: dict[str, object], favorite_ids: set[int]) -> None:
    """Проверить обязательность продуктового онбординга перед генерацией рациона."""
    onboarding_completed = profile.get("preferences_onboarding_completed") is True
    if onboarding_completed and len(favorite_ids) > 0:
        return

    raise HTTPException(status_code=422, detail={"reason": "preferences_not_completed"})


def resolve_requested_date(date_value: str | None) -> tuple[date, bool]:
    """Преобразовать входную дату; при ошибке вернуть today и флаг ошибки."""
    resolved_date = date.today()
    date_parse_error = False
    if isinstance(date_value, str) and date_value.strip():
        try:
            resolved_date = date.fromisoformat(date_value.strip())
        except ValueError:
            # Сохраняем совместимость: при ошибке формата не падаем, а используем today.
            date_parse_error = True
    return resolved_date, date_parse_error


def resolve_week_start(start_value: str | None) -> tuple[date, bool]:
    """Определить начало недели (ISO, понедельник) по входной дате или текущей дате."""
    parse_error = False
    if isinstance(start_value, str) and start_value.strip():
        try:
            start_date = date.fromisoformat(start_value.strip())
        except ValueError:
            start_date = date.today()
            parse_error = True
    else:
        start_date = date.today()

    week_start = start_date - timedelta(days=start_date.weekday())
    return week_start, parse_error


def build_meal_plan_payload_for_date(
    resolved_date: date,
    safe_profile: dict[str, object],
    raw_products: list[dict[str, object]],
    favorite_ids: set[int],
    excluded_ids: set[int],
    products_pool: list[dict[str, object]],
    products_pool_stats: dict[str, int],
    used_favorites_only: bool,
    telegram_user_id: int,
    debug_enabled: bool,
    date_parse_error: bool,
) -> dict[str, object]:
    """Собрать payload рациона на одну дату из уже загруженных профиля и каталога."""
    targets, targets_diagnostics = resolve_targets(safe_profile)
    meals, distribution_diagnostics = distribute_meal_targets(targets)
    seed_value = build_seed_value(telegram_user_id, resolved_date)

    generation_diagnostics: dict[str, object] = {"strategy": "not_executed"}
    if not products_pool:
        meals = []
        totals = {"calories": 0, "protein_g": 0, "fat_g": 0, "carbs_g": 0}
    else:
        meals, totals, generation_diagnostics = build_meals_with_products(
            meals,
            distribution_diagnostics,
            products_pool,
            seed_value,
        )

    self_checks = build_self_checks(
        profile=safe_profile,
        targets=targets,
        totals=totals,
        meals=meals,
        excluded_ids=excluded_ids,
        favorite_ids=favorite_ids,
        used_favorites_only=used_favorites_only,
    )

    meta: dict[str, object] = {
        "seed": seed_value,
        "algo_version": MEAL_PLAN_ALGO_VERSION,
        "targets_source": targets_diagnostics.get("targets_source"),
        "missing_fields": targets_diagnostics.get("missing_fields", []),
        "used_favorites_only": used_favorites_only,
        "contract_stage": "stage_10_debug_checks",
        "date_parse_error": date_parse_error,
        "catalog_size": len(raw_products),
        "pool_size": len(products_pool),
        "reason": "empty_products_pool" if len(products_pool) == 0 else None,
        "favorite_ids_count": len(favorite_ids),
        "excluded_ids_count": len(excluded_ids),
        "self_checks": self_checks,
    }

    if debug_enabled:
        selected_ids = sorted(collect_selected_product_ids(meals))
        meal_kcal_deviations: dict[str, float | None] = {}
        for meal in meals:
            meal_key = str(meal.get("key") or "")
            target_kcal = meal.get("target_calories") if isinstance(meal.get("target_calories"), int) else None
            meal_totals = sum_items(meal.get("items") if isinstance(meal.get("items"), list) else [])
            if isinstance(target_kcal, int) and target_kcal > 0:
                meal_kcal_deviations[meal_key] = round(((meal_totals["calories"] - target_kcal) / target_kcal) * 100, 2)
            else:
                meal_kcal_deviations[meal_key] = None

        day_kcal_deviation = None
        day_macro_deviations = {"protein_g": None, "fat_g": None, "carbs_g": None}
        day_macro_within = {"protein_8pct": None, "fat_12pct": None, "carbs_12pct": None}

        target_calories = targets.get("calories") if isinstance(targets, dict) else None
        target_macros = targets.get("macros") if isinstance(targets, dict) else None
        if isinstance(target_calories, int) and target_calories > 0:
            day_kcal_deviation = round(((totals.get("calories", 0) - target_calories) / target_calories) * 100, 2)

        if isinstance(target_macros, dict):
            protein_target = target_macros.get("protein_g") if isinstance(target_macros.get("protein_g"), int) else None
            fat_target = target_macros.get("fat_g") if isinstance(target_macros.get("fat_g"), int) else None
            carbs_target = target_macros.get("carbs_g") if isinstance(target_macros.get("carbs_g"), int) else None

            protein_dev = calc_deviation_pct(int(totals.get("protein_g", 0)), protein_target)
            fat_dev = calc_deviation_pct(int(totals.get("fat_g", 0)), fat_target)
            carbs_dev = calc_deviation_pct(int(totals.get("carbs_g", 0)), carbs_target)

            day_macro_deviations = {"protein_g": protein_dev, "fat_g": fat_dev, "carbs_g": carbs_dev}
            day_macro_within = {
                "protein_8pct": (abs(protein_dev) <= 8) if isinstance(protein_dev, float) else None,
                "fat_12pct": (abs(fat_dev) <= 12) if isinstance(fat_dev, float) else None,
                "carbs_12pct": (abs(carbs_dev) <= 12) if isinstance(carbs_dev, float) else None,
            }

        meta.update(
            {
                "debug_enabled": True,
                "missing_fields": targets_diagnostics.get("missing_fields", []),
                "pool": products_pool_stats,
                "used_product_ids": selected_ids,
                "meal_kcal_deviations_pct": meal_kcal_deviations,
                "day_kcal_deviation_pct": day_kcal_deviation,
                "day_macro_deviations_pct": day_macro_deviations,
                "day_macro_within_tolerance": day_macro_within,
                "targets_diagnostics": targets_diagnostics,
                "distribution_diagnostics": distribution_diagnostics,
                "generation_diagnostics": generation_diagnostics,
            },
        )

    return {
        "date": resolved_date.isoformat(),
        "targets": targets,
        "meals": meals,
        "totals": totals,
        "meta": meta,
    }


@router.get("/api/meal-plan")
async def meal_plan_api(
    request: Request,
    response: Response,
    date_value: str | None = Query(default=None, alias="date"),
    app_debug: bool | None = Query(default=None, alias="app_debug"),
) -> dict[str, object]:
    """Вернуть backend-контракт рациона на дату c эвристическим подбором блюд (v1)."""
    telegram_user_id = require_telegram_user_id(request, response)
    profile = load_profile(telegram_user_id)

    resolved_date, date_parse_error = resolve_requested_date(date_value)

    raw_products = load_admin_products()
    safe_profile = profile if isinstance(profile, dict) else {}
    favorite_ids = normalize_profile_id_set(safe_profile.get("favorite_product_ids"))
    excluded_ids = normalize_profile_id_set(safe_profile.get("excluded_product_ids"))
    ensure_preferences_completed(safe_profile, favorite_ids)
    products_pool, used_favorites_only, products_pool_stats = build_products_pool(raw_products, favorite_ids, excluded_ids)

    cache_key = build_day_cache_key(telegram_user_id, resolved_date)
    cached_payload = read_cache_payload(cache_key)
    if isinstance(cached_payload, dict):
        return cached_payload

    debug_enabled = bool(APP_DEBUG) or bool(app_debug)
    payload = build_meal_plan_payload_for_date(
        resolved_date=resolved_date,
        safe_profile=safe_profile,
        raw_products=raw_products,
        favorite_ids=favorite_ids,
        excluded_ids=excluded_ids,
        products_pool=products_pool,
        products_pool_stats=products_pool_stats,
        used_favorites_only=used_favorites_only,
        telegram_user_id=telegram_user_id,
        debug_enabled=debug_enabled,
        date_parse_error=date_parse_error,
    )
    write_cache_payload(cache_key, payload, MEAL_PLAN_CACHE_TTL_SECONDS)
    return payload


@router.get("/api/meal-plan/week")
async def meal_plan_week_api(
    request: Request,
    response: Response,
    start: str | None = Query(default=None),
    app_debug: bool | None = Query(default=None, alias="app_debug"),
) -> dict[str, object]:
    """Вернуть рацион на 7 дней, начиная с понедельника выбранной ISO-недели."""
    telegram_user_id = require_telegram_user_id(request, response)
    profile = load_profile(telegram_user_id)

    week_start, start_parse_error = resolve_week_start(start)

    raw_products = load_admin_products()
    safe_profile = profile if isinstance(profile, dict) else {}
    favorite_ids = normalize_profile_id_set(safe_profile.get("favorite_product_ids"))
    excluded_ids = normalize_profile_id_set(safe_profile.get("excluded_product_ids"))
    ensure_preferences_completed(safe_profile, favorite_ids)
    products_pool, used_favorites_only, products_pool_stats = build_products_pool(raw_products, favorite_ids, excluded_ids)

    week_cache_key = build_week_cache_key(telegram_user_id, week_start)
    cached_week_payload = read_cache_payload(week_cache_key)
    if isinstance(cached_week_payload, dict):
        return cached_week_payload

    debug_enabled = bool(APP_DEBUG) or bool(app_debug)

    days: list[dict[str, object]] = []
    for day_index in range(7):
        current_date = week_start + timedelta(days=day_index)
        day_payload = build_meal_plan_payload_for_date(
            resolved_date=current_date,
            safe_profile=safe_profile,
            raw_products=raw_products,
            favorite_ids=favorite_ids,
            excluded_ids=excluded_ids,
            products_pool=products_pool,
            used_favorites_only=used_favorites_only,
            telegram_user_id=telegram_user_id,
            debug_enabled=debug_enabled,
            date_parse_error=start_parse_error and day_index == 0,
        )
        days.append(day_payload)

    payload = {
        "week_start": week_start.isoformat(),
        "days": days,
    }
    write_cache_payload(week_cache_key, payload, MEAL_PLAN_CACHE_TTL_SECONDS)
    return payload
