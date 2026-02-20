# Аудит: единый pipeline расчёта целей и единый источник `profile.calories_target`

## Что сделано в этой итерации
Введён единый фронтовый pipeline:

`computeTargets(profile, diaryEntries, nowDate)`

Pipeline возвращает полный набор целевых полей:
- `tdee_calories` (справка),
- `calories_target`,
- `calorie_delta`,
- `weight_rate_kg_per_week`,
- `predicted_goal_date`,
- `warning_message`,
- `required_rate_kg_per_week`,
- `required_calorie_delta`,
- `required_calories_target`,
- `safe_weeks_estimate`.

## Принципы pipeline
1. Используется текущая forecast-модель:
   - темп изменения веса,
   - перевод через `7700 ккал/кг`,
   - safety clamp,
   - weekly autocorrection.
2. Расчёт детерминирован по входам `profile + nowDate`.
3. Null-safe: при неполных данных поля возвращаются как `null`, без скрытых коэффициентных fallback (`0.85/1.10`).

## Где находится единый расчёт
- `static/js/calculations.js`
  - `computeTargets(profile, diaryEntries, nowDate)` — единая точка сборки целевых полей.
  - `calculateWeightGoalForecast(...)` поддерживает `now_date` для детерминированного расчёта дедлайнов/прогноза.

## Где pipeline вызывается и как сохраняется
- `static/js/resume.js`
  - `ensureComputedTargetsSaved(profile)`:
    1) один вызов `computeTargets(...)`,
    2) сравнение с текущим профилем,
    3) одна запись через `patchUserProfileWithBackend(...)` только при drift.
  - Вызывается на `/resume` при загрузке после анкеты и при первом входе.

После сохранения система работает от сохранённых полей профиля, где целевые калории — `profile.calories_target`.

## Backend-контракт `/api/meal-plan` (строгий)
- `resolve_calories_target(profile)` берёт только `profile.calories_target`.
- Если цель отсутствует/невалидна → `target_not_computed`.
- В ответе есть:
  - `targets_source`: `"profile.calories_target"` или `"missing"`,
  - `target_status`: `"ok"` или `"target_not_computed"`.

## Карта мест в коде: где берутся калории

### Backend
1. `app/routers/meal_plan_api.py`
   - `resolve_calories_target(profile)` → строго `calories_target only`.
   - `resolve_targets(profile)` → диагностирует `missing`, не генерирует «левую» цель.
   - `build_meal_plan_payload_for_date(...)` → отдаёт `targets_source` и `target_status`.
   - `meal_plan_week_api(...)` → агрегирует `targets_source`/`target_status` для недели.

### Frontend
2. `static/js/calculations.js`
   - `computeTargets(...)` → единый расчёт целевых полей.

3. `static/js/resume.js`
   - `ensureComputedTargetsSaved(...)` → один вызов/одна запись в профиль при необходимости.
   - `updateCalculatedMetrics(...)` и `renderNutritionRings(...)` используют сохранённый `profile.calories_target`.

4. `static/js/profile.js`
   - `getResolvedProfileForDisplay()` без fallback `tdee*0.85/1.1`.
   - `renderCalorieTrend(...)`, `renderTodayPlanCard(...)`, `renderWeeklyProgress(...)`, `renderMonthGrid(...)` → цель только `profile.calories_target`.

## Ограничения и совместимость
- Формулы BMR/TDEE не менялись.
- Старые поля профиля не удалялись (обратная совместимость структуры сохранена).


## /profile: поведение при отсутствии цели
- Все сравнения «факт/цель» в прогресс-метриках выполняются строго относительно `profile.calories_target`.
- `tdee_calories` не используется в прогресс-сравнениях.
- Если цель не рассчитана, UI показывает аккуратный placeholder **«цель не рассчитана»** и не подставляет TDEE.
