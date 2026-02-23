# Фазовый rollout SPA и feature-flags маршрутов

Документ фиксирует поэтапное включение SPA-экранов и быстрый rollback на legacy-страницы.

## Флаги окружения

- `SPA_ENABLED` — глобальный рубильник SPA-shell (`/app`).
- `SPA_PHASE_1_ENABLED` — фаза 1.
- `SPA_PHASE_2_ENABLED` — фаза 2.
- `SPA_PHASE_3_ENABLED` — фаза 3.
- `SPA_PHASE_4_ENABLED` — фаза 4.

Если флаг фазы выключен, SPA-router делает моментальный rollback на legacy URL того же пути.

## Матрица фаз

### Фаза 1 (низкий риск)

- `menu`
- `support`
- `references`
- `plans`
- `reminders_settings`

### Фаза 2 (средний риск)

- `foods`
- `my_products`
- `shopping_list`
- `trial-start`
- `preferences-onboarding-choice`
- `preferences-onboarding`

### Фаза 3 (высокий риск)

- `questionnaire`
- `resume`
- `meal-plan`

### Фаза 4 (критичный риск)

- `profile`
- `diary` (FAB, панели, water/sleep/habits, карточки прогресса)

## Быстрый rollback

1. Выключить нужный `SPA_PHASE_*` флаг.
2. Пользователь при переходе по SPA-маршруту автоматически уходит на legacy-страницу того же пути.
3. При аварийной ситуации выключить `SPA_ENABLED`, и `/app` вернёт пользователя на `/`.

## Пример запуска

```bash
SPA_ENABLED=1 \
SPA_PHASE_1_ENABLED=1 \
SPA_PHASE_2_ENABLED=0 \
SPA_PHASE_3_ENABLED=0 \
SPA_PHASE_4_ENABLED=0 \
python main.py
```
