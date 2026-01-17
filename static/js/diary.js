const DIARY_STORAGE_KEY = window.DIARY_STORAGE_KEY || 'bree_diary_entries';

let diaryInitialized = false;
let diaryGlobalHandlersBound = false;

const MODE_PRODUCTS = 'products';
const MODE_SUMMARY = 'summary';

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
    const items = Array.isArray(entry.items) ? entry.items : [];
    const totals = mode === MODE_PRODUCTS ? calculateTotals(items) : null;
    const calories = Number(entry.calories ?? totals?.calories ?? 0) || 0;
    const protein = Number(entry.protein ?? entry.protein_g ?? totals?.protein ?? 0) || 0;
    const fat = Number(entry.fat ?? entry.fat_g ?? totals?.fat ?? 0) || 0;
    const carbs = Number(entry.carbs ?? entry.carbs_g ?? totals?.carbs ?? 0) || 0;
    const dateKey = typeof window.normalizeLocalDate === 'function'
        ? window.normalizeLocalDate(entry.date)
        : entry.date;
    if (!dateKey) {
        return null;
    }
    return {
        date: dateKey,
        mode,
        meal: entry.meal || null,
        calories,
        protein,
        fat,
        carbs,
        items: mode === MODE_PRODUCTS ? items : []
    };
}

function sortEntries(entries) {
    return [...entries].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

function calculateTotals(items) {
    return items.reduce(
        (acc, item) => {
            acc.calories += Number(item?.calories) || 0;
            acc.protein += Number(item?.protein) || 0;
            acc.fat += Number(item?.fat) || 0;
            acc.carbs += Number(item?.carbs) || 0;
            return acc;
        },
        { calories: 0, protein: 0, fat: 0, carbs: 0 }
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
        item.innerHTML = `
            <div class="flex items-center justify-between">
                <span class="font-semibold text-slate-700">${entry.date}</span>
                <span class="text-xs text-slate-500">${modeLabel}</span>
            </div>
            ${mealLabel ? `<div class="text-xs text-slate-500">${mealLabel}</div>` : ''}
            <div class="text-slate-500">Калории: ${Math.round(entry.calories)} ккал</div>
            <div class="text-slate-500">Белки, жиры, углеводы: ${Math.round(entry.protein)} / ${Math.round(entry.fat)} / ${Math.round(entry.carbs)} г</div>
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

function setAiComment(insights, advice) {
    const container = document.getElementById('diary-ai-comment');
    if (!container) {
        return;
    }
    container.innerHTML = '';
    if ((!insights || !insights.length) && !advice) {
        container.innerHTML = '<p class="text-slate-400">Добавьте несколько дней, чтобы получить комментарий.</p>';
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
    await fetch('/api/food-diary/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            telegram_user_id: profile.telegram_user_id,
            date: entry.date,
            calories: entry.calories,
            protein_g: entry.protein,
            fat_g: entry.fat,
            carbs_g: entry.carbs
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
        protein: entry.protein_g,
        fat: entry.fat_g,
        carbs: entry.carbs_g
    })).filter(Boolean);
}

async function requestAiAnalysis(entries) {
    const profile = typeof getUserProfile === 'function' ? getUserProfile() : null;
    if (!profile) {
        return { insights: [], advice: '' };
    }
    const response = await fetch('/api/food-diary/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            user_profile: profile,
            food_entries: entries
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
        const key = `${entry.date}-${entry.mode}-${entry.meal || ''}-${entry.calories}-${entry.protein}-${entry.fat}-${entry.carbs}`;
        if (!seen.has(key)) {
            seen.add(key);
            unique.push(entry);
        }
    });
    return unique;
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
            acc.calories += Number(entry.calories) || 0;
            acc.protein += Number(entry.protein) || 0;
            acc.fat += Number(entry.fat) || 0;
            acc.carbs += Number(entry.carbs) || 0;
            return acc;
        },
        { calories: 0, protein: 0, fat: 0, carbs: 0 }
    );
    container.innerHTML = `
        <div>Калории: ${Math.round(totals.calories)} ккал</div>
        <div>Белки: ${Math.round(totals.protein)} г</div>
        <div>Жиры: ${Math.round(totals.fat)} г</div>
        <div>Углеводы: ${Math.round(totals.carbs)} г</div>
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
    return params.get('mode') === MODE_SUMMARY ? MODE_SUMMARY : MODE_PRODUCTS;
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
            renderDailySummary(readDiaryEntries(), getSelectedDate());
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
    const analysis = await requestAiAnalysis(merged.slice(0, 7));
    if (analysis?.text) {
        setAiComment(analysis.text.insights, analysis.text.advice);
        renderDeviationRisk(analysis.text.risk, analysis.text.comment);
        updateProfileDeviation(analysis.text.risk, analysis.text.comment);
    } else {
        setAiComment(analysis.insights, analysis.advice);
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
    const initialDate = getDateFromUrl();

    if (toggle) {
        setActiveMode(getModeFromUrl());
    }

    if (initialDate) {
        if (productsDate) {
            productsDate.value = initialDate;
        }
        if (summaryDate) {
            summaryDate.value = initialDate;
        }
    }

    if (productsItems && productsItems.children.length === 0) {
        productsItems.appendChild(buildFoodItemRow());
    }

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
                calories: totals.calories,
                protein: totals.protein,
                fat: totals.fat,
                carbs: totals.carbs,
                items
            });
            const entries = readDiaryEntries();
            entries.push(entry);
            const merged = sortEntries(entries);
            saveDiaryEntries(merged);
            await syncEntryWithBackend(entry);
            renderDiaryList(merged);
            renderDailySummary(merged, date);
            productsItems.innerHTML = '';
            productsItems.appendChild(buildFoodItemRow());
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
                protein: Number.isFinite(protein) ? protein : 0,
                fat: Number.isFinite(fat) ? fat : 0,
                carbs: Number.isFinite(carbs) ? carbs : 0
            });
            const entries = readDiaryEntries();
            entries.push(entry);
            const merged = sortEntries(entries);
            saveDiaryEntries(merged);
            await syncEntryWithBackend(entry);
            renderDiaryList(merged);
            renderDailySummary(merged, date);
        });
    }

    const handleDateChange = () => {
        const entries = readDiaryEntries();
        renderDailySummary(entries, getSelectedDate());
    };

    if (productsDate) {
        productsDate.addEventListener('change', handleDateChange);
    }
    if (summaryDate) {
        summaryDate.addEventListener('change', handleDateChange);
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
