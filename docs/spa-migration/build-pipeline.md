# Сборка SPA перед деплоем backend

Для поэтапной миграции сохраняем старые `templates/*.html`, но добавляем отдельный шаг сборки SPA.

## Локальный/CI шаг

Используйте скрипт:

```bash
scripts/сборка_spa_перед_деплоем.sh
```

Скрипт:

1. проверяет наличие `npm`,
2. устанавливает зависимости в `spa/` (если `node_modules` отсутствует),
3. выполняет `npm run build`,
4. складывает артефакты в `spa/dist`.

## Интеграция с backend

- FastAPI отдает ассеты сборки по `/spa-assets`.
- SPA shell отдается роутом `/app` (и `/app/{path}`).
- Legacy HTML-страницы продолжают работать как fallback и не удаляются.


## Эксплуатация

- Для процедур деплоя/rollback/мониторинга используйте `docs/spa-migration/operations-runbook.md`.
- Legacy-файлы `templates/*.html` и `static/js/*.js` удаляются только после подтвержденной замены в SPA и фиксации в итоговом отчете `docs/spa-migration/migration-final-report.md`.
