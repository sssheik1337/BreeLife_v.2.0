# Карта bridge: legacy global → SPA store/action

Этот документ фиксирует минимальный набор глобалов, которые временно остаются в `window` для совместимости старых экранов.

> Принцип: после миграции каждого экрана убираем неиспользуемые ключи через `removeLegacyBinding(...)`.

## Таблица соответствий

| Legacy global | SPA источник | Тип доступа | Комментарий по удалению |
|---|---|---|---|
| `window.apiFetch` | `windowBridge.installWindowBridge({ apiFetch })` | чтение/вызов | Удалить после перевода всех legacy API-вызовов на `spa/src/api/*`. |
| `window.getUserProfile` | `useAppStateStore().profile` | чтение (snapshot) | Удалить после миграции экранов, читающих профиль напрямую из `window`. |
| `window.getDiaryEntries` | `useAppStateStore().diaryEntries` | чтение (snapshot) | Удалить после миграции `diary/profile`-экранов. |
| `window.getHabitEntries` | `useAppStateStore().habitEntries` | чтение (snapshot) | Удалить после миграции привычек и связанных виджетов. |
| `window.getServerUser` | `useAppStateStore().serverUser` | чтение (snapshot) | Удалить после перевода guards/layout на Vue Router + store. |
| `window.getProfileCompleted` | `useAppStateStore().profileCompleted` | чтение (snapshot) | Удалить после миграции всех redirect-правил в router-guards. |

## Порядок сокращения bridge

1. Мигрируем экран в SPA и подтверждаем, что он не обращается к соответствующему `window.*` ключу.
2. Удаляем ключ из bridge через `removeLegacyBinding(...)` в точке инициализации.
3. Обновляем эту таблицу и отмечаем дату удаления.
4. После вычищения всех строк удаляем `windowBridge` полностью через `uninstallWindowBridge`.
