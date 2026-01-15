const FOOD_DIARY_STORAGE_KEY = 'food_diary_entries';

function readFoodDiaryEntries() {
    const raw = localStorage.getItem(FOOD_DIARY_STORAGE_KEY);
    if (!raw) {
        return [];
    }
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        return [];
    }
}

function saveFoodDiaryEntries(entries) {
    localStorage.setItem(FOOD_DIARY_STORAGE_KEY, JSON.stringify(entries));
}

function formatMealLabel(meal) {
    const map = {
        breakfast: 'Завтрак',
        lunch: 'Обед',
        dinner: 'Ужин',
        snack: 'Перекус'
    };
    return map[meal] || 'Приём пищи';
}

function buildFoodItemRow(values = {}) {
    const wrapper = document.createElement('div');
    wrapper.className = 'food-item-row grid grid-cols-1 gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3';

    wrapper.innerHTML = `
        <input type="text" class="form-input" placeholder="Название продукта" value="${values.name || ''}" required>
        <div class="grid grid-cols-2 gap-2">
            <input type="number" class="form-input" placeholder="Ккал" min="0" step="1" value="${values.calories ?? ''}" required>
            <input type="number" class="form-input" placeholder="Белки, г" min="0" step="0.1" value="${values.protein ?? ''}" required>
        </div>
        <div class="grid grid-cols-2 gap-2">
            <input type="number" class="form-input" placeholder="Жиры, г" min="0" step="0.1" value="${values.fat ?? ''}" required>
            <input type="number" class="form-input" placeholder="Углеводы, г" min="0" step="0.1" value="${values.carbs ?? ''}" required>
        </div>
        <button type="button" class="text-sm text-rose-500 font-semibold">Удалить продукт</button>
    `;

    const removeButton = wrapper.querySelector('button');
    if (removeButton) {
        removeButton.addEventListener('click', () => {
            wrapper.remove();
        });
    }

    return wrapper;
}

function collectFoodItems(container) {
    const items = [];
    const rows = container.querySelectorAll('.food-item-row');
    rows.forEach((row) => {
        const inputs = row.querySelectorAll('input');
        if (inputs.length < 5) {
            return;
        }
        const [nameInput, caloriesInput, proteinInput, fatInput, carbsInput] = inputs;
        const name = nameInput.value.trim();
        const calories = Number(caloriesInput.value);
        const protein = Number(proteinInput.value);
        const fat = Number(fatInput.value);
        const carbs = Number(carbsInput.value);
        if (!name) {
            return;
        }
        items.push({
            name,
            calories: Number.isFinite(calories) ? calories : 0,
            protein: Number.isFinite(protein) ? protein : 0,
            fat: Number.isFinite(fat) ? fat : 0,
            carbs: Number.isFinite(carbs) ? carbs : 0
        });
    });
    return items;
}

function sumNutrition(items) {
    return items.reduce(
        (acc, item) => {
            acc.calories += item.calories || 0;
            acc.protein += item.protein || 0;
            acc.fat += item.fat || 0;
            acc.carbs += item.carbs || 0;
            return acc;
        },
        { calories: 0, protein: 0, fat: 0, carbs: 0 }
    );
}

function parseDate(value) {
    if (!value) {
        return null;
    }
    const parsed = new Date(`${value}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function daysBetween(dateA, dateB) {
    const ms = dateA.getTime() - dateB.getTime();
    return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function getDeviationReport() {
    const profile = typeof getUserProfile === 'function' ? getUserProfile() : null;
    const tdee = profile?.tdee_calories;
    const entries = readFoodDiaryEntries();
    const thresholds = window.adminConfig?.calorie_threshold || {};
    const overeatThreshold = Number.isFinite(thresholds.overeat) ? thresholds.overeat : 0.1;
    const undereatThreshold = Number.isFinite(thresholds.undereat) ? thresholds.undereat : 0.1;

    if (!entries.length) {
        return { status: 'no_data', message: 'Нет данных за последние дни. Заполните дневник.' };
    }

    const lastEntryDate = parseDate(entries[0].date);
    const today = parseDate(new Date().toISOString().split('T')[0]);
    if (!lastEntryDate || !today) {
        return { status: 'no_data', message: 'Нет данных за последние дни. Заполните дневник.' };
    }

    const gapDays = daysBetween(today, lastEntryDate);
    if (gapDays >= 2) {
        return { status: 'no_data', message: 'Дневник не заполнен более двух дней.' };
    }

    const recentByDate = new Map();
    entries.forEach((entry) => {
        const entryDate = parseDate(entry.date);
        if (!entryDate) {
            return;
        }
        const diff = daysBetween(today, entryDate);
        if (diff >= 0 && diff < 7) {
            const summary = sumNutrition(entry.items || []);
            const current = recentByDate.get(entry.date) || 0;
            recentByDate.set(entry.date, current + summary.calories);
        }
    });

    if (!recentByDate.size) {
        return { status: 'no_data', message: 'Нет данных за последние 7 дней.' };
    }

    const totalCalories = Array.from(recentByDate.values()).reduce((sum, value) => sum + value, 0);
    const avgCalories = totalCalories / recentByDate.size;

    if (typeof tdee !== 'number') {
        return { status: 'ok', message: 'Ориентир по калориям пока не рассчитан.' };
    }

    const deviation = (avgCalories - tdee) / tdee;
    if (deviation > overeatThreshold) {
        return { status: 'overeat', message: 'Похоже на переедание. Попробуйте снизить калории.' };
    }
    if (deviation < -undereatThreshold) {
        return { status: 'undereat', message: 'Похоже на недоедание. Добавьте немного энергии.' };
    }
    return { status: 'ok', message: 'План соблюдается. Продолжайте в том же духе.' };
}

function renderDeviationReport() {
    const indicator = document.getElementById('deviation-indicator');
    const text = document.getElementById('deviation-text');
    if (!indicator || !text) {
        return;
    }
    const report = getDeviationReport();
    const statusStyles = {
        ok: 'bg-emerald-400',
        overeat: 'bg-rose-500',
        undereat: 'bg-yellow-400',
        no_data: 'bg-yellow-400'
    };
    indicator.className = `inline-flex h-3 w-3 rounded-full ${statusStyles[report.status] || 'bg-slate-300'}`;
    text.textContent = report.message;
}

function getDailyNutritionSummary(date) {
    const entries = readFoodDiaryEntries();
    const dayEntries = entries.filter((entry) => entry.date === date);
    const total = dayEntries.reduce(
        (acc, entry) => {
            const summary = sumNutrition(entry.items || []);
            acc.calories += summary.calories;
            acc.protein += summary.protein;
            acc.fat += summary.fat;
            acc.carbs += summary.carbs;
            return acc;
        },
        { calories: 0, protein: 0, fat: 0, carbs: 0 }
    );
    return {
        date,
        total,
        entries: dayEntries
    };
}

function renderDailySummary(date) {
    const container = document.getElementById('daily-summary');
    if (!container) {
        return;
    }
    if (!date) {
        container.innerHTML = '<p class="text-slate-400">Выберите дату, чтобы увидеть сводку.</p>';
        return;
    }
    const summary = getDailyNutritionSummary(date);
    const profile = typeof getUserProfile === 'function' ? getUserProfile() : null;
    const tdee = profile?.tdee_calories;
    const total = summary.total;

    const rows = [
        `Калории: ${Math.round(total.calories)} ккал`,
        `Белки: ${Math.round(total.protein)} г`,
        `Жиры: ${Math.round(total.fat)} г`,
        `Углеводы: ${Math.round(total.carbs)} г`
    ];

    if (typeof tdee === 'number') {
        const diff = Math.round(total.calories - tdee);
        const note = diff === 0
            ? 'Вы ровно в ориентире по калориям.'
            : diff > 0
                ? `Выше ориентира на ${diff} ккал.`
                : `Ниже ориентира на ${Math.abs(diff)} ккал.`;
        rows.push(note);
    } else {
        rows.push('Ориентир по калориям пока не рассчитан.');
    }

    container.innerHTML = rows.map((row) => `<p>${row}</p>`).join('');
}

function renderFoodDiaryList(entries) {
    const list = document.getElementById('food-diary-list');
    if (!list) {
        return;
    }
    list.innerHTML = '';
    if (!entries.length) {
        list.innerHTML = '<p class="text-slate-400">Пока нет записей.</p>';
        return;
    }
    entries.slice(0, 5).forEach((entry) => {
        const item = document.createElement('div');
        item.className = 'bg-slate-50 rounded-xl p-3 border border-slate-100';
        const summary = sumNutrition(entry.items || []);
        item.innerHTML = `
            <div class="font-semibold text-slate-700">${entry.date} • ${formatMealLabel(entry.meal)}</div>
            <div class="text-slate-500">Калории: ${Math.round(summary.calories)} ккал</div>
            <div class="text-slate-500">Белки, жиры, углеводы: ${Math.round(summary.protein)} / ${Math.round(summary.fat)} / ${Math.round(summary.carbs)} г</div>
        `;
        list.appendChild(item);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('food-diary-form');
    const dateInput = document.getElementById('food-diary-date');
    const mealInput = document.getElementById('food-diary-meal');
    const itemsContainer = document.getElementById('food-items');
    const addButton = document.getElementById('add-food-item');

    if (!itemsContainer || !addButton || !form) {
        return;
    }

    itemsContainer.appendChild(buildFoodItemRow());

    addButton.addEventListener('click', () => {
        itemsContainer.appendChild(buildFoodItemRow());
    });

    if (dateInput) {
        if (!dateInput.value) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }
        dateInput.addEventListener('change', () => {
            renderDailySummary(dateInput.value);
        });
    }

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        const date = dateInput?.value || '';
        const meal = mealInput?.value || '';
        const items = collectFoodItems(itemsContainer);
        if (!date || !meal || !items.length) {
            return;
        }
        const entries = readFoodDiaryEntries();
        entries.unshift({ date, meal, items });
        saveFoodDiaryEntries(entries);
        renderFoodDiaryList(entries);
        renderDailySummary(date);
        renderDeviationReport();
        form.reset();
        itemsContainer.innerHTML = '';
        itemsContainer.appendChild(buildFoodItemRow());
    });

    const entries = readFoodDiaryEntries();
    renderFoodDiaryList(entries);
    renderDailySummary(dateInput?.value || '');
    renderDeviationReport();
});
