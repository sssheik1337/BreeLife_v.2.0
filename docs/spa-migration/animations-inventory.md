# Инвентаризация анимаций для SPA-миграции

Документ фиксирует текущий контракт анимаций из legacy-слоя (`static/css/style.css`, `static/js/ui.js`, `static/js/diary.js`) и правила переноса в SPA.

## Правило миграции (обязательное)

- До полного завершения миграции **запрещено менять** `duration`, `timing-function` и названия ключевых анимаций.
- Допускается только перенос в SPA-компоненты/composables с сохранением визуального поведения.

## CSS-анимации и keyframes (источник: `static/css/style.css`)

| Анимация / класс | Где используется | Контракт (duration / easing) |
|---|---|---|
| `@keyframes fadeIn` | `.card`, `.animate-fade-in` | `0.5s ease-out` |
| `@keyframes slideIn` | `.animate-slide-in` | `0.3s ease-out` |
| `@keyframes ripple` | ripple-эффект кнопок | `0.6s linear` |
| `@keyframes pulse` | `.animate-pulse-subtle` | `2s infinite` |
| `@keyframes float` | `.animate-float` | `3s ease-in-out infinite` |
| `@keyframes shimmer` | `.skeleton-line` | `1.6s ease-in-out infinite` |
| `@keyframes diary-panel-in` | `.diary-panel__card` | `0.2s ease` |
| `@keyframes diary-fab-in` | `.diary-fab__menu` | `0.18s ease` |

## JS-анимации/transition

| Сценарий | Источник | Контракт |
|---|---|---|
| Page transition при загрузке | `static/js/ui.js` (`animatePageTransition`) | `opacity 0.2s ease` |
| Ripple на `.btn-primary` | `static/js/ui.js` | `animation: ripple 0.6s linear` |
| Анимация прогресс-бара на resume | `static/js/resume.js` | `width 1s ease-out, background-color 1s ease-out` |
| Анимация кольца прогресса | `static/js/resume.js` | `stroke-dashoffset 1.2s ease-out` |
| Анимация баров на profile | `static/js/profile.js` | `height 220ms ease, background-color 220ms ease` |
| Открытие diary FAB/menu | `static/js/diary.js` + CSS | `diary-fab-in 0.18s ease` + toggle hidden классов |

## Что переносим в SPA

1. Общие keyframes и utility-классы — в `spa/src/components/animations/legacy-animation-contract.css`.
2. JS-hooks:
   - page transition,
   - ripple для `.btn-primary`,
   - diary panel/FAB toggle helpers.
3. На каждом мигрированном экране сравниваем поведение по smoke-checklist.

## Side-by-side сверка migrated-экранов

На текущем шаге полностью мигрированных экранов ещё нет (есть только инфраструктурные заглушки маршрутов).

Когда появится первый мигрированный экран, добавляем в этот документ запись:

| Экран | Legacy URL | SPA URL | Действие | Результат сверки |
|---|---|---|---|---|
| _пример: Дневник_ | `/diary` | `/diary` | открыть FAB, закрыть, открыть панель | _OK / BLOCKED_ |
