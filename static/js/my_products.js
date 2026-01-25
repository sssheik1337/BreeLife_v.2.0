// Экран "Мои продукты": любимые и исключённые позиции.

const PRODUCTS_ENDPOINT = '/static/data/products.json';

document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('my-products-container');
    if (!container) {
        return;
    }

    container.textContent = 'Загрузка списка продуктов...';

    fetch(PRODUCTS_ENDPOINT)
        .then((response) => {
            if (!response.ok) {
                throw new Error('Не удалось загрузить данные');
            }
            return response.json();
        })
        .then((products) => {
            renderMyProducts(container, products);
        })
        .catch(() => {
            container.textContent = 'Не удалось загрузить список продуктов.';
        });
});

function renderMyProducts(container, products) {
    const profile = typeof getUserProfile === 'function' ? getUserProfile() : {};
    const favoriteIds = new Set(profile.favorite_product_ids || []);
    const excludedIds = new Set(profile.excluded_product_ids || []);

    container.innerHTML = '';
    updateCounts(products.length, favoriteIds.size, excludedIds.size);

    const groups = groupBy(products, 'group');
    Object.keys(groups).forEach((groupName) => {
        const groupSection = document.createElement('section');
        groupSection.className = 'space-y-4';

        const header = document.createElement('div');
        header.className = 'flex items-center justify-between';
        header.innerHTML = `
            <h2 class="text-lg font-semibold text-slate-800">${groupName}</h2>
            <span class="text-sm text-slate-400">${groups[groupName].length} поз.</span>
        `;

        const grid = document.createElement('div');
        grid.className = 'grid grid-cols-1 gap-4';

        groups[groupName].forEach((product) => {
            grid.appendChild(
                createPreferenceCard(product, favoriteIds, excludedIds, (nextFavorites, nextExcluded) => {
                    updateCounts(products.length, nextFavorites.size, nextExcluded.size);
                    savePreferences(nextFavorites, nextExcluded);
                })
            );
        });

        groupSection.appendChild(header);
        groupSection.appendChild(grid);
        container.appendChild(groupSection);
    });
}

function updateCounts(total, favorites, excluded) {
    const favoritesCount = document.getElementById('favorites-count');
    const excludedCount = document.getElementById('excluded-count');
    const totalCount = document.getElementById('total-count');
    if (favoritesCount) {
        favoritesCount.textContent = favorites.toString();
    }
    if (excludedCount) {
        excludedCount.textContent = excluded.toString();
    }
    if (totalCount) {
        totalCount.textContent = total.toString();
    }
}

function savePreferences(favorites, excluded) {
    if (typeof patchUserProfile !== 'function') {
        return;
    }
    patchUserProfile({
        favorite_product_ids: Array.from(favorites),
        excluded_product_ids: Array.from(excluded)
    });
}

function createPreferenceCard(product, favoriteIds, excludedIds, onChange) {
    const card = document.createElement('div');
    card.className = 'bg-white rounded-2xl p-5 border border-slate-100 shadow-sm';

    const indicatorClass = getHealthIndicatorClass(product.health_level);
    const hasFiber = Array.isArray(product.tags) && product.tags.includes('клетчатка');

    const favoriteActive = favoriteIds.has(product.id);
    const excludedActive = excludedIds.has(product.id);

    const header = document.createElement('div');
    header.className = 'flex items-start justify-between gap-3';
    header.innerHTML = `
        <div>
            <div class="text-base font-semibold text-slate-800">${product.name}</div>
            <div class="text-sm text-slate-500">${product.group}</div>
        </div>
        <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${indicatorClass}"></span>
    `;

    const tags = document.createElement('div');
    tags.className = 'flex flex-wrap gap-2 mt-4';
    tags.innerHTML = `
        ${hasFiber ? '<span class="px-2 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-600">клетчатка</span>' : ''}
        ${renderTags(product.tags)}
    `;

    const actions = document.createElement('div');
    actions.className = 'flex items-center gap-2 mt-4';

    const favoriteButton = document.createElement('button');
    favoriteButton.type = 'button';
    favoriteButton.className = buildToggleClass(favoriteActive, 'emerald');
    favoriteButton.textContent = favoriteActive ? 'Люблю' : 'Люблю';

    const excludeButton = document.createElement('button');
    excludeButton.type = 'button';
    excludeButton.className = buildToggleClass(excludedActive, 'rose');
    excludeButton.textContent = excludedActive ? 'Исключить' : 'Исключить';

    favoriteButton.addEventListener('click', () => {
        const nextFavorites = new Set(favoriteIds);
        const nextExcluded = new Set(excludedIds);
        if (nextFavorites.has(product.id)) {
            nextFavorites.delete(product.id);
        } else {
            nextFavorites.add(product.id);
            nextExcluded.delete(product.id);
        }
        updateToggleState(favoriteButton, nextFavorites.has(product.id), 'emerald');
        updateToggleState(excludeButton, nextExcluded.has(product.id), 'rose');
        favoriteIds.clear();
        excludedIds.clear();
        nextFavorites.forEach((id) => favoriteIds.add(id));
        nextExcluded.forEach((id) => excludedIds.add(id));
        onChange(nextFavorites, nextExcluded);
    });

    excludeButton.addEventListener('click', () => {
        const nextFavorites = new Set(favoriteIds);
        const nextExcluded = new Set(excludedIds);
        if (nextExcluded.has(product.id)) {
            nextExcluded.delete(product.id);
        } else {
            nextExcluded.add(product.id);
            nextFavorites.delete(product.id);
        }
        updateToggleState(excludeButton, nextExcluded.has(product.id), 'rose');
        updateToggleState(favoriteButton, nextFavorites.has(product.id), 'emerald');
        favoriteIds.clear();
        excludedIds.clear();
        nextFavorites.forEach((id) => favoriteIds.add(id));
        nextExcluded.forEach((id) => excludedIds.add(id));
        onChange(nextFavorites, nextExcluded);
    });

    actions.appendChild(favoriteButton);
    actions.appendChild(excludeButton);

    card.appendChild(header);
    card.appendChild(tags);
    card.appendChild(actions);

    return card;
}

function buildToggleClass(isActive, tone) {
    if (tone === 'emerald') {
        return isActive
            ? 'px-3 py-2 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700'
            : 'px-3 py-2 rounded-full text-xs font-semibold bg-slate-100 text-slate-500';
    }
    return isActive
        ? 'px-3 py-2 rounded-full text-xs font-semibold bg-rose-100 text-rose-700'
        : 'px-3 py-2 rounded-full text-xs font-semibold bg-slate-100 text-slate-500';
}

function updateToggleState(button, isActive, tone) {
    button.className = buildToggleClass(isActive, tone);
}

function groupBy(items, key) {
    return items.reduce((result, item) => {
        const group = item[key] || 'Без группы';
        if (!result[group]) {
            result[group] = [];
        }
        result[group].push(item);
        return result;
    }, {});
}

function getHealthIndicatorClass(level) {
    switch (level) {
        case 'good':
            return 'bg-emerald-100 text-emerald-700';
        case 'medium':
            return 'bg-amber-100 text-amber-700';
        case 'bad':
            return 'bg-rose-100 text-rose-700';
        default:
            return 'bg-slate-100 text-slate-600';
    }
}

function renderTags(tags) {
    if (!Array.isArray(tags)) {
        return '';
    }

    return tags
        .filter((tag) => tag !== 'клетчатка')
        .map((tag) => `<span class="px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">${tag}</span>`)
        .join('');
}
