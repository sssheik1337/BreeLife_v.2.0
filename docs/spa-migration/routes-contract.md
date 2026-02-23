# Контракт маршрутов для SPA (без переименования URL)

Документ фиксирует канонические публичные пути, которые SPA должна поддерживать **1:1** относительно текущих backend HTML-роутов.

## Цели контракта

- Сохранить deeplink-совместимость внутри Telegram WebApp.
- Сохранить текущее поведение редиректов из backend и `static/js/ui.js`.
- Оставить backend HTML-роуты в качестве fallback на время поэтапной миграции.

## Источники

- `app/routers/core.py`
- `app/routers/questionnaire.py`
- `app/routers/profile.py`
- `app/routers/diary.py`
- `app/routers/foods.py`
- `app/routers/pages.py`
- `docs/navigation.md`

## Канонические пользовательские маршруты

| Путь | Экран | Guard / поведение | Источник текущей логики |
|---|---|---|---|
| `/` | Entry | Если профиль завершён → переход на `/profile`, иначе остаёмся на entry/переходим в `/questionnaire`. | `static/js/ui.js` |
| `/index` | Alias entry | Поведение как у `/`. | `app/routers/core.py` |
| `/questionnaire` | Анкета | Доступен без принудительного редиректа. | `app/routers/questionnaire.py`, `static/js/ui.js` |
| `/preferences-onboarding-choice` | Выбор шага предпочтений | Требует `profile_completed`; если `preferences_onboarding_completed=true` → `/trial-start`; иначе экран выбора. | `app/routers/pages.py` |
| `/preferences-onboarding` | Онбординг предпочтений | Требует `profile_completed`; при незавершённом профиле → `/questionnaire`. | `app/routers/pages.py` |
| `/trial-start` | Welcome триала | Требует `profile_completed`; если welcome уже показан/триал начат → `/profile`. | `app/routers/profile.py` |
| `/resume` | Профиль (личные данные) | Требует `profile_completed`, иначе `/questionnaire`. | `app/routers/profile.py`, `static/js/ui.js` |
| `/profile` | Прогресс | Требует `profile_completed`; если требуется welcome триала → `/trial-start`. | `app/routers/profile.py` |
| `/profile.html` | Alias прогресса | Алиас на `/profile`. | `app/routers/profile.py` |
| `/diary` | Дневник | Требует `profile_completed`, иначе `/questionnaire`. | `app/routers/diary.py`, `static/js/ui.js` |
| `/food-diary` | Legacy alias дневника | Редирект на `/diary`. | `app/routers/diary.py` |
| `/foods` | Каталог продуктов | Требует `profile_completed`, иначе `/questionnaire`. | `app/routers/foods.py` |
| `/my-products` | Мои продукты | Требует `profile_completed`, иначе `/questionnaire`. | `app/routers/foods.py` |
| `/meal-plan` | Рацион | Требует `profile_completed`; без product-onboarding → `/preferences-onboarding`. | `app/routers/foods.py` |
| `/shopping-list` | Список покупок | Требует `profile_completed`; без product-onboarding → `/preferences-onboarding`. | `app/routers/foods.py` |
| `/menu` | Меню | Для завершённого профиля не редиректить автоматически. | `app/routers/pages.py`, `static/js/ui.js` |
| `/references` | Справка | Требует `profile_completed`, иначе `/questionnaire`. | `app/routers/pages.py`, `static/js/ui.js` |
| `/support` | Поддержка | Требует `profile_completed`, иначе `/questionnaire`. | `app/routers/pages.py`, `static/js/ui.js` |
| `/plans` | Тарифы | Требует `profile_completed`, иначе `/questionnaire`. | `app/routers/pages.py`, `static/js/ui.js` |
| `/settings/reminders` | Настройки напоминаний | Требует `profile_completed`, иначе `/questionnaire`. | `app/routers/pages.py`, `static/js/ui.js` |

## Канонические названия пунктов нижней навигации

Сохраняем текущую договорённость без переименования URL:

- **«Профиль»** → `/resume`
- **«Прогресс»** → `/profile`
- **«Дневник»** → `/diary`
- **«Рацион»** → `/meal-plan`
- **«Меню» / настройки** → `/menu`

## Fallback-стратегия на время миграции

1. SPA поддерживает те же пути и правила редиректов.
2. Backend HTML-роуты не удаляются и продолжают работать как fallback.
3. Переключение на SPA выполняется по фичефлагу/роут-префиксу.
4. При ошибке SPA-router пользователь должен иметь возможность вернуться на legacy HTML-страницу того же пути.

## Примечание по guard-логике

Guard-логика в SPA должна повторять текущие источники истины:

- `/api/me/status` — авторизация + `profile_completed`.
- `/api/profile` — поля онбординга предпочтений и состояние trial welcome.
- Локальный fallback (например, `window.profileCompleted`) допускается только как временная защита при миграции.
