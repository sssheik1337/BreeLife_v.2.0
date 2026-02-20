// Генератор рациона: день или неделя на основе профиля и предпочтений.
// Этап миграции: текущий экран пока использует локальную сборку из каталога продуктов.
// Новый backend-контракт зафиксирован на `GET /api/meal-plan` и будет подключён
// в следующих задачах без изменения структуры DOM на странице.

const PRODUCTS_ENDPOINT = '/api/products';

const MEAL_DISTRIBUTION = [
    { key: 'breakfast', title: 'Завтрак', share: 0.25, items: 2 },
    { key: 'lunch', title: 'Обед', share: 0.35, items: 3 },
    { key: 'snack', title: 'Перекус', share: 0.1, items: 2 },
    { key: 'dinner', title: 'Ужин', share: 0.3, items: 3 }
];

document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('meal-plan-container');
    if (!container) {
        return;
    }

    container.textContent = 'Загрузка рациона...';

    try {
        // Синхронизируем профиль с backend, чтобы рацион использовал единый источник истины.
        if (typeof syncProfileWithBackend === 'function') {
            await syncProfileWithBackend();
        }

        const response = await fetch(PRODUCTS_ENDPOINT);
        if (!response.ok) {
            throw new Error('Не удалось загрузить данные');
        }
        const products = await response.json();
        initMealPlan(container, products);
    } catch (error) {
        container.textContent = 'Не удалось загрузить рацион.';
    }
});

function initMealPlan(container, products) {
    const rangeButtons = Array.from(document.querySelectorAll('[data-plan-range]'));
    let activeRange = 'day';
    updateRangeButtons(rangeButtons, activeRange);
    renderMealPlan(container, products, activeRange);

    rangeButtons.forEach((button) => {
        button.addEventListener('click', () => {
            activeRange = button.dataset.planRange || 'day';
            updateRangeButtons(rangeButtons, activeRange);
            renderMealPlan(container, products, activeRange);
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


function resolveCaloriesTarget(profile) {
    const directTarget = Number(profile?.calories_target);
    if (Number.isFinite(directTarget) && directTarget > 0) {
        return directTarget;
    }

    const requiredTarget = Number(profile?.required_calories_target);
    if (Number.isFinite(requiredTarget) && requiredTarget > 0) {
        return requiredTarget;
    }

    const tdee = Number(profile?.tdee_calories);
    if (!Number.isFinite(tdee) || tdee <= 0) {
        return null;
    }

    // Аварийный расчёт цели по калориям на основе TDEE и цели, если явная цель не сохранена.
    if (profile?.goal === 'lose') {
        return Math.max(1200, Math.round(tdee * 0.85));
    }
    if (profile?.goal === 'gain') {
        return Math.round(tdee * 1.1);
    }
    return Math.round(tdee);
}


function resolveMacrosTarget(profile, caloriesTarget) {
    if (profile?.macros && typeof profile.macros === 'object') {
        return profile.macros;
    }

    if (typeof calculateMacros !== 'function') {
        return null;
    }

    return calculateMacros({
        goal: profile?.goal,
        weight_kg: profile?.weight_kg,
        calories_target: caloriesTarget
    });
}

function renderMealPlan(container, products, rangeKey) {
    const profile = typeof getUserProfile === 'function' ? getUserProfile() : {};
    const filteredProducts = buildPreferredProducts(products, profile);

    const caloriesTarget = resolveCaloriesTarget(profile);
    const macrosTarget = resolveMacrosTarget(profile, caloriesTarget);
    const totalsText = buildTotalsText(caloriesTarget, macrosTarget);

    updateSummary(filteredProducts.length, totalsText);

    container.innerHTML = '';

    const days = rangeKey === 'week' ? 7 : 1;
    for (let dayIndex = 0; dayIndex < days; dayIndex += 1) {
        const dayPlan = buildDayPlan(filteredProducts, dayIndex);
        container.appendChild(renderDayCard(dayPlan, dayIndex, caloriesTarget));
    }
}

function normalizeProfileIdSet(value) {
    if (!Array.isArray(value)) {
        return new Set();
    }
    const normalized = value
        .map((item) => Number(item))
        .filter((item) => Number.isInteger(item));
    return new Set(normalized);
}

function buildPreferredProducts(products, profile) {
    // Безопасно нормализуем id, чтобы учесть legacy-форматы (строки/дубли).
    const favorites = normalizeProfileIdSet(profile?.favorite_product_ids);
    const excluded = normalizeProfileIdSet(profile?.excluded_product_ids);
    const available = products.filter((product) => !excluded.has(product.id));
    if (favorites.size > 0) {
        const favoriteProducts = available.filter((product) => favorites.has(product.id));
        if (favoriteProducts.length > 0) {
            return favoriteProducts;
        }
    }
    return available;
}

function buildTotalsText(caloriesTarget, macrosTarget) {
    const caloriesText = Number.isFinite(caloriesTarget) && caloriesTarget > 0
        ? `${Math.round(caloriesTarget)} ккал`
        : 'ещё не рассчитано';
    if (!macrosTarget) {
        return { calories: caloriesText, macros: 'ещё не рассчитано' };
    }
    const protein = macrosTarget.protein_g ? Math.round(macrosTarget.protein_g) : 0;
    const fat = macrosTarget.fat_g ? Math.round(macrosTarget.fat_g) : 0;
    const carbs = macrosTarget.carbs_g ? Math.round(macrosTarget.carbs_g) : 0;
    return {
        calories: caloriesText,
        macros: `${protein} / ${fat} / ${carbs} г`
    };
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
        products.textContent = productsCount.toString();
    }
}

function buildDayPlan(products, dayIndex) {
    const sorted = [...products].sort((a, b) => {
        const groupA = a.group || '';
        const groupB = b.group || '';
        if (groupA === groupB) {
            return (a.name || '').localeCompare(b.name || '');
        }
        return groupA.localeCompare(groupB);
    });

    const plan = MEAL_DISTRIBUTION.map((meal, mealIndex) => {
        const startIndex = (dayIndex * 7 + mealIndex * 3) % Math.max(sorted.length, 1);
        const items = pickItems(sorted, startIndex, meal.items);
        return {
            title: meal.title,
            share: meal.share,
            items
        };
    });

    return plan;
}

function pickItems(list, startIndex, count) {
    if (list.length === 0) {
        return [];
    }
    const items = [];
    for (let i = 0; i < count; i += 1) {
        const index = (startIndex + i) % list.length;
        items.push(list[index]);
    }
    return items;
}

function renderDayCard(plan, dayIndex, caloriesTarget) {
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

    const meals = document.createElement('div');
    meals.className = 'space-y-3';

    plan.forEach((meal) => {
        const mealCard = document.createElement('div');
        mealCard.className = 'rounded-xl border border-slate-100 bg-slate-50 px-4 py-3';

        const caloriesPart = Number.isFinite(caloriesTarget) && caloriesTarget > 0
            ? `≈ ${Math.round(caloriesTarget * meal.share)} ккал`
            : 'ориентир не рассчитан';

        const itemsText = meal.items.length
            ? meal.items.map((item) => item.name).join(', ')
            : 'Добавьте любимые продукты, чтобы получить подборку.';

        mealCard.innerHTML = `
            <div class="flex items-center justify-between">
                <div class="text-sm font-semibold text-slate-800">${meal.title}</div>
                <div class="text-xs text-slate-500">${caloriesPart}</div>
            </div>
            <div class="text-xs text-slate-600 mt-2">${itemsText}</div>
        `;

        meals.appendChild(mealCard);
    });

    card.appendChild(header);
    card.appendChild(meals);
    return card;
}
