from __future__ import annotations

from typing import Literal

ProductKind = Literal["food", "beverage", "water"]
ProductRole = Literal["protein", "carb", "veg", "fat", "fruit", "dairy", "snack", "beverage"]
PortionUnit = Literal["g", "ml"]


def _to_marker(product: dict[str, object]) -> str:
    name = str(product.get("name") or "").strip().lower()
    group = str(product.get("group") or "").strip().lower()
    tags = product.get("tags")
    tags_text = ""
    if isinstance(tags, list):
        tags_text = " ".join(str(tag).strip().lower() for tag in tags)
    return f"{name} {group} {tags_text}".strip()


def _safe_float(value: object) -> float | None:
    if isinstance(value, bool):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _contains_any(text: str, keywords: tuple[str, ...]) -> bool:
    return any(keyword in text for keyword in keywords)


WATER_MARKERS = (
    "вода",
    "питьевая",
    "минеральная",
    "аква",
    "water",
    "h2o",
    "still water",
    "sparkling water",
    "mineral water",
    "drinking water",
)

NON_WATER_DRINK_MARKERS = (
    "кофе",
    "чай",
    "кефир",
    "ряженка",
    "йогурт питьевой",
    "сок",
    "морс",
    "компот",
    "лимонад",
    "квас",
    "какао",
    "латте",
    "капучино",
    "эспрессо",
    "американо",
    "смузи",
    "молоко",
    "айран",
    "coffee",
    "tea",
    "juice",
    "kvass",
    "smoothie",
    "latte",
    "cappuccino",
    "espresso",
)

BEVERAGE_MARKERS = (
    "напит",
    "drink",
    "кофе",
    "чай",
    "кефир",
    "ряженка",
    "йогурт питьевой",
    "сок",
    "морс",
    "компот",
    "лимонад",
    "квас",
    "какао",
    "латте",
    "капучино",
    "эспрессо",
    "американо",
    "смузи",
    "айран",
    "coffee",
    "tea",
    "juice",
    "kvass",
    "smoothie",
    "latte",
    "cappuccino",
    "espresso",
)

PROTEIN_MARKERS = (
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
    "яйц",
    "белок",
    "tofu",
    "тофу",
)

POTATO_MARKERS = (
    "картоф",
    "батат",
    "potato",
)

CARB_MARKERS = (
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
    "хлеб",
    "хлопья",
    "muesli",
    "oat",
    "rice",
    "pasta",
)

DRY_GRAIN_MARKERS = (
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
)

VEG_MARKERS = (
    "овощ",
    "огур",
    "помид",
    "томат",
    "капуст",
    "брокк",
    "кабач",
    "баклаж",
    "морков",
    "свек",
    "лук",
    "шпинат",
    "салат",
    "перец",
    "зелень",
)

FRUIT_MARKERS = (
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
    "дын",
    "арбуз",
    "папай",
    "melon",
    "berry",
    "cherry",
    "mango",
)

DAIRY_MARKERS = (
    "молоч",
    "творог",
    "сыр",
    "йогур",
    "кефир",
    "ряженк",
    "сметан",
    "молоко",
    "айран",
    "dairy",
    "milk",
    "yogurt",
)

FAT_MARKERS = (
    "масл",
    "авокад",
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
    "оливк",
    "маслин",
    "oil",
    "nuts",
    "seeds",
)

OIL_MARKERS = ("масло", "oil")
NUTS_AND_SEEDS_MARKERS = (
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
)

SNACK_MARKERS = (
    "батончик",
    "печеньк",
    "крекер",
    "чипс",
    "попкорн",
    "снек",
    "десерт",
    "шоколад",
    "колбас",
    "сосиск",
    "сардельк",
    "ветчин",
    "салям",
    "бекон",
    "cookie",
    "cracker",
    "snack",
)

LIQUID_DAIRY_MARKERS = (
    "кефир",
    "ряженк",
    "айран",
    "йогурт питьевой",
    "молоко",
    "drink yogurt",
    "milk",
)


def _is_potato_like(marker: str) -> bool:
    return _contains_any(marker, POTATO_MARKERS)


def classify_kind(product: dict[str, object]) -> ProductKind:
    marker = _to_marker(product)
    kcal = _safe_float(product.get("kcal_per_100g") or product.get("kcal"))

    if _contains_any(marker, WATER_MARKERS) and not _contains_any(marker, NON_WATER_DRINK_MARKERS):
        if kcal is None or kcal <= 5.0:
            return "water"

    if _contains_any(marker, BEVERAGE_MARKERS):
        return "beverage"

    return "food"


def classify_role(product: dict[str, object]) -> ProductRole:
    marker = _to_marker(product)
    kind = classify_kind(product)
    if kind in {"water", "beverage"}:
        return "beverage"

    protein = _safe_float(product.get("protein_g")) or 0.0
    fat = _safe_float(product.get("fat_g")) or 0.0
    carbs = _safe_float(product.get("carbs_g")) or 0.0

    if _contains_any(marker, FAT_MARKERS):
        return "fat"
    if _contains_any(marker, DAIRY_MARKERS):
        return "dairy"
    if _contains_any(marker, FRUIT_MARKERS):
        return "fruit"
    if _contains_any(marker, SNACK_MARKERS):
        return "snack"
    if _is_potato_like(marker):
        return "carb"
    if _contains_any(marker, VEG_MARKERS):
        return "veg"
    if _contains_any(marker, CARB_MARKERS):
        return "carb"
    if _contains_any(marker, PROTEIN_MARKERS):
        return "protein"

    if fat >= 18 and fat >= protein and fat >= carbs:
        return "fat"
    if protein >= 12 and protein >= carbs:
        return "protein"
    if carbs >= 15:
        return "carb"
    if fat >= 8 and protein < 8 and carbs < 12:
        return "fat"
    return "snack"


def default_portion_constraints(role: ProductRole, product: dict[str, object]) -> dict[str, int | PortionUnit]:
    marker = _to_marker(product)
    kind = classify_kind(product)

    # Water is always excluded from meal plan and shopping list.
    if kind == "water":
        return {"min": 0, "max": 0, "step": 0, "unit": "ml"}

    # Beverage is a side drink only; it is not used to close calories/macros.
    if role == "beverage":
        return {"min": 150, "max": 400, "step": 50, "unit": "ml"}

    if role == "fat":
        if _contains_any(marker, OIL_MARKERS):
            return {"min": 5, "max": 15, "step": 5, "unit": "g"}
        if _contains_any(marker, NUTS_AND_SEEDS_MARKERS):
            return {"min": 10, "max": 30, "step": 5, "unit": "g"}
        return {"min": 10, "max": 40, "step": 5, "unit": "g"}

    if role == "carb":
        if _contains_any(marker, DRY_GRAIN_MARKERS):
            return {"min": 30, "max": 90, "step": 10, "unit": "g"}
        return {"min": 40, "max": 180, "step": 10, "unit": "g"}

    if role == "protein":
        return {"min": 80, "max": 220, "step": 10, "unit": "g"}

    if role == "veg":
        return {"min": 80, "max": 400, "step": 20, "unit": "g"}

    if role == "fruit":
        return {"min": 80, "max": 200, "step": 10, "unit": "g"}

    if role == "dairy":
        if _contains_any(marker, LIQUID_DAIRY_MARKERS):
            return {"min": 150, "max": 350, "step": 50, "unit": "ml"}
        return {"min": 80, "max": 220, "step": 10, "unit": "g"}

    return {"min": 20, "max": 80, "step": 10, "unit": "g"}
