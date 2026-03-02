<template>
    <section class="min-h-screen bg-gradient-to-br from-[#f8fafc] via-[#f0f9ff] to-[#f0fdf4]">
        <main class="flex-1 px-4 py-8">
            <div class="max-w-md mx-auto space-y-8">
                <div class="text-center">
                    <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-400 mb-4 shadow-lg">
                        <i data-feather="book-open" class="w-7 h-7 text-white"></i>
                    </div>
                    <h1 class="text-2xl font-bold text-slate-800">Рацион питания</h1>
                    <p class="text-slate-500 mt-2">План собран под ваш ритм, цели и любимые продукты.</p>
                </div>

                <div class="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-3">
                    <div class="flex items-start justify-between gap-3">
                        <div>
                            <p class="text-sm text-slate-500">Диапазон</p>
                            <p id="meal-plan-desc" class="text-sm text-slate-500">Без медицинских обещаний.</p>
                        </div>
                        <div class="flex items-center gap-2">
                            <button
                                type="button"
                                data-plan-range="day"
                                class="text-xs font-semibold px-3 py-1 rounded-full"
                                :class="activeRange === 'day' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'"
                                @click="activeRange = 'day'"
                            >День</button>
                            <button
                                type="button"
                                data-plan-range="week"
                                class="text-xs font-semibold px-3 py-1 rounded-full"
                                :class="activeRange === 'week' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'"
                                @click="activeRange = 'week'"
                            >Неделя</button>
                        </div>
                    </div>
                    <div class="grid grid-cols-3 gap-4 text-center">
                        <div>
                            <p class="text-xs text-slate-500">Калории</p>
                            <p id="meal-plan-calories" class="text-base font-semibold text-slate-800">{{ summaryCalories }}</p>
                        </div>
                        <div>
                            <p class="text-xs text-slate-500">Белки/жиры/углеводы</p>
                            <p id="meal-plan-macros" class="text-base font-semibold text-slate-800">{{ summaryMacros }}</p>
                        </div>
                        <div>
                            <p class="text-xs text-slate-500">Продукты</p>
                            <p id="meal-plan-products" class="text-base font-semibold text-slate-800">{{ summaryProducts }}</p>
                        </div>
                    </div>
                </div>

                <div id="meal-plan-container" class="space-y-6">
                    <p v-if="isLoading" class="text-center text-slate-400">Загрузка...</p>
                    <p v-else-if="loadError" class="text-center text-slate-400">{{ loadError }}</p>
                    <div
                        v-for="day in dayCards"
                        :key="day.key"
                        class="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-4"
                    >
                        <div class="flex items-center justify-between">
                            <div>
                                <h3 class="text-base font-semibold text-slate-800">{{ day.label }}</h3>
                                <p class="text-xs text-slate-500">План питания без медицинских обещаний.</p>
                            </div>
                        </div>

                        <div class="space-y-3">
                            <div
                                v-for="meal in day.meals"
                                :key="`${day.key}-${meal.key}`"
                                class="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"
                            >
                                <div class="flex items-center justify-between">
                                    <div class="text-sm font-semibold text-slate-800">{{ meal.title }}</div>
                                    <div class="text-xs text-slate-500">{{ meal.caloriesText }}</div>
                                </div>
                                <div class="text-xs text-slate-600 mt-2">{{ meal.suggestion }}</div>
                                <div class="text-xs text-slate-600 mt-1">{{ meal.itemsText }}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    </section>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, nextTick, onMounted, watch } from 'vue';
import { useMealPlanStore, type MealPlanItem, type MealPlanMeal, type MealPlanPayload } from '../stores/mealPlanStore';
import { useStorageStore } from '../stores/storageStore';

const MEAL_PLAN_ENDPOINT = '/api/meal-plan';

const DEFAULT_MEALS: Array<{ key: string; title: string }> = [
    { key: 'breakfast', title: 'Завтрак' },
    { key: 'lunch', title: 'Обед' },
    { key: 'snack', title: 'Перекус' },
    { key: 'dinner', title: 'Ужин' }
];

const storageStore = useStorageStore();
const mealPlanStore = useMealPlanStore();
const { activeRange, plans, isLoading, loadError } = storeToRefs(mealPlanStore);

const isFrontendDebugEnabled = (): boolean => Boolean((window as any)?.appDebug);

const getIsoDateWithOffset = (dayOffset: number): string => {
    const baseDate = new Date();
    baseDate.setHours(0, 0, 0, 0);
    baseDate.setDate(baseDate.getDate() + dayOffset);
    const year = baseDate.getFullYear();
    const month = String(baseDate.getMonth() + 1).padStart(2, '0');
    const day = String(baseDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const normalizeMeals = (meals: unknown): MealPlanMeal[] => {
    if (Array.isArray(meals) && meals.length > 0) {
        return meals as MealPlanMeal[];
    }
    return DEFAULT_MEALS.map((meal) => ({
        ...meal,
        items: [],
        target_calories: null,
        suggestion: 'Сборный приём пищи'
    }));
};

const isValidCaloriesTarget = (value: unknown): boolean => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0;
};

const computeAndPersistMissingCaloriesTarget = async (): Promise<{ ok: boolean; reason: string | null; diagnostics?: Record<string, unknown> | null }> => {
    const profile = storageStore.getUserProfile() as Record<string, unknown>;
    const computed = storageStore.computeTargetsForProfile(profile, new Date(), isFrontendDebugEnabled());

    if (!isValidCaloriesTarget(computed?.calories_target)) {
        return {
            ok: false,
            reason: 'insufficient_profile_data',
            diagnostics: { stage: 'compute', message: 'Недостаточно данных профиля для расчёта calories_target' }
        };
    }

    const payload = {
        tdee_calories: computed?.tdee_calories,
        calories_target: computed?.calories_target,
        calorie_delta: computed?.calorie_delta,
        weight_rate_kg_per_week: computed?.weight_rate_kg_per_week,
        predicted_goal_date: computed?.predicted_goal_date,
        warning_message: computed?.warning_message,
        safe_weeks_estimate: computed?.safe_weeks_estimate
    };

    try {
        const savedProfile = await storageStore.patchUserProfileWithBackend(payload);
        const savedCaloriesTarget = Number((savedProfile as Record<string, unknown> | null)?.calories_target);
        const isConfirmed = Number.isFinite(savedCaloriesTarget) && savedCaloriesTarget > 0;
        if (!isConfirmed) {
            return {
                ok: false,
                reason: 'profile_patch_not_confirmed',
                diagnostics: {
                    stage: 'persist',
                    message: 'Backend не подтвердил сохранение calories_target',
                    backend_response: savedProfile ?? null
                }
            };
        }
    } catch (error) {
        return {
            ok: false,
            reason: 'profile_patch_failed',
            diagnostics: {
                stage: 'persist',
                message: error instanceof Error ? error.message : 'Ошибка сохранения профиля на backend'
            }
        };
    }

    return { ok: true, reason: null, diagnostics: null };
};

const loadMealPlanByDate = async (isoDate: string, options: { allowColdStartRecovery?: boolean } = {}): Promise<MealPlanPayload> => {
    const allowColdStartRecovery = options.allowColdStartRecovery !== false;
    const params = new URLSearchParams({ date: isoDate });
    if (isFrontendDebugEnabled()) {
        params.set('app_debug', '1');
    }

    const response = await storageStore.apiFetch(`${MEAL_PLAN_ENDPOINT}?${params.toString()}`);
    if (!response.ok) {
        throw new Error('Не удалось загрузить рацион');
    }

    const payload = await response.json() as MealPlanPayload;
    const targetStatus = payload?.target_status;
    const targetsSource = payload?.targets_source;
    const needsColdStartRecovery = targetStatus === 'target_not_computed' || targetsSource === 'missing';

    if (!needsColdStartRecovery || !allowColdStartRecovery) {
        return payload;
    }

    const recovery = await computeAndPersistMissingCaloriesTarget();
    if (!recovery.ok) {
        const reason = recovery.reason === 'insufficient_profile_data'
            ? 'Заполните профиль для расчёта плана питания'
            : 'Не удалось восстановить цель рациона';
        const error = new Error(reason);
        (error as any).code = recovery.reason;
        (error as any).recovery_diagnostics = recovery.diagnostics || null;
        throw error;
    }

    return loadMealPlanByDate(isoDate, { allowColdStartRecovery: false });
};

const buildTotalsText = (targets: MealPlanPayload['targets']): { calories: string; macros: string } => {
    const caloriesTarget = Number(targets?.calories);
    const macrosTarget = targets?.macros && typeof targets.macros === 'object' ? targets.macros : null;

    const caloriesText = Number.isFinite(caloriesTarget) && caloriesTarget > 0
        ? `${Math.round(caloriesTarget)} ккал`
        : 'ещё не рассчитано';

    if (!macrosTarget) {
        return { calories: caloriesText, macros: 'ещё не рассчитано' };
    }

    const protein = Number.isFinite(Number(macrosTarget.protein_g)) ? Math.round(Number(macrosTarget.protein_g)) : 0;
    const fat = Number.isFinite(Number(macrosTarget.fat_g)) ? Math.round(Number(macrosTarget.fat_g)) : 0;
    const carbs = Number.isFinite(Number(macrosTarget.carbs_g)) ? Math.round(Number(macrosTarget.carbs_g)) : 0;

    if (protein === 0 && fat === 0 && carbs === 0 && !Number.isFinite(Number(macrosTarget.protein_g))) {
        return { calories: caloriesText, macros: 'ещё не рассчитано' };
    }

    return {
        calories: caloriesText,
        macros: `${protein} / ${fat} / ${carbs} г`
    };
};

const countUniqueProductsInMeals = (meals: unknown): number => {
    if (!Array.isArray(meals)) {
        return 0;
    }
    const ids = new Set<number>();
    meals.forEach((meal) => {
        const items = Array.isArray((meal as MealPlanMeal)?.items) ? (meal as MealPlanMeal).items as MealPlanItem[] : [];
        items.forEach((item) => {
            const productId = Number(item?.product_id);
            if (Number.isInteger(productId)) {
                ids.add(productId);
            }
        });
    });
    return ids.size;
};

const summaryTotals = computed(() => {
    const primaryPlan = plans.value[0] || null;
    return buildTotalsText(primaryPlan?.targets);
});

const summaryCalories = computed(() => summaryTotals.value.calories);
const summaryMacros = computed(() => summaryTotals.value.macros);

const summaryProducts = computed(() => {
    const primaryPlan = plans.value[0] || null;
    const backendPoolSize = Number(primaryPlan?.meta?.pool_size);
    if (Number.isFinite(backendPoolSize) && backendPoolSize >= 0) {
        return String(backendPoolSize);
    }
    return String(countUniqueProductsInMeals(primaryPlan?.meals));
});

const dayCards = computed(() => {
    return plans.value.map((plan, dayIndex) => {
        const meals = normalizeMeals(plan?.meals).map((meal) => {
            const targetCalories = Number(meal?.target_calories);
            const caloriesText = Number.isFinite(targetCalories) && targetCalories > 0
                ? `≈ ${Math.round(targetCalories)} ккал`
                : 'ориентир не рассчитан';

            const items = Array.isArray(meal?.items) ? meal.items : [];
            const suggestion = typeof meal?.suggestion === 'string' && meal.suggestion.trim()
                ? meal.suggestion.trim()
                : 'Сборный приём пищи';

            const itemsText = items.length > 0
                ? items
                    .map((item) => {
                        const itemName = String(item?.name || 'Продукт');
                        const grams = Number(item?.grams);
                        return Number.isFinite(grams) && grams > 0
                            ? `${itemName} (${Math.round(grams)} г)`
                            : itemName;
                    })
                    .join(', ')
                : 'Добавьте любимые продукты, чтобы получить подборку.';

            return {
                key: meal?.key || meal?.title || 'meal',
                title: meal?.title || 'Приём пищи',
                caloriesText,
                suggestion,
                itemsText
            };
        });

        return {
            key: `${dayIndex}`,
            label: dayIndex === 0 ? 'Сегодня' : `День ${dayIndex + 1}`,
            meals
        };
    });
});

const refreshIcons = async (): Promise<void> => {
    await nextTick();
    const feather = (window as any).feather;
    if (typeof feather?.replace === 'function') {
        feather.replace();
    }
};

const loadMealPlan = async (): Promise<void> => {
    isLoading.value = true;
    loadError.value = '';

    const days = activeRange.value === 'week' ? 7 : 1;
    const dates = Array.from({ length: days }, (_, index) => getIsoDateWithOffset(index));

    try {
        plans.value = await Promise.all(dates.map((isoDate) => loadMealPlanByDate(isoDate)));
    } catch (error) {
        plans.value = [];
        if (error instanceof Error && error.message === 'Заполните профиль для расчёта плана питания') {
            loadError.value = 'Заполните профиль для расчёта плана питания';
        } else {
            loadError.value = 'Не удалось загрузить рацион.';
        }
    } finally {
        isLoading.value = false;
        await refreshIcons();
    }
};

watch(activeRange, () => {
    void loadMealPlan();
});

onMounted(async () => {
    try {
        await storageStore.syncProfileWithBackend();
    } catch {
        // Keep local profile fallback.
    }

    await loadMealPlan();
});
</script>
