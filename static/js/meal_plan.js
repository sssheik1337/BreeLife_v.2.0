// Экран рациона использует backend-контракт /api/meal-plan без изменения текущего UI.

const MEAL_PLAN_ENDPOINT = '/api/meal-plan';

const DEFAULT_MEALS = [
    { key: 'breakfast', title: 'Завтрак' },
    { key: 'lunch', title: 'Обед' },
    { key: 'snack', title: 'Перекус' },
    { key: 'dinner', title: 'Ужин' }
];

document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('meal-plan-container');
    if (!container) {
        return;
    }

    container.textContent = 'Загрузка рациона...';

    try {
        // Синхронизируем профиль с backend, чтобы экран работал с актуальными данными.
        if (typeof syncProfileWithBackend === 'function') {
            await syncProfileWithBackend();
        }

        initMealPlan(container);
    } catch (error) {
        if (error?.message === 'Заполните профиль для расчёта плана питания') {
            container.textContent = 'Заполните профиль для расчёта плана питания';
            return;
        }
        container.textContent = 'Не удалось загрузить рацион.';
    }
});

function initMealPlan(container) {
    const rangeButtons = Array.from(document.querySelectorAll('[data-plan-range]'));
    let activeRange = 'day';

    updateRangeButtons(rangeButtons, activeRange);
    renderMealPlan(container, activeRange);

    rangeButtons.forEach((button) => {
        button.addEventListener('click', async () => {
            activeRange = button.dataset.planRange || 'day';
            updateRangeButtons(rangeButtons, activeRange);
            await renderMealPlan(container, activeRange);
        });
    });
}

function updateRangeButtons(buttons, activeValue) {
    buttons.forEach((button) => {
        const isActive = button.dataset.planRange === activeValue;
        button.classList.toggle('bg-emerald-100', isActive);
        button.classList.toggle('text-emerald-700', isActive);
        button.classList.toggle('bg-slate-100', !isActive);
        button.classList.toggle('text-slate-500', !isActive);
    });
}

function getIsoDateWithOffset(dayOffset) {
    const baseDate = new Date();
    baseDate.setHours(0, 0, 0, 0);
    baseDate.setDate(baseDate.getDate() + dayOffset);
    const year = baseDate.getFullYear();
    const month = String(baseDate.getMonth() + 1).padStart(2, '0');
    const day = String(baseDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function isFrontendDebugEnabled() {
    return Boolean(window?.appDebug);
}

async function loadMealPlanByDate(isoDate, { allowColdStartRecovery = true } = {}) {
    const params = new URLSearchParams({ date: isoDate });
    if (isFrontendDebugEnabled()) {
        params.set('app_debug', '1');
    }

    const response = await fetch(`${MEAL_PLAN_ENDPOINT}?${params.toString()}`);
    if (!response.ok) {
        throw new Error('Не удалось загрузить рацион');
    }

    const payload = await response.json();
    const targetStatus = payload?.target_status;
    const targetsSource = payload?.targets_source;
    const needsColdStartRecovery = targetStatus === 'target_not_computed' || targetsSource === 'missing';

    if (!needsColdStartRecovery || allowColdStartRecovery === false) {
        return payload;
    }

    const recovery = await computeAndPersistMissingCaloriesTarget();
    if (!recovery.ok) {
        const reason = recovery.reason === 'insufficient_profile_data'
            ? 'Заполните профиль для расчёта плана питания'
            : 'Не удалось восстановить цель рациона';
        const error = new Error(reason);
        error.code = recovery.reason;
        throw error;
    }

    // После успешного сохранения цели повторяем запрос один раз.
    return loadMealPlanByDate(isoDate, { allowColdStartRecovery: false });
}



function isValidCaloriesTarget(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0;
}

async function computeAndPersistMissingCaloriesTarget() {
    if (typeof window.computeTargets !== 'function') {
        return { ok: false, reason: 'compute_targets_unavailable' };
    }

    const profile = typeof window.getUserProfile === 'function'
        ? (window.getUserProfile() || {})
        : {};
    const diaryEntries = typeof window.getDiaryEntries === 'function'
        ? window.getDiaryEntries()
        : [];

    const computed = window.computeTargets(profile, diaryEntries, new Date());
    if (!isValidCaloriesTarget(computed?.calories_target)) {
        return { ok: false, reason: 'insufficient_profile_data' };
    }

    const payload = {
        tdee_calories: computed?.tdee_calories,
        calories_target: computed?.calories_target,
        calorie_delta: computed?.calorie_delta,
        weight_rate_kg_per_week: computed?.weight_rate_kg_per_week,
        predicted_goal_date: computed?.predicted_goal_date,
        warning_message: computed?.warning_message,
        required_rate_kg_per_week: computed?.required_rate_kg_per_week,
        required_calorie_delta: computed?.required_calorie_delta,
        required_calories_target: computed?.required_calories_target,
        safe_weeks_estimate: computed?.safe_weeks_estimate,
    };

    if (typeof window.patchUserProfileWithBackend === 'function') {
        await window.patchUserProfileWithBackend(payload);
    } else if (typeof window.patchUserProfile === 'function') {
        window.patchUserProfile(payload);
    } else {
        return { ok: false, reason: 'profile_patch_unavailable' };
    }

    return { ok: true, reason: null };
}

function buildTotalsText(targets) {
    const caloriesTarget = Number(targets?.calories);
    const macrosTarget = targets?.macros && typeof targets.macros === 'object'
        ? targets.macros
        : null;

    const caloriesText = Number.isFinite(caloriesTarget) && caloriesTarget > 0
        ? `${Math.round(caloriesTarget)} ккал`
        : 'ещё не рассчитано';

    if (!macrosTarget) {
        return { calories: caloriesText, macros: 'ещё не рассчитано' };
    }

    const protein = Number.isFinite(Number(macrosTarget.protein_g)) ? Math.round(Number(macrosTarget.protein_g)) : 0;
    const fat = Number.isFinite(Number(macrosTarget.fat_g)) ? Math.round(Number(macrosTarget.fat_g)) : 0;
    const carbs = Number.isFinite(Number(macrosTarget.carbs_g)) ? Math.round(Number(macrosTarget.carbs_g)) : 0;

    // Если backend явно вернул пустые макросы, сохраняем заглушку как раньше.
    if (protein === 0 && fat === 0 && carbs === 0 && !Number.isFinite(Number(macrosTarget.protein_g))) {
        return { calories: caloriesText, macros: 'ещё не рассчитано' };
    }

    return {
        calories: caloriesText,
        macros: `${protein} / ${fat} / ${carbs} г`
    };
}

function countUniqueProductsInMeals(meals) {
    if (!Array.isArray(meals)) {
        return 0;
    }
    const ids = new Set();
    meals.forEach((meal) => {
        const items = Array.isArray(meal?.items) ? meal.items : [];
        items.forEach((item) => {
            const productId = Number(item?.product_id);
            if (Number.isInteger(productId)) {
                ids.add(productId);
            }
        });
    });
    return ids.size;
}

function updateSummary(productsCount, totalsText) {
    const desc = document.getElementById('meal-plan-desc');
    const calories = document.getElementById('meal-plan-calories');
    const macros = document.getElementById('meal-plan-macros');
    const products = document.getElementById('meal-plan-products');

    if (desc) {
        desc.textContent = 'План собран по вашему профилю и выбранным продуктам. Это подсказка, а не медсовет.';
    }
    if (calories) {
        calories.textContent = totalsText.calories;
    }
    if (macros) {
        macros.textContent = totalsText.macros;
    }
    if (products) {
        products.textContent = String(productsCount);
    }
}

function normalizeMeals(meals) {
    if (Array.isArray(meals) && meals.length > 0) {
        return meals;
    }
    return DEFAULT_MEALS.map((meal) => ({ ...meal, items: [], target_calories: null, suggestion: 'Сборный приём пищи' }));
}

function renderDayCard(dayPlan, dayIndex) {
    const mealsData = normalizeMeals(dayPlan?.meals);

    const card = document.createElement('div');
    card.className = 'bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-4';

    const header = document.createElement('div');
    header.className = 'flex items-center justify-between';
    const dayLabel = dayIndex === 0 ? 'Сегодня' : `День ${dayIndex + 1}`;
    header.innerHTML = `
        <div>
            <h3 class="text-base font-semibold text-slate-800">${dayLabel}</h3>
            <p class="text-xs text-slate-500">План питания без медицинских обещаний.</p>
        </div>
    `;

    const mealsContainer = document.createElement('div');
    mealsContainer.className = 'space-y-3';

    mealsData.forEach((meal) => {
        const mealCard = document.createElement('div');
        mealCard.className = 'rounded-xl border border-slate-100 bg-slate-50 px-4 py-3';

        const targetCalories = Number(meal?.target_calories);
        const caloriesPart = Number.isFinite(targetCalories) && targetCalories > 0
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

        mealCard.innerHTML = `
            <div class="flex items-center justify-between">
                <div class="text-sm font-semibold text-slate-800">${meal?.title || 'Приём пищи'}</div>
                <div class="text-xs text-slate-500">${caloriesPart}</div>
            </div>
            <div class="text-xs text-slate-600 mt-2">${suggestion}</div>
            <div class="text-xs text-slate-600 mt-1">${itemsText}</div>
        `;

        mealsContainer.appendChild(mealCard);
    });

    card.appendChild(header);
    card.appendChild(mealsContainer);
    return card;
}

async function renderMealPlan(container, rangeKey) {
    container.textContent = 'Загрузка рациона...';

    const days = rangeKey === 'week' ? 7 : 1;
    const dates = Array.from({ length: days }, (_, index) => getIsoDateWithOffset(index));

    try {
        const plans = await Promise.all(dates.map((isoDate) => loadMealPlanByDate(isoDate)));
        const primaryPlan = plans[0] || {};

        const totalsText = buildTotalsText(primaryPlan.targets);
        const backendPoolSize = Number(primaryPlan?.meta?.pool_size);
        const productsCount = Number.isFinite(backendPoolSize) && backendPoolSize >= 0
            ? backendPoolSize
            : countUniqueProductsInMeals(primaryPlan.meals);

        updateSummary(productsCount, totalsText);

        container.innerHTML = '';
        plans.forEach((plan, dayIndex) => {
            container.appendChild(renderDayCard(plan, dayIndex));
        });
    } catch (error) {
        if (error?.message === 'Заполните профиль для расчёта плана питания') {
            container.textContent = 'Заполните профиль для расчёта плана питания';
            return;
        }
        container.textContent = 'Не удалось загрузить рацион.';
    }
}
