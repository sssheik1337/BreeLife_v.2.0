from datetime import date

from fastapi import APIRouter, Query, Request, Response

from app.dependencies import load_profile, require_telegram_user_id
from services.products_db import load_admin_products
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
    """Определить целевые калории и БЖУ с диагностикой источника расчёта."""
    calories_target, calories_source = resolve_calories_target(profile)
    if calories_target is None:
        return None, {"calories_source": calories_source, "macros_source": "unresolved"}

    macros_from_profile = normalize_macros_payload(profile.get("macros_target"))
    if macros_from_profile is not None:
        return {"calories": calories_target, "macros": macros_from_profile}, {
            "calories_source": calories_source,
            "macros_source": "profile.macros_target",
        }

    legacy_macros = normalize_macros_payload(profile.get("macros"))
    if legacy_macros is not None:
        return {"calories": calories_target, "macros": legacy_macros}, {
            "calories_source": calories_source,
            "macros_source": "profile.macros",
        }

    weight_kg = parse_positive_number(profile.get("weight_kg"))
    if weight_kg is None:
        return {
            "calories": calories_target,
            "macros": {"protein_g": None, "fat_g": None, "carbs_g": None},
        }, {"calories_source": calories_source, "macros_source": "weight_missing"}

    return {"calories": calories_target, "macros": calculate_macros_target(calories_target, weight_kg)}, {
        "calories_source": calories_source,
        "macros_source": "calculated_from_weight",
    }


def build_products_pool(
    products: list[dict[str, object]],
    favorite_ids: set[int],
    excluded_ids: set[int],
) -> tuple[list[dict[str, object]], bool]:
    """Построить пул продуктов: excluded всегда убрать, favorites использовать при доступности."""
    available = []
    for item in products:
        product_id = item.get("id")
        if not isinstance(product_id, int):
            continue
        if product_id in excluded_ids:
            continue
        available.append(item)

    if favorite_ids:
        favorite_products = [item for item in available if item.get("id") in favorite_ids]
        if favorite_products:
            return favorite_products, True

    return available, False


def prepare_products_for_planning(products: list[dict[str, object]]) -> list[dict[str, object]]:
    """Подготовить и отфильтровать продукты для эвристики (только kcal > 0)."""
    prepared: list[dict[str, object]] = []
    for item in products:
        product_id = item.get("id")
        if not isinstance(product_id, int):
            continue

        kcal_100 = parse_positive_number(item.get("kcal"))
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


def choose_best_product(candidates: list[dict[str, object]], used_ids: set[int], score_key: str) -> dict[str, object] | None:
    """Выбрать лучший продукт по заданному скорингу, избегая дублирования в одном meal."""
    sorted_candidates = sorted(
        candidates,
        key=lambda item: (float(item.get(score_key) or 0.0), float(item.get("kcal_100") or 0.0)),
        reverse=True,
    )
    for product in sorted_candidates:
        product_id = product.get("id")
        if isinstance(product_id, int) and product_id not in used_ids:
            return product
    return None


def find_meal_components(products: list[dict[str, object]]) -> tuple[dict[str, object] | None, dict[str, object] | None, dict[str, object] | None]:
    """Подобрать компоненты meal: белковая база, углеводная часть, опциональный жир."""
    used_ids: set[int] = set()

    protein_candidates = [
        item for item in products if float(item.get("protein_100") or 0) >= 8 or float(item.get("protein_density") or 0) >= 0.08
    ]
    protein_base = choose_best_product(protein_candidates or products, used_ids, "protein_density")
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
    carb_base = choose_best_product(carb_candidates or products, used_ids, "carb_density")
    if carb_base and isinstance(carb_base.get("id"), int):
        used_ids.add(int(carb_base["id"]))

    fat_candidates = [
        item for item in products if float(item.get("fat_100") or 0) >= 10 or float(item.get("fat_density") or 0) >= 0.06
    ]
    fat_addon = choose_best_product(fat_candidates, used_ids, "fat_density")
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
) -> tuple[list[dict[str, object]], dict[str, object]]:
    """Собрать продукты и граммовки для одного приёма пищи."""
    if not prepared_products:
        return [], {"strategy": "no_products"}

    protein_base, carb_base, fat_addon = find_meal_components(prepared_products)
    chosen_products = [item for item in [protein_base, carb_base, fat_addon] if isinstance(item, dict)]
    chosen_products = chosen_products[:3]

    if len(chosen_products) < 2:
        # Fallback для бедного каталога: берём первые 2 валидных продукта.
        fallback = prepared_products[:2]
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
    diagnostics = {
        "strategy": "heuristic_v1",
        "selected_product_ids": [item.get("product_id") for item in meal_items],
        "kcal_deviation": (
            round(((totals["calories"] - meal_target_calories) / meal_target_calories) * 100, 2)
            if isinstance(meal_target_calories, int) and meal_target_calories > 0
            else None
        ),
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


def build_meals_with_products(
    meals: list[dict[str, object]],
    distribution_diagnostics: dict[str, object],
    products_pool: list[dict[str, object]],
) -> tuple[list[dict[str, object]], dict[str, object], dict[str, object]]:
    """Сформировать наполненные meals и дневные totals по эвристике v1."""
    prepared_products = prepare_products_for_planning(products_pool)

    meal_macros_targets = distribution_diagnostics.get("meal_macros_targets")
    if not isinstance(meal_macros_targets, dict):
        meal_macros_targets = {}

    meal_generation: dict[str, object] = {}
    for meal in meals:
        meal_key = str(meal.get("key") or "")
        meal_macro_target = meal_macros_targets.get(meal_key)
        meal_items, meal_diag = build_meal_items(
            meal_target_calories=meal.get("target_calories") if isinstance(meal.get("target_calories"), int) else None,
            meal_macro_target=meal_macro_target if isinstance(meal_macro_target, dict) else None,
            prepared_products=prepared_products,
        )
        meal["items"] = meal_items
        meal_generation[meal_key] = meal_diag

    day_totals = calculate_day_totals(meals)
    day_diagnostics = {
        "valid_products_count": len(prepared_products),
        "meal_generation": meal_generation,
    }
    return meals, day_totals, day_diagnostics


@router.get("/api/meal-plan")
async def meal_plan_api(
    request: Request,
    response: Response,
    date_value: str | None = Query(default=None, alias="date"),
) -> dict[str, object]:
    """Вернуть backend-контракт рациона на дату c эвристическим подбором блюд (v1)."""
    telegram_user_id = require_telegram_user_id(request, response)
    profile = load_profile(telegram_user_id)

    resolved_date = date.today()
    date_parse_error = False
    if isinstance(date_value, str) and date_value.strip():
        try:
            resolved_date = date.fromisoformat(date_value.strip())
        except ValueError:
            # На этапе миграции не падаем на неверной дате, чтобы сохранить совместимость.
            date_parse_error = True

    raw_products = load_admin_products()
    favorite_ids = normalize_profile_id_set(profile.get("favorite_product_ids") if isinstance(profile, dict) else None)
    excluded_ids = normalize_profile_id_set(profile.get("excluded_product_ids") if isinstance(profile, dict) else None)
    products_pool, used_favorites_only = build_products_pool(raw_products, favorite_ids, excluded_ids)

    targets, targets_diagnostics = resolve_targets(profile if isinstance(profile, dict) else {})
    meals, distribution_diagnostics = distribute_meal_targets(targets)
    meals, totals, generation_diagnostics = build_meals_with_products(meals, distribution_diagnostics, products_pool)

    return {
        "date": resolved_date.isoformat(),
        "targets": targets,
        "meals": meals,
        "totals": totals,
        "meta": {
            "seed": f"{resolved_date.isoformat()}:{telegram_user_id}",
            "used_favorites_only": used_favorites_only,
            "contract_stage": "stage_6_heuristic_v1",
            "date_parse_error": date_parse_error,
            "catalog_size": len(raw_products),
            "pool_size": len(products_pool),
            "favorite_ids_count": len(favorite_ids),
            "excluded_ids_count": len(excluded_ids),
            "targets_diagnostics": targets_diagnostics,
            "distribution_diagnostics": distribution_diagnostics,
            "generation_diagnostics": generation_diagnostics,
        },
    }
