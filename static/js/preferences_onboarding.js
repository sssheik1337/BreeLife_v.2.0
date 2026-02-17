// Онбординг предпочтений: карточки лайк/не хочу/пропуск.

const ONBOARDING_PRODUCTS_ENDPOINT = '/api/preferences/onboarding-products?limit=30';
const TARGET_FAVORITES = 10;
const TARGET_EXCLUDED = 3;

const onboardingState = {
    items: [],
    currentIndex: 0,
    favoritesSet: new Set(),
    excludedSet: new Set(),
    totalCount: 0,
    isSaving: false,
};

function parseIdSet(value) {
    if (!Array.isArray(value)) {
        return new Set();
    }
    return new Set(value.filter((item) => Number.isInteger(item)));
}

async function hydrateSelectedSetsFromProfile() {
    if (typeof window.syncProfileWithBackend === 'function') {
        try {
            await window.syncProfileWithBackend();
        } catch (_) {
            // Если синхронизация не удалась, используем локально доступный профиль.
        }
    }
    if (typeof getUserProfile !== 'function') {
        onboardingState.favoritesSet = new Set();
        onboardingState.excludedSet = new Set();
        return;
    }
    const profile = getUserProfile();
    onboardingState.favoritesSet = parseIdSet(profile?.favorite_product_ids);
    onboardingState.excludedSet = parseIdSet(profile?.excluded_product_ids);
}

function getOnboardingElements() {
    return {
        card: document.getElementById('preferences-card'),
        progress: document.getElementById('preferences-progress'),
        progressBar: document.getElementById('preferences-progress-bar'),
        name: document.getElementById('preferences-product-name'),
        group: document.getElementById('preferences-product-group'),
        kcal: document.getElementById('preferences-product-kcal'),
        likeButton: document.getElementById('preferences-like'),
        skipButton: document.getElementById('preferences-skip'),
        excludeButton: document.getElementById('preferences-exclude'),
        doneButton: document.getElementById('preferences-done'),
        softSkipButton: document.getElementById('preferences-soft-skip'),
        emptyState: document.getElementById('preferences-empty-state'),
        kpiFavorites: document.getElementById('preferences-kpi-favorites'),
        kpiExcluded: document.getElementById('preferences-kpi-excluded'),
        softHint: document.getElementById('preferences-soft-hint'),
    };
}

function normalizeOnboardingItems(payload) {
    if (!payload || typeof payload !== 'object') {
        return [];
    }
    const items = Array.isArray(payload.items) ? payload.items : [];
    return items
        .filter((item) => item && typeof item === 'object' && Number.isInteger(item.id))
        .map((item) => ({
            id: item.id,
            name: typeof item.name === 'string' ? item.name : 'Без названия',
            group: typeof item.group === 'string' && item.group.trim() ? item.group : 'Без группы',
            kcal: typeof item.kcal === 'number' ? item.kcal : 0,
        }));
}

function updateProgress(elements) {
    const viewed = Math.min(onboardingState.currentIndex + 1, onboardingState.totalCount);
    const total = onboardingState.totalCount;
    const percent = total > 0 ? Math.round((viewed / total) * 100) : 0;

    if (elements.progress) {
        elements.progress.textContent = total > 0 ? `${viewed} из ${total}` : '0 из 0';
    }
    if (elements.progressBar) {
        elements.progressBar.style.width = `${percent}%`;
    }
}



function updateKpiHints(elements) {
    const favoritesCount = onboardingState.favoritesSet.size;
    const excludedCount = onboardingState.excludedSet.size;

    if (elements.kpiFavorites) {
        elements.kpiFavorites.textContent = `Желательно выбрать 10 любимых продуктов (${favoritesCount}/10).`;
    }
    if (elements.kpiExcluded) {
        elements.kpiExcluded.textContent = `Можно отметить 3 нежелательных продукта (${excludedCount}/3).`;
    }
}

function hasSoftKpiUnderfill() {
    return onboardingState.favoritesSet.size < TARGET_FAVORITES || onboardingState.excludedSet.size < TARGET_EXCLUDED;
}

function showSoftFinishHint(elements) {
    if (elements.softHint) {
        elements.softHint.classList.remove('hidden');
    }
    if (typeof showNotification === 'function') {
        showNotification('Можно завершить уже сейчас, но ещё пара отметок сделает рацион точнее.', 'warning');
    }
}

function setCardEnabled(elements, enabled) {
    [elements.likeButton, elements.skipButton, elements.excludeButton].forEach((button) => {
        if (!button) {
            return;
        }
        button.disabled = !enabled;
        button.classList.toggle('opacity-60', !enabled);
    });
}

function renderCurrentCard(elements) {
    updateProgress(elements);
    updateKpiHints(elements);

    if (!elements.card || onboardingState.totalCount === 0) {
        if (elements.emptyState) {
            elements.emptyState.classList.remove('hidden');
        }
        setCardEnabled(elements, false);
        return;
    }

    const item = onboardingState.items[onboardingState.currentIndex];
    if (!item) {
        if (elements.emptyState) {
            elements.emptyState.classList.remove('hidden');
        }
        setCardEnabled(elements, false);
        return;
    }

    if (elements.emptyState) {
        elements.emptyState.classList.add('hidden');
    }
    if (elements.name) {
        elements.name.textContent = item.name;
    }
    if (elements.group) {
        elements.group.textContent = item.group;
    }
    if (elements.kcal) {
        elements.kcal.textContent = `${Math.round(Number(item.kcal) || 0)} ккал / 100 г`;
    }

    setCardEnabled(elements, true);
}

function animateCardSwitch(elements, callback) {
    if (!elements.card) {
        callback();
        return;
    }

    elements.card.classList.add('transition-all', 'duration-300', 'ease-out', 'opacity-0', 'translate-y-2');
    setTimeout(() => {
        callback();
        elements.card.classList.remove('opacity-0', 'translate-y-2');
    }, 180);
}

function nextCard(elements) {
    if (onboardingState.currentIndex >= onboardingState.totalCount - 1) {
        renderCurrentCard(elements);
        setCardEnabled(elements, false);
        return;
    }
    onboardingState.currentIndex += 1;
    renderCurrentCard(elements);
}

function handleLike(elements) {
    const item = onboardingState.items[onboardingState.currentIndex];
    if (!item) {
        return;
    }
    onboardingState.favoritesSet.add(item.id);
    onboardingState.excludedSet.delete(item.id);
    animateCardSwitch(elements, () => nextCard(elements));
}

function handleExclude(elements) {
    const item = onboardingState.items[onboardingState.currentIndex];
    if (!item) {
        return;
    }
    onboardingState.excludedSet.add(item.id);
    onboardingState.favoritesSet.delete(item.id);
    animateCardSwitch(elements, () => nextCard(elements));
}

function handleSkip(elements) {
    animateCardSwitch(elements, () => nextCard(elements));
}

function finishOnboarding() {
    if (onboardingState.isSaving) {
        return;
    }
    window.location.href = '/trial-start';
}

function setSavingState(elements, saving) {
    onboardingState.isSaving = saving;
    [elements.doneButton, elements.softSkipButton, elements.likeButton, elements.skipButton, elements.excludeButton].forEach((button) => {
        if (!button) {
            return;
        }
        button.disabled = saving;
        button.classList.toggle('opacity-60', saving);
    });
}

async function saveOnboardingChoices(elements) {
    if (hasSoftKpiUnderfill()) {
        showSoftFinishHint(elements);
    }
    if (onboardingState.isSaving) {
        return;
    }
    setSavingState(elements, true);

    const fetcher = window.apiFetch || fetch;
    const payload = {
        favorite_product_ids: Array.from(onboardingState.favoritesSet),
        excluded_product_ids: Array.from(onboardingState.excludedSet),
        preferences_onboarding_completed: true,
    };

    try {
        const response = await fetcher('/api/profile/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            throw new Error('PROFILE_SAVE_FAILED');
        }

        if (typeof patchUserProfile === 'function') {
            patchUserProfile(payload);
        }

        finishOnboarding();
    } catch (_) {
        if (typeof showNotification === 'function') {
            showNotification('Не удалось сохранить выбор. Попробуйте ещё раз.', 'error');
        }
        setSavingState(elements, false);
    }
}

async function loadOnboardingProducts() {
    const fetcher = window.apiFetch || fetch;
    const response = await fetcher(ONBOARDING_PRODUCTS_ENDPOINT);
    if (!response.ok) {
        throw new Error('Не удалось загрузить продукты для онбординга.');
    }
    return response.json();
}

async function initPreferencesOnboarding() {
    const elements = getOnboardingElements();
    if (!elements.card) {
        return;
    }

    await hydrateSelectedSetsFromProfile();

    try {
        const payload = await loadOnboardingProducts();
        const items = normalizeOnboardingItems(payload);
        onboardingState.items = items;
        onboardingState.currentIndex = 0;
        onboardingState.totalCount = items.length;

        renderCurrentCard(elements);
    } catch (error) {
        if (typeof showNotification === 'function') {
            showNotification('Не удалось загрузить карточки продуктов. Попробуйте позже.', 'error');
        }
        onboardingState.items = [];
        onboardingState.currentIndex = 0;
        onboardingState.totalCount = 0;
        renderCurrentCard(elements);
    }

    elements.likeButton?.addEventListener('click', () => handleLike(elements));
    elements.excludeButton?.addEventListener('click', () => handleExclude(elements));
    elements.skipButton?.addEventListener('click', () => handleSkip(elements));
    elements.doneButton?.addEventListener('click', () => {
        saveOnboardingChoices(elements);
    });
    elements.softSkipButton?.addEventListener('click', finishOnboarding);
}

document.addEventListener('DOMContentLoaded', initPreferencesOnboarding);
