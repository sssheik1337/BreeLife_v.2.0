const DIARY_STORAGE_KEY = window.DIARY_STORAGE_KEY || 'bree_diary_entries';
const HABITS_STORAGE_KEY = 'bree_habits';
const apiFetch = window.apiFetch || fetch;

let diaryInitialized = false;
let diaryGlobalHandlersBound = false;
let diaryEntriesMemory = [];
let habitsEntriesMemory = [];
let diaryModeMemory = null;

const MODE_PRODUCTS = 'products';
const MODE_SUMMARY = 'summary';
const MODE_DAY = 'day';
const MIN_AI_DAYS = 5;
const MAX_AI_DAYS = 7;
const DIARY_LIST_STEP = 7;
let diaryListLimit = DIARY_LIST_STEP;

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
    return Array.isArray(diaryEntriesMemory) ? diaryEntriesMemory.map(normalizeEntry).filter(Boolean) : [];
}

function saveDiaryEntries(entries) {
    if (typeof window.setDiaryEntries === 'function') {
        window.setDiaryEntries(entries);
        return;
    }
    diaryEntriesMemory = Array.isArray(entries) ? entries : [];
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
            ? (() => {
                const resolved = resolveCarbTotals(
                    entry.totals.carbs_g,
                    entry.totals.carbs_simple_g,
                    entry.totals.carbs_complex_g
                );
                return {
                    calories: Number(entry.totals.calories) || 0,
                    protein_g: Number(entry.totals.protein_g) || 0,
                    fat_g: Number(entry.totals.fat_g) || 0,
                    carbs_g: resolved.total,
                    carbs_simple_g: resolved.simple,
                    carbs_complex_g: resolved.complex,
                    fiber_g: Number(entry.totals.fiber_g) || 0
                };
            })()
            : calculateTotals(items))
        : (() => {
            const resolved = resolveCarbTotals(
                entry.carbs_g ?? entry.carbs ?? 0,
                entry.carbs_simple_g ?? entry.carbs_simple ?? 0,
                entry.carbs_complex_g ?? entry.carbs_complex ?? 0
            );
            return {
                calories: Number(entry.calories ?? 0) || 0,
                protein_g: Number(entry.protein_g ?? entry.protein ?? 0) || 0,
                fat_g: Number(entry.fat_g ?? entry.fat ?? 0) || 0,
                carbs_g: resolved.total,
                carbs_simple_g: resolved.simple,
                carbs_complex_g: resolved.complex,
                fiber_g: Number(entry.fiber_g ?? entry.fiber ?? 0) || 0,
                water_l: Number(entry.water_l ?? entry.water ?? 0) || 0
            };
        })();
    if (mode === MODE_PRODUCTS) {
        return {
            date: dateKey,
            mode,
            meal: entry.meal || null,
            items,
            totals,
            water_l: Number(entry.water_l ?? entry.water ?? 0) || 0,
            sleep_time: entry.sleep_time || null,
            activity: Boolean(entry.activity)
        };
    }
        return {
            date: dateKey,
            mode,
            calories: totals.calories,
            protein_g: totals.protein_g,
            fat_g: totals.fat_g,
            carbs_g: totals.carbs_g,
            carbs_simple_g: totals.carbs_simple_g,
            carbs_complex_g: totals.carbs_complex_g,
            fiber_g: totals.fiber_g,
            water_l: totals.water_l,
            sleep_time: entry.sleep_time || null,
            activity: Boolean(entry.activity)
        };
}

function sortEntries(entries) {
    return [...entries].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

function calculateTotals(items) {
    return items.reduce(
        (acc, item) => {
            const resolved = resolveCarbTotals(
                item?.carbs ?? item?.carbs_g ?? 0,
                item?.carbs_simple ?? item?.carbs_simple_g ?? 0,
                item?.carbs_complex ?? item?.carbs_complex_g ?? 0
            );
            acc.calories += Number(item?.calories) || 0;
            acc.protein_g += Number(item?.protein) || Number(item?.protein_g) || 0;
            acc.fat_g += Number(item?.fat) || Number(item?.fat_g) || 0;
            acc.carbs_g += resolved.total;
            acc.carbs_simple_g += resolved.simple;
            acc.carbs_complex_g += resolved.complex;
            acc.fiber_g += Number(item?.fiber) || Number(item?.fiber_g) || 0;
            return acc;
        },
        {
            calories: 0,
            protein_g: 0,
            fat_g: 0,
            carbs_g: 0,
            carbs_simple_g: 0,
            carbs_complex_g: 0,
            fiber_g: 0
        }
    );
}

function resolveCarbTotals(totalValue, simpleValue, complexValue) {
    const total = Number(totalValue) || 0;
    let simple = Number(simpleValue) || 0;
    let complex = Number(complexValue) || 0;
    if (simple > 0 && complex === 0 && total > simple) {
        complex = total - simple;
    }
    if (complex > 0 && simple === 0 && total > complex) {
        simple = total - complex;
    }
    if (simple > 0 || complex > 0) {
        return { total: simple + complex, simple, complex };
    }
    if (total > 0) {
        return { total, simple: 0, complex: total };
    }
    return { total: 0, simple: 0, complex: 0 };
}

function formatCarbSplit(totals) {
    const total = Number(totals?.carbs_g) || 0;
    const simple = Number(totals?.carbs_simple_g) || 0;
    const complex = Number(totals?.carbs_complex_g) || 0;
    if (total <= 0) {
        return 'Углеводы: 0 г (простые 0 / сложные 0 г)';
    }
    return `Углеводы: ${Math.round(total)} г (простые ${Math.round(simple)} / сложные ${Math.round(complex)} г)`;
}

function getMaxWaterForDate(entries, dateKey) {
    if (!dateKey) {
        return 0;
    }
    return entries.reduce((maxValue, entry) => {
        if (entry?.date !== dateKey) {
            return maxValue;
        }
        const water = Number(entry?.water_l) || 0;
        return Math.max(maxValue, water);
    }, 0);
}

function getActivityForDate(entries, dateKey) {
    if (!dateKey) {
        return false;
    }
    return entries.some((entry) => entry?.date === dateKey && entry?.activity === true);
}

function readHabitEntries() {
    if (typeof window.getHabitEntries === 'function') {
        return window.getHabitEntries();
    }
    return habitsEntriesMemory && typeof habitsEntriesMemory === 'object' ? habitsEntriesMemory : {};
}

function saveHabitEntries(entries) {
    if (typeof window.setHabitEntries === 'function') {
        window.setHabitEntries(entries);
        return;
    }
    habitsEntriesMemory = entries && typeof entries === 'object' ? entries : {};
}

function buildHabitDefaults(dateKey, entries) {
    if (!dateKey) {
        return null;
    }
    const waterTarget = Number(window.adminConfig?.reminders?.water_min_l);
    const sleepTarget = parseSleepMinutes(window.adminConfig?.reminders?.sleep_target);
    const dayEntries = getEntriesByDate(entries, dateKey);
    const waterValue = getMaxWaterForDate(entries, dateKey);
    const sleepMinutes = getMinSleepForDate(entries, dateKey);
    const activityValue = getActivityForDate(entries, dateKey);
    const hasDiary = dayEntries.length > 0;
    const waterOk = Number.isFinite(waterTarget) && waterTarget > 0 ? waterValue >= waterTarget : waterValue > 0;
    const sleepOk = sleepMinutes !== null ? (sleepTarget !== null ? sleepMinutes <= sleepTarget : true) : false;
    return {
        water: waterOk,
        sleep: sleepOk,
        diary: hasDiary,
        activity: activityValue
    };
}

function getHabitStatus(dateKey, entries) {
    const habits = readHabitEntries();
    const defaults = buildHabitDefaults(dateKey, entries);
    const stored = habits[dateKey];
    if (stored && typeof stored === 'object') {
        return { ...defaults, ...stored };
    }
    return defaults;
}

function updateHabitEntry(dateKey, key, value) {
    if (!dateKey) {
        return;
    }
    const habits = readHabitEntries();
    const entry = habits[dateKey] && typeof habits[dateKey] === 'object' ? habits[dateKey] : {};
    habits[dateKey] = { ...entry, [key]: value };
    saveHabitEntries(habits);
}

function removeHabitEntry(dateKey) {
    if (!dateKey) {
        return;
    }
    const habits = readHabitEntries();
    if (habits[dateKey]) {
        delete habits[dateKey];
        saveHabitEntries(habits);
    }
}

function parseSleepMinutes(value) {
    if (!value || typeof value !== 'string') {
        return null;
    }
    const [hours, minutes] = value.split(':').map((part) => Number(part));
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
        return null;
    }
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        return null;
    }
    return hours * 60 + minutes;
}

function getMinSleepForDate(entries, dateKey) {
    if (!dateKey) {
        return null;
    }
    let best = null;
    entries.forEach((entry) => {
        if (entry?.date !== dateKey) {
            return;
        }
        const minutes = parseSleepMinutes(entry.sleep_time);
        if (minutes === null) {
            return;
        }
        if (best === null || minutes < best) {
            best = minutes;
        }
    });
    return best;
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
    const entriesSorted = sortEntries(entries);
    const uniqueDates = Array.from(new Set(entriesSorted.map((entry) => entry.date).filter(Boolean)));
    const visibleDates = uniqueDates.slice(0, diaryListLimit);
    const visibleEntries = entriesSorted.filter((entry) => visibleDates.includes(entry.date));
    const groupedByDate = new Map();
    visibleEntries.forEach((entry) => {
        if (!entry?.date) {
            return;
        }
        const totals = entry.mode === MODE_PRODUCTS
            ? entry.totals || calculateTotals(entry.items || [])
            : (() => {
                const resolved = resolveCarbTotals(
                    entry.carbs_g ?? 0,
                    entry.carbs_simple_g ?? 0,
                    entry.carbs_complex_g ?? 0
                );
                return {
                    calories: Number(entry.calories) || 0,
                    protein_g: Number(entry.protein_g) || 0,
                    fat_g: Number(entry.fat_g) || 0,
                    carbs_g: resolved.total,
                    carbs_simple_g: resolved.simple,
                    carbs_complex_g: resolved.complex,
                    fiber_g: Number(entry.fiber_g) || 0
                };
            })();
        const existing = groupedByDate.get(entry.date) || {
            date: entry.date,
            calories: 0,
            protein_g: 0,
            fat_g: 0,
            carbs_g: 0,
            carbs_simple_g: 0,
            carbs_complex_g: 0,
            fiber_g: 0,
            water_l: 0,
            sleep_time: null,
            entriesCount: 0
        };
        existing.calories += Number(totals.calories) || 0;
        existing.protein_g += Number(totals.protein_g) || 0;
        existing.fat_g += Number(totals.fat_g) || 0;
        existing.carbs_g += Number(totals.carbs_g) || 0;
        existing.carbs_simple_g += Number(totals.carbs_simple_g) || 0;
        existing.carbs_complex_g += Number(totals.carbs_complex_g) || 0;
        existing.fiber_g += Number(totals.fiber_g) || 0;
        existing.water_l = Math.max(existing.water_l, Number(entry?.water_l) || 0);
        const sleepMinutes = parseSleepMinutes(entry?.sleep_time);
        if (sleepMinutes !== null) {
            if (existing.sleep_time === null || sleepMinutes < existing.sleep_time) {
                existing.sleep_time = sleepMinutes;
            }
        }
        existing.entriesCount += 1;
        groupedByDate.set(entry.date, existing);
    });
    visibleDates.forEach((date) => {
        const summary = groupedByDate.get(date);
        if (!summary) {
            return;
        }
        const dayEntries = entriesSorted.filter((entry) => entry.date === date);
        const item = document.createElement('div');
        item.className = 'bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-2';
        const waterLine = summary.water_l > 0
            ? `<div class="text-slate-500">Вода: ${summary.water_l.toFixed(1)} л</div>`
            : '';
        const sleepLine = summary.sleep_time !== null
            ? `<div class="text-slate-500">Сон: ${String(Math.floor(summary.sleep_time / 60)).padStart(2, '0')}:${String(summary.sleep_time % 60).padStart(2, '0')}</div>`
            : '';
        const entriesMarkup = dayEntries.map((entry) => {
            const modeLabel = entry.mode === MODE_PRODUCTS ? 'По продуктам' : 'Запись';
            const mealLabel = entry.mode === MODE_PRODUCTS ? (mealLabels[entry.meal] || 'Приём пищи') : '';
            const totals = entry.mode === MODE_PRODUCTS
                ? entry.totals || calculateTotals(entry.items || [])
                : (() => {
                    const resolved = resolveCarbTotals(
                        entry.carbs_g ?? 0,
                        entry.carbs_simple_g ?? 0,
                        entry.carbs_complex_g ?? 0
                    );
                    return {
                        calories: Number(entry.calories) || 0,
                        protein_g: Number(entry.protein_g) || 0,
                        fat_g: Number(entry.fat_g) || 0,
                        carbs_g: resolved.total,
                        carbs_simple_g: resolved.simple,
                        carbs_complex_g: resolved.complex,
                        fiber_g: Number(entry.fiber_g) || 0
                    };
                })();
            const mealParam = entry.mode === MODE_PRODUCTS && entry.meal ? `&meal=${entry.meal}` : '';
            const editUrl = `/diary?date=${entry.date}&mode=${entry.mode}${mealParam}`;
            return `
                <div class="rounded-xl border border-slate-100 bg-white p-3 space-y-2">
                    <div class="flex items-center justify-between">
                        <span class="text-xs text-slate-500">${modeLabel}${mealLabel ? ` · ${mealLabel}` : ''}</span>
                        <div class="flex items-center gap-2">
                            <a href="/diary?date=${entry.date}&mode=${MODE_DAY}" class="text-xs text-slate-500 font-semibold">Открыть день</a>
                            <a href="${editUrl}" class="text-xs text-emerald-600 font-semibold">Редактировать</a>
                            <button type="button" class="text-xs text-rose-500 font-semibold" data-action="delete-entry" data-date="${entry.date}" data-mode="${entry.mode}" data-meal="${entry.meal || ''}">
                                Удалить
                            </button>
                        </div>
                    </div>
                    <div class="text-slate-500">Всего за день: ${Math.round(totals.calories)} ккал</div>
                    <div class="text-slate-500">Белки / жиры / углеводы / клетчатка: ${Math.round(totals.protein_g)} / ${Math.round(totals.fat_g)} / ${Math.round(totals.carbs_g)} / ${Math.round(totals.fiber_g || 0)} г</div>
                    <div class="text-slate-500">${formatCarbSplit(totals)}</div>
                </div>
            `;
        }).join('');
        item.innerHTML = `
            <button type="button" class="w-full flex items-center justify-between" data-action="toggle-day" data-date="${summary.date}">
                <span class="font-semibold text-slate-700">${summary.date}</span>
                <span class="text-xs text-slate-500">Записей: ${summary.entriesCount}</span>
            </button>
            <div class="text-slate-500">Всего за день: ${Math.round(summary.calories)} ккал</div>
            <div class="text-slate-500">Белки / жиры / углеводы / клетчатка: ${Math.round(summary.protein_g)} / ${Math.round(summary.fat_g)} / ${Math.round(summary.carbs_g)} / ${Math.round(summary.fiber_g || 0)} г</div>
            <div class="text-slate-500">${formatCarbSplit(summary)}</div>
            ${sleepLine}
            ${waterLine}
            <div class="mt-2">
                <a href="/diary?date=${summary.date}&mode=${MODE_DAY}" class="text-xs text-emerald-600 font-semibold">Открыть день целиком</a>
            </div>
            <div class="hidden" data-role="day-details">
                <div class="mt-2 space-y-2">
                    ${entriesMarkup}
                </div>
            </div>
        `;
        list.appendChild(item);
    });
    if (uniqueDates.length > visibleDates.length) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn-secondary w-full mt-3';
        button.textContent = 'Показать ещё';
        button.addEventListener('click', () => {
            diaryListLimit += DIARY_LIST_STEP;
            renderDiaryList(entries);
        });
        list.appendChild(button);
    }
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
    const fixButton = document.getElementById('diary-fix-button');
    if (!indicator || !label || !text || !fixButton) {
        return;
    }
    const hasRisk = risk === 'low' || risk === 'medium' || risk === 'high';
    if (!hasRisk) {
        indicator.className = 'hidden';
        label.textContent = 'Недостаточно данных';
        text.textContent = '';
        fixButton.classList.add('opacity-60', 'cursor-not-allowed');
        fixButton.setAttribute('aria-disabled', 'true');
        fixButton.setAttribute('tabindex', '-1');
        return;
    }
    const riskMap = {
        low: { label: 'Риск низкий', color: 'bg-emerald-400' },
        medium: { label: 'Риск средний', color: 'bg-yellow-400' },
        high: { label: 'Риск высокий', color: 'bg-rose-500' }
    };
    const resolved = riskMap[risk];
    indicator.className = `inline-flex h-3 w-3 rounded-full ${resolved.color}`;
    label.textContent = resolved.label;
    text.textContent = comment || '';
    if (comment) {
        fixButton.classList.remove('opacity-60', 'cursor-not-allowed');
        fixButton.removeAttribute('aria-disabled');
        fixButton.removeAttribute('tabindex');
    } else {
        fixButton.classList.add('opacity-60', 'cursor-not-allowed');
        fixButton.setAttribute('aria-disabled', 'true');
        fixButton.setAttribute('tabindex', '-1');
    }
    fixButton.onclick = (event) => {
        if (!comment) {
            event.preventDefault();
            return;
        }
        event.preventDefault();
        alert(comment);
    };
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
    if (typeof window.setDiaryEntries === 'function') {
        return;
    }
    await apiFetch('/api/diary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            entries: [entry]
        })
    });
}

async function loadEntriesFromBackend() {
    if (typeof window.syncDiaryEntriesWithBackend === 'function') {
        const entries = await window.syncDiaryEntriesWithBackend();
        return Array.isArray(entries) ? entries.map(normalizeEntry).filter(Boolean) : [];
    }
    const response = await apiFetch('/api/diary');
    if (!response.ok) {
        return [];
    }
    const data = await response.json();
    const entries = Array.isArray(data?.entries) ? data.entries : [];
    return entries.map(normalizeEntry).filter(Boolean);
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
                carbs_g: Number(entry?.carbs_g) || 0,
                fiber_g: Number(entry?.fiber_g) || 0
            };
        const key = `${entry.date}-${entry.mode}-${entry.meal || ''}-${totals.calories}-${totals.protein_g}-${totals.fat_g}-${totals.carbs_g}-${totals.carbs_simple_g || 0}-${totals.carbs_complex_g || 0}-${totals.fiber_g}-${entry?.items?.length || 0}-${entry?.sleep_time || ''}`;
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
        if (dateKey && hasEntryData(entry)) {
            dates.add(dateKey);
        }
    });
    return Array.from(dates).sort();
}

function getEntryCalories(entry) {
    if (!entry) {
        return 0;
    }
    if (entry.mode === MODE_PRODUCTS || Array.isArray(entry.items)) {
        const totals = entry.totals || calculateTotals(entry.items || []);
        return Number(totals.calories) || 0;
    }
    return Number(entry?.calories) || 0;
}

function hasEntryData(entry) {
    if (!entry) {
        return false;
    }
    const hasItems = Array.isArray(entry.items) && entry.items.length > 0;
    if (entry.mode === MODE_PRODUCTS || hasItems) {
        const calories = getEntryCalories(entry);
        return hasItems || (Number.isFinite(calories) && calories > 0);
    }
    const calories = getEntryCalories(entry);
    return Number.isFinite(calories) && calories > 0;
}

function buildEntriesForAnalysis(entries) {
    const dateSet = new Set();
    entries.forEach((entry) => {
        const dateKey = getDiaryDateKey(entry?.date);
        if (dateKey && hasEntryData(entry)) {
            dateSet.add(dateKey);
        }
    });
    const uniqueDates = Array.from(dateSet).sort();
    const selectedDates = uniqueDates.slice(-MAX_AI_DAYS);
    const selectedSet = new Set(selectedDates);
    const filtered = entries.filter((entry) => {
        if (!hasEntryData(entry)) {
            return false;
        }
        const dateKey = getDiaryDateKey(entry?.date);
        return dateKey ? selectedSet.has(dateKey) : false;
    });
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

function buildDayTotals(dayEntries, allEntries, dateKey) {
    const totals = dayEntries.reduce(
        (acc, entry) => {
            if (entry.mode === MODE_PRODUCTS) {
                const resolvedTotals = entry.totals || calculateTotals(entry.items || []);
                acc.calories += Number(resolvedTotals.calories) || 0;
                acc.protein_g += Number(resolvedTotals.protein_g) || 0;
                acc.fat_g += Number(resolvedTotals.fat_g) || 0;
                acc.carbs_g += Number(resolvedTotals.carbs_g) || 0;
                acc.carbs_simple_g += Number(resolvedTotals.carbs_simple_g) || 0;
                acc.carbs_complex_g += Number(resolvedTotals.carbs_complex_g) || 0;
                acc.fiber_g += Number(resolvedTotals.fiber_g) || 0;
                return acc;
            }
            const resolved = resolveCarbTotals(
                entry.carbs_g ?? 0,
                entry.carbs_simple_g ?? 0,
                entry.carbs_complex_g ?? 0
            );
            acc.calories += Number(entry.calories) || 0;
            acc.protein_g += Number(entry.protein_g) || 0;
            acc.fat_g += Number(entry.fat_g) || 0;
            acc.carbs_g += resolved.total;
            acc.carbs_simple_g += resolved.simple;
            acc.carbs_complex_g += resolved.complex;
            acc.fiber_g += Number(entry.fiber_g) || 0;
            return acc;
        },
        { calories: 0, protein_g: 0, fat_g: 0, carbs_g: 0, carbs_simple_g: 0, carbs_complex_g: 0, fiber_g: 0 }
    );
    const water = dateKey ? getMaxWaterForDate(allEntries, dateKey) : 0;
    const sleepMinutes = dateKey ? getMinSleepForDate(allEntries, dateKey) : null;
    return { totals, water, sleepMinutes };
}

function renderDailySummary(entries, date) {
    const container = document.getElementById('daily-summary');
    if (!container) {
        return;
    }
    const fallbackDate = date || getSelectedDate();
    if (!fallbackDate) {
        container.innerHTML = '<p class="text-slate-400">Выберите дату, чтобы увидеть сводку.</p>';
        return;
    }
    const dayEntries = getEntriesByDate(entries, fallbackDate);
    if (!dayEntries.length) {
        container.innerHTML = '<p class="text-slate-400">Нет записей за выбранный день.</p>';
        return;
    }
    const summary = buildDayTotals(dayEntries, entries, fallbackDate);
    const waterMax = summary.water;
    const sleepMinutes = summary.sleepMinutes;
    const sleepText = sleepMinutes !== null
        ? `${String(Math.floor(sleepMinutes / 60)).padStart(2, '0')}:${String(sleepMinutes % 60).padStart(2, '0')}`
        : '—';
    const totals = summary.totals;
    const activityText = getActivityForDate(dayEntries, fallbackDate) ? 'да' : 'нет';
    container.innerHTML = `
        <div>Всего энергии: ${Math.round(totals.calories)} ккал</div>
        <div>Белки: ${Math.round(totals.protein_g)} г</div>
        <div>Жиры: ${Math.round(totals.fat_g)} г</div>
        <div>${formatCarbSplit(totals)}</div>
        <div>Клетчатка: ${Math.round(totals.fiber_g)} г</div>
        <div>Сон: ${sleepText}</div>
        <div>Вода: ${waterMax.toFixed(1)} л</div>
        <div>Активность: ${activityText}</div>
    `;
}

function renderDayScreen(entries, dateKey) {
    const container = document.getElementById('diary-mode-day');
    const dateInput = document.getElementById('diary-day-date');
    const hint = document.getElementById('diary-day-hint');
    if (!container || !dateInput || !hint) {
        return;
    }
    if (!dateKey) {
        dateInput.value = '';
        hint.textContent = 'Выберите дату и добавьте хотя бы один приём пищи.';
        ['breakfast', 'lunch', 'dinner', 'snack'].forEach((meal) => {
            const list = document.getElementById(`diary-meal-${meal}-list`);
            const total = document.getElementById(`diary-meal-${meal}-total`);
            if (list) {
                list.innerHTML = '<p class="text-slate-400">Выберите дату, чтобы добавить продукты.</p>';
            }
            if (total) {
                total.textContent = '';
            }
        });
        return;
    }

    dateInput.value = dateKey;

    const dayEntries = getEntriesByDate(entries, dateKey);
    const mealEntries = dayEntries.filter((entry) => entry.mode === MODE_PRODUCTS && entry.meal);
    hint.textContent = mealEntries.length
        ? 'Заполняйте приёмы пищи продуктами. Для редактирования используйте кнопку «Редактировать».'
        : 'За эту дату ещё нет приёмов пищи. Нажмите «Добавить» в нужной карточке или кнопку «+».';

    const mealTitles = {
        breakfast: 'завтрак',
        lunch: 'обед',
        dinner: 'ужин',
        snack: 'перекус'
    };

    const renderMealCard = (mealKey) => {
        const list = document.getElementById(`diary-meal-${mealKey}-list`);
        const total = document.getElementById(`diary-meal-${mealKey}-total`);
        if (!list || !total) {
            return;
        }
        const entry = mealEntries.find((item) => item.meal === mealKey) || null;
        if (!entry) {
            list.innerHTML = `
                <p class="text-slate-400">Ничего не добавлено.</p>
                <button type="button" class="text-emerald-600 font-semibold mt-2" data-action="edit-meal" data-meal="${mealKey}">Добавить ${mealTitles[mealKey] || 'приём пищи'}</button>
            `;
            total.textContent = '';
            return;
        }

        const totals = entry.totals || calculateTotals(entry.items || []);
        const carbs = Math.round(Number(totals.carbs_g) || 0);
        total.textContent = `${Math.round(Number(totals.calories) || 0)} ккал`;
        const items = Array.isArray(entry.items) ? entry.items : [];
        list.innerHTML = `
            <div class="space-y-2">
                ${items.map((item) => `
                    <div class="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                        <span>${item.name}</span>
                        <span class="text-xs text-slate-500">${Math.round(Number(item.grams) || 0)} г</span>
                    </div>
                `).join('')}
                <p class="text-xs text-slate-500">Б ${Math.round(Number(totals.protein_g) || 0)} • Ж ${Math.round(Number(totals.fat_g) || 0)} • У ${carbs}</p>
                <button type="button" class="text-emerald-600 font-semibold" data-action="edit-meal" data-meal="${mealKey}">Редактировать</button>
            </div>
        `;
    };

    ['breakfast', 'lunch', 'dinner', 'snack'].forEach(renderMealCard);
}


function updateDayMeta(entries, dateKey, waterValue, sleepValue, activityValue) {
    if (!dateKey) {
        return entries;
    }
    const hasDayEntries = entries.some((entry) => entry.date === dateKey);
    if (!hasDayEntries) {
        return [
            ...entries,
            {
                date: dateKey,
                water_l: Number.isFinite(waterValue) ? waterValue : 0,
                sleep_time: sleepValue || null,
                activity: typeof activityValue === 'boolean' ? activityValue : false
            }
        ];
    }
    return entries.map((entry) => {
        if (entry.date !== dateKey) {
            return entry;
        }
        return {
            ...entry,
            water_l: Number.isFinite(waterValue) ? waterValue : entry.water_l,
            sleep_time: sleepValue || entry.sleep_time,
            activity: typeof activityValue === 'boolean' ? activityValue : entry.activity
        };
    });
}

function persistDayMeta(dateKey, waterValue, sleepValue, activityValue, options = {}) {
    const entries = readDiaryEntries();
    if (!dateKey) {
        return false;
    }
    const hint = options.hintId ? document.getElementById(options.hintId) : null;
    if (hint) {
        hint.textContent = '';
    }
    const updated = updateDayMeta(entries, dateKey, waterValue, sleepValue, activityValue);
    saveDiaryEntries(updated);
    renderDayScreen(updated, dateKey);
    renderDailySummary(updated, dateKey);
    renderDiaryList(updated);
    updateSummaryForm(updated, dateKey);
    updateProductsForm(
        updated,
        dateKey,
        document.getElementById('diary-products-meal')?.value || 'breakfast'
    );
    void refreshDiary();
    return true;
}

function buildFoodItemRow(values = {}) {
    const wrapper = document.createElement('div');
    wrapper.className = 'food-item-row grid grid-cols-1 gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3';

    wrapper.innerHTML = `
        <div class="relative">
            <input type="text" class="form-input" placeholder="Название продукта" value="${values.name || ''}" required data-product-search>
            <div class="absolute left-0 right-0 top-full z-10 mt-1 hidden max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg" data-product-results></div>
        </div>
        <input type="number" class="form-input" placeholder="Граммы" min="1" step="1" value="${values.grams ?? ''}" required data-product-grams>
        <div class="rounded-xl border border-slate-100 bg-white/80 px-3 py-2 text-sm text-slate-600">
            <div class="flex items-center justify-between">
                <span>Белки</span>
                <span class="font-medium text-slate-800" data-nutrition-protein>—</span>
            </div>
            <div class="flex items-center justify-between">
                <span>Жиры</span>
                <span class="font-medium text-slate-800" data-nutrition-fat>—</span>
            </div>
            <div class="flex items-center justify-between">
                <span>Углеводы</span>
                <span class="font-medium text-slate-800" data-nutrition-carbs>—</span>
            </div>
        </div>
        <button type="button" class="self-end text-xs text-rose-500 font-semibold">Удалить продукт</button>
    `;

    const removeButton = wrapper.querySelector('button');
    if (removeButton) {
        removeButton.addEventListener('click', () => {
            wrapper.remove();
        });
    }

    const searchInput = wrapper.querySelector('[data-product-search]');
    const resultsContainer = wrapper.querySelector('[data-product-results]');
    const gramsInput = wrapper.querySelector('[data-product-grams]');

    const gramsValue = Number(values.grams) || 0;
    const fallbackMultiplier = gramsValue > 0 ? 100 / gramsValue : 0;
    const per100 = {
        calories: Number(values.per100_calories) || (fallbackMultiplier ? Number(values.calories) * fallbackMultiplier : 0),
        protein: Number(values.per100_protein) || (fallbackMultiplier ? Number(values.protein) * fallbackMultiplier : 0),
        fat: Number(values.per100_fat) || (fallbackMultiplier ? Number(values.fat) * fallbackMultiplier : 0),
        carbs: Number(values.per100_carbs) || (fallbackMultiplier ? Number(values.carbs) * fallbackMultiplier : 0),
        carbs_simple: Number(values.per100_carbs_simple) || (fallbackMultiplier ? Number(values.carbs_simple) * fallbackMultiplier : 0),
        carbs_complex: Number(values.per100_carbs_complex) || (fallbackMultiplier ? Number(values.carbs_complex) * fallbackMultiplier : 0),
        fiber: Number(values.per100_fiber) || (fallbackMultiplier ? Number(values.fiber) * fallbackMultiplier : 0)
    };

    if (searchInput && resultsContainer) {
        searchInput.addEventListener('input', async () => {
            const query = searchInput.value.trim();
            if (query.length < 2) {
                resultsContainer.classList.add('hidden');
                resultsContainer.innerHTML = '';
                return;
            }
            const data = await requestProductSearch(query);
            renderProductSuggestions(resultsContainer, data, (product) => {
                applyProductSelection(wrapper, product);
            });
        });
    }

    if (gramsInput) {
        gramsInput.addEventListener('input', () => {
            updateItemNutritionFromGrams(wrapper);
        });
    }

    if (values.name && gramsInput) {
        gramsInput.value = values.grams ?? '';
        applyProductSelection(wrapper, {
            name: values.name,
            calories: per100.calories || Number(values.calories) || 0,
            protein_g: per100.protein || Number(values.protein) || 0,
            fat_g: per100.fat || Number(values.fat) || 0,
            carbs_g: per100.carbs || Number(values.carbs) || 0,
            carbs_simple_g: per100.carbs_simple || Number(values.carbs_simple) || 0,
            carbs_complex_g: per100.carbs_complex || Number(values.carbs_complex) || 0,
            fiber_g: per100.fiber || Number(values.fiber) || 0
        }, true);
    }

    return wrapper;
}

function requestProductSearch(query) {
    return fetch(`/api/products/search?q=${encodeURIComponent(query)}`)
        .then((response) => (response.ok ? response.json() : null))
        .catch(() => null);
}

function renderProductSuggestions(container, data, onSelect) {
    container.innerHTML = '';
    if (!data || (!Array.isArray(data.exact) && !Array.isArray(data.similar))) {
        container.classList.add('hidden');
        return;
    }
    const exact = Array.isArray(data.exact) ? data.exact : [];
    const similar = Array.isArray(data.similar) ? data.similar : [];

    const buildSection = (title, items) => {
        if (!items.length) {
            return '';
        }
        const list = items.map((item) => `
            <button type="button" class="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-slate-100" data-product-item>
                <span class="font-medium text-slate-900">${item.name}</span>
                <span class="text-xs text-slate-500">${item.kcal} ккал / 100 г</span>
            </button>
        `).join('');
        return `
            <div class="px-3 py-2 text-xs font-semibold uppercase text-slate-400">${title}</div>
            ${list}
        `;
    };

    const content = `
        ${buildSection('Совпадения', exact)}
        ${exact.length === 0 ? buildSection('Похожие', similar) : ''}
    `;

    container.innerHTML = content;
    const buttons = container.querySelectorAll('[data-product-item]');
    const items = exact.length ? exact : similar;
    buttons.forEach((button, index) => {
        button.addEventListener('click', () => {
            if (typeof onSelect === 'function') {
                onSelect(items[index]);
            }
            container.classList.add('hidden');
        });
    });
    container.classList.toggle('hidden', !content.trim());
}

function applyProductSelection(wrapper, product, skipSearchUpdate = false) {
    if (!product || !wrapper) {
        return;
    }
    const searchInput = wrapper.querySelector('[data-product-search]');
    const gramsInput = wrapper.querySelector('[data-product-grams]');
    if (searchInput && !skipSearchUpdate) {
        searchInput.value = product.name || '';
    }
    const carbsSimple = Number(product.carbs_simple_g ?? product.carbs_simple ?? 0) || 0;
    const carbsComplex = Number(product.carbs_complex_g ?? product.carbs_complex ?? 0) || 0;
    const carbsTotal = Number(product.carbs_g ?? product.carbs ?? 0) || (carbsSimple + carbsComplex);
    wrapper.dataset.productCalories = product.kcal ?? product.calories ?? 0;
    wrapper.dataset.productProtein = product.protein_g ?? product.protein ?? 0;
    wrapper.dataset.productFat = product.fat_g ?? product.fat ?? 0;
    wrapper.dataset.productCarbs = carbsTotal;
    wrapper.dataset.productCarbsSimple = carbsSimple;
    wrapper.dataset.productCarbsComplex = carbsComplex > 0 ? carbsComplex : Math.max(0, carbsTotal - carbsSimple);
    wrapper.dataset.productFiber = product.fiber_g ?? product.fiber ?? 0;
    if (!gramsInput?.value) {
        gramsInput.value = 100;
    }
    updateItemNutritionFromGrams(wrapper);
}

function updateItemNutritionFromGrams(wrapper) {
    const gramsInput = wrapper.querySelector('[data-product-grams]');
    if (!gramsInput) {
        return;
    }
    const grams = Number(gramsInput.value);
    if (!Number.isFinite(grams) || grams <= 0) {
        const resetValue = (selector) => {
            const element = wrapper.querySelector(selector);
            if (element) {
                element.textContent = '—';
            }
        };
        wrapper.dataset.currentCalories = '';
        wrapper.dataset.currentProtein = '';
        wrapper.dataset.currentFat = '';
        wrapper.dataset.currentCarbs = '';
        wrapper.dataset.currentFiber = '';
        resetValue('[data-nutrition-protein]');
        resetValue('[data-nutrition-fat]');
        resetValue('[data-nutrition-carbs]');
        return;
    }
    const per100 = {
        calories: Number(wrapper.dataset.productCalories) || 0,
        protein: Number(wrapper.dataset.productProtein) || 0,
        fat: Number(wrapper.dataset.productFat) || 0,
        carbs: Number(wrapper.dataset.productCarbs) || 0,
        carbs_simple: Number(wrapper.dataset.productCarbsSimple) || 0,
        carbs_complex: Number(wrapper.dataset.productCarbsComplex) || 0,
        fiber: Number(wrapper.dataset.productFiber) || 0
    };
    const multiplier = grams / 100;
    const currentCalories = per100.calories * multiplier;
    const currentProtein = per100.protein * multiplier;
    const currentFat = per100.fat * multiplier;
    const currentCarbs = per100.carbs * multiplier;
    const currentFiber = per100.fiber * multiplier;
    wrapper.dataset.currentCalories = currentCalories.toFixed(1);
    wrapper.dataset.currentProtein = currentProtein.toFixed(1);
    wrapper.dataset.currentFat = currentFat.toFixed(1);
    wrapper.dataset.currentCarbs = currentCarbs.toFixed(1);
    wrapper.dataset.currentFiber = currentFiber.toFixed(1);
    const setDisplayValue = (selector, value, suffix) => {
        const element = wrapper.querySelector(selector);
        if (element) {
            element.textContent = value > 0 ? `${value.toFixed(1)}${suffix}` : '—';
        }
    };
    setDisplayValue('[data-nutrition-protein]', currentProtein, ' г');
    setDisplayValue('[data-nutrition-fat]', currentFat, ' г');
    setDisplayValue('[data-nutrition-carbs]', currentCarbs, ' г');
}

function collectFoodItems(container) {
    const items = [];
    const rows = container.querySelectorAll('.food-item-row');
    rows.forEach((row) => {
        const nameInput = row.querySelector('[data-product-search]');
        const gramsInput = row.querySelector('[data-product-grams]');
        if (!nameInput || !gramsInput) {
            return;
        }
        const name = nameInput.value.trim();
        const grams = Number(gramsInput.value);
        const calories = Number(row.dataset.currentCalories);
        const protein = Number(row.dataset.currentProtein);
        const fat = Number(row.dataset.currentFat);
        const carbs = Number(row.dataset.currentCarbs);
        const per100CarbsSimple = Number(row.dataset.productCarbsSimple) || 0;
        const per100CarbsComplex = Number(row.dataset.productCarbsComplex) || 0;
        const carbsSimple = grams > 0 ? (per100CarbsSimple * grams) / 100 : 0;
        const carbsComplex = grams > 0 ? (per100CarbsComplex * grams) / 100 : 0;
        const fiber = Number(row.dataset.currentFiber);
        if (!name) {
            return;
        }
        items.push({
            name,
            grams: Number.isFinite(grams) ? grams : 0,
            calories: Number.isFinite(calories) ? calories : 0,
            protein: Number.isFinite(protein) ? protein : 0,
            fat: Number.isFinite(fat) ? fat : 0,
            carbs: Number.isFinite(carbs) ? carbs : 0,
            carbs_simple: Number.isFinite(carbsSimple) ? carbsSimple : 0,
            carbs_complex: Number.isFinite(carbsComplex) ? carbsComplex : 0,
            fiber: Number.isFinite(fiber) ? fiber : 0,
            per100_calories: Number(row.dataset.productCalories) || 0,
            per100_protein: Number(row.dataset.productProtein) || 0,
            per100_fat: Number(row.dataset.productFat) || 0,
            per100_carbs: Number(row.dataset.productCarbs) || 0,
            per100_carbs_simple: Number(row.dataset.productCarbsSimple) || 0,
            per100_carbs_complex: Number(row.dataset.productCarbsComplex) || 0,
            per100_fiber: Number(row.dataset.productFiber) || 0
        });
    });
    return items;
}

function getModeFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const rawMode = params.get('mode');
    if (rawMode === MODE_SUMMARY || rawMode === MODE_PRODUCTS || rawMode === MODE_DAY) {
        diaryModeMemory = rawMode === MODE_SUMMARY ? MODE_DAY : rawMode;
        return diaryModeMemory;
    }
    const stored = diaryModeMemory;
    if (stored === MODE_SUMMARY || stored === MODE_PRODUCTS || stored === MODE_DAY) {
        return stored === MODE_SUMMARY ? MODE_DAY : stored;
    }
    return MODE_DAY;
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

function getMealFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const rawMeal = params.get('meal');
    if (!rawMeal) {
        return '';
    }
    return mealLabels[rawMeal] ? rawMeal : '';
}

function setActiveMode(mode) {
    const productsPanel = document.getElementById('diary-products-panel');
    const productsBlock = document.getElementById('diary-mode-products');
    const dayBlock = document.getElementById('diary-mode-day');
    if (dayBlock) {
        dayBlock.classList.toggle('hidden', mode === MODE_PRODUCTS);
    }
    if (productsBlock) {
        productsBlock.classList.toggle('hidden', mode !== MODE_PRODUCTS);
    }
    if (productsPanel) {
        productsPanel.classList.toggle('hidden', mode !== MODE_PRODUCTS);
    }
    diaryModeMemory = mode === MODE_PRODUCTS ? MODE_PRODUCTS : MODE_DAY;

    const params = new URLSearchParams(window.location.search);
    params.set('mode', diaryModeMemory);
    const dateValue = getSelectedDate();
    if (dateValue) {
        params.set('date', dateValue);
    }
    if (diaryModeMemory !== MODE_PRODUCTS) {
        params.delete('meal');
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
    const carbsSimpleInput = document.getElementById('diary-summary-carbs-simple');
    const carbsComplexInput = document.getElementById('diary-summary-carbs-complex');
    const carbsInput = document.getElementById('diary-summary-carbs');
    const fiberInput = document.getElementById('diary-summary-fiber');
    const sleepInput = document.getElementById('diary-summary-sleep');
    const waterInput = document.getElementById('diary-summary-water');
    const activityInput = document.getElementById('diary-summary-activity');
    const deleteButton = document.getElementById('diary-summary-delete');

    if (!caloriesInput || !proteinInput || !fatInput || !carbsSimpleInput || !carbsComplexInput || !carbsInput || !fiberInput || !sleepInput || !waterInput || !activityInput || !deleteButton) {
        return;
    }

    const entry = dateKey ? findSummaryEntry(entries, dateKey) : null;
    if (entry) {
        const resolved = resolveCarbTotals(
            entry.carbs_g ?? 0,
            entry.carbs_simple_g ?? 0,
            entry.carbs_complex_g ?? 0
        );
        caloriesInput.value = entry.calories ?? '';
        proteinInput.value = entry.protein_g ?? '';
        fatInput.value = entry.fat_g ?? '';
        carbsSimpleInput.value = resolved.simple ? resolved.simple.toFixed(1) : '';
        carbsComplexInput.value = resolved.complex ? resolved.complex.toFixed(1) : '';
        carbsInput.value = resolved.total ? resolved.total.toFixed(1) : '';
        fiberInput.value = entry.fiber_g ?? '';
        sleepInput.value = entry.sleep_time ?? '';
        waterInput.value = entry.water_l ?? '';
        activityInput.checked = Boolean(entry.activity);
        deleteButton.classList.remove('hidden');
    } else {
        caloriesInput.value = '';
        proteinInput.value = '';
        fatInput.value = '';
        carbsSimpleInput.value = '';
        carbsComplexInput.value = '';
        carbsInput.value = '';
        fiberInput.value = '';
        sleepInput.value = '';
        waterInput.value = '';
        activityInput.checked = dateKey ? getActivityForDate(entries, dateKey) : false;
        deleteButton.classList.add('hidden');
    }
}

function updateSummaryCarbTotal() {
    const carbsSimpleInput = document.getElementById('diary-summary-carbs-simple');
    const carbsComplexInput = document.getElementById('diary-summary-carbs-complex');
    const carbsInput = document.getElementById('diary-summary-carbs');
    if (!carbsSimpleInput || !carbsComplexInput || !carbsInput) {
        return resolveCarbTotals(0, 0, 0);
    }
    const resolved = resolveCarbTotals(
        Number(carbsInput.value) || 0,
        Number(carbsSimpleInput.value) || 0,
        Number(carbsComplexInput.value) || 0
    );
    carbsInput.value = resolved.total > 0 ? resolved.total.toFixed(1) : '';
    return resolved;
}

function updateProductsForm(entries, dateKey, meal) {
    const itemsContainer = document.getElementById('diary-products-items');
    const deleteButton = document.getElementById('diary-products-delete');
    const waterInput = document.getElementById('diary-products-water');
    const sleepInput = document.getElementById('diary-products-sleep');
    const activityInput = document.getElementById('diary-products-activity');

    if (!itemsContainer || !deleteButton || !waterInput || !sleepInput || !activityInput) {
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

    if (dateKey) {
        waterInput.value = getMaxWaterForDate(entries, dateKey).toFixed(1);
        const sleepMinutes = getMinSleepForDate(entries, dateKey);
        sleepInput.value = sleepMinutes !== null
            ? `${String(Math.floor(sleepMinutes / 60)).padStart(2, '0')}:${String(sleepMinutes % 60).padStart(2, '0')}`
            : '';
        activityInput.checked = getActivityForDate(entries, dateKey);
    } else {
        waterInput.value = '';
        sleepInput.value = '';
        activityInput.checked = false;
    }
}

function bindGlobalDiaryHandlers() {
    if (diaryGlobalHandlersBound) {
        return;
    }
    diaryGlobalHandlersBound = true;

    // Делаем обработчики устойчивыми, чтобы клики не терялись из-за состояния DOM.
    document.addEventListener('click', (event) => {
        const fabToggle = event.target.closest('[data-action="fab-toggle"]');
        if (fabToggle) {
            toggleFabMenu();
            return;
        }

        const fabBackdrop = event.target.closest('#diary-fab-backdrop');
        if (fabBackdrop) {
            closeFabMenu();
            return;
        }

        const fabItem = event.target.closest('[data-fab-action]');
        if (fabItem) {
            const action = fabItem.dataset.fabAction;
            closeFabMenu();
            if (action === 'meal') {
                openProductsForm(getSelectedDate(), fabItem.dataset.meal || 'breakfast');
            }
            if (action === 'water') {
                openProductsForm(getSelectedDate(), 'breakfast');
                setTimeout(() => {
                    const waterInput = document.getElementById('diary-products-water');
                    if (waterInput) {
                        waterInput.focus();
                        waterInput.select();
                    }
                }, 0);
            }
            return;
        }

        const quickWaterButton = event.target.closest('[data-action="quick-water"]');
        if (quickWaterButton) {
            const target = quickWaterButton.dataset.waterTarget;
            const amount = Number(quickWaterButton.dataset.waterAdd);
            const targets = {
                products: {
                    dateInput: document.getElementById('diary-products-date'),
                    waterInput: document.getElementById('diary-products-water'),
                    sleepInput: document.getElementById('diary-products-sleep'),
                    activityInput: document.getElementById('diary-products-activity')
                }
            };
            const config = target ? targets[target] : null;
            if (!config || !config.waterInput || !Number.isFinite(amount) || amount <= 0) {
                return;
            }
            const dateKey = config.dateInput?.value || getSelectedDate();
            const current = Number(config.waterInput.value) || 0;
            const next = Math.round((current + amount) * 100) / 100;
            config.waterInput.value = next.toString();
            const sleepValue = config.sleepInput?.value || '';
            const activityValue = Boolean(config.activityInput?.checked);
            const saved = persistDayMeta(dateKey, next, sleepValue, activityValue, { hintId: config.hintId });
            if (saved && typeof showNotification === 'function') {
                const amountMl = Math.round(amount * 1000);
                showNotification(`Добавлено ${amountMl} мл воды. Сейчас: ${next.toFixed(2)} л.`);
            }
            return;
        }

        const editMealButton = event.target.closest('[data-action="edit-meal"]');
        if (editMealButton) {
            openProductsForm(getSelectedDate(), editMealButton.dataset.meal || 'breakfast');
            return;
        }

        const closeProductsButton = event.target.closest('#diary-products-close');
        if (closeProductsButton) {
            setActiveMode(MODE_DAY);
            return;
        }

        const clearDayButton = event.target.closest('[data-action="clear-day"]');
        if (clearDayButton) {
            const dateKey = getSelectedDate();
            if (!dateKey) {
                return;
            }
            const entries = readDiaryEntries();
            const updated = entries.filter((entry) => entry.date !== dateKey);
            removeHabitEntry(dateKey);
            saveDiaryEntries(updated);
            renderDayScreen(updated, dateKey);
            renderDailySummary(updated, dateKey);
            renderDiaryList(updated);
            void refreshDiary();
            return;
        }

        const addButton = event.target.closest('#diary-add-item');
        if (addButton) {
            const productsItems = document.getElementById('diary-products-items');
            if (productsItems) {
                productsItems.appendChild(buildFoodItemRow());
            }
        }

        const toggleButton = event.target.closest('[data-action="toggle-day"]');
        if (toggleButton) {
            const card = toggleButton.closest('.bg-slate-50');
            const details = card?.querySelector('[data-role="day-details"]');
            if (details) {
                details.classList.toggle('hidden');
            }
            return;
        }

        const deleteButton = event.target.closest('[data-action="delete-entry"]');
        if (deleteButton) {
            event.preventDefault();
            event.stopPropagation();
            const date = deleteButton.dataset.date;
            const mode = deleteButton.dataset.mode;
            const meal = deleteButton.dataset.meal;
            if (!date || !mode) {
                return;
            }
            const entries = readDiaryEntries();
            const updated = entries.filter((entry) => {
                if (entry.date !== date || entry.mode !== mode) {
                    return true;
                }
                if (mode === MODE_PRODUCTS) {
                    return entry.meal !== meal;
                }
                return false;
            });
            if (!updated.some((entry) => entry.date === date)) {
                removeHabitEntry(date);
            }
            saveDiaryEntries(updated);
            renderDiaryList(updated);
            renderDailySummary(updated, getSelectedDate());
            renderDayScreen(updated, getSelectedDate());
            updateSummaryForm(updated, getSelectedDate());
            updateProductsForm(
                updated,
                getSelectedDate(),
                document.getElementById('diary-products-meal')?.value || 'breakfast'
            );
            void refreshDiary();
        }

        const habitToggle = event.target.closest('[data-habit-toggle]');
        if (habitToggle) {
            const dateKey = getSelectedDate();
            const key = habitToggle.dataset.habitKey;
            if (!dateKey || !key) {
                return;
            }
            updateHabitEntry(dateKey, key, habitToggle.checked);
            renderDayScreen(readDiaryEntries(), dateKey);
        }
    });
}

function getSelectedDate() {
    const dayDate = document.getElementById('diary-day-date');
    const productsDate = document.getElementById('diary-products-date');
    const summaryDate = document.getElementById('diary-summary-date');
    if (dayDate && !dayDate.closest('.hidden')) {
        return dayDate.value;
    }
    if (productsDate && !productsDate.closest('.hidden')) {
        return productsDate.value;
    }
    if (summaryDate && !summaryDate.closest('.hidden')) {
        return summaryDate.value;
    }
    return '';
}

function ensureDiaryDate() {
    const dayDate = document.getElementById('diary-day-date');
    if (!dayDate) {
        return '';
    }
    if (!dayDate.value) {
        const today = typeof window.normalizeLocalDate === 'function'
            ? window.normalizeLocalDate(new Date())
            : new Date().toISOString().split('T')[0];
        dayDate.value = today || '';
    }
    return dayDate.value;
}

function openProductsForm(dateKey, mealKey) {
    const dateValue = dateKey || ensureDiaryDate();
    setActiveMode(MODE_PRODUCTS);
    const productsDate = document.getElementById('diary-products-date');
    if (productsDate && dateValue) {
        productsDate.value = dateValue;
    }
    const mealSelect = document.getElementById('diary-products-meal');
    if (mealSelect && mealKey) {
        mealSelect.value = mealKey;
    }
    updateProductsForm(
        readDiaryEntries(),
        dateValue,
        mealSelect?.value || mealKey || 'breakfast'
    );
}

function closeFabMenu() {
    const menu = document.getElementById('diary-fab-menu');
    const backdrop = document.getElementById('diary-fab-backdrop');
    menu?.classList.add('hidden');
    backdrop?.classList.add('hidden');
}

function toggleFabMenu() {
    const menu = document.getElementById('diary-fab-menu');
    const backdrop = document.getElementById('diary-fab-backdrop');
    if (!menu || !backdrop) {
        return;
    }
    const isHidden = menu.classList.contains('hidden');
    menu.classList.toggle('hidden', !isHidden);
    backdrop.classList.toggle('hidden', !isHidden);
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
    if (getModeFromUrl() === MODE_DAY) {
        renderDayScreen(merged, selectedDate);
    }

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
        renderDeviationRisk(
            null,
            `Нужно минимум ${MIN_AI_DAYS} дней. Сейчас: ${uniqueDatesCount}.`
        );
        updateProfileDeviation(null, null);
        setDiaryLoadingState(false);
        return;
    }
    const analysis = await requestAiAnalysis(filtered);
    if (analysis?.text) {
        if (typeof analysis.text === 'string') {
            setAiComment([analysis.text], '', null, null);
        } else {
            setAiComment(analysis.text.insights, analysis.text.advice, MIN_AI_DAYS, uniqueDatesCount);
        }
        renderDeviationRisk(analysis.deviation_risk, analysis.deviation_comment);
        updateProfileDeviation(analysis.deviation_risk, analysis.deviation_comment);
    } else {
        setAiComment([], '', MIN_AI_DAYS, uniqueDatesCount);
        renderDeviationRisk(
            null,
            `Нужно минимум ${MIN_AI_DAYS} дней. Сейчас: ${uniqueDatesCount}.`
        );
        updateProfileDeviation(null, null);
    }
    setDiaryLoadingState(false);
}

async function initDiary() {
    if (diaryInitialized) {
        return;
    }
    diaryInitialized = true;

    bindGlobalDiaryHandlers();
    const productsForm = document.getElementById('diary-products-form');
    const productsDate = document.getElementById('diary-products-date');
    const dayDate = document.getElementById('diary-day-date');
    const productsItems = document.getElementById('diary-products-items');
    const addItemButton = document.getElementById('diary-add-item');
    const deleteProductsButton = document.getElementById('diary-products-delete');
    const initialDate = getDateFromUrl();
    const initialMode = getModeFromUrl();
    const initialMeal = getMealFromUrl();
    const params = new URLSearchParams(window.location.search);
    const openFabOnLoad = params.get('fab') === '1';

    setActiveMode(initialMode);

    const resolvedDate = initialDate || ensureDiaryDate();
    if (productsDate) {
        productsDate.value = resolvedDate;
    }
    if (dayDate) {
        dayDate.value = resolvedDate;
    }

    if (initialMeal) {
        const mealSelect = document.getElementById('diary-products-meal');
        if (mealSelect) {
            mealSelect.value = initialMeal;
        }
    }

    if (typeof window.syncProfileWithBackend === 'function') {
        await window.syncProfileWithBackend();
    }

    updateProductsForm(
        readDiaryEntries(),
        resolvedDate,
        document.getElementById('diary-products-meal')?.value || 'breakfast'
    );
    renderDayScreen(readDiaryEntries(), resolvedDate);

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
            const water = Number(document.getElementById('diary-products-water')?.value);
            const sleepTime = document.getElementById('diary-products-sleep')?.value || null;
            const activity = Boolean(document.getElementById('diary-products-activity')?.checked);
            const entry = normalizeEntry({
                date,
                mode: MODE_PRODUCTS,
                meal,
                items,
                totals,
                water_l: Number.isFinite(water) ? water : 0,
                sleep_time: sleepTime,
                activity
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
            setActiveMode(MODE_DAY);
            closeFabMenu();
            if (typeof showNotification === 'function') {
                showNotification('Приём пищи сохранён.');
            }
        });
    }

    const handleDateChange = () => {
        const entries = readDiaryEntries();
        const selected = getSelectedDate();
        renderDailySummary(entries, selected);
        renderDayScreen(entries, selected);
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
            if (currentMode === MODE_PRODUCTS) {
                const meal = document.getElementById('diary-products-meal')?.value;
                if (meal) {
                    params.set('meal', meal);
                }
            }
            window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
        }
    };

    if (productsDate) {
        productsDate.addEventListener('change', handleDateChange);
    }
    if (dayDate) {
        dayDate.addEventListener('change', handleDateChange);
    }
    const mealSelect = document.getElementById('diary-products-meal');
    if (mealSelect) {
        mealSelect.addEventListener('change', () => {
            updateProductsForm(
                readDiaryEntries(),
                getSelectedDate(),
                mealSelect.value
            );
            const params = new URLSearchParams(window.location.search);
            params.set('mode', getModeFromUrl());
            const dateValue = getSelectedDate();
            if (dateValue) {
                params.set('date', dateValue);
            }
            if (mealSelect.value) {
                params.set('meal', mealSelect.value);
            }
            window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
        });
    }

    if (deleteProductsButton) {
        deleteProductsButton.addEventListener('click', async () => {
            const productsDateValue = productsDate?.value;
            const dateKey = getDiaryDateKey(productsDateValue);
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

    renderDailySummary(readDiaryEntries(), resolvedDate);
    renderDayScreen(readDiaryEntries(), resolvedDate);

    if (openFabOnLoad) {
        // Всегда возвращаем режим дня, чтобы сначала показывать именно FAB-меню,
        // а не форму добавления продуктов.
        setActiveMode(MODE_DAY);
        toggleFabMenu();
        params.delete('fab');
        const next = params.toString();
        const nextUrl = next ? `${window.location.pathname}?${next}` : window.location.pathname;
        window.history.replaceState({}, '', nextUrl);
    }

    void refreshDiary();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        void initDiary();
    });
} else {
    void initDiary();
}

window.addEventListener('load', () => {
    void initDiary();
});
