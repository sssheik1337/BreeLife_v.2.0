const DIARY_STORAGE_KEY = window.DIARY_STORAGE_KEY || 'bree_diary_entries';
const MODE_STORAGE_KEY = 'bree_diary_mode';

let diaryInitialized = false;
let diaryGlobalHandlersBound = false;

const MODE_PRODUCTS = 'products';
const MODE_SUMMARY = 'summary';
const MIN_AI_DAYS = 5;
const MAX_AI_DAYS = 7;

const mealLabels = {
    breakfast: 'Завтрак',
    lunch: 'Обед',
    dinner: 'Ужин',
    snack: 'Перекус'
};

function readDiaryEntries() {
    if (typeof window.getDiaryEntries === 'function') {
        return window.getDiaryEntries();
    }
    const raw = localStorage.getItem(DIARY_STORAGE_KEY);
    if (!raw) {
        return [];
    }
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.map(normalizeEntry).filter(Boolean) : [];
    } catch (error) {
        return [];
    }
}

function saveDiaryEntries(entries) {
    localStorage.setItem(DIARY_STORAGE_KEY, JSON.stringify(entries));
}

function normalizeEntry(entry) {
    if (!entry || !entry.date) {
        return null;
    }
    const mode = entry.mode === MODE_PRODUCTS || entry.mode === MODE_SUMMARY
        ? entry.mode
        : Array.isArray(entry.items)
            ? MODE_PRODUCTS
            : MODE_SUMMARY;
    const dateKey = typeof window.normalizeLocalDate === 'function'
        ? window.normalizeLocalDate(entry.date)
        : entry.date;
    if (!dateKey) {
        return null;
    }
    const items = Array.isArray(entry.items) ? entry.items : [];
    const totals = mode === MODE_PRODUCTS
        ? (entry.totals
            ? {
                calories: Number(entry.totals.calories) || 0,
                protein_g: Number(entry.totals.protein_g) || 0,
                fat_g: Number(entry.totals.fat_g) || 0,
                carbs_g: Number(entry.totals.carbs_g) || 0
            }
            : calculateTotals(items))
        : {
            calories: Number(entry.calories ?? 0) || 0,
            protein_g: Number(entry.protein_g ?? entry.protein ?? 0) || 0,
            fat_g: Number(entry.fat_g ?? entry.fat ?? 0) || 0,
            carbs_g: Number(entry.carbs_g ?? entry.carbs ?? 0) || 0
        };
    if (mode === MODE_PRODUCTS) {
        return {
            date: dateKey,
            mode,
            meal: entry.meal || null,
            items,
            totals
        };
    }
    return {
        date: dateKey,
        mode,
        calories: totals.calories,
        protein_g: totals.protein_g,
        fat_g: totals.fat_g,
        carbs_g: totals.carbs_g
    };
}

function sortEntries(entries) {
    return [...entries].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

function calculateTotals(items) {
    return items.reduce(
        (acc, item) => {
            acc.calories += Number(item?.calories) || 0;
            acc.protein_g += Number(item?.protein) || Number(item?.protein_g) || 0;
            acc.fat_g += Number(item?.fat) || Number(item?.fat_g) || 0;
            acc.carbs_g += Number(item?.carbs) || Number(item?.carbs_g) || 0;
            return acc;
        },
        {
            calories: 0,
            protein_g: 0,
            fat_g: 0,
            carbs_g: 0
        }
    );
}

function renderDiaryList(entries) {
    const list = document.getElementById('diary-list');
    if (!list) {
        return;
    }
    list.innerHTML = '';
    if (!entries.length) {
        list.innerHTML = '<p class="text-slate-400">Пока нет записей.</p>';
        return;
    }
    entries.forEach((entry) => {
        const item = document.createElement('div');
        item.className = 'bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-1';
        const modeLabel = entry.mode === MODE_PRODUCTS ? 'По продуктам' : 'Итоги дня';
        const mealLabel = entry.mode === MODE_PRODUCTS ? (mealLabels[entry.meal] || 'Приём пищи') : '';
        const totals = entry.mode === MODE_PRODUCTS
            ? entry.totals || calculateTotals(entry.items || [])
            : {
                calories: Number(entry.calories) || 0,
                protein_g: Number(entry.protein_g) || 0,
                fat_g: Number(entry.fat_g) || 0,
                carbs_g: Number(entry.carbs_g) || 0
            };
        item.innerHTML = `
            <div class="flex items-center justify-between">
                <span class="font-semibold text-slate-700">${entry.date}</span>
                <span class="text-xs text-slate-500">${modeLabel}</span>
            </div>
            ${mealLabel ? `<div class="text-xs text-slate-500">${mealLabel}</div>` : ''}
            <div class="text-slate-500">Калории: ${Math.round(totals.calories)} ккал</div>
            <div class="text-slate-500">Белки, жиры, углеводы: ${Math.round(totals.protein_g)} / ${Math.round(totals.fat_g)} / ${Math.round(totals.carbs_g)} г</div>
        `;
        list.appendChild(item);
    });
}

function setDiaryLoadingState(isLoading) {
    const list = document.getElementById('diary-list');
    const aiSection = document.getElementById('diary-ai-section');
    if (list) {
        list.classList.toggle('is-loading', isLoading);
        if (isLoading) {
            list.innerHTML = `
                <div class="skeleton-line"></div>
                <div class="skeleton-line mt-3"></div>
                <div class="skeleton-line mt-3"></div>
            `;
        }
    }
    if (aiSection) {
        aiSection.classList.toggle('is-loading', isLoading);
    }
}

function setAiComment(insights, advice, minDays, currentDays) {
    const container = document.getElementById('diary-ai-comment');
    if (!container) {
        return;
    }
    container.innerHTML = '';
    if ((!insights || !insights.length) && !advice) {
        if (Number.isFinite(minDays) && Number.isFinite(currentDays)) {
            container.innerHTML = `<p class="text-slate-400">Нужно минимум ${minDays} дней. Сейчас: ${currentDays}.</p>`;
        } else {
            container.innerHTML = '<p class="text-slate-400">Добавьте несколько дней, чтобы получить комментарий.</p>';
        }
        return;
    }
    if (Array.isArray(insights)) {
        insights.forEach((text) => {
            const p = document.createElement('p');
            p.textContent = text;
            container.appendChild(p);
        });
    }
    if (advice) {
        const p = document.createElement('p');
        p.className = 'font-semibold text-emerald-700';
        p.textContent = advice;
        container.appendChild(p);
    }
}

function renderDeviationRisk(risk, comment) {
    const indicator = document.getElementById('diary-risk-indicator');
    const label = document.getElementById('diary-risk-label');
    const text = document.getElementById('diary-risk-comment');
    if (!indicator || !label || !text) {
        return;
    }
    const riskMap = {
        low: { label: 'Риск низкий', color: 'bg-emerald-400' },
        medium: { label: 'Риск средний', color: 'bg-yellow-400' },
        high: { label: 'Риск высокий', color: 'bg-rose-500' }
    };
    const resolved = riskMap[risk] || riskMap.low;
    indicator.className = `inline-flex h-3 w-3 rounded-full ${resolved.color}`;
    label.textContent = resolved.label;
    text.textContent = comment || 'Добавьте данные, чтобы увидеть оценку риска.';
}

function updateProfileDeviation(risk, comment) {
    if (typeof patchUserProfile !== 'function') {
        return;
    }
    patchUserProfile({
        deviation_risk: risk || null,
        deviation_comment: comment || null
    });
}

async function toggleDiaryPaywall(isExpired, profile, entriesCount) {
    const paywall = document.getElementById('diary-paywall');
    const paywallText = document.getElementById('diary-paywall-text');
    const paywallButton = document.getElementById('diary-paywall-button');
    const paymentMotivation = document.getElementById('diary-payment-motivation');
    const riskSection = document.getElementById('diary-risk-section');
    const aiSection = document.getElementById('diary-ai-section');

    if (!paywall || !paywallText || !riskSection || !aiSection) {
        return;
    }

    paywall.classList.toggle('hidden', !isExpired);
    riskSection.classList.toggle('hidden', isExpired);
    aiSection.classList.toggle('hidden', isExpired);

    if (isExpired && typeof getPaywallMotivation === 'function') {
        paywallText.textContent = getPaywallMotivation(profile, entriesCount);
    }

    if (isExpired && paymentMotivation && typeof getPaymentMotivation === 'function') {
        const deviations = typeof getFoodDiaryDeviationStatus === 'function'
            ? getFoodDiaryDeviationStatus(profile)
            : null;
        paymentMotivation.textContent = await getPaymentMotivation(profile, deviations);
    }

    if (paywallButton && !paywallButton.dataset.bound) {
        paywallButton.dataset.bound = 'true';
        paywallButton.addEventListener('click', () => {
            showNotification('Оплата скоро будет доступна. Мы сообщим, когда всё готово.', 'success');
        });
    }
}

async function syncEntryWithBackend(entry) {
    const profile = typeof getUserProfile === 'function' ? getUserProfile() : null;
    if (!profile?.telegram_user_id) {
        return;
    }
    const totals = entry.mode === MODE_PRODUCTS && entry.totals
        ? entry.totals
        : {
            calories: Number(entry.calories) || 0,
            protein_g: Number(entry.protein_g) || 0,
            fat_g: Number(entry.fat_g) || 0,
            carbs_g: Number(entry.carbs_g) || 0
        };
    await fetch('/api/food-diary/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            telegram_user_id: profile.telegram_user_id,
            date: entry.date,
            calories: totals.calories,
            protein_g: totals.protein_g,
            fat_g: totals.fat_g,
            carbs_g: totals.carbs_g
        })
    });
}

async function loadEntriesFromBackend() {
    const profile = typeof getUserProfile === 'function' ? getUserProfile() : null;
    if (!profile?.telegram_user_id) {
        return [];
    }
    const response = await fetch(`/api/food-diary/list?telegram_user_id=${profile.telegram_user_id}`);
    if (!response.ok) {
        return [];
    }
    const data = await response.json();
    const entries = Array.isArray(data) ? data : [];
    return entries.map((entry) => normalizeEntry({
        date: entry.date,
        mode: MODE_SUMMARY,
        calories: entry.calories,
        protein_g: entry.protein_g,
        fat_g: entry.fat_g,
        carbs_g: entry.carbs_g
    })).filter(Boolean);
}

async function requestAiAnalysis(entries) {
    const profile = typeof getUserProfile === 'function' ? getUserProfile() : null;
    if (!profile) {
        return { insights: [], advice: '' };
    }
    const normalizedEntries = entries.map((entry) => {
        if (!entry) {
            return null;
        }
        if (entry.mode === MODE_PRODUCTS) {
            const totals = entry.totals || calculateTotals(entry.items || []);
            return {
                date: entry.date,
                mode: entry.mode,
                calories: totals.calories,
                protein_g: totals.protein_g,
                fat_g: totals.fat_g,
                carbs_g: totals.carbs_g
            };
        }
        return {
            date: entry.date,
            mode: entry.mode,
            calories: entry.calories,
            protein_g: entry.protein_g,
            fat_g: entry.fat_g,
            carbs_g: entry.carbs_g
        };
    }).filter(Boolean);
    const response = await fetch('/api/food-diary/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            user_profile: profile,
            food_entries: normalizedEntries
        })
    });
    if (!response.ok) {
        return { insights: [], advice: '' };
    }
    return response.json();
}

function mergeEntries(localEntries, backendEntries) {
    const merged = sortEntries([...localEntries, ...backendEntries]);
    const unique = [];
    const seen = new Set();
    merged.forEach((entry) => {
        const totals = entry?.mode === MODE_PRODUCTS && entry.totals
            ? entry.totals
            : {
                calories: Number(entry?.calories) || 0,
                protein_g: Number(entry?.protein_g) || 0,
                fat_g: Number(entry?.fat_g) || 0,
                carbs_g: Number(entry?.carbs_g) || 0
            };
        const key = `${entry.date}-${entry.mode}-${entry.meal || ''}-${totals.calories}-${totals.protein_g}-${totals.fat_g}-${totals.carbs_g}-${entry?.items?.length || 0}`;
        if (!seen.has(key)) {
            seen.add(key);
            unique.push(entry);
        }
    });
    return unique;
}

function getDiaryDateKey(value) {
    if (typeof window.normalizeLocalDate === 'function') {
        return window.normalizeLocalDate(value);
    }
    return value || null;
}

function getUniqueDiaryDates(entries) {
    const dates = new Set();
    entries.forEach((entry) => {
        const dateKey = getDiaryDateKey(entry?.date);
        if (dateKey) {
            dates.add(dateKey);
        }
    });
    return Array.from(dates).sort();
}

function buildEntriesForAnalysis(entries) {
    const uniqueDates = getUniqueDiaryDates(entries);
    const selectedDates = uniqueDates.slice(-MAX_AI_DAYS);
    const dateSet = new Set(selectedDates);
    const filtered = entries.filter((entry) => dateSet.has(entry?.date));
    return { filtered, uniqueDatesCount: uniqueDates.length };
}

function getEntriesByDate(entries, date) {
    const dateKey = typeof window.normalizeLocalDate === 'function'
        ? window.normalizeLocalDate(date)
        : date;
    if (!dateKey) {
        return [];
    }
    return entries.filter((entry) => entry.date === dateKey);
}

function renderDailySummary(entries, date) {
    const container = document.getElementById('daily-summary');
    if (!container) {
        return;
    }
    if (!date) {
        container.innerHTML = '<p class="text-slate-400">Выберите дату, чтобы увидеть сводку.</p>';
        return;
    }
    const dayEntries = getEntriesByDate(entries, date);
    if (!dayEntries.length) {
        container.innerHTML = '<p class="text-slate-400">Нет записей за выбранный день.</p>';
        return;
    }
    const totals = dayEntries.reduce(
        (acc, entry) => {
            if (entry.mode === MODE_PRODUCTS) {
                const resolvedTotals = entry.totals || calculateTotals(entry.items || []);
                acc.calories += Number(resolvedTotals.calories) || 0;
                acc.protein_g += Number(resolvedTotals.protein_g) || 0;
                acc.fat_g += Number(resolvedTotals.fat_g) || 0;
                acc.carbs_g += Number(resolvedTotals.carbs_g) || 0;
                return acc;
            }
            acc.calories += Number(entry.calories) || 0;
            acc.protein_g += Number(entry.protein_g) || 0;
            acc.fat_g += Number(entry.fat_g) || 0;
            acc.carbs_g += Number(entry.carbs_g) || 0;
            return acc;
        },
        { calories: 0, protein_g: 0, fat_g: 0, carbs_g: 0 }
    );
    container.innerHTML = `
        <div>Калории: ${Math.round(totals.calories)} ккал</div>
        <div>Белки: ${Math.round(totals.protein_g)} г</div>
        <div>Жиры: ${Math.round(totals.fat_g)} г</div>
        <div>Углеводы: ${Math.round(totals.carbs_g)} г</div>
    `;
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

function getModeFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const rawMode = params.get('mode');
    if (rawMode === MODE_SUMMARY || rawMode === MODE_PRODUCTS) {
        localStorage.setItem(MODE_STORAGE_KEY, rawMode);
        return rawMode;
    }
    const stored = localStorage.getItem(MODE_STORAGE_KEY);
    if (stored === MODE_SUMMARY || stored === MODE_PRODUCTS) {
        return stored;
    }
    return MODE_SUMMARY;
}

function getDateFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const rawDate = params.get('date');
    if (!rawDate) {
        return '';
    }
    return typeof window.normalizeLocalDate === 'function'
        ? window.normalizeLocalDate(rawDate) || ''
        : rawDate;
}

function setActiveMode(mode) {
    const toggle = document.getElementById('diary-mode-toggle');
    const productsBlock = document.getElementById('diary-mode-products');
    const summaryBlock = document.getElementById('diary-mode-summary');
    if (!toggle || !productsBlock || !summaryBlock) {
        return;
    }
    const buttons = toggle.querySelectorAll('[data-mode]');
    buttons.forEach((button) => {
        const isActive = button.dataset.mode === mode;
        button.classList.toggle('btn-primary', isActive);
        button.classList.toggle('btn-secondary', !isActive);
    });
    productsBlock.classList.toggle('hidden', mode !== MODE_PRODUCTS);
    summaryBlock.classList.toggle('hidden', mode !== MODE_SUMMARY);
    localStorage.setItem(MODE_STORAGE_KEY, mode);

    const params = new URLSearchParams(window.location.search);
    params.set('mode', mode);
    const dateValue = getSelectedDate();
    if (dateValue) {
        params.set('date', dateValue);
    }
    const next = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', next);
}

function findSummaryEntry(entries, dateKey) {
    return entries.find((entry) => entry.mode === MODE_SUMMARY && entry.date === dateKey) || null;
}

function findProductsEntry(entries, dateKey, meal) {
    return entries.find((entry) => entry.mode === MODE_PRODUCTS && entry.date === dateKey && entry.meal === meal) || null;
}

function updateSummaryForm(entries, dateKey) {
    const caloriesInput = document.getElementById('diary-summary-calories');
    const proteinInput = document.getElementById('diary-summary-protein');
    const fatInput = document.getElementById('diary-summary-fat');
    const carbsInput = document.getElementById('diary-summary-carbs');
    const deleteButton = document.getElementById('diary-summary-delete');

    if (!caloriesInput || !proteinInput || !fatInput || !carbsInput || !deleteButton) {
        return;
    }

    const entry = dateKey ? findSummaryEntry(entries, dateKey) : null;
    if (entry) {
        caloriesInput.value = entry.calories ?? '';
        proteinInput.value = entry.protein_g ?? '';
        fatInput.value = entry.fat_g ?? '';
        carbsInput.value = entry.carbs_g ?? '';
        deleteButton.classList.remove('hidden');
    } else {
        caloriesInput.value = '';
        proteinInput.value = '';
        fatInput.value = '';
        carbsInput.value = '';
        deleteButton.classList.add('hidden');
    }
}

function updateProductsForm(entries, dateKey, meal) {
    const itemsContainer = document.getElementById('diary-products-items');
    const deleteButton = document.getElementById('diary-products-delete');

    if (!itemsContainer || !deleteButton) {
        return;
    }

    const entry = dateKey && meal ? findProductsEntry(entries, dateKey, meal) : null;
    itemsContainer.innerHTML = '';
    if (entry && Array.isArray(entry.items) && entry.items.length > 0) {
        entry.items.forEach((item) => {
            itemsContainer.appendChild(buildFoodItemRow(item));
        });
        deleteButton.classList.remove('hidden');
    } else {
        itemsContainer.appendChild(buildFoodItemRow());
        if (entry) {
            deleteButton.classList.remove('hidden');
        } else {
            deleteButton.classList.add('hidden');
        }
    }
}

function bindGlobalDiaryHandlers() {
    if (diaryGlobalHandlersBound) {
        return;
    }
    diaryGlobalHandlersBound = true;

    // Делаем обработчики устойчивыми, чтобы клики не терялись из-за состояния DOM.
    document.addEventListener('click', (event) => {
        const modeButton = event.target.closest('#diary-mode-toggle [data-mode]');
        if (modeButton) {
            setActiveMode(modeButton.dataset.mode);
            const entries = readDiaryEntries();
            const selectedDate = getSelectedDate();
            renderDailySummary(entries, selectedDate);
            updateSummaryForm(entries, selectedDate);
            updateProductsForm(
                entries,
                selectedDate,
                document.getElementById('diary-products-meal')?.value || 'breakfast'
            );
            return;
        }

        const addButton = event.target.closest('#diary-add-item');
        if (addButton) {
            const productsItems = document.getElementById('diary-products-items');
            if (productsItems) {
                productsItems.appendChild(buildFoodItemRow());
            }
        }
    });
}

function getSelectedDate() {
    const productsDate = document.getElementById('diary-products-date');
    const summaryDate = document.getElementById('diary-summary-date');
    if (productsDate && !productsDate.closest('.hidden')) {
        return productsDate.value;
    }
    if (summaryDate && !summaryDate.closest('.hidden')) {
        return summaryDate.value;
    }
    return '';
}

async function refreshDiary() {
    setDiaryLoadingState(true);
    const localEntries = readDiaryEntries();
    const backendEntries = await loadEntriesFromBackend();
    const merged = mergeEntries(localEntries, backendEntries);
    saveDiaryEntries(merged);
    renderDiaryList(merged);

    const selectedDate = getSelectedDate();
    renderDailySummary(merged, selectedDate);

    const profile = typeof getUserProfile === 'function' ? getUserProfile() : null;
    const isExpired = profile?.subscription_status === 'expired';
    await toggleDiaryPaywall(isExpired, profile, merged.length);
    if (isExpired) {
        setDiaryLoadingState(false);
        return;
    }
    const { filtered, uniqueDatesCount } = buildEntriesForAnalysis(merged);
    if (uniqueDatesCount < MIN_AI_DAYS) {
        setAiComment([], '', MIN_AI_DAYS, uniqueDatesCount);
        setDiaryLoadingState(false);
        return;
    }
    const analysis = await requestAiAnalysis(filtered);
    if (analysis?.text) {
        setAiComment(analysis.text.insights, analysis.text.advice, MIN_AI_DAYS, uniqueDatesCount);
        renderDeviationRisk(analysis.text.risk, analysis.text.comment);
        updateProfileDeviation(analysis.text.risk, analysis.text.comment);
    } else {
        setAiComment(analysis.insights, analysis.advice, MIN_AI_DAYS, uniqueDatesCount);
    }
    setDiaryLoadingState(false);
}

function initDiary() {
    if (diaryInitialized) {
        return;
    }
    diaryInitialized = true;

    bindGlobalDiaryHandlers();
    const toggle = document.getElementById('diary-mode-toggle');
    const productsForm = document.getElementById('diary-products-form');
    const summaryForm = document.getElementById('diary-summary-form');
    const productsDate = document.getElementById('diary-products-date');
    const summaryDate = document.getElementById('diary-summary-date');
    const productsItems = document.getElementById('diary-products-items');
    const addItemButton = document.getElementById('diary-add-item');
    const deleteSummaryButton = document.getElementById('diary-summary-delete');
    const deleteProductsButton = document.getElementById('diary-products-delete');
    const initialDate = getDateFromUrl();
    const initialMode = getModeFromUrl();

    if (toggle) {
        setActiveMode(initialMode);
    }

    if (initialDate) {
        if (productsDate) {
            productsDate.value = initialDate;
        }
        if (summaryDate) {
            summaryDate.value = initialDate;
        }
    }

    updateSummaryForm(readDiaryEntries(), initialDate);
    updateProductsForm(
        readDiaryEntries(),
        initialDate,
        document.getElementById('diary-products-meal')?.value || 'breakfast'
    );

    if (addItemButton && productsItems) {
        addItemButton.setAttribute('type', 'button');
    }

    if (productsForm && productsItems) {
        productsForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const date = productsDate?.value;
            const meal = document.getElementById('diary-products-meal')?.value || null;
            if (!date) {
                return;
            }
            const items = collectFoodItems(productsItems);
            if (!items.length) {
                showNotification('Добавьте хотя бы один продукт.', 'error');
                return;
            }
            const totals = calculateTotals(items);
            const entry = normalizeEntry({
                date,
                mode: MODE_PRODUCTS,
                meal,
                items,
                totals
            });
            const entries = readDiaryEntries();
            const dateKey = entry?.date;
            const existing = dateKey && meal ? findProductsEntry(entries, dateKey, meal) : null;
            let updated = entries;
            if (existing) {
                updated = entries.map((item) => (item === existing ? entry : item));
            } else {
                updated = [...entries, entry];
            }
            const merged = sortEntries(updated);
            saveDiaryEntries(merged);
            await syncEntryWithBackend(entry);
            updateProductsForm(merged, dateKey, meal);
            await refreshDiary();
        });
    }

    if (summaryForm) {
        summaryForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const date = summaryDate?.value;
            if (!date) {
                return;
            }
            const calories = Number(document.getElementById('diary-summary-calories')?.value);
            const protein = Number(document.getElementById('diary-summary-protein')?.value);
            const fat = Number(document.getElementById('diary-summary-fat')?.value);
            const carbs = Number(document.getElementById('diary-summary-carbs')?.value);
            const entry = normalizeEntry({
                date,
                mode: MODE_SUMMARY,
                calories: Number.isFinite(calories) ? calories : 0,
                protein_g: Number.isFinite(protein) ? protein : 0,
                fat_g: Number.isFinite(fat) ? fat : 0,
                carbs_g: Number.isFinite(carbs) ? carbs : 0
            });
            const entries = readDiaryEntries();
            const dateKey = entry?.date;
            const existing = dateKey ? findSummaryEntry(entries, dateKey) : null;
            let updated = entries;
            if (existing) {
                updated = entries.map((item) => (item === existing ? entry : item));
            } else {
                updated = [...entries, entry];
            }
            const merged = sortEntries(updated);
            saveDiaryEntries(merged);
            await syncEntryWithBackend(entry);
            updateSummaryForm(merged, dateKey);
            await refreshDiary();
        });
    }

    const handleDateChange = () => {
        const entries = readDiaryEntries();
        const selected = getSelectedDate();
        renderDailySummary(entries, selected);
        updateSummaryForm(entries, selected);
        updateProductsForm(
            entries,
            selected,
            document.getElementById('diary-products-meal')?.value || 'breakfast'
        );
        if (selected) {
            const params = new URLSearchParams(window.location.search);
            params.set('date', selected);
            const currentMode = getModeFromUrl();
            params.set('mode', currentMode);
            window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
        }
    };

    if (productsDate) {
        productsDate.addEventListener('change', handleDateChange);
    }
    if (summaryDate) {
        summaryDate.addEventListener('change', handleDateChange);
    }
    const mealSelect = document.getElementById('diary-products-meal');
    if (mealSelect) {
        mealSelect.addEventListener('change', () => {
            updateProductsForm(
                readDiaryEntries(),
                getSelectedDate(),
                mealSelect.value
            );
        });
    }

    if (deleteSummaryButton) {
        deleteSummaryButton.addEventListener('click', async () => {
            const dateKey = getSelectedDate();
            if (!dateKey) {
                return;
            }
            const entries = readDiaryEntries();
            const updated = entries.filter((entryItem) => !(entryItem.mode === MODE_SUMMARY && entryItem.date === dateKey));
            saveDiaryEntries(updated);
            updateSummaryForm(updated, dateKey);
            await refreshDiary();
        });
    }

    if (deleteProductsButton) {
        deleteProductsButton.addEventListener('click', async () => {
            const dateKey = getSelectedDate();
            const meal = document.getElementById('diary-products-meal')?.value;
            if (!dateKey || !meal) {
                return;
            }
            const entries = readDiaryEntries();
            const updated = entries.filter((entryItem) => !(entryItem.mode === MODE_PRODUCTS && entryItem.date === dateKey && entryItem.meal === meal));
            saveDiaryEntries(updated);
            updateProductsForm(updated, dateKey, meal);
            await refreshDiary();
        });
    }

    if (initialDate) {
        renderDailySummary(readDiaryEntries(), initialDate);
    }

    void refreshDiary();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDiary);
} else {
    initDiary();
}

window.addEventListener('load', initDiary);
