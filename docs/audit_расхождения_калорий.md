# Аудит: строгий контракт целевых калорий (`profile.calories_target`)

## Что внедрено
В backend рациона закреплён строгий контракт:
- единственный источник целевых калорий — `profile.calories_target`;
- если `calories_target` отсутствует или невалиден, backend **не подставляет** цель по `TDEE*коэффициентам` и возвращает статус `target_not_computed`;
- в ответе `/api/meal-plan` добавлен верхнеуровневый флаг `targets_source` со значением:
  - `"profile.calories_target"` — цель взята из профиля,
  - `"missing"` — цель не рассчитана.

Дополнительно в ответе возвращается `target_status`:
- `"ok"` или `"target_not_computed"`.

## Новый приоритет расчёта для `/api/meal-plan`
1. Валидный `profile.calories_target`.
2. Иначе: `target_not_computed` (без fallback на `required_calories_target`, `tdee_calories`, `tdee*0.85/1.10`).

## Важные ограничения, которые сохранены
- Формулы BMR/TDEE не менялись.
- Старые поля профиля не удалялись (обратная совместимость структуры данных сохранена).

## Карта мест в коде: где берутся калории и что стало `calories_target only`

### Backend (`calories_target only`)
1. `app/routers/meal_plan_api.py`
   - `resolve_calories_target(profile)` → только `profile.calories_target`, иначе `target_not_computed`.
   - `resolve_targets(profile)` → при отсутствии цели отдаёт диагностику с `targets_source.calories = "missing"`.
   - `is_profile_valid_for_targets(profile)` → проверяет только валидность `calories_target`.
   - `build_meal_plan_payload_for_date(...)` → добавляет в ответ `targets_source` (`profile.calories_target|missing`) и `target_status` (`ok|target_not_computed`).
   - `meal_plan_week_api(...)` → агрегирует `targets_source`/`target_status` на уровень недели.

### Frontend (по ранее введённому контракту)
2. `static/js/resume.js`
   - `updateCalculatedMetrics(profile)` → целевые калории для блока питания берутся из `profile.calories_target`.
   - `renderNutritionRings(profile)` → `recommended.calories = profile.calories_target`.

3. `static/js/profile.js`
   - `getResolvedProfileForDisplay()` → без локального fallback `tdee*0.85/1.1`.
   - `renderCalorieTrend(...)`, `renderTodayPlanCard(...)`, `renderWeeklyProgress(...)`, `renderMonthGrid(...)` → цель только `profile.calories_target`.

## Что это меняет в поведении
- Система больше не «придумывает» калорийную цель на `/api/meal-plan`.
- Если цель не рассчитана, клиент получает честный признак `target_not_computed` и может инициировать пересчёт+сохранение профиля.
