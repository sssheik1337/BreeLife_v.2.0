from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class MealSlotTemplate:
    slot: str
    required: bool = True


@dataclass(frozen=True)
class MealTemplate:
    key: str
    title: str
    slots: tuple[MealSlotTemplate, ...]


BreakfastTemplate = MealTemplate(
    key="breakfast",
    title="\u0417\u0430\u0432\u0442\u0440\u0430\u043a",
    slots=(
        MealSlotTemplate("carb_base", required=True),
        MealSlotTemplate("protein_add", required=True),
        MealSlotTemplate("fat_add", required=True),
        MealSlotTemplate("beverage", required=True),
    ),
)

LunchTemplate = MealTemplate(
    key="lunch",
    title="\u041e\u0431\u0435\u0434",
    slots=(
        MealSlotTemplate("protein_base", required=True),
        MealSlotTemplate("carb_side", required=True),
        MealSlotTemplate("veg_side", required=True),
        MealSlotTemplate("beverage", required=True),
    ),
)

SnackTemplate = MealTemplate(
    key="snack",
    title="\u041f\u0435\u0440\u0435\u043a\u0443\u0441",
    slots=(
        MealSlotTemplate("dairy_or_fruit", required=True),
        MealSlotTemplate("nuts_or_seed", required=True),
        MealSlotTemplate("beverage", required=False),
    ),
)

DinnerTemplate = MealTemplate(
    key="dinner",
    title="\u0423\u0436\u0438\u043d",
    slots=(
        MealSlotTemplate("protein_base", required=True),
        MealSlotTemplate("veg_side", required=True),
        MealSlotTemplate("carb_side", required=False),
        MealSlotTemplate("beverage", required=True),
    ),
)


def get_meal_templates_v2() -> tuple[MealTemplate, ...]:
    return (BreakfastTemplate, LunchTemplate, SnackTemplate, DinnerTemplate)


def get_meal_template_v2(meal_key: str) -> MealTemplate | None:
    for template in get_meal_templates_v2():
        if template.key == meal_key:
            return template
    return None
