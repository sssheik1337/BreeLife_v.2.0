// Экран "Мои продукты": любимые и исключённые позиции.

const PRODUCTS_ENDPOINT = '/api/products';
const DEFAULT_OPEN_GROUPS = 2;

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
    const groupEntries = Object.entries(groups);

    groupEntries.forEach(([groupName, groupProducts], index) => {
        const groupId = `my-products-group-${index}`;
        const isInitiallyOpen = index < DEFAULT_OPEN_GROUPS;

        const groupSection = document.createElement('section');
        groupSection.className = 'space-y-3 rounded-2xl border border-slate-100 bg-white/70 p-3 shadow-sm';

        const headerButton = document.createElement('button');
        headerButton.type = 'button';
        headerButton.dataset.action = 'toggle-group';
        headerButton.setAttribute('aria-controls', groupId);
        headerButton.className = 'w-full flex items-center justify-between rounded-xl px-2 py-2 transition-colors duration-200 hover:bg-slate-50';

        const chevron = `
            <svg class="h-4 w-4 text-slate-400 transition-transform duration-300 ease-out" data-group-chevron viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.51a.75.75 0 01-1.08 0l-4.25-4.51a.75.75 0 01.02-1.06z" clip-rule="evenodd"/>
            </svg>
        `;

        headerButton.innerHTML = `
            <span class="flex items-center gap-3">
                <span class="text-lg font-semibold text-slate-800">${groupName}</span>
                <span class="text-sm text-slate-400">${groupProducts.length} поз.</span>
            </span>
            ${chevron}
        `;

        const groupBody = document.createElement('div');
        groupBody.id = groupId;
        groupBody.className = 'overflow-hidden transition-all duration-300 ease-out';

        const grid = document.createElement('div');
        grid.className = 'grid grid-cols-1 gap-4 pt-2';

        groupProducts.forEach((product) => {
            grid.appendChild(
                createPreferenceCard(product, favoriteIds, excludedIds, (nextFavorites, nextExcluded) => {
                    updateCounts(products.length, nextFavorites.size, nextExcluded.size);
                    savePreferences(nextFavorites, nextExcluded);
                })
            );
        });

        groupBody.appendChild(grid);
        groupSection.appendChild(headerButton);
        groupSection.appendChild(groupBody);
        container.appendChild(groupSection);

        setGroupExpanded(groupBody, headerButton, isInitiallyOpen);

        headerButton.addEventListener('click', () => {
            const expanded = headerButton.getAttribute('aria-expanded') === 'true';
            setGroupExpanded(groupBody, headerButton, !expanded);
        });
    });
}

function setGroupExpanded(groupBody, headerButton, expanded) {
    const chevron = headerButton.querySelector('[data-group-chevron]');
    headerButton.setAttribute('aria-expanded', expanded ? 'true' : 'false');

    if (expanded) {
        groupBody.style.maxHeight = `${groupBody.scrollHeight}px`;
        groupBody.style.opacity = '1';
        groupBody.style.transform = 'translateY(0px)';
    } else {
        groupBody.style.maxHeight = '0px';
        groupBody.style.opacity = '0';
        groupBody.style.transform = 'translateY(-4px)';
    }

    if (chevron) {
        chevron.classList.toggle('rotate-180', expanded);
    }
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
    actions.className = 'flex flex-col gap-3 mt-4 text-sm text-slate-600';

    const favoriteLabel = document.createElement('label');
    favoriteLabel.className = 'flex items-center gap-2';
    favoriteLabel.innerHTML = `
        <input type="checkbox" class="form-checkbox" ${favoriteActive ? 'checked' : ''} data-preference="favorite">
        <span>❤️ Люблю</span>
    `;

    const excludeLabel = document.createElement('label');
    excludeLabel.className = 'flex items-center gap-2';
    excludeLabel.innerHTML = `
        <input type="checkbox" class="form-checkbox" ${excludedActive ? 'checked' : ''} data-preference="excluded">
        <span>🚫 Не ем / аллергия</span>
    `;

    const favoriteInput = favoriteLabel.querySelector('input');
    const excludeInput = excludeLabel.querySelector('input');

    favoriteInput?.addEventListener('change', () => {
        const nextFavorites = new Set(favoriteIds);
        const nextExcluded = new Set(excludedIds);
        if (favoriteInput.checked) {
            nextFavorites.add(product.id);
            nextExcluded.delete(product.id);
        } else {
            nextFavorites.delete(product.id);
        }
        if (excludeInput) {
            excludeInput.checked = nextExcluded.has(product.id);
        }
        favoriteIds.clear();
        excludedIds.clear();
        nextFavorites.forEach((id) => favoriteIds.add(id));
        nextExcluded.forEach((id) => excludedIds.add(id));
        onChange(nextFavorites, nextExcluded);
    });

    excludeInput?.addEventListener('change', () => {
        const nextFavorites = new Set(favoriteIds);
        const nextExcluded = new Set(excludedIds);
        if (excludeInput.checked) {
            nextExcluded.add(product.id);
            nextFavorites.delete(product.id);
        } else {
            nextExcluded.delete(product.id);
        }
        if (favoriteInput) {
            favoriteInput.checked = nextFavorites.has(product.id);
        }
        favoriteIds.clear();
        excludedIds.clear();
        nextFavorites.forEach((id) => favoriteIds.add(id));
        nextExcluded.forEach((id) => excludedIds.add(id));
        onChange(nextFavorites, nextExcluded);
    });

    actions.appendChild(favoriteLabel);
    actions.appendChild(excludeLabel);

    card.appendChild(header);
    card.appendChild(tags);
    card.appendChild(actions);

    return card;
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
