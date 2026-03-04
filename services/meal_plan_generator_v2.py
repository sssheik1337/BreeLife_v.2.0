from __future__ import annotations

import logging
import random
from dataclasses import dataclass

from services.meal_templates_v2 import MealTemplate, MealSlotTemplate, get_meal_templates_v2
from services.products_heuristics import (
    classify_kind,
    classify_role,
    default_portion_constraints,
)
from services.yandex_gpt_meal_picker import (
    MealPickerError,
    SlotCandidate,
    can_use_yandex_meal_picker,
    pick_slot_product_ids_with_yandex,
)

logger = logging.getLogger(__name__)

MEAL_TOTAL_MAX_AMOUNT = {
    "breakfast": 700,
    "lunch": 900,
    "snack": 500,
    "dinner": 800,
}

MEAL_FOOD_TARGET_TOLERANCE = {
    "breakfast": 0.10,
    "lunch": 0.09,
    "snack": 0.12,
    "dinner": 0.09,
}

SLOT_CALORIE_WEIGHTS = {
    "breakfast": {"carb_base": 0.46, "protein_add": 0.34, "fat_add": 0.20},
    "lunch": {"protein_base": 0.45, "carb_side": 0.35, "veg_side": 0.20},
    "snack": {"dairy_or_fruit": 0.75, "nuts_or_seed": 0.25},
    "dinner": {"protein_base": 0.52, "veg_side": 0.28, "carb_side": 0.20},
}

SLOT_ADJUST_PRIORITY = {
    "breakfast": {
        "up": ("carb_base", "protein_add", "fat_add"),
        "down": ("fat_add", "carb_base", "protein_add"),
    },
    "lunch": {
        "up": ("carb_side", "protein_base", "veg_side"),
        "down": ("carb_side", "protein_base", "veg_side"),
    },
    "snack": {
        "up": ("dairy_or_fruit", "nuts_or_seed"),
        "down": ("nuts_or_seed", "dairy_or_fruit"),
    },
    "dinner": {
        "up": ("protein_base", "carb_side", "veg_side"),
        "down": ("carb_side", "protein_base", "veg_side"),
    },
}

YandexPickerMaxAttemptsPerMeal = 3
DeterministicMaxAttemptsPerMeal = 4
DefaultWeeklyRepeatLimit = 3


@dataclass
class PreparedProduct:
    id: int
    name: str
    group: str
    tags: list[str]
    marker: str
    kind: str
    role: str
    kcal_100: float
    protein_100: float
    fat_100: float
    carbs_100: float


@dataclass
class SlotSelection:
    slot: str
    product: PreparedProduct
    amount: int
    min_amount: int
    max_amount: int
    step: int
    unit: str
    role: str
    kind: str


def _safe_float(value: object) -> float | None:
    if isinstance(value, bool):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _kcal_100_from_raw(product: dict[str, object]) -> float:
    kcal = _safe_float(product.get("kcal_per_100g") or product.get("kcal"))
    if kcal is not None and kcal >= 0:
        return kcal
    protein = _safe_float(product.get("protein_g")) or 0.0
    fat = _safe_float(product.get("fat_g")) or 0.0
    carbs = _safe_float(product.get("carbs_g")) or 0.0
    calculated = protein * 4.0 + fat * 9.0 + carbs * 4.0
    return max(0.0, calculated)


def _to_marker(product: dict[str, object]) -> str:
    name = str(product.get("name") or "").strip().lower()
    group = str(product.get("group") or "").strip().lower()
    tags = product.get("tags")
    tags_text = ""
    if isinstance(tags, list):
        tags_text = " ".join(str(tag).strip().lower() for tag in tags)
    return f"{name} {group} {tags_text}".strip()


def _prepare_products(products: list[dict[str, object]]) -> list[PreparedProduct]:
    prepared: list[PreparedProduct] = []
    for raw in products:
        raw_id = raw.get("id")
        if isinstance(raw_id, bool):
            continue
        try:
            product_id = int(raw_id)
        except (TypeError, ValueError):
            continue

        kind = classify_kind(raw)
        if kind == "water":
            # Water is excluded from ration generation.
            continue

        name = str(raw.get("name") or "").strip() or f"Product {product_id}"
        group = str(raw.get("group") or "").strip()
        tags_raw = raw.get("tags")
        tags = [str(tag).strip() for tag in tags_raw] if isinstance(tags_raw, list) else []
        kcal_100 = _kcal_100_from_raw(raw)
        prepared.append(
            PreparedProduct(
                id=product_id,
                name=name,
                group=group,
                tags=tags,
                marker=_to_marker(raw),
                kind=kind,
                role=classify_role(raw),
                kcal_100=kcal_100,
                protein_100=_safe_float(raw.get("protein_g")) or 0.0,
                fat_100=_safe_float(raw.get("fat_g")) or 0.0,
                carbs_100=_safe_float(raw.get("carbs_g")) or 0.0,
            ),
        )
    prepared.sort(key=lambda item: item.id)
    return prepared


def _contains_any(text: str, keywords: tuple[str, ...]) -> bool:
    return any(token in text for token in keywords)


FRUIT_BERRY_MARKERS = (
    "фрукт",
    "ягод",
    "вишн",
    "черешн",
    "клубник",
    "черник",
    "голубик",
    "малин",
    "смородин",
    "ежевик",
    "яблок",
    "груш",
    "банан",
    "апельс",
    "мандар",
    "киви",
    "ананас",
    "виноград",
    "персик",
    "нектарин",
    "слив",
    "абрикос",
    "гранат",
    "манго",
    "папай",
    "berry",
    "cherry",
    "mango",
    "fruit",
)

POTATO_MARKERS = ("картоф", "батат", "potato")

DENSE_CARB_MARKERS = (
    "круп",
    "рис",
    "греч",
    "овся",
    "булгур",
    "пшен",
    "макарон",
    "паста",
    "лапша",
    "кус-кус",
    "кускус",
    "перлов",
    "ячн",
    "чечев",
    "нут",
    "фасол",
    "горох",
    "хлопья",
    "cereal",
    "rice",
    "pasta",
    "oat",
    "beans",
    "lentil",
)

ANIMAL_PROTEIN_MARKERS = (
    "кур",
    "индей",
    "говя",
    "теля",
    "крол",
    "барани",
    "свини",
    "рыб",
    "лосос",
    "тунец",
    "треск",
    "кревет",
    "мид",
    "кальмар",
    "осьминог",
    "seafood",
    "fish",
    "shrimp",
    "beef",
    "pork",
    "chicken",
    "turkey",
)

DRY_WEIGHT_CARB_MARKERS = (
    "сух",
    "круп",
    "рис",
    "греч",
    "овся",
    "булгур",
    "макарон",
    "паста",
    "лапша",
    "перлов",
    "ячн",
    "чечев",
    "нут",
    "фасол",
    "горох",
    "хлопья",
    "pasta",
    "rice",
    "oat",
    "lentil",
    "beans",
)


def _is_oil(product: PreparedProduct) -> bool:
    return _contains_any(product.marker, ("масл", "oil"))


def _is_nuts_or_seed(product: PreparedProduct) -> bool:
    return _contains_any(
        product.marker,
        (
            "орех",
            "арахис",
            "миндал",
            "фисташ",
            "грецк",
            "кешью",
            "семен",
            "кунжут",
            "чиа",
            "лен",
            "nuts",
            "seed",
        ),
    )


def _is_fruit_or_berry_like(product: PreparedProduct) -> bool:
    if product.role == "fruit":
        return True
    return _contains_any(product.marker, FRUIT_BERRY_MARKERS)


def _is_potato_like(product: PreparedProduct) -> bool:
    return _contains_any(product.marker, POTATO_MARKERS)


def _is_dense_carb(product: PreparedProduct) -> bool:
    if _is_fruit_or_berry_like(product):
        return False
    if _is_potato_like(product):
        return True
    return _contains_any(product.marker, DENSE_CARB_MARKERS)


def _is_animal_protein(product: PreparedProduct) -> bool:
    return _contains_any(product.marker, ANIMAL_PROTEIN_MARKERS)

def _estimate_cooked_grams_from_dry(product: PreparedProduct, dry_grams: int) -> int:
    marker = product.marker
    factor = 2.6
    if _contains_any(marker, ("рис", "rice")):
        factor = 3.0
    elif _contains_any(marker, ("греч",)):
        factor = 2.7
    elif _contains_any(marker, ("булгур", "кус-кус", "кускус")):
        factor = 2.5
    elif _contains_any(marker, ("овся", "хлопья", "oat")):
        factor = 2.0
    elif _contains_any(marker, ("макарон", "паста", "лапша", "pasta")):
        factor = 2.3
    elif _contains_any(marker, ("чечев", "нут", "фасол", "горох", "lentil", "beans")):
        factor = 2.6
    return int(max(0, round(float(dry_grams) * factor)))


def _slot_allowed_product(slot: str, meal_key: str, product: PreparedProduct, selected: dict[str, SlotSelection]) -> bool:
    if product.kind == "water":
        return False

    if meal_key == "snack" and _is_animal_protein(product):
        return False

    if slot == "beverage":
        return product.kind == "beverage"
    if slot == "carb_base":
        return product.role == "carb"
    if slot == "carb_side":
        if product.role != "carb":
            return False
        if meal_key in {"lunch", "dinner"}:
            return _is_dense_carb(product)
        return True
    if slot == "protein_base":
        return product.role == "protein"
    if slot == "protein_add":
        return product.role in {"protein", "dairy"}
    if slot == "veg_side":
        if product.role != "veg":
            return False
        return not _is_potato_like(product)
    if slot == "dairy_or_fruit":
        if _is_animal_protein(product):
            return False
        return product.role in {"dairy", "fruit"}
    if slot == "nuts_or_seed":
        return product.role == "fat" and _is_nuts_or_seed(product)
    if slot == "fat_add":
        if product.role != "fat":
            return False
        if _is_oil(product):
            # Oil is only allowed for lunch/dinner and only with veg_side.
            if meal_key not in {"lunch", "dinner"}:
                return False
            return "veg_side" in selected
        return True
    return False

def _slot_fit_score(slot: str, product: PreparedProduct) -> float:
    if slot == "beverage":
        # Beverage should not close calories; prioritize lighter options.
        return -product.kcal_100
    if slot in {"carb_base", "carb_side"}:
        return product.carbs_100 * 2.0 - product.fat_100 * 0.2
    if slot in {"protein_base", "protein_add"}:
        return product.protein_100 * 2.0 - product.fat_100 * 0.3
    if slot == "veg_side":
        return product.carbs_100 * 0.2 + product.protein_100 * 0.2 - product.kcal_100 * 0.02
    if slot == "dairy_or_fruit":
        return product.protein_100 * 1.2 + product.carbs_100 * 0.6 - product.fat_100 * 0.3
    if slot == "nuts_or_seed":
        return product.fat_100 * 1.5 + product.protein_100 * 0.3
    if slot == "fat_add":
        return product.fat_100 * 1.3 - product.carbs_100 * 0.3
    return 0.0


def _within_weekly_repeat_limit(
    product_id: int,
    weekly_usage_by_product_id: dict[int, int] | None,
    weekly_repeat_limit: int,
) -> bool:
    if weekly_repeat_limit <= 0:
        return True
    if not isinstance(weekly_usage_by_product_id, dict):
        return True
    current = int(weekly_usage_by_product_id.get(product_id, 0) or 0)
    return current < weekly_repeat_limit


def _round_to_step(value: float, min_amount: int, max_amount: int, step: int) -> int:
    if step <= 0:
        return max(min_amount, min(max_amount, int(round(value))))
    rounded = int(round(value / step) * step)
    return max(min_amount, min(max_amount, rounded))


def _build_slot_constraints(slot: str, product: PreparedProduct) -> dict[str, int | str]:
    base = default_portion_constraints(product.role, {"name": product.name, "group": product.group, "tags": product.tags})
    minimum = int(base["min"])
    maximum = int(base["max"])
    step = int(base["step"])
    unit = str(base["unit"])

    if slot == "protein_add":
        minimum = max(minimum, 40)
        maximum = min(maximum, 140)
    elif slot == "veg_side":
        minimum = max(minimum, 100)
    elif slot == "dairy_or_fruit":
        if unit == "ml":
            minimum = max(minimum, 150)
            maximum = min(maximum, 300)
        else:
            minimum = max(minimum, 80)
            maximum = min(maximum, 220)
    elif slot == "beverage":
        minimum = 150
        maximum = min(400, maximum if maximum > 0 else 400)
        step = 50
        unit = "ml"
    elif slot == "fat_add":
        maximum = min(maximum, 20)
    elif slot == "nuts_or_seed":
        maximum = min(maximum, 30)

    if maximum < minimum:
        maximum = minimum
    if step <= 0:
        step = 10
    return {"min": minimum, "max": maximum, "step": step, "unit": unit}


def _compute_item_totals(selection: SlotSelection) -> dict[str, int]:
    factor = float(selection.amount) / 100.0
    return {
        "calories": int(round(selection.product.kcal_100 * factor)),
        "p_g": int(round(selection.product.protein_100 * factor)),
        "f_g": int(round(selection.product.fat_100 * factor)),
        "c_g": int(round(selection.product.carbs_100 * factor)),
    }


def _meal_food_calories(items: list[SlotSelection]) -> int:
    calories = 0
    for item in items:
        if item.kind == "beverage":
            continue
        calories += _compute_item_totals(item)["calories"]
    return calories


def _meal_total_amount(items: list[SlotSelection]) -> int:
    return sum(int(item.amount) for item in items)


def _apply_initial_amounts(
    meal_key: str,
    items: list[SlotSelection],
    meal_target_calories: int | None,
) -> None:
    weights = SLOT_CALORIE_WEIGHTS.get(meal_key, {})
    total_weight = 0.0
    for item in items:
        if item.slot == "beverage":
            continue
        total_weight += float(weights.get(item.slot, 0.0))

    for item in items:
        if item.slot == "beverage":
            # Beverage stays fixed and does not participate in calories fit.
            item.amount = _round_to_step(200, item.min_amount, item.max_amount, item.step)
            continue

        if isinstance(meal_target_calories, int) and meal_target_calories > 0 and item.product.kcal_100 > 0 and total_weight > 0:
            weight = float(weights.get(item.slot, 0.0))
            slot_target_kcal = meal_target_calories * (weight / total_weight)
            desired = (slot_target_kcal / item.product.kcal_100) * 100.0
            item.amount = _round_to_step(desired, item.min_amount, item.max_amount, item.step)
        else:
            midpoint = float(item.min_amount + item.max_amount) / 2.0
            item.amount = _round_to_step(midpoint, item.min_amount, item.max_amount, item.step)


def _enforce_total_amount_cap(meal_key: str, items: list[SlotSelection]) -> None:
    cap = int(MEAL_TOTAL_MAX_AMOUNT.get(meal_key, 900))
    for _ in range(120):
        total = _meal_total_amount(items)
        if total <= cap:
            return
        adjustable = [
            item
            for item in items
            if item.slot != "beverage" and item.amount - item.step >= item.min_amount
        ]
        if not adjustable:
            return
        adjustable.sort(
            key=lambda item: (item.product.kcal_100, item.amount),
            reverse=True,
        )
        target = adjustable[0]
        target.amount = max(target.min_amount, target.amount - target.step)


def _adjust_food_calories_to_target(
    meal_key: str,
    items: list[SlotSelection],
    meal_target_calories: int | None,
) -> dict[str, object]:
    if not isinstance(meal_target_calories, int) or meal_target_calories <= 0:
        return {"target": None, "actual_food_calories": _meal_food_calories(items), "tolerance": None, "iterations": 0}

    tolerance_ratio = float(MEAL_FOOD_TARGET_TOLERANCE.get(meal_key, 0.10))
    tolerance = max(25, int(round(meal_target_calories * tolerance_ratio)))
    max_total_amount = int(MEAL_TOTAL_MAX_AMOUNT.get(meal_key, 900))

    priorities = SLOT_ADJUST_PRIORITY.get(meal_key, {"up": (), "down": ()})
    iterations = 0
    for _ in range(220):
        iterations += 1
        current_food_cal = _meal_food_calories(items)
        delta = meal_target_calories - current_food_cal
        if abs(delta) <= tolerance:
            break

        direction = "up" if delta > 0 else "down"
        order = priorities.get(direction, ())
        changed = False

        for slot_name in order:
            slot_items = [item for item in items if item.slot == slot_name and item.slot != "beverage"]
            if not slot_items:
                continue
            item = slot_items[0]
            if direction == "up":
                next_amount = item.amount + item.step
                if next_amount > item.max_amount:
                    continue
                if _meal_total_amount(items) + item.step > max_total_amount:
                    continue
                item.amount = next_amount
                changed = True
                break

            next_amount = item.amount - item.step
            if next_amount < item.min_amount:
                continue
            item.amount = next_amount
            changed = True
            break

        if not changed:
            break

    return {
        "target": meal_target_calories,
        "actual_food_calories": _meal_food_calories(items),
        "tolerance": tolerance,
        "iterations": iterations,
    }


def _selection_compatible(meal_key: str, selected: dict[str, SlotSelection]) -> bool:
    has_carb_base = "carb_base" in selected
    has_dairy_base = any(item.product.role == "dairy" for item in selected.values())
    has_fruit = any(item.product.role == "fruit" for item in selected.values())
    has_oil = any(_is_oil(item.product) for item in selected.values())
    if has_fruit and has_oil and not (has_carb_base or has_dairy_base):
        return False

    fat_item = selected.get("fat_add")
    if fat_item and _is_oil(fat_item.product):
        if meal_key not in {"lunch", "dinner"}:
            return False
        if "veg_side" not in selected:
            return False
    return True


def _pick_for_slot(
    slot_spec: MealSlotTemplate,
    meal_key: str,
    prepared_products: list[PreparedProduct],
    selected: dict[str, SlotSelection],
    used_day_ids: set[int],
    globally_excluded_ids: set[int],
    weekly_usage_by_product_id: dict[int, int] | None,
    weekly_repeat_limit: int,
    rng: random.Random,
) -> SlotSelection | None:
    slot_name = slot_spec.slot
    candidates = [
        product
        for product in prepared_products
        if (
            product.id not in globally_excluded_ids
            and _within_weekly_repeat_limit(product.id, weekly_usage_by_product_id, weekly_repeat_limit)
            and _slot_allowed_product(slot_name, meal_key, product, selected)
        )
    ]
    if not candidates:
        return None

    fresh_candidates = [item for item in candidates if item.id not in used_day_ids]
    pool = fresh_candidates if fresh_candidates else candidates

    ranked = sorted(pool, key=lambda item: (_slot_fit_score(slot_name, item), -item.id), reverse=True)
    top_n = ranked[: min(6, len(ranked))]
    pick = top_n[rng.randrange(len(top_n))]
    constraints = _build_slot_constraints(slot_name, pick)

    return SlotSelection(
        slot=slot_name,
        product=pick,
        amount=int(constraints["min"]),
        min_amount=int(constraints["min"]),
        max_amount=int(constraints["max"]),
        step=int(constraints["step"]),
        unit=str(constraints["unit"]),
        role=pick.role,
        kind=pick.kind,
    )


def _build_ranked_candidates_for_slot(
    slot_spec: MealSlotTemplate,
    meal_key: str,
    prepared_products: list[PreparedProduct],
    selected: dict[str, SlotSelection],
    used_day_ids: set[int],
    globally_excluded_ids: set[int],
    weekly_usage_by_product_id: dict[int, int] | None,
    weekly_repeat_limit: int,
) -> list[PreparedProduct]:
    slot_name = slot_spec.slot
    all_candidates = [
        product
        for product in prepared_products
        if (
            product.id not in globally_excluded_ids
            and _within_weekly_repeat_limit(product.id, weekly_usage_by_product_id, weekly_repeat_limit)
            and _slot_allowed_product(slot_name, meal_key, product, selected)
        )
    ]
    fresh = [item for item in all_candidates if item.id not in used_day_ids]
    pool = fresh if fresh else all_candidates
    return sorted(pool, key=lambda item: (_slot_fit_score(slot_name, item), -item.id), reverse=True)


def _selection_from_product(slot_name: str, product: PreparedProduct) -> SlotSelection:
    constraints = _build_slot_constraints(slot_name, product)
    return SlotSelection(
        slot=slot_name,
        product=product,
        amount=int(constraints["min"]),
        min_amount=int(constraints["min"]),
        max_amount=int(constraints["max"]),
        step=int(constraints["step"]),
        unit=str(constraints["unit"]),
        role=product.role,
        kind=product.kind,
    )


def _build_yandex_candidate_map(
    template: MealTemplate,
    prepared_products: list[PreparedProduct],
    used_day_ids: set[int],
    globally_excluded_ids: set[int],
    weekly_usage_by_product_id: dict[int, int] | None,
    weekly_repeat_limit: int,
) -> tuple[dict[str, list[PreparedProduct]], list[str], list[str]]:
    selected_context: dict[str, SlotSelection] = {}
    candidates_by_slot: dict[str, list[PreparedProduct]] = {}
    required_slots: list[str] = []
    optional_slots: list[str] = []

    for slot_spec in template.slots:
        ranked = _build_ranked_candidates_for_slot(
            slot_spec=slot_spec,
            meal_key=template.key,
            prepared_products=prepared_products,
            selected=selected_context,
            used_day_ids=used_day_ids,
            globally_excluded_ids=globally_excluded_ids,
            weekly_usage_by_product_id=weekly_usage_by_product_id,
            weekly_repeat_limit=weekly_repeat_limit,
        )
        candidates_by_slot[slot_spec.slot] = ranked
        if ranked:
            selected_context[slot_spec.slot] = _selection_from_product(slot_spec.slot, ranked[0])
        if slot_spec.required:
            required_slots.append(slot_spec.slot)
        else:
            optional_slots.append(slot_spec.slot)

    return candidates_by_slot, required_slots, optional_slots


def _to_picker_candidates(candidates: list[PreparedProduct]) -> list[SlotCandidate]:
    return [
        SlotCandidate(
            product_id=item.id,
            name=item.name,
            role=item.role,
            kind=item.kind,
            group=item.group,
            kcal_100=item.kcal_100,
        )
        for item in candidates[:30]
    ]


def _build_selected_from_id_map(
    template: MealTemplate,
    selected_id_map: dict[str, int],
    candidates_by_slot: dict[str, list[PreparedProduct]],
) -> tuple[dict[str, SlotSelection], list[str]]:
    selected: dict[str, SlotSelection] = {}
    missing_required_slots: list[str] = []
    for slot_spec in template.slots:
        slot_name = slot_spec.slot
        selected_id = selected_id_map.get(slot_name)
        if selected_id is None:
            if slot_spec.required:
                missing_required_slots.append(slot_name)
            continue
        product = next((item for item in candidates_by_slot.get(slot_name, []) if item.id == selected_id), None)
        if product is None:
            if slot_spec.required:
                missing_required_slots.append(slot_name)
            continue
        selected[slot_name] = _selection_from_product(slot_name, product)
    return selected, missing_required_slots


def _portion_plan_is_sane(
    meal_key: str,
    items: list[SlotSelection],
    meal_target_calories: int | None,
) -> tuple[bool, str]:
    total_amount = _meal_total_amount(items)
    cap = int(MEAL_TOTAL_MAX_AMOUNT.get(meal_key, 900))
    if total_amount > cap:
        return False, "total_amount_limit_exceeded"

    for item in items:
        if item.amount < item.min_amount or item.amount > item.max_amount:
            return False, f"slot_{item.slot}_amount_out_of_constraints"

    if isinstance(meal_target_calories, int) and meal_target_calories > 0:
        actual = _meal_food_calories(items)
        lower = int(round(meal_target_calories * 0.60))
        upper = int(round(meal_target_calories * 1.40))
        has_maxed_food_slot = any(
            item.kind != "beverage" and item.amount >= item.max_amount
            for item in items
        )
        if actual < lower and has_maxed_food_slot:
            return False, "slots_maxed_out"
        if actual < lower or actual > upper:
            return False, "food_calories_out_of_sanity_band"

    return True, "ok"


def _is_retryable_sanity_failure(sanity_reason: str) -> bool:
    return sanity_reason in {"food_calories_out_of_sanity_band", "slots_maxed_out"}


def _finalize_meal_payload(
    template: MealTemplate,
    meal_target_calories: int | None,
    selected: dict[str, SlotSelection],
    missing_required_slots: list[str],
) -> tuple[dict[str, object], set[int], bool, str]:
    items = list(selected.values())
    _apply_initial_amounts(template.key, items, meal_target_calories)
    _enforce_total_amount_cap(template.key, items)
    fit_diagnostics = _adjust_food_calories_to_target(template.key, items, meal_target_calories)
    _enforce_total_amount_cap(template.key, items)
    sane, sanity_reason = _portion_plan_is_sane(template.key, items, meal_target_calories)

    used_ids = {item.product.id for item in items if item.kind != "beverage"}
    meal_items: list[dict[str, object]] = []
    totals = {"calories": 0, "protein_g": 0, "fat_g": 0, "carbs_g": 0}
    for item in items:
        item_totals = _compute_item_totals(item)
        totals["calories"] += item_totals["calories"]
        totals["protein_g"] += item_totals["p_g"]
        totals["fat_g"] += item_totals["f_g"]
        totals["carbs_g"] += item_totals["c_g"]
        item_payload: dict[str, object] = {
            "slot": item.slot,
            "product_id": item.product.id,
            "name": item.product.name,
            "amount": int(item.amount),
            "unit": item.unit,
            "calories": item_totals["calories"],
            "p_g": item_totals["p_g"],
            "f_g": item_totals["f_g"],
            "c_g": item_totals["c_g"],
            "kind": item.kind,
            "role": item.role,
            "kcal_per_100": round(item.product.kcal_100, 2),
        }
        if item.unit == "g":
            item_payload["grams"] = int(item.amount)
            if item.slot in {"carb_base", "carb_side"} and _contains_any(item.product.marker, DRY_WEIGHT_CARB_MARKERS):
                item_payload["portion_is_dry"] = True
                item_payload["cooked_grams_est"] = _estimate_cooked_grams_from_dry(item.product, int(item.amount))
        elif item.unit == "ml":
            item_payload["ml"] = int(item.amount)
        meal_items.append(item_payload)

    meal_payload: dict[str, object] = {
        "key": template.key,
        "title": template.title,
        "target_calories": meal_target_calories if isinstance(meal_target_calories, int) else None,
        "items": meal_items,
        "totals": totals,
        "meta": {
            "template": template.title,
            "missing_required_slots": missing_required_slots,
            "fit": fit_diagnostics,
            "total_amount": _meal_total_amount(items),
            "total_amount_limit": int(MEAL_TOTAL_MAX_AMOUNT.get(template.key, 900)),
            "sanity_ok": sane,
            "sanity_reason": sanity_reason,
        },
    }
    return meal_payload, used_ids, sane, sanity_reason


def _build_meal_from_template(
    template: MealTemplate,
    meal_target_calories: int | None,
    prepared_products: list[PreparedProduct],
    used_day_ids: set[int],
    globally_excluded_ids: set[int],
    weekly_usage_by_product_id: dict[int, int] | None,
    weekly_repeat_limit: int,
    use_yandex_picker: bool,
    rng: random.Random,
) -> tuple[dict[str, object], set[int]]:
    candidates_by_slot, required_slots, optional_slots = _build_yandex_candidate_map(
        template=template,
        prepared_products=prepared_products,
        used_day_ids=used_day_ids,
        globally_excluded_ids=globally_excluded_ids,
        weekly_usage_by_product_id=weekly_usage_by_product_id,
        weekly_repeat_limit=weekly_repeat_limit,
    )

    yandex_attempted = False
    yandex_used = False
    yandex_fail_reason: str | None = None
    yandex_attempt_exclude_ids = set(globally_excluded_ids)
    deterministic_attempts = 0

    if use_yandex_picker and can_use_yandex_meal_picker():
        yandex_attempted = True
        for _ in range(YandexPickerMaxAttemptsPerMeal):
            try:
                picker_candidates = {slot: _to_picker_candidates(candidates) for slot, candidates in candidates_by_slot.items()}
                selected_id_map = pick_slot_product_ids_with_yandex(
                    meal_key=template.key,
                    required_slots=required_slots,
                    optional_slots=optional_slots,
                    candidates_by_slot=picker_candidates,
                    exclude_product_ids=yandex_attempt_exclude_ids,
                    weekly_usage_by_product_id=weekly_usage_by_product_id,
                    weekly_repeat_limit=weekly_repeat_limit,
                )
                selected, missing_required_slots = _build_selected_from_id_map(
                    template=template,
                    selected_id_map=selected_id_map,
                    candidates_by_slot=candidates_by_slot,
                )

                if not _selection_compatible(template.key, selected):
                    selected.pop("fat_add", None)
                    if not _selection_compatible(template.key, selected):
                        for item in selected.values():
                            yandex_attempt_exclude_ids.add(item.product.id)
                        yandex_fail_reason = "incompatible_selection"
                        continue

                meal_payload, used_ids, sane, sanity_reason = _finalize_meal_payload(
                    template=template,
                    meal_target_calories=meal_target_calories,
                    selected=selected,
                    missing_required_slots=missing_required_slots,
                )
                if sane:
                    yandex_used = True
                    meta = meal_payload.get("meta")
                    if isinstance(meta, dict):
                        meta["selection_source"] = "yandex_gpt_picker"
                        meta["yandex_attempted"] = True
                        meta["yandex_used"] = True
                        meta["yandex_fallback_reason"] = None
                    return meal_payload, used_ids

                yandex_fail_reason = sanity_reason
                if _is_retryable_sanity_failure(sanity_reason):
                    for product_id in used_ids:
                        yandex_attempt_exclude_ids.add(product_id)
                    continue
                break
            except MealPickerError as exc:
                yandex_fail_reason = str(exc)
                logger.warning("Yandex meal picker rejected for %s: %s", template.key, exc)
                break
            except Exception as exc:
                yandex_fail_reason = str(exc)
                logger.warning("Yandex meal picker unexpected failure for %s: %s", template.key, exc)
                break

    deterministic_excluded_ids = set(yandex_attempt_exclude_ids)
    last_payload: dict[str, object] | None = None
    last_used_ids: set[int] = set()
    last_sanity_reason: str | None = None

    for attempt_index in range(DeterministicMaxAttemptsPerMeal):
        deterministic_attempts = attempt_index + 1
        selected: dict[str, SlotSelection] = {}
        missing_required_slots: list[str] = []
        for slot_spec in template.slots:
            choice = _pick_for_slot(
                slot_spec=slot_spec,
                meal_key=template.key,
                prepared_products=prepared_products,
                selected=selected,
                used_day_ids=used_day_ids,
                globally_excluded_ids=deterministic_excluded_ids,
                weekly_usage_by_product_id=weekly_usage_by_product_id,
                weekly_repeat_limit=weekly_repeat_limit,
                rng=rng,
            )
            if choice is None:
                if slot_spec.required:
                    missing_required_slots.append(slot_spec.slot)
                continue
            selected[slot_spec.slot] = choice

        if not _selection_compatible(template.key, selected):
            selected.pop("fat_add", None)
            if not _selection_compatible(template.key, selected):
                selected = {k: v for k, v in selected.items() if v.slot != "beverage"}

        meal_payload, used_ids, sane, sanity_reason = _finalize_meal_payload(
            template=template,
            meal_target_calories=meal_target_calories,
            selected=selected,
            missing_required_slots=missing_required_slots,
        )
        last_payload = meal_payload
        last_used_ids = used_ids
        last_sanity_reason = sanity_reason

        if sane:
            break

        if not _is_retryable_sanity_failure(sanity_reason):
            break

        if not used_ids:
            break
        deterministic_excluded_ids.update(used_ids)

    if last_payload is None:
        last_payload, last_used_ids, _, last_sanity_reason = _finalize_meal_payload(
            template=template,
            meal_target_calories=meal_target_calories,
            selected={},
            missing_required_slots=[],
        )

    meal_payload = last_payload
    used_ids = last_used_ids
    meta = meal_payload.get("meta")
    if isinstance(meta, dict):
        meta["selection_source"] = "deterministic_heuristics"
        meta["yandex_attempted"] = yandex_attempted
        meta["yandex_used"] = yandex_used
        meta["yandex_fallback_reason"] = yandex_fail_reason
        meta["deterministic_attempts"] = deterministic_attempts
        meta["deterministic_last_sanity_reason"] = last_sanity_reason
    return meal_payload, used_ids


def _to_int_target(value: object) -> int | None:
    if isinstance(value, bool):
        return None
    try:
        parsed = int(round(float(value)))
    except (TypeError, ValueError):
        return None
    return parsed if parsed > 0 else None


def generate_day_meal_plan_v2(
    products: list[dict[str, object]],
    seed_value: str,
    meal_targets: dict[str, object] | None = None,
    excluded_product_ids: set[int] | None = None,
    weekly_usage_by_product_id: dict[int, int] | None = None,
    weekly_repeat_limit: int = DefaultWeeklyRepeatLimit,
    use_yandex_picker: bool = True,
) -> dict[str, object]:
    prepared_products = _prepare_products(products)
    rng = random.Random(seed_value)
    global_excluded = set(excluded_product_ids or set())
    used_day_ids: set[int] = set()
    weekly_usage = dict(weekly_usage_by_product_id or {})
    applied_weekly_repeat_limit = max(1, int(weekly_repeat_limit))

    meals: list[dict[str, object]] = []
    for template in get_meal_templates_v2():
        target_raw = meal_targets.get(template.key) if isinstance(meal_targets, dict) else None
        target_calories = _to_int_target(target_raw)
        meal_payload, used_ids = _build_meal_from_template(
            template=template,
            meal_target_calories=target_calories,
            prepared_products=prepared_products,
            used_day_ids=used_day_ids,
            globally_excluded_ids=global_excluded,
            weekly_usage_by_product_id=weekly_usage,
            weekly_repeat_limit=applied_weekly_repeat_limit,
            use_yandex_picker=use_yandex_picker,
            rng=rng,
        )
        meals.append(meal_payload)
        used_day_ids.update(used_ids)
        for product_id in used_ids:
            weekly_usage[product_id] = int(weekly_usage.get(product_id, 0)) + 1

    day_totals = {"calories": 0, "protein_g": 0, "fat_g": 0, "carbs_g": 0}
    for meal in meals:
        totals = meal.get("totals")
        if not isinstance(totals, dict):
            continue
        day_totals["calories"] += int(totals.get("calories") or 0)
        day_totals["protein_g"] += int(totals.get("protein_g") or 0)
        day_totals["fat_g"] += int(totals.get("fat_g") or 0)
        day_totals["carbs_g"] += int(totals.get("carbs_g") or 0)

    return {
        "meals": meals,
        "totals": day_totals,
        "meta": {
            "generator_version": "v2_templates_with_yandex_picker",
            "seed": seed_value,
            "products_considered": len(prepared_products),
            "excluded_products_count": len(global_excluded),
            "weekly_repeat_limit": applied_weekly_repeat_limit,
            "yandex_picker_enabled": bool(use_yandex_picker and can_use_yandex_meal_picker()),
        },
    }
