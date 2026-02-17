from fastapi import APIRouter, HTTPException

from services.nutrition import calculate_bmr, calculate_daily_calories, calculate_goal_calories
from services.products_db import load_admin_products

router = APIRouter()


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
