// Генератор рациона: день или неделя на основе профиля и предпочтений.

const PRODUCTS_ENDPOINT = '/static/data/products.json';

const MEAL_DISTRIBUTION = [
    { key: 'breakfast', title: 'Завтрак', share: 0.25, items: 2 },
    { key: 'lunch', title: 'Обед', share: 0.35, items: 3 },
    { key: 'snack', title: 'Перекус', share: 0.1, items: 2 },
    { key: 'dinner', title: 'Ужин', share: 0.3, items: 3 }
];

document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('meal-plan-container');
    if (!container) {
        return;
    }

    container.textContent = 'Загрузка рациона...';

    fetch(PRODUCTS_ENDPOINT)
        .then((response) => {
            if (!response.ok) {
                throw new Error('Не удалось загрузить данные');
            }
            return response.json();
        })
        .then((products) => {
            initMealPlan(container, products);
        })
        .catch(() => {
            container.textContent = 'Не удалось загрузить рацион.';
        });
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

function renderMealPlan(container, products, rangeKey) {
    const profile = typeof getUserProfile === 'function' ? getUserProfile() : {};
    const filteredProducts = buildPreferredProducts(products, profile);

    const caloriesTarget = Number(profile?.tdee_calories);
    const macrosTarget = profile?.macros || (typeof calculateMacros === 'function' ? calculateMacros(caloriesTarget) : null);
    const totalsText = buildTotalsText(caloriesTarget, macrosTarget);

    updateSummary(filteredProducts.length, totalsText);

    container.innerHTML = '';

    const days = rangeKey === 'week' ? 7 : 1;
    for (let dayIndex = 0; dayIndex < days; dayIndex += 1) {
        const dayPlan = buildDayPlan(filteredProducts, dayIndex);
        container.appendChild(renderDayCard(dayPlan, dayIndex, caloriesTarget));
    }
}

function buildPreferredProducts(products, profile) {
    const favorites = new Set(profile?.favorite_product_ids || []);
    const excluded = new Set(profile?.excluded_product_ids || []);
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
