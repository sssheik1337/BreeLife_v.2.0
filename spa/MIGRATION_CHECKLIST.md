# SPA Migration Contract

## Definition of Done (per screen)

A screen is considered migrated only if all checks below are true:

1. No legacy script loading from `/static/js/*`.
2. No `document.createElement('script')` usage.
3. No `window.init*` bootstrap calls.
4. Data source is Pinia state/actions (not imperative `window.*` flows).
5. Internal navigation uses Vue Router only.
6. No `window.location.*` for internal route transitions.
7. Screen works without full page reloads.

## Screen Status

| Screen | Route | Status |
| --- | --- | --- |
| EntryPage.vue | `/` `/index` | vue-native |
| QuestionnairePage.vue | `/questionnaire` | vue-native |
| PreferencesChoicePage.vue | `/preferences-onboarding-choice` | vue-native |
| PreferencesOnboardingPage.vue | `/preferences-onboarding` | vue-native |
| TrialStartPage.vue | `/trial-start` | vue-native |
| ResumePage.vue | `/resume` | vue-native |
| ProfilePage.vue | `/profile` | vue-native |
| DiaryPage.vue | `/diary` | vue-native |
| FoodsPage.vue | `/foods` | vue-native |
| MyProductsPage.vue | `/my-products` | vue-native |
| MealPlanPage.vue | `/meal-plan` | vue-native |
| ShoppingListPage.vue | `/shopping-list` | vue-native |
| MenuPage.vue | `/menu` | vue-native |
| PlansPage.vue | `/plans` | vue-native |
| ReferencesPage.vue | `/references` | vue-native |
| RemindersSettingsPage.vue | `/settings/reminders` | vue-native |
| SupportPage.vue | `/support` | vue-native |

Status legend:

- `wrapper`: Vue template exists, but page still depends on legacy `/static/js/*` and/or `window.init*`.
- `vue-native`: No legacy script bootstrap, data and navigation are fully Vue + Pinia.
