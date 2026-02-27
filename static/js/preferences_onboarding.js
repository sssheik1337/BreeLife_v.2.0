// Онбординг предпочтений: карточки лайк/не хочу/пропуск.

const ONBOARDING_PRODUCTS_ENDPOINT = '/api/preferences/onboarding-products?limit=30';
const TARGET_FAVORITES = 10;

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
        selectionHint: document.getElementById('preferences-selection-hint'),
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
        return { items: [], meta: null };
    }

    const items = (Array.isArray(payload.items) ? payload.items : [])
        .filter((item) => item && typeof item === 'object' && Number.isInteger(item.id))
        .map((item) => ({
            id: item.id,
            name: typeof item.name === 'string' ? item.name : 'Без названия',
            group: typeof item.group === 'string' && item.group.trim() ? item.group : 'Без группы',
            kcal: typeof item.kcal === 'number' ? item.kcal : 0,
        }));

    const rawMeta = payload.meta && typeof payload.meta === 'object' ? payload.meta : null;
    const meta = rawMeta
        ? {
            groupsTotal: Number.isInteger(rawMeta.groups_total) ? rawMeta.groups_total : null,
            groupSampleSize: Number.isInteger(rawMeta.group_sample_size) ? rawMeta.group_sample_size : null,
            selectionStrategy: typeof rawMeta.selection_strategy === 'string' ? rawMeta.selection_strategy : null,
        }
        : null;

    return { items, meta };
}

function updateSelectionHint(elements, meta) {
    if (!elements.selectionHint) {
        return;
    }

    if (!meta || !meta.groupsTotal || !meta.groupSampleSize) {
        elements.selectionHint.textContent = 'Показываем продукты из разных групп, чтобы быстее настроить рацион.';
        return;
    }

    elements.selectionHint.textContent = `Показываем продукты из разных групп: ${meta.groupsTotal} групп, до ${meta.groupSampleSize} карточек на группу.`;
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
        elements.kpiExcluded.textContent = `Нежелательные продукты: ${excludedCount} (без ограничений).`;
    }

    updateSoftHint(elements);
}

function updateSoftHint(elements) {
    if (!elements.softHint) {
        return;
    }

    const remainingFavorites = Math.max(0, TARGET_FAVORITES - onboardingState.favoritesSet.size);

    if (remainingFavorites === 0) {
        elements.softHint.classList.add('hidden');
        return;
    }

    elements.softHint.textContent = `Можно завершить уже сейчас — для большей точности можно отметить ещё любимых продуктов: ${remainingFavorites}.`;
    elements.softHint.classList.remove('hidden');
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

function buildSpaFallbackTarget(path) {
    const spaBase = typeof window.__SPA_BASE__ === 'string' ? window.__SPA_BASE__ : '';
    if (!spaBase || typeof path !== 'string') {
        return path;
    }
    if (path === '/') {
        return `${spaBase}/`;
    }
    if (path.startsWith(`${spaBase}/`) || path === spaBase) {
        return path;
    }
    if (path.startsWith('/')) {
        return `${spaBase}${path}`;
    }
    return `${spaBase}/${path}`;
}

function attachSpaNavigationToContinue(button) {
    if (!button || button.dataset.spaBound === 'true') {
        return;
    }
    button.dataset.spaBound = 'true';
    button.addEventListener('click', (event) => {
        const target = button.getAttribute('href');
        if (!target) {
            return;
        }
        if (typeof window.spaNavigate === 'function') {
            event.preventDefault();
            window.spaNavigate(target);
            return;
        }
        const fallbackTarget = buildSpaFallbackTarget(target);
        if (fallbackTarget && fallbackTarget !== target) {
            event.preventDefault();
            window.location.href = fallbackTarget;
        }
    });
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
        attachSpaNavigationToContinue(continueButton);
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
    if (onboardingState.isSaving) {
        return;
    }
    setSavingState(elements, true);

    const payload = {
        favorite_product_ids: Array.from(onboardingState.favoritesSet),
        excluded_product_ids: Array.from(onboardingState.excludedSet),
        preferences_onboarding_completed: true,
    };

    try {
        if (typeof patchUserProfileWithBackend === 'function') {
            const savedProfile = await patchUserProfileWithBackend(payload);
            if (!savedProfile) {
                throw new Error('PROFILE_SAVE_FAILED');
            }
        } else if (typeof patchUserProfile === 'function') {
            const fallbackProfile = patchUserProfile(payload);
            if (!fallbackProfile) {
                throw new Error('PROFILE_SAVE_FALLBACK_FAILED');
            }
        } else {
            throw new Error('PATCH_PROFILE_UNAVAILABLE');
        }

        // После успешного ответа снимаем блокировку кнопок и показываем финальный экран.
        const completionType = resolveCompletionType();
        const completionEvent = completionType === 'completed_with_choices'
            ? 'completed_with_choices'
            : 'completed_without_choices';
        sendOnboardingEvent(completionEvent);
        setSavingState(elements, false);
        finishOnboarding(elements, completionType, null);
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
        const normalizedPayload = normalizeOnboardingItems(payload);
        onboardingState.items = normalizedPayload.items;
        onboardingState.currentIndex = 0;
        onboardingState.totalCount = normalizedPayload.items.length;

        updateSelectionHint(elements, normalizedPayload.meta);
        renderCurrentCard(elements);
        sendOnboardingEvent('entered');
    } catch (error) {
        if (typeof showNotification === 'function') {
            showNotification('Не удалось загрузить карточки продуктов. Попробуйте позже.', 'error');
        }
        onboardingState.items = [];
        onboardingState.currentIndex = 0;
        onboardingState.totalCount = 0;
        updateSelectionHint(elements, null);
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
