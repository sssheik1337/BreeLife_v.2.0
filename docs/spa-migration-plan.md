# SPA Migration Assessment (FastAPI + Telegram WebApp)

## Current architecture snapshot

- Backend uses FastAPI routers for both template-rendered pages and JSON APIs.
- Frontend is currently a multi-script setup with shared global state (`window.*`) and page-level script bundles.
- Telegram WebApp integration and profile/session sync behavior are critical and should be preserved during migration.

## Migration complexity

The migration is **medium-high complexity** because:

1. Significant client business logic lives in browser scripts and global handlers.
2. SSR templates and API endpoints are mixed, so migration requires route and rendering strategy changes.
3. Telegram-specific UX/session lifecycle introduces additional regression risk.

## Framework recommendation

### Recommended: Vue 3

Vue 3 is the pragmatic choice here for a staged migration:

- Lower ceremony for incremental page-by-page replacement.
- Easier transition from existing template-style frontend code.
- Good fit for gradual refactors where legacy pages must continue working.

### React is still valid when

- Team expertise is stronger in React.
- There is a strategic requirement to align with existing React ecosystem tooling.

## Safe migration strategy

1. Keep FastAPI as API/auth/business layer.
2. Introduce an SPA entry route (for example `/app`) while keeping existing SSR pages alive.
3. Define and freeze API contracts for profile, onboarding, meal plan, and diary modules.
4. Move legacy browser logic into SPA services/stores module by module.
5. Migrate features in vertical slices (onboarding -> profile -> meal plan -> diary).
6. Use feature flags or route split to reduce deployment risk.
7. Remove legacy scripts only after stability metrics pass.

## Key risks and mitigations

- **State sync regressions**: add contract tests for profile patch/merge behavior.
- **Telegram flow regressions**: isolate Telegram adapter and add smoke E2E coverage.
- **Logic duplication during transition**: enforce per-module ownership and sunset plan.
- **Performance regressions**: lazy-load routes and keep initial JS payload minimal.

## Suggested timeline (single squad)

- MVP SPA for 1-2 core flows: **3-5 weeks**.
- Main user flows migrated: **8-14 weeks**.
- Hardening/regressions/perf: **+2-4 weeks**.

**Overall estimate:** ~10-18 weeks depending on team size and release constraints.
