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

async function sendOnboardingEvent(eventName) {
    const fetcher = window.apiFetch || fetch;
    const payload = {
        event: eventName,
        favorites_count: onboardingState.favoritesSet.size,
        excluded_count: onboardingState.excludedSet.size,
        viewed_count: Math.min(onboardingState.currentIndex + 1, onboardingState.totalCount),
    };

    try {
        await fetcher('/api/preferences/onboarding/event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    } catch (_) {
        // Аналитическое событие не должно ломать пользовательский сценарий.
    }
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

function getPostOnboardingRoute() {
    if (typeof window.resolvePostQuestionnaireRoute === 'function') {
        return window.resolvePostQuestionnaireRoute({ preferences_onboarding_completed: true });
    }
    return '/profile';
}

function hasAnyChoices() {
    return onboardingState.favoritesSet.size > 0 || onboardingState.excludedSet.size > 0;
}

function resolveCompletionType(preferredType = null) {
    if (preferredType === 'completed_without_choices') {
        return 'completed_without_choices';
    }
    if (preferredType === 'completed_with_choices') {
        return 'completed_with_choices';
    }
    return hasAnyChoices() ? 'completed_with_choices' : 'completed_without_choices';
}

function showSuccessState(elements, completionType) {
    const successCard = document.getElementById('preferences-success');
    const continueButton = document.getElementById('preferences-continue');
    const successWithChoices = document.getElementById('preferences-success-with-choices');
    const successWithoutChoices = document.getElementById('preferences-success-without-choices');
    const nextRoute = getPostOnboardingRoute();

    if (continueButton) {
        continueButton.setAttribute('href', nextRoute);
    }

    const isWithChoices = completionType === 'completed_with_choices';
    if (successWithChoices) {
        successWithChoices.classList.toggle('hidden', !isWithChoices);
    }
    if (successWithoutChoices) {
        successWithoutChoices.classList.toggle('hidden', isWithChoices);
    }

    if (elements.card) {
        elements.card.classList.add('hidden');
    }
    if (elements.doneButton) {
        elements.doneButton.classList.add('hidden');
    }
    if (elements.softSkipButton) {
        elements.softSkipButton.classList.add('hidden');
    }

    if (successCard) {
        successCard.classList.remove('hidden');
        successCard.classList.add('transition-all', 'duration-300', 'ease-out');
    }
}

function finishOnboarding(elements, completionType = null, eventName = null) {
    if (onboardingState.isSaving) {
        return;
    }
    const resolvedCompletionType = resolveCompletionType(completionType);
    if (eventName) {
        sendOnboardingEvent(eventName);
    }
    showSuccessState(elements, resolvedCompletionType);
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

        finishOnboarding(elements, resolveCompletionType(), null);
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
        sendOnboardingEvent('entered');
    } catch (error) {
        if (typeof showNotification === 'function') {
            showNotification('Не удалось загрузить карточки продуктов. Попробуйте позже.', 'error');
        }
        onboardingState.items = [];
        onboardingState.currentIndex = 0;
        onboardingState.totalCount = 0;
        renderCurrentCard(elements);
        sendOnboardingEvent('entered');
    }

    elements.likeButton?.addEventListener('click', () => handleLike(elements));
    elements.excludeButton?.addEventListener('click', () => handleExclude(elements));
    elements.skipButton?.addEventListener('click', () => handleSkip(elements));
    elements.doneButton?.addEventListener('click', () => {
        saveOnboardingChoices(elements);
    });
    elements.softSkipButton?.addEventListener('click', () => finishOnboarding(elements, 'completed_without_choices', 'skipped'));
}

document.addEventListener('DOMContentLoaded', initPreferencesOnboarding);
