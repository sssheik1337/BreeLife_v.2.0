# Эксплуатационный runbook SPA-миграции

Документ описывает деплой, rollback и мониторинг ошибок на этапе поэтапной миграции legacy → SPA.

## 1) Деплой

### Переменные окружения

- `SPA_ENABLED` — включает SPA-shell `/app`.
- `SPA_PRIMARY_ROUTES_TO_SHELL_ENABLED` — переводит основные пользовательские маршруты на SPA-shell через backend-редирект.
- `SPA_PHASE_1_ENABLED` ... `SPA_PHASE_4_ENABLED` — пофазное включение экранов в SPA-router.

### Последовательность релиза

1. Выполнить сборку SPA (`scripts/сборка_spa_перед_деплоем.sh`).
2. Проверить наличие артефактов `spa/dist`.
3. Задеплоить backend.
4. Включить `SPA_ENABLED=1`, оставить `SPA_PRIMARY_ROUTES_TO_SHELL_ENABLED=0`.
5. Поочередно включать `SPA_PHASE_*` по плану миграции.
6. После стабилизации включить `SPA_PRIMARY_ROUTES_TO_SHELL_ENABLED=1`.

## 2) Rollback

### Быстрый откат по фазе

- Выключить соответствующий `SPA_PHASE_*`.
- Пользователь автоматически уходит на legacy-страницу того же маршрута.

### Полный откат SPA

1. Выключить `SPA_PRIMARY_ROUTES_TO_SHELL_ENABLED=0`.
2. Выключить `SPA_ENABLED=0`.
3. Проверить доступность legacy-маршрутов.

## 3) Мониторинг ошибок

Минимальный чек-лист мониторинга после каждого включения флагов:

- Ошибки 5xx по маршрутам `/app`, `/api/me/status`, `/api/profile`, `/api/diary`, `/api/meal-plan/*`.
- Доля 307-редиректов между `/app/*` и legacy-роутами (для выявления циклов).
- Ошибки в консоли Telegram WebApp (runtime/theme/viewport).
- Ошибки и таймауты API в критичных сценариях (`diary`, `profile`, `resume`).

## 4) Политика удаления legacy

- `templates/*.html` и `static/js/*.js` удаляются только после подтвержденной замены эквивалентными SPA-модулями.
- До подтверждения паритета legacy остаётся fallback-слоем.
