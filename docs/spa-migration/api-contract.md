# API-контракт для SPA (канонические endpoint'ы и legacy-совместимость)

Документ фиксирует фактические API endpoint'ы из `app/routers/*.py` и рекомендуемые канонические пути для нового SPA-клиента.

## Правила выбора endpoint'ов

- Новый SPA-код использует только **канонические** endpoint'ы.
- Legacy-дубликаты остаются доступными через адаптер совместимости (для поэтапной миграции).
- Для авторизованных endpoint'ов добавляем заголовок `X-Telegram-Init-Data` при наличии `Telegram.WebApp.initData`.

## Заголовок `X-Telegram-Init-Data`

- Используется для auth bootstrap (`/api/auth/telegram`) и совместимости с backend-проверками.
- Источник значения: `window.telegramInitData` или `window.Telegram?.WebApp?.initData`.
- Если значение пустое, запросы выполняются без заголовка (fallback для браузера вне Telegram).

## Ошибки `401/403`

- `401 UNAUTHORIZED`: сессия отсутствует/просрочена. Клиент должен инициировать повторную Telegram-авторизацию или редирект на entry.
- `403 FORBIDDEN`: доступ запрещён (пример: `DEV_MODE_DISABLED` для trial). Клиент должен показать понятное сообщение без бесконечного ретрая.

## Форматы данных (критично для миграции)

### Профиль (`/api/profile`, `/api/profile/save`)

- Даты: ISO-строки (`YYYY-MM-DD` или `ISO datetime`) либо `null`.
- Числа: `number` либо `null` (`height_cm`, `weight_kg`, `target_weight_kg`, `activity_factor`, `calories_target`, ...).
- Флаги: `boolean` либо `null` (`is_completed`, `preferences_onboarding_completed`, `trial_welcome_seen`, ...).
- Списки: массивы ID (`favorite_product_ids`, `excluded_product_ids`) либо пустой массив.

### Дневник (`/api/diary`, `/api/habits`)

- `entries`: массив объектов.
- `date`: `YYYY-MM-DD` (локальная дата) либо `null`.
- `water_l`: `number | null`.
- `sleep_time`: строка (`HH:MM`) либо `null`.
- `activity`: `boolean | null`.
- Для сохранения используем payload вида `{ "entries": [...] }`.

---

## Endpoint-матрица по use-case

| Use-case | Канонический endpoint | Метод | Legacy-дубликаты | Примечание |
|---|---|---|---|---|
| Получить профиль | `/api/profile` | `GET` | `/api/profile` (`POST`), `/api/profile/get` (`GET`) | В новом коде только `GET /api/profile`. |
| Частично сохранить профиль | `/api/profile/save` | `POST` | — | PATCH-поведение на backend через `apply_profile_patch`. |
| Отправить событие onboarding | `/api/preferences/onboarding/event` | `POST` | — | Аналитика шага предпочтений. |
| Получить дневник | `/api/diary` | `GET` | `/api/diary/get` (`GET`) | В новом коде только `/api/diary`. |
| Сохранить дневник | `/api/diary` | `POST` | `/api/diary/save` (`POST`) | Payload `{ entries: [...] }`. |
| Получить привычки | `/api/habits` | `GET` | `/api/habits/get` (`GET`) | Канонический `/api/habits`. |
| Сохранить привычки | `/api/habits` | `POST` | `/api/habits/save` (`POST`) | Payload `{ entries: [...] }`. |
| Получить рацион на день | `/api/meal-plan` | `GET` | — | Query-параметр `date` опционален. |
| Получить рацион на неделю | `/api/meal-plan/week` | `GET` | — | Query-параметр `week_start` опционален. |
| Статус подписки | `/api/subscription/status` | `GET` | — | Возвращает `active/inactive` + даты подписки. |
| Старт trial | `/api/subscription/start_trial` | `POST` | — | В DEV может вернуть `403 DEV_MODE_DISABLED`. |
| Старт оплаты | `/api/payments/start` | `POST` | — | Payload `{ plan_id: string }`. |
| Список напоминаний | `/api/reminders/list` | `GET` | — | Канонический список. |
| Запланировать напоминание | `/api/reminders/schedule` | `POST` | — | Payload `{ type, when_iso }`. |
| Создать напоминание | `/api/reminders/generate` | `POST` | — | Payload `{ type, time, enabled }`. |
| Автогенерация напоминаний | `/api/reminders/auto-generate` | `POST` | — | Payload `{ type, timezone_offset }`. |

## Источники

- `app/routers/profile.py`
- `app/routers/diary.py`
- `app/routers/meal_plan_api.py`
- `app/routers/subscription.py`
- `app/routers/reminders.py`
- `app/routers/telegram.py`
