from collections import defaultdict

from fastapi import APIRouter, HTTPException, Query, Request, Response

from app.dependencies import load_profile, require_telegram_user_id
from services.nutrition import calculate_bmr, calculate_daily_calories, calculate_goal_calories
from services.products_db import load_admin_products

router = APIRouter()

ONBOARDING_GROUP_SAMPLE_SIZE = 3
ONBOARDING_LIMIT_DEFAULT = 30
ONBOARDING_LIMIT_MAX = 60


def normalize_product_name(value: str) -> str:
    return value.strip().lower()


def search_products(query: str) -> dict[str, list[dict[str, object]]]:
    normalized_query = normalize_product_name(query)
    if not normalized_query:
        return {"exact": [], "similar": []}
    products = load_admin_products()
    exact = []
    similar = []
    for item in products:
        name = item.get("name")
        if not isinstance(name, str):
            continue
        normalized_name = normalize_product_name(name)
        if normalized_name == normalized_query:
            exact.append(item)
        elif normalized_query in normalized_name:
            similar.append(item)
    return {"exact": exact, "similar": similar}


def normalize_onboarding_item(item: dict[str, object]) -> dict[str, object]:
    return {
        "id": item.get("id"),
        "name": item.get("name"),
        "group": item.get("group"),
        "kcal": item.get("kcal") or 0,
    }


def build_onboarding_selection(
    products: list[dict[str, object]],
    excluded_ids: set[int],
    limit: int,
) -> tuple[list[dict[str, object]], int]:
    available: list[dict[str, object]] = []
    for item in products:
        product_id = item.get("id")
        if not isinstance(product_id, int) or product_id in excluded_ids:
            continue
        available.append(item)

    grouped: dict[str, list[dict[str, object]]] = defaultdict(list)
    for item in available:
        group_name = str(item.get("group") or "Без группы").strip() or "Без группы"
        grouped[group_name].append(item)

    groups_total = len(grouped)

    selected: list[dict[str, object]] = []
    selected_ids: set[int] = set()

    # Сначала берём по несколько продуктов из каждой группы.
    for group_name in sorted(grouped.keys()):
        for item in grouped[group_name][:ONBOARDING_GROUP_SAMPLE_SIZE]:
            product_id = item.get("id")
            if not isinstance(product_id, int) or product_id in selected_ids:
                continue
            selected.append(item)
            selected_ids.add(product_id)
            if len(selected) >= limit:
                return selected, groups_total

    # Затем добираем первыми доступными до лимита.
    for item in available:
        product_id = item.get("id")
        if not isinstance(product_id, int) or product_id in selected_ids:
            continue
        selected.append(item)
        selected_ids.add(product_id)
        if len(selected) >= limit:
            break

    return selected, groups_total


@router.get("/api/products/search")
async def products_search(q: str):
    query = q.strip()
    if len(query) < 2:
        return {"exact": [], "similar": []}
    results = search_products(query)

    def normalize_item(item: dict[str, object]) -> dict[str, object]:
        return {
            "id": item.get("id"),
            "name": item.get("name"),
            "kcal": item.get("kcal") or 0,
            "protein_g": item.get("protein_g") or 0,
            "fat_g": item.get("fat_g") or 0,
            "carbs_g": item.get("carbs_g") or 0,
            "fiber_g": item.get("fiber_g") or 0,
        }

    return {
        "exact": [normalize_item(item) for item in results["exact"]],
        "similar": [normalize_item(item) for item in results["similar"]],
    }


@router.get("/api/products")
async def products_list():
    """Вернуть полный каталог продуктов из админской SQLite-базы."""
    products = load_admin_products()
    normalized: list[dict[str, object]] = []
    for item in products:
        normalized.append(
            {
                "id": item.get("id"),
                "name": item.get("name"),
                "group": item.get("group"),
                "kcal": item.get("kcal") or 0,
                "protein_g": item.get("protein_g") or 0,
                "fat_g": item.get("fat_g") or 0,
                "carbs_g": item.get("carbs_g") or 0,
                "carbs_simple_g": item.get("carbs_simple_g") or 0,
                "carbs_complex_g": item.get("carbs_complex_g") or 0,
                "fiber_g": item.get("fiber_g") or 0,
                "tags": item.get("tags") if isinstance(item.get("tags"), list) else [],
                "health_level": item.get("health_level"),
            }
        )
    return normalized


@router.get("/api/preferences/onboarding-products")
async def preferences_onboarding_products(
    request: Request,
    response: Response,
    limit: int = Query(default=ONBOARDING_LIMIT_DEFAULT, ge=1, le=ONBOARDING_LIMIT_MAX),
):
    telegram_user_id = require_telegram_user_id(request, response)
    profile = load_profile(telegram_user_id)

    favorite_ids_raw = profile.get("favorite_product_ids") if isinstance(profile.get("favorite_product_ids"), list) else []
    excluded_ids_raw = profile.get("excluded_product_ids") if isinstance(profile.get("excluded_product_ids"), list) else []

    favorite_ids = {item for item in favorite_ids_raw if isinstance(item, int)}
    excluded_ids = {item for item in excluded_ids_raw if isinstance(item, int)}
    already_chosen_ids = favorite_ids | excluded_ids

    products = load_admin_products()
    selected, groups_total = build_onboarding_selection(products, already_chosen_ids, limit)

    return {
        "items": [normalize_onboarding_item(item) for item in selected],
        "total": len(selected),
        "limit": limit,
        "meta": {
            "groups_total": groups_total,
            "group_sample_size": ONBOARDING_GROUP_SAMPLE_SIZE,
            "selection_strategy": "group_balanced_then_fill",
        },
    }


@router.get("/api/calculate")
async def calculate(
    sex: str,
    weight: float,
    height: float,
    age: int,
    activity_factor: float,
    goal_type: str,
):
    try:
        bmr = calculate_bmr(sex=sex, weight=weight, height=height, age=age)
        daily_calories = calculate_daily_calories(bmr, activity_factor)
        goal_calories = calculate_goal_calories(daily_calories, goal_type)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {
        "bmr": bmr,
        "daily_calories": daily_calories,
        "goal_calories": goal_calories,
    }
