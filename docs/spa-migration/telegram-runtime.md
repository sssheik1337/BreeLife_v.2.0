# Telegram runtime для SPA

Документ описывает перенос runtime-логики из `static/js/ui.js` в SPA-слой.

## Что перенесено

- `ready/expand` для Telegram WebApp.
- Синхронизация CSS-переменных темы:
  - `--tg-bg-color`
  - `--tg-text-color`
- Синхронизация safe-area и верхнего offset:
  - `--tg-safe-top`
  - `--tg-ui-top`
- Подписки на события:
  - `themeChanged`
  - `viewportChanged`
- Обновление `--header-height` для стабилизации вертикального layout и предотвращения «прыжков».

## Файлы

- `spa/src/platform/telegramRuntime.ts` — платформа/адаптер Telegram WebApp.
- `spa/src/composables/useTelegramRuntime.ts` — composable жизненного цикла.
- `spa/src/layouts/RootSpaLayout.vue` — корневой layout, где runtime запускается один раз.

## Как подключать

1. Оборачивать SPA-экраны в `RootSpaLayout.vue`.
2. Не переименовывать CSS-переменные, чтобы сохранить совместимость со старым стилевым слоем.
3. При переносе шапки/нижней навигации в SPA оставлять привязку к тем же переменным (`--tg-safe-top`, `--tg-ui-top`, `--header-height`).

## Fallback

Если Telegram WebApp API недоступен (например, локальный браузер), runtime не падает:

- выставляется дефолтная высота шапки,
- тема остаётся браузерной,
- приложение продолжает работать без блокировки маршрутов.
