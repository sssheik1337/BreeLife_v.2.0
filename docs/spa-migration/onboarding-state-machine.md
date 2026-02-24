# Onboarding state-machine (legacy → SPA)

Документ фиксирует единый автомат переходов онбординга для SPA и сопоставление с текущей legacy-логикой.

## Источники истины (legacy)

- Backend-редиректы: `app/routers/pages.py`, `app/routers/profile.py`.
- Frontend-редиректы: `static/js/questionnaire.js`, `static/js/ui.js`.

## Состояния

- `ENTRY` — входные страницы `/` и `/index`.
- `UNAUTHORIZED` — не авторизован в Telegram-сессии.
- `QUESTIONNAIRE_REQUIRED` — профиль не завершён (`profile_completed=false` и `profile.is_completed!==true`).
- `QUESTIONNAIRE_COMPLETED` — анкета завершена.
- `PREFERENCES_CHOICE_REQUIRED` — после анкеты, но онбординг предпочтений не завершён.
- `TRIAL_WELCOME_REQUIRED` — нужен экран `/trial-start` по правилу `should_redirect_to_trial_start`.
- `PROFILE_READY` — можно открывать `/profile`.
- `PRODUCTS_ONBOARDING_REQUIRED` — нет признаков завершения продуктового онбординга.

## Правила переходов (parity)

1. `ENTRY -> /profile`, если профиль завершён.
2. Любой защищённый маршрут -> `/`, если пользователь не авторизован.
3. Любой маршрут (кроме `/questionnaire` и preference-маршрутов) -> `/questionnaire`, если профиль не завершён.
4. `/questionnaire` ->
   - `/trial-start`, если `preferences_onboarding_completed=true`;
   - `/preferences-onboarding-choice`, если `preferences_onboarding_completed=false`.
5. `/preferences-onboarding-choice` -> `/questionnaire`, если профиль не завершён.
6. `/preferences-onboarding-choice` -> `/trial-start`, если preference-онбординг уже завершён.
7. `/profile` -> `/trial-start`, если `should_redirect_to_trial_start(profile)=true`.
8. `/trial-start` -> `/profile`, если `should_redirect_to_trial_start(profile)=false`.
9. `/meal-plan` и `/shopping-list` -> `/preferences-onboarding`, если нет product onboarding данных.

## Реализация в SPA

- Централизованная проверка: `spa/src/domain/onboarding/stateMachine.ts`.
- Отладочное логирование: `spa/src/domain/onboarding/debug.ts`.
- Интеграция в роутер: `spa/src/router/index.ts` (`beforeEach`).

## Debug-режим (сравнение legacy vs SPA)

Включение:

- query-параметр: `?onboardingDebug=1`
- или localStorage: `localStorage.setItem('spa_onboarding_debug', '1')`

Логи в консоли:

- `[spa:onboarding] guard:start` — входные данные guard.
- `[spa:onboarding] guard:decision` — итоговое решение автомата.

## Сценарии сравнения до отключения legacy

### Первый вход

1. Неавторизованный пользователь открывает `/profile` → ожидаем редирект на `/`.
2. Авторизованный, профиль не завершён, открывает `/menu` → ожидаем `/questionnaire`.
3. Пользователь завершает анкету:
   - без preference completion → `/preferences-onboarding-choice`;
   - с preference completion → `/trial-start`.

### Возврат пользователя

1. Завершённый профиль + `trial_welcome_seen=false` + нет `trial_started_at` → `/profile` должен редиректить в `/trial-start`.
2. Завершённый профиль + `trial_welcome_seen=true` → `/trial-start` должен редиректить в `/profile`.
3. Для `/meal-plan` и `/shopping-list` без product onboarding данных ожидаем редирект в `/preferences-onboarding`.
