// Экран "Список покупок": группировка продуктов и отметки "куплено".

const SHOPPING_PRODUCTS_ENDPOINT = '/api/products';
const SHOPPING_DEFAULT_WEIGHT = 100;
let shoppingChecksMemory = {};

const SHOPPING_MEAL_DISTRIBUTION = [
    { key: 'breakfast', title: 'Завтрак', share: 0.25, items: 2 },
    { key: 'lunch', title: 'Обед', share: 0.35, items: 3 },
    { key: 'snack', title: 'Перекус', share: 0.1, items: 2 },
    { key: 'dinner', title: 'Ужин', share: 0.3, items: 3 }
];

document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('shopping-list-container');
    if (!container) {
        return;
    }

    container.textContent = 'Загрузка списка продуктов...';

    fetch(SHOPPING_PRODUCTS_ENDPOINT)
        .then((response) => {
            if (!response.ok) {
                throw new Error('Не удалось загрузить данные');
            }
            return response.json();
        })
        .then((products) => {
            initShoppingList(container, products);
        })
        .catch(() => {
            container.textContent = 'Не удалось загрузить список покупок.';
        });
});

function initShoppingList(container, products) {
    const rangeButtons = Array.from(document.querySelectorAll('[data-shopping-range]'));
    const copyButton = document.getElementById('shopping-copy');
    const clearButton = document.getElementById('shopping-clear');
    let activeRange = 'day';

    const render = () => {
        updateRangeButtons(rangeButtons, activeRange);
        const aggregated = buildShoppingList(products, activeRange);
        renderShoppingList(container, aggregated);
        if (copyButton) {
            copyButton.onclick = () => copyShoppingList(aggregated);
        }
    };

    rangeButtons.forEach((button) => {
        button.addEventListener('click', () => {
            activeRange = button.dataset.shoppingRange || 'day';
            render();
        });
    });

    if (clearButton) {
        clearButton.addEventListener('click', () => {
            clearShoppingChecks();
            render();
        });
    }

    render();
}

function updateRangeButtons(buttons, activeValue) {
    buttons.forEach((button) => {
        const isActive = button.dataset.shoppingRange === activeValue;
        button.classList.toggle('bg-emerald-100', isActive);
        button.classList.toggle('text-emerald-700', isActive);
        button.classList.toggle('bg-slate-100', !isActive);
        button.classList.toggle('text-slate-500', !isActive);
    });
}

function buildShoppingList(products, rangeKey) {
    const profile = typeof getUserProfile === 'function' ? getUserProfile() : {};
    const filteredProducts = buildPreferredProducts(products, profile);
    const days = rangeKey === 'week' ? 7 : 1;
    const totals = new Map();

    for (let dayIndex = 0; dayIndex < days; dayIndex += 1) {
        const plan = buildDayPlan(filteredProducts, dayIndex);
        plan.forEach((meal) => {
            meal.items.forEach((item) => {
                if (!item) {
                    return;
                }
                const key = `${item.group || 'Без группы'}::${item.name}`;
                const current = totals.get(key) || {
                    name: item.name,
                    group: item.group || 'Без группы',
                    weight: 0,
                    count: 0
                };
                current.weight += SHOPPING_DEFAULT_WEIGHT;
                current.count += 1;
                totals.set(key, current);
            });
        });
    }

    const grouped = {};
    totals.forEach((item) => {
        if (!grouped[item.group]) {
            grouped[item.group] = [];
        }
        grouped[item.group].push(item);
    });

    Object.keys(grouped).forEach((groupName) => {
        grouped[groupName].sort((a, b) => a.name.localeCompare(b.name));
    });

    return grouped;
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

function buildDayPlan(products, dayIndex) {
    const sorted = [...products].sort((a, b) => {
        const groupA = a.group || '';
        const groupB = b.group || '';
        if (groupA === groupB) {
            return (a.name || '').localeCompare(b.name || '');
        }
        return groupA.localeCompare(groupB);
    });

    return SHOPPING_MEAL_DISTRIBUTION.map((meal, mealIndex) => {
        const startIndex = (dayIndex * 7 + mealIndex * 3) % Math.max(sorted.length, 1);
        return {
            title: meal.title,
            items: pickItems(sorted, startIndex, meal.items)
        };
    });
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

function renderShoppingList(container, grouped) {
    container.innerHTML = '';
    const groupNames = Object.keys(grouped);
    if (groupNames.length === 0) {
        container.innerHTML = '<p class="text-center text-slate-400">Сначала выберите продукты в рационе.</p>';
        return;
    }

    const checks = loadShoppingChecks();

    groupNames.forEach((groupName) => {
        const section = document.createElement('section');
        section.className = 'bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-4';

        const header = document.createElement('div');
        header.className = 'flex items-center justify-between';
        header.innerHTML = `
            <h2 class="text-base font-semibold text-slate-800">${groupName}</h2>
            <span class="text-xs text-slate-400">${grouped[groupName].length} поз.</span>
        `;

        const list = document.createElement('div');
        list.className = 'space-y-3';

        grouped[groupName].forEach((item) => {
            const key = buildCheckKey(item);
            const checked = Boolean(checks[key]);
            const row = document.createElement('label');
            row.className = 'flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3';
            row.innerHTML = `
                <div class="flex items-center gap-3">
                    <input type="checkbox" class="form-checkbox" ${checked ? 'checked' : ''} data-shopping-check="${key}">
                    <div>
                        <div class="text-sm font-semibold text-slate-800">${item.name}</div>
                        <div class="text-xs text-slate-500">≈ ${item.weight} г • ${item.count} раз</div>
                    </div>
                </div>
            `;
            list.appendChild(row);
        });

        section.appendChild(header);
        section.appendChild(list);
        container.appendChild(section);
    });

    container.querySelectorAll('[data-shopping-check]').forEach((input) => {
        input.addEventListener('change', (event) => {
            const target = event.target;
            if (!target || !target.dataset.shoppingCheck) {
                return;
            }
            const key = target.dataset.shoppingCheck;
            const nextChecks = loadShoppingChecks();
            if (target.checked) {
                nextChecks[key] = true;
            } else {
                delete nextChecks[key];
            }
            saveShoppingChecks(nextChecks);
        });
    });
}

function buildCheckKey(item) {
    return `${item.group}::${item.name}`;
}

function loadShoppingChecks() {
    return shoppingChecksMemory && typeof shoppingChecksMemory === 'object' ? shoppingChecksMemory : {};
}

function saveShoppingChecks(checks) {
    shoppingChecksMemory = checks && typeof checks === 'object' ? checks : {};
}

function clearShoppingChecks() {
    shoppingChecksMemory = {};
}

function copyShoppingList(grouped) {
    const lines = [];
    Object.keys(grouped).forEach((groupName) => {
        lines.push(groupName);
        grouped[groupName].forEach((item) => {
            lines.push(`- ${item.name}: ≈ ${item.weight} г`);
        });
        lines.push('');
    });
    const text = lines.join('\n').trim();

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            showNotification('Список скопирован!', 'success');
        }).catch(() => {
            fallbackCopy(text);
        });
        return;
    }
    fallbackCopy(text);
}

function fallbackCopy(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'absolute';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    try {
        document.execCommand('copy');
        showNotification('Список скопирован!', 'success');
    } catch (error) {
        showNotification('Не удалось скопировать список.', 'error');
    }
    document.body.removeChild(textarea);
}
