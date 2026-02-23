# QA smoke-checklist: анимации без регресса

Чеклист выполняется для каждого экрана после миграции в SPA.

## Базовые правила

- Сохраняем те же имена анимаций, что в legacy.
- Не меняем `duration` и `timing-function` до завершения миграции.
- Проверяем поведение в Telegram WebApp и в обычном браузере (fallback).

## Общий smoke-check

- [ ] Page transition: при входе на экран есть мягкий `opacity 0.2s ease`.
- [ ] Ripple на `.btn-primary`: создаётся и удаляется без артефактов.
- [ ] Utility-анимации (`animate-fade-in`, `animate-slide-in`, `animate-pulse-subtle`, `animate-float`) визуально совпадают с legacy.
- [ ] Skeleton shimmer работает с той же скоростью (`1.6s ease-in-out infinite`).

## Дневник / FAB / панели

- [ ] Открытие diary-панели: `diary-panel-in 0.2s ease` без рывков.
- [ ] Открытие FAB-меню: `diary-fab-in 0.18s ease` без смещения по оси X.
- [ ] Закрытие backdrop/menu корректно снимает `hidden` и не оставляет зависший overlay.

## Прогресс и резюме

- [ ] Resume progress bar: `width 1s ease-out`.
- [ ] Resume progress ring: `stroke-dashoffset 1.2s ease-out`.
- [ ] Profile columns: `height 220ms ease`.

## Side-by-side (до/после)

Для каждого migrated-экрана фиксируем:

1. Действие в legacy.
2. То же действие в SPA.
3. Итог сравнения (совпадает / есть расхождение).

Шаблон записи:

| Экран | Сценарий | Legacy | SPA | Итог |
|---|---|---|---|---|
| `/diary` | Открытие FAB | ✅ | ✅ | Совпадает |
