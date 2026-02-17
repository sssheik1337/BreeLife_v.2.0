// Экран "Мои продукты": любимые и исключённые позиции.

const PRODUCTS_ENDPOINT = '/api/products';
const DEFAULT_OPEN_GROUPS = 2;
const GROUP_PAGE_SIZE = 12;
const SEARCH_DEBOUNCE_MS = 250;

// Состояние интерфейса хранится только в памяти текущей вкладки.
const pageState = {
    expandedGroups: new Set(),
    visibleCountByGroup: {},
    searchQuery: ''
};

document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('my-products-container');
    const searchInput = document.getElementById('my-products-search-input');
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
            const allProducts = Array.isArray(products) ? products : [];
            pageState.searchQuery = getInitialSearchQuery();
            const render = () => {
                const filteredProducts = filterProducts(allProducts, pageState.searchQuery);
                renderMyProducts(container, filteredProducts, { hasActiveSearch: pageState.searchQuery.length > 0 });
            };

            hydrateExpandedGroupsFromUrl(allProducts);
            applySearchInputValue(searchInput, pageState.searchQuery);
            bindSearchInput(searchInput, render);
            render();
        })
        .catch(() => {
            container.textContent = 'Не удалось загрузить список продуктов.';
        });
});

function bindSearchInput(input, onSearch) {
    if (!input) {
        return;
    }
    const debouncedSearch = debounce((value) => {
        onSearch(value);
    }, SEARCH_DEBOUNCE_MS);

    input.addEventListener('input', (event) => {
        const query = normalizeSearchValue(event.target?.value);
        pageState.searchQuery = query;
        syncStateToUrl();
        debouncedSearch(query);
    });
}

function getInitialSearchQuery() {
    const params = new URLSearchParams(window.location.search);
    return normalizeSearchValue(params.get('q') || '');
}

function hydrateExpandedGroupsFromUrl(products) {
    const params = new URLSearchParams(window.location.search);
    const rawGroups = params.get('groups') || '';
    if (!rawGroups) {
        return;
    }

    const groups = new Set(Object.keys(groupBy(products, 'group')));
    rawGroups
        .split(',')
        .map((value) => decodeURIComponent(value).trim())
        .filter((value) => value && groups.has(value))
        .forEach((value) => pageState.expandedGroups.add(value));
}

function applySearchInputValue(input, value) {
    if (!input) {
        return;
    }
    input.value = value;
}

function syncStateToUrl() {
    const params = new URLSearchParams(window.location.search);

    if (pageState.searchQuery) {
        params.set('q', pageState.searchQuery);
    } else {
        params.delete('q');
    }

    if (pageState.expandedGroups.size > 0) {
        params.set('groups', Array.from(pageState.expandedGroups).map(encodeURIComponent).join(','));
    } else {
        params.delete('groups');
    }

    const query = params.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    window.history.replaceState(null, '', nextUrl);
}

function normalizeSearchValue(value) {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function filterProducts(products, query) {
    if (!query) {
        return products;
    }

    return products.filter((product) => {
        const name = String(product?.name || '').toLowerCase();
        const group = String(product?.group || '').toLowerCase();
        const brand = String(product?.brand || '').toLowerCase();
        return name.includes(query) || group.includes(query) || brand.includes(query);
    });
}

function debounce(callback, waitMs) {
    let timeoutId = null;
    return (...args) => {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => {
            callback(...args);
        }, waitMs);
    };
}

function renderMyProducts(container, products, options = {}) {
    const profile = typeof getUserProfile === 'function' ? getUserProfile() : {};
    const favoriteIds = new Set(profile.favorite_product_ids || []);
    const excludedIds = new Set(profile.excluded_product_ids || []);
    const hasActiveSearch = options.hasActiveSearch === true;

    container.innerHTML = '';
    updateCounts(products.length, favoriteIds.size, excludedIds.size);

    const groups = groupBy(products, 'group');
    const groupEntries = Object.entries(groups);

    if (groupEntries.length === 0) {
        renderEmptyState(container, hasActiveSearch);
        return;
    }

    groupEntries.forEach(([groupName, groupProducts], index) => {
        const groupId = `my-products-group-${index}`;
        const defaultVisibleCount = Math.min(GROUP_PAGE_SIZE, groupProducts.length);
        const storedVisibleCount = pageState.visibleCountByGroup[groupName];
        const visibleCount = Number.isInteger(storedVisibleCount)
            ? Math.max(defaultVisibleCount, Math.min(storedVisibleCount, groupProducts.length))
            : defaultVisibleCount;
        const isInitiallyOpen = hasActiveSearch
            ? true
            : pageState.expandedGroups.has(groupName) || index < DEFAULT_OPEN_GROUPS;
        const groupState = {
            visibleCount
        };
        pageState.visibleCountByGroup[groupName] = groupState.visibleCount;

        const groupSection = document.createElement('section');
        groupSection.className = 'space-y-3 rounded-2xl border border-slate-100 bg-white/70 p-3 shadow-sm';

        const headerButton = document.createElement('button');
        headerButton.type = 'button';
        headerButton.dataset.action = 'toggle-group';
        headerButton.setAttribute('aria-controls', groupId);
        headerButton.className = 'sticky top-2 z-10 w-full flex items-center justify-between rounded-xl px-2 py-2 border border-slate-100 bg-white/90 backdrop-blur-sm shadow-sm transition-all duration-300 ease-out hover:bg-white active:scale-[0.99]';

        const chevron = `
            <svg class="h-4 w-4 text-slate-400 transition-transform duration-300 ease-out" data-group-chevron viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.51a.75.75 0 01-1.08 0l-4.25-4.51a.75.75 0 01.02-1.06z" clip-rule="evenodd"/>
            </svg>
        `;

        headerButton.innerHTML = `
            <span class="flex items-center gap-3">
                <span class="text-lg font-semibold text-slate-800">${groupName}</span>
                <span class="text-sm text-slate-400">${groupProducts.length} поз.</span>
                <span class="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500" data-group-progress></span>
            </span>
            ${chevron}
        `;

        const groupBody = document.createElement('div');
        groupBody.id = groupId;
        groupBody.className = 'overflow-hidden transition-all duration-300 ease-out';

        const grid = document.createElement('div');
        grid.className = 'grid grid-cols-1 gap-4 pt-2';

        const showMoreButton = document.createElement('button');
        showMoreButton.type = 'button';
        showMoreButton.className = 'btn-secondary w-full text-sm transition-all duration-300 ease-out';

        renderGroupSlice(grid, groupProducts, groupState.visibleCount, favoriteIds, excludedIds, products, (nextFavorites, nextExcluded) => {
            updateCounts(products.length, nextFavorites.size, nextExcluded.size);
            savePreferences(nextFavorites, nextExcluded);
        });
        updateShowMoreButton(showMoreButton, groupProducts.length, groupState.visibleCount);
        updateGroupProgressBadge(headerButton, groupProducts.length, groupState.visibleCount);

        showMoreButton.addEventListener('click', () => {
            const previousCount = groupState.visibleCount;
            groupState.visibleCount = Math.min(groupState.visibleCount + GROUP_PAGE_SIZE, groupProducts.length);
            pageState.visibleCountByGroup[groupName] = groupState.visibleCount;

            for (let i = previousCount; i < groupState.visibleCount; i += 1) {
                appendAnimatedPreferenceCard(
                    grid,
                    groupProducts[i],
                    favoriteIds,
                    excludedIds,
                    products,
                    (nextFavorites, nextExcluded) => {
                        updateCounts(products.length, nextFavorites.size, nextExcluded.size);
                        savePreferences(nextFavorites, nextExcluded);
                    }
                );
            }

            updateShowMoreButton(showMoreButton, groupProducts.length, groupState.visibleCount);
            updateGroupProgressBadge(headerButton, groupProducts.length, groupState.visibleCount);

            if (headerButton.getAttribute('aria-expanded') === 'true') {
                requestAnimationFrame(() => {
                    groupBody.style.maxHeight = `${groupBody.scrollHeight}px`;
                });
            }
        });

        groupBody.appendChild(grid);
        groupBody.appendChild(showMoreButton);
        groupSection.appendChild(headerButton);
        groupSection.appendChild(groupBody);
        container.appendChild(groupSection);

        setGroupExpanded(groupBody, headerButton, isInitiallyOpen);

        headerButton.addEventListener('click', () => {
            const expanded = headerButton.getAttribute('aria-expanded') === 'true';
            const nextExpanded = !expanded;
            setGroupExpanded(groupBody, headerButton, nextExpanded);
            if (nextExpanded) {
                pageState.expandedGroups.add(groupName);
            } else {
                pageState.expandedGroups.delete(groupName);
            }
            syncStateToUrl();
        });
    });
}

function renderEmptyState(container, hasActiveSearch) {
    const title = hasActiveSearch ? 'Ничего не найдено' : 'Пока нет продуктов';
    const description = hasActiveSearch
        ? 'Попробуйте изменить запрос по названию, группе или бренду.'
        : 'Список продуктов пока пуст. Вернитесь позже.';

    container.innerHTML = `
        <div class="rounded-2xl border border-slate-100 bg-white p-6 text-center shadow-sm">
            <p class="text-base font-semibold text-slate-700">${title}</p>
            <p class="mt-2 text-sm text-slate-500">${description}</p>
        </div>
    `;
}

function renderGroupSlice(grid, groupProducts, visibleCount, favoriteIds, excludedIds, allProducts, onChange) {
    grid.innerHTML = '';
    groupProducts.slice(0, visibleCount).forEach((product) => {
        grid.appendChild(createPreferenceCard(product, favoriteIds, excludedIds, (nextFavorites, nextExcluded) => {
            onChange(nextFavorites, nextExcluded, allProducts.length);
        }));
    });
}

function appendAnimatedPreferenceCard(grid, product, favoriteIds, excludedIds, allProducts, onChange) {
    const card = createPreferenceCard(product, favoriteIds, excludedIds, (nextFavorites, nextExcluded) => {
        onChange(nextFavorites, nextExcluded, allProducts.length);
    });
    card.classList.add('opacity-0', 'translate-y-2', 'transition-all', 'duration-300', 'ease-out');
    grid.appendChild(card);

    requestAnimationFrame(() => {
        card.classList.remove('opacity-0', 'translate-y-2');
    });
}

function updateGroupProgressBadge(headerButton, totalCount, visibleCount) {
    const badge = headerButton.querySelector('[data-group-progress]');
    if (!badge) {
        return;
    }
    badge.textContent = `Показано ${visibleCount} из ${totalCount}`;
}

function updateShowMoreButton(button, totalCount, visibleCount) {
    const remaining = totalCount - visibleCount;
    if (remaining <= 0) {
        button.classList.add('hidden');
        return;
    }

    button.classList.remove('hidden');
    button.textContent = `Показать ещё (${remaining})`;
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
