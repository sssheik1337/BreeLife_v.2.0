const DIARY_STORAGE_KEY = window.DIARY_STORAGE_KEY || 'bree_diary_entries';
const HABITS_STORAGE_KEY = 'bree_habits';

let diaryInitialized = false;
let diaryGlobalHandlersBound = false;
let diaryEntriesMemory = [];
let habitsEntriesMemory = [];
let dayMetaEntriesMemory = [];

const MODE_PRODUCTS = 'products';
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

function readDayMetaEntries() {
    if (typeof window.getDayMetaEntries === 'function') {
        return window.getDayMetaEntries();
    }
    return Array.isArray(dayMetaEntriesMemory) ? dayMetaEntriesMemory : [];
}

function saveDayMetaEntries(entries) {
    if (typeof window.setDayMetaEntries === 'function') {
        window.setDayMetaEntries(entries);
        return;
    }
    dayMetaEntriesMemory = Array.isArray(entries) ? entries : [];
}

function normalizeEntry(entry) {
    if (!entry || !entry.date) {
        return null;
    }
    const mode = entry.mode === MODE_PRODUCTS || Array.isArray(entry.items)
        ? MODE_PRODUCTS
        : null;
    const dateKey = typeof window.normalizeLocalDate === 'function'
        ? window.normalizeLocalDate(entry.date)
        : entry.date;
    if (!dateKey) {
        return null;
    }
    if (!mode) {
        return null;
    }
    const items = Array.isArray(entry.items) ? entry.items : [];
    const totals = entry.totals
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
        : calculateTotals(items);
    return {
        date: dateKey,
        mode,
        meal: entry.meal || null,
        items,
        totals
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

function getDayMetaForDate(entries, dateKey) {
    if (!dateKey) {
        return { water_ml: 0, sleep_hours: null, activity_flag: false };
    }
    const entry = entries.find((item) => item?.date === dateKey);
    return {
        water_ml: Number(entry?.water_ml) || 0,
        sleep_hours: Number.isFinite(entry?.sleep_hours) ? entry.sleep_hours : null,
        activity_flag: Boolean(entry?.activity_flag)
    };
}

function getDayMetaSnapshot(dateKey) {
    const meta = getDayMetaForDate(readDayMetaEntries(), dateKey);
    return {
        waterLiters: meta.water_ml > 0 ? meta.water_ml / 1000 : 0,
        sleepHours: Number.isFinite(meta.sleep_hours) ? meta.sleep_hours : null,
        activityFlag: Boolean(meta.activity_flag)
    };
}

function persistDayMetaWithExisting(dateKey, values, options = {}) {
    if (!dateKey) {
        return false;
    }
    const snapshot = getDayMetaSnapshot(dateKey);
    const waterValue = Number.isFinite(values?.waterLiters) ? values.waterLiters : snapshot.waterLiters;
    const sleepHours = Number.isFinite(values?.sleepHours) ? values.sleepHours : snapshot.sleepHours;
    const sleepValue = sleepHours !== null ? formatSleepHours(sleepHours) : '';
    const activityValue = typeof values?.activityFlag === 'boolean' ? values.activityFlag : snapshot.activityFlag;
    return persistDayMeta(dateKey, waterValue, sleepValue, activityValue, options);
}

function formatSleepHours(hours) {
    if (!Number.isFinite(hours) || hours < 0) {
        return '';
    }
    const totalMinutes = Math.round(hours * 60);
    const safeMinutes = Math.min(Math.max(totalMinutes, 0), 23 * 60 + 59);
    const hh = String(Math.floor(safeMinutes / 60)).padStart(2, '0');
    const mm = String(safeMinutes % 60).padStart(2, '0');
    return `${hh}:${mm}`;
}

function parseSleepHours(value) {
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
    return hours + minutes / 60;
}

function parseTimeToMinutes(value) {
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

function addDaysToDate(dateKey, daysToAdd) {
    if (!dateKey) {
        return '';
    }
    const [year, month, day] = dateKey.split('-').map((value) => Number(value));
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
        return '';
    }
    const date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCDate(date.getUTCDate() + daysToAdd);
    return date.toISOString().slice(0, 10);
}

function formatShortDate(dateKey) {
    if (!dateKey) {
        return '';
    }
    const [year, month, day] = dateKey.split('-').map((value) => Number(value));
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
        return '';
    }
    return `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}`;
}

function calculateSleepDuration(dateKey, startTime, endTime) {
    const startMinutes = parseTimeToMinutes(startTime);
    const endMinutes = parseTimeToMinutes(endTime);
    if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes)) {
        return null;
    }
    let durationMinutes = endMinutes - startMinutes;
    let endDateKey = dateKey;
    if (durationMinutes <= 0) {
        durationMinutes += 24 * 60;
        endDateKey = addDaysToDate(dateKey, 1);
    }
    return {
        durationMinutes,
        durationHours: durationMinutes / 60,
        endDateKey
    };
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
    const sleepTargetMinutes = parseSleepMinutes(window.adminConfig?.reminders?.sleep_target);
    const sleepTargetHours = sleepTargetMinutes !== null ? sleepTargetMinutes / 60 : null;
    const dayEntries = getEntriesByDate(entries, dateKey);
    const dayMeta = getDayMetaForDate(readDayMetaEntries(), dateKey);
    const waterValue = dayMeta.water_ml / 1000;
    const sleepValue = dayMeta.sleep_hours;
    const activityValue = dayMeta.activity_flag;
    const hasDiary = dayEntries.length > 0;
    const waterOk = Number.isFinite(waterTarget) && waterTarget > 0 ? waterValue >= waterTarget : waterValue > 0;
    const sleepOk = sleepValue !== null ? (sleepTargetHours !== null ? sleepValue <= sleepTargetHours : true) : false;
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

function renderDiaryList(entries) {
    const list = document.getElementById('diary-list');
    if (!list) {
        return;
    }
    list.innerHTML = '';
    const dayMetaEntries = readDayMetaEntries();
    const dayMetaDates = dayMetaEntries
        .filter((entry) => entry?.date && (Number(entry?.water_ml) > 0 || Number.isFinite(entry?.sleep_hours) || entry?.activity_flag))
        .map((entry) => entry.date);
    if (!entries.length && !dayMetaDates.length) {
        list.innerHTML = '<p class="text-slate-400">Пока нет записей.</p>';
        return;
    }
    const entriesSorted = sortEntries(entries);
    const uniqueDates = Array.from(new Set([...entriesSorted.map((entry) => entry.date).filter(Boolean), ...dayMetaDates]));
    uniqueDates.sort((a, b) => (b || '').localeCompare(a || ''));
    const visibleDates = uniqueDates.slice(0, diaryListLimit);
    const visibleEntries = entriesSorted.filter((entry) => visibleDates.includes(entry.date));
    const groupedByDate = new Map();
    const dayMetaMap = new Map(dayMetaEntries.map((entry) => [entry.date, entry]));
    visibleEntries.forEach((entry) => {
        if (!entry?.date) {
            return;
        }
        const totals = entry.totals || calculateTotals(entry.items || []);
        const existing = groupedByDate.get(entry.date) || {
            date: entry.date,
            calories: 0,
            protein_g: 0,
            fat_g: 0,
            carbs_g: 0,
            carbs_simple_g: 0,
            carbs_complex_g: 0,
            fiber_g: 0,
            sleep_hours: null,
            entriesCount: 0
        };
        existing.calories += Number(totals.calories) || 0;
        existing.protein_g += Number(totals.protein_g) || 0;
        existing.fat_g += Number(totals.fat_g) || 0;
        existing.carbs_g += Number(totals.carbs_g) || 0;
        existing.carbs_simple_g += Number(totals.carbs_simple_g) || 0;
        existing.carbs_complex_g += Number(totals.carbs_complex_g) || 0;
        existing.fiber_g += Number(totals.fiber_g) || 0;
        existing.entriesCount += 1;
        groupedByDate.set(entry.date, existing);
    });
    visibleDates.forEach((date) => {
        const summary = groupedByDate.get(date) || {
            date,
            calories: 0,
            protein_g: 0,
            fat_g: 0,
            carbs_g: 0,
            carbs_simple_g: 0,
            carbs_complex_g: 0,
            fiber_g: 0,
            entriesCount: 0
        };
        const meta = dayMetaMap.get(date);
        const waterValue = Number(meta?.water_ml) ? Number(meta.water_ml) / 1000 : 0;
        const sleepValue = Number.isFinite(meta?.sleep_hours) ? meta.sleep_hours : null;
        const dayEntries = entriesSorted.filter((entry) => entry.date === date);
        const item = document.createElement('div');
        item.className = 'bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-2';
        const waterLine = waterValue > 0
            ? `<div class="text-slate-500">Вода: ${waterValue.toFixed(1)} л</div>`
            : '';
        const sleepLine = sleepValue !== null
            ? `<div class="text-slate-500">Сон: ${formatSleepHours(sleepValue)}</div>`
            : '';
        const entriesMarkup = dayEntries.map((entry) => {
            const mealLabel = mealLabels[entry.meal] || 'Приём пищи';
            const totals = entry.totals || calculateTotals(entry.items || []);
            const mealParam = entry.meal ? `&meal=${entry.meal}` : '';
            const editUrl = `/diary?date=${entry.date}${mealParam}`;
            return `
                <div class="rounded-xl border border-slate-100 bg-white p-3 space-y-2">
                    <div class="flex items-center justify-between">
                        <span class="text-xs text-slate-500">${mealLabel}</span>
                        <div class="flex items-center gap-2">
                            <a href="/diary?date=${entry.date}" class="text-xs text-slate-500 font-semibold">Открыть день</a>
                            <a href="${editUrl}" class="text-xs text-emerald-600 font-semibold">Редактировать</a>
                            <button type="button" class="text-xs text-rose-500 font-semibold" data-action="delete-entry" data-date="${entry.date}" data-meal="${entry.meal || ''}">
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
                <a href="/diary?date=${summary.date}" class="text-xs text-emerald-600 font-semibold">Открыть день целиком</a>
            </div>
            <div class="hidden" data-role="day-details">
                <div class="mt-2 space-y-2">
                    ${entriesMarkup || '<p class="text-xs text-slate-400">Нет приёмов пищи.</p>'}
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
    const profile = typeof getUserProfile === 'function' ? getUserProfile() : null;
    if (!profile?.telegram_user_id) {
        return;
    }
    await fetch('/api/diary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            telegram_user_id: profile.telegram_user_id,
            entries: [entry]
        })
    });
}

async function loadEntriesFromBackend() {
    if (typeof window.syncDiaryEntriesWithBackend === 'function') {
        const entries = await window.syncDiaryEntriesWithBackend();
        return Array.isArray(entries) ? entries.map(normalizeEntry).filter(Boolean) : [];
    }
    const profile = typeof getUserProfile === 'function' ? getUserProfile() : null;
    if (!profile?.telegram_user_id) {
        return [];
    }
    const response = await fetch(`/api/diary?telegram_user_id=${profile.telegram_user_id}`);
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
        const totals = entry.totals || calculateTotals(entry.items || []);
        return {
            date: entry.date,
            mode: MODE_PRODUCTS,
            calories: totals.calories,
            protein_g: totals.protein_g,
            fat_g: totals.fat_g,
            carbs_g: totals.carbs_g
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
        const totals = entry?.totals || calculateTotals(entry?.items || []);
        const key = `${entry.date}-${entry.mode}-${entry.meal || ''}-${totals.calories}-${totals.protein_g}-${totals.fat_g}-${totals.carbs_g}-${totals.carbs_simple_g || 0}-${totals.carbs_complex_g || 0}-${totals.fiber_g}-${entry?.items?.length || 0}`;
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
    const totals = entry.totals || calculateTotals(entry.items || []);
    return Number(totals.calories) || 0;
}

function hasEntryData(entry) {
    if (!entry) {
        return false;
    }
    const hasItems = Array.isArray(entry.items) && entry.items.length > 0;
    const calories = getEntryCalories(entry);
    return hasItems || (Number.isFinite(calories) && calories > 0);
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
            const resolvedTotals = entry.totals || calculateTotals(entry.items || []);
            acc.calories += Number(resolvedTotals.calories) || 0;
            acc.protein_g += Number(resolvedTotals.protein_g) || 0;
            acc.fat_g += Number(resolvedTotals.fat_g) || 0;
            acc.carbs_g += Number(resolvedTotals.carbs_g) || 0;
            acc.carbs_simple_g += Number(resolvedTotals.carbs_simple_g) || 0;
            acc.carbs_complex_g += Number(resolvedTotals.carbs_complex_g) || 0;
            acc.fiber_g += Number(resolvedTotals.fiber_g) || 0;
            return acc;
        },
        { calories: 0, protein_g: 0, fat_g: 0, carbs_g: 0, carbs_simple_g: 0, carbs_complex_g: 0, fiber_g: 0 }
    );
    const dayMeta = dateKey ? getDayMetaForDate(readDayMetaEntries(), dateKey) : { water_ml: 0, sleep_hours: null };
    return { totals, water: dayMeta.water_ml / 1000, sleepHours: dayMeta.sleep_hours };
}

function renderDayScreen(entries, dateKey) {
    const container = document.getElementById('diary-mode-day');
    const dateInput = document.getElementById('diary-day-date');
    const waterInput = document.getElementById('diary-day-water');
    const sleepInput = document.getElementById('diary-day-sleep');
    const activityInput = document.getElementById('diary-day-activity');
    const caloriesEl = document.getElementById('diary-day-summary-calories');
    const macrosEl = document.getElementById('diary-day-summary-macros');
    const waterEl = document.getElementById('diary-day-summary-water');
    const sleepEl = document.getElementById('diary-day-summary-sleep');
    const waterTotal = document.getElementById('diary-water-total');
    const hint = document.getElementById('diary-day-hint');
    if (!container || !dateInput || !waterInput || !sleepInput || !activityInput || !hint) {
        return;
    }
    if (!dateKey) {
        dateInput.value = '';
        hint.textContent = 'Выберите дату, чтобы управлять днём.';
        if (caloriesEl) {
            caloriesEl.textContent = '—';
        }
        if (macrosEl) {
            macrosEl.textContent = '—';
        }
        if (waterEl) {
            waterEl.textContent = '—';
        }
        if (sleepEl) {
            sleepEl.textContent = '—';
        }
        if (waterTotal) {
            waterTotal.textContent = '';
        }
        waterInput.value = '';
        sleepInput.value = '';
        activityInput.checked = false;
        ['breakfast', 'lunch', 'dinner', 'snack'].forEach((meal) => {
            const list = document.getElementById(`diary-meal-${meal}-list`);
            const total = document.getElementById(`diary-meal-${meal}-total`);
            if (list) {
                list.innerHTML = '<p class="text-sm text-slate-400">Ничего не добавлено.</p>';
            }
            if (total) {
                total.textContent = '';
            }
        });
        return;
    }
    dateInput.value = dateKey;
    const dayEntries = getEntriesByDate(entries, dateKey);
    const dayMeta = getDayMetaForDate(readDayMetaEntries(), dateKey);
    const waterLiters = dayMeta.water_ml > 0 ? dayMeta.water_ml / 1000 : 0;
    waterInput.value = waterLiters > 0 ? waterLiters.toFixed(1) : '';
    sleepInput.value = dayMeta.sleep_hours !== null ? formatSleepHours(dayMeta.sleep_hours) : '';
    activityInput.checked = dayMeta.activity_flag;
    hint.textContent = dayEntries.length
        ? 'Изменения сохраняются сразу для выбранной даты.'
        : 'За этот день пока нет записей. Добавьте приём пищи или воду.';

    if (waterTotal) {
        waterTotal.textContent = waterLiters > 0 ? `${waterLiters.toFixed(1)} л` : '';
    }

    const summary = buildDayTotals(dayEntries, entries, dateKey);
    const totals = summary.totals;
    if (caloriesEl) {
        caloriesEl.textContent = dayEntries.length ? `${Math.round(totals.calories)} ккал` : '—';
    }
    if (macrosEl) {
        macrosEl.textContent = dayEntries.length
            ? `Б ${Math.round(totals.protein_g)} · Ж ${Math.round(totals.fat_g)} · У ${Math.round(totals.carbs_g)}`
            : '—';
    }
    if (waterEl) {
        waterEl.textContent = waterLiters > 0 ? `${waterLiters.toFixed(1)} л` : '—';
    }
    if (sleepEl) {
        sleepEl.textContent = dayMeta.sleep_hours !== null
            ? formatSleepHours(dayMeta.sleep_hours)
            : '—';
    }

    const renderMealCard = (mealKey) => {
        const list = document.getElementById(`diary-meal-${mealKey}-list`);
        const total = document.getElementById(`diary-meal-${mealKey}-total`);
        if (!list || !total) {
            return;
        }
        const entry = findProductsEntry(entries, dateKey, mealKey);
        if (!entry) {
            list.innerHTML = '<p class="text-sm text-slate-400">Ничего не добавлено.</p>';
            total.textContent = '';
            return;
        }
        const totals = entry.totals || calculateTotals(entry.items || []);
        total.textContent = `${Math.round(totals.calories)} ккал`;
        const itemsMarkup = Array.isArray(entry.items) && entry.items.length
            ? entry.items.map((item) => `
                <div class="flex items-center justify-between">
                    <span>${item?.name || 'Без названия'}</span>
                    <span class="text-xs text-slate-400">${Math.round(item?.calories || 0)} ккал</span>
                </div>
            `).join('')
            : '<p class="text-sm text-slate-400">Список продуктов не заполнен.</p>';
        list.innerHTML = `
            <div class="space-y-2">${itemsMarkup}</div>
            <div class="mt-3 flex items-center gap-3 text-xs">
                <button type="button" class="text-emerald-600 font-semibold" data-action="edit-meal" data-meal="${mealKey}">Редактировать</button>
                <button type="button" class="text-rose-500 font-semibold" data-action="delete-entry" data-date="${entry.date}" data-meal="${mealKey}">Удалить</button>
            </div>
        `;
    };

    ['breakfast', 'lunch', 'dinner', 'snack'].forEach(renderMealCard);
}

function updateDayMeta(entries, dateKey, waterValue, sleepValue, activityValue) {
    if (!dateKey) {
        return entries;
    }
    const waterMl = Number.isFinite(waterValue) ? Math.max(0, Math.round(waterValue * 1000)) : 0;
    const sleepHours = sleepValue ? parseSleepHours(sleepValue) : null;
    const next = Array.isArray(entries) ? [...entries] : [];
    const index = next.findIndex((entry) => entry.date === dateKey);
    const payload = {
        date: dateKey,
        water_ml: waterMl,
        sleep_hours: sleepHours,
        activity_flag: typeof activityValue === 'boolean' ? activityValue : false
    };
    if (index >= 0) {
        next[index] = { ...next[index], ...payload };
    } else {
        next.push(payload);
    }
    return next;
}

function persistDayMeta(dateKey, waterValue, sleepValue, activityValue, options = {}) {
    const dayMetaEntries = readDayMetaEntries();
    if (!dateKey) {
        return false;
    }
    const hint = options.hintId ? document.getElementById(options.hintId) : null;
    if (hint) {
        hint.textContent = '';
    }
    const updatedMeta = updateDayMeta(dayMetaEntries, dateKey, waterValue, sleepValue, activityValue);
    saveDayMetaEntries(updatedMeta);
    const diaryEntries = readDiaryEntries();
    renderDayScreen(diaryEntries, dateKey);
    renderDiaryList(diaryEntries);
    updateProductsForm(
        diaryEntries,
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
        <div class="rounded-xl border border-slate-100 bg-white px-3 py-2 text-sm text-slate-600" data-product-summary>
            Выберите продукт и укажите граммы, чтобы увидеть сводку.
        </div>
        <button type="button" class="text-sm text-rose-500 font-semibold">Удалить продукт</button>
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
    const summary = wrapper.querySelector('[data-product-summary]');
    if (!gramsInput) {
        return;
    }
    const grams = Number(gramsInput.value);
    if (!Number.isFinite(grams) || grams <= 0) {
        if (summary) {
            summary.textContent = 'Укажите граммы, чтобы увидеть сводку.';
        }
        wrapper.dataset.productCaloriesValue = '0';
        wrapper.dataset.productProteinValue = '0';
        wrapper.dataset.productFatValue = '0';
        wrapper.dataset.productCarbsValue = '0';
        wrapper.dataset.productFiberValue = '0';
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
    const totals = {
        calories: per100.calories * multiplier,
        protein: per100.protein * multiplier,
        fat: per100.fat * multiplier,
        carbs: per100.carbs * multiplier,
        fiber: per100.fiber * multiplier
    };
    wrapper.dataset.productCaloriesValue = totals.calories.toFixed(1);
    wrapper.dataset.productProteinValue = totals.protein.toFixed(1);
    wrapper.dataset.productFatValue = totals.fat.toFixed(1);
    wrapper.dataset.productCarbsValue = totals.carbs.toFixed(1);
    wrapper.dataset.productFiberValue = totals.fiber.toFixed(1);
    if (summary) {
        const lines = [];
        if (totals.calories > 0) {
            lines.push(`Ккал: ${Math.round(totals.calories)}`);
        }
        if (totals.protein > 0) {
            lines.push(`Белки: ${totals.protein.toFixed(1)} г`);
        }
        if (totals.fat > 0) {
            lines.push(`Жиры: ${totals.fat.toFixed(1)} г`);
        }
        if (totals.carbs > 0) {
            lines.push(`Углеводы: ${totals.carbs.toFixed(1)} г`);
        }
        if (totals.fiber > 0) {
            lines.push(`Клетчатка: ${totals.fiber.toFixed(1)} г`);
        }
        summary.textContent = lines.length ? lines.join(' · ') : 'Нет данных по БЖУ для этого продукта.';
    }
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
        const calories = Number(row.dataset.productCaloriesValue) || 0;
        const protein = Number(row.dataset.productProteinValue) || 0;
        const fat = Number(row.dataset.productFatValue) || 0;
        const carbs = Number(row.dataset.productCarbsValue) || 0;
        const per100CarbsSimple = Number(row.dataset.productCarbsSimple) || 0;
        const per100CarbsComplex = Number(row.dataset.productCarbsComplex) || 0;
        const carbsSimple = grams > 0 ? (per100CarbsSimple * grams) / 100 : 0;
        const carbsComplex = grams > 0 ? (per100CarbsComplex * grams) / 100 : 0;
        const fiber = Number(row.dataset.productFiberValue) || 0;
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

function findProductsEntry(entries, dateKey, meal) {
    return entries.find((entry) => entry.mode === MODE_PRODUCTS && entry.date === dateKey && entry.meal === meal) || null;
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
            } else if (action === 'water') {
                openWaterPanel(getSelectedDate());
            } else if (action === 'sleep') {
                openSleepPanel(getSelectedDate());
            }
            return;
        }

        const quickWaterButton = event.target.closest('[data-action="quick-water"]');
        if (quickWaterButton) {
            const target = quickWaterButton.dataset.waterTarget;
            const amount = Number(quickWaterButton.dataset.waterAdd);
            const targets = {
                day: {
                    dateInput: document.getElementById('diary-day-date'),
                    waterInput: document.getElementById('diary-day-water'),
                    sleepInput: document.getElementById('diary-day-sleep'),
                    activityInput: document.getElementById('diary-day-activity'),
                    hintId: 'diary-day-hint'
                },
                panel: {
                    dateInput: document.getElementById('diary-water-date'),
                    waterInput: document.getElementById('diary-water-amount'),
                    hintId: 'diary-water-hint'
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
            if (target === 'day') {
                const sleepValue = config.sleepInput?.value || '';
                const activityValue = Boolean(config.activityInput?.checked);
                persistDayMeta(dateKey, next, sleepValue, activityValue, { hintId: config.hintId });
            } else {
                persistDayMetaWithExisting(dateKey, { waterLiters: next }, { hintId: config.hintId });
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
            closeProductsPanel();
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
            const dayMetaEntries = readDayMetaEntries();
            const updatedMeta = dayMetaEntries.filter((entry) => entry.date !== dateKey);
            saveDayMetaEntries(updatedMeta);
            saveDiaryEntries(updated);
            renderDayScreen(updated, dateKey);
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
            const meal = deleteButton.dataset.meal;
            if (!date) {
                return;
            }
            const entries = readDiaryEntries();
            const updated = entries.filter((entry) => !(entry.date === date && entry.meal === meal));
            saveDiaryEntries(updated);
            renderDiaryList(updated);
            renderDayScreen(updated, getSelectedDate());
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
    if (dayDate && !dayDate.closest('.hidden')) {
        return dayDate.value;
    }
    if (productsDate && !productsDate.closest('.hidden')) {
        return productsDate.value;
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

function openProductsPanel() {
    const panel = document.getElementById('diary-products-panel');
    if (panel) {
        panel.classList.remove('hidden');
    }
}

function closeProductsPanel() {
    const panel = document.getElementById('diary-products-panel');
    if (panel) {
        panel.classList.add('hidden');
    }
    const params = new URLSearchParams(window.location.search);
    if (params.has('meal')) {
        params.delete('meal');
        const next = params.toString();
        const nextUrl = next ? `${window.location.pathname}?${next}` : window.location.pathname;
        window.history.replaceState({}, '', nextUrl);
    }
}

function openWaterPanel(dateKey) {
    const panel = document.getElementById('diary-water-panel');
    const dateInput = document.getElementById('diary-water-date');
    const waterInput = document.getElementById('diary-water-amount');
    const hint = document.getElementById('diary-water-hint');
    const resolvedDate = dateKey || ensureDiaryDate();
    if (dateInput && resolvedDate) {
        dateInput.value = resolvedDate;
    }
    if (waterInput) {
        const snapshot = getDayMetaSnapshot(resolvedDate);
        waterInput.value = snapshot.waterLiters > 0 ? snapshot.waterLiters.toFixed(2) : '';
    }
    if (hint) {
        hint.textContent = 'Добавьте воду и сохраните, чтобы обновить дневник.';
    }
    panel?.classList.remove('hidden');
}

function closeWaterPanel() {
    const panel = document.getElementById('diary-water-panel');
    panel?.classList.add('hidden');
}

function updateSleepPanelSummary() {
    const dateInput = document.getElementById('diary-sleep-date');
    const startInput = document.getElementById('diary-sleep-start');
    const endInput = document.getElementById('diary-sleep-end');
    const summary = document.getElementById('diary-sleep-summary');
    if (!summary) {
        return;
    }
    const dateKey = dateInput?.value;
    const startTime = startInput?.value;
    const endTime = endInput?.value;
    if (!dateKey || !startTime || !endTime) {
        summary.textContent = 'Укажите время начала и окончания сна.';
        return;
    }
    const result = calculateSleepDuration(dateKey, startTime, endTime);
    if (!result) {
        summary.textContent = 'Не удалось рассчитать сон. Проверьте время.';
        return;
    }
    const hours = Math.floor(result.durationMinutes / 60);
    const minutes = Math.round(result.durationMinutes % 60);
    const durationLabel = minutes ? `${hours} ч ${minutes} мин` : `${hours} ч`;
    const endDateLabel = result.endDateKey && result.endDateKey !== dateKey
        ? `Окончание: ${formatShortDate(result.endDateKey)}.`
        : 'Окончание в тот же день.';
    summary.textContent = `Длительность: ${durationLabel}. ${endDateLabel}`;
}

function openSleepPanel(dateKey) {
    const panel = document.getElementById('diary-sleep-panel');
    const dateInput = document.getElementById('diary-sleep-date');
    const startInput = document.getElementById('diary-sleep-start');
    const endInput = document.getElementById('diary-sleep-end');
    const hint = document.getElementById('diary-sleep-hint');
    const resolvedDate = dateKey || ensureDiaryDate();
    if (dateInput && resolvedDate) {
        dateInput.value = resolvedDate;
    }
    if (startInput) {
        startInput.value = '';
    }
    if (endInput) {
        endInput.value = '';
    }
    if (hint) {
        const snapshot = getDayMetaSnapshot(resolvedDate);
        hint.textContent = snapshot.sleepHours !== null
            ? `Сейчас сохранено: ${formatSleepHours(snapshot.sleepHours)}.`
            : 'Сон пока не заполнен.';
    }
    updateSleepPanelSummary();
    panel?.classList.remove('hidden');
}

function closeSleepPanel() {
    const panel = document.getElementById('diary-sleep-panel');
    panel?.classList.add('hidden');
}

function openProductsForm(dateKey, mealKey) {
    const dateValue = dateKey || ensureDiaryDate();
    openProductsPanel();
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
    const params = new URLSearchParams(window.location.search);
    if (dateValue) {
        params.set('date', dateValue);
    }
    const mealValue = mealSelect?.value || mealKey;
    if (mealValue) {
        params.set('meal', mealValue);
    }
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
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
    renderDayScreen(merged, selectedDate);

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
    const waterPanel = document.getElementById('diary-water-panel');
    const waterForm = document.getElementById('diary-water-form');
    const waterDate = document.getElementById('diary-water-date');
    const waterAmount = document.getElementById('diary-water-amount');
    const waterClose = document.getElementById('diary-water-close');
    const sleepPanel = document.getElementById('diary-sleep-panel');
    const sleepForm = document.getElementById('diary-sleep-form');
    const sleepDate = document.getElementById('diary-sleep-date');
    const sleepStart = document.getElementById('diary-sleep-start');
    const sleepEnd = document.getElementById('diary-sleep-end');
    const sleepClose = document.getElementById('diary-sleep-close');
    const initialDate = getDateFromUrl();
    const initialMeal = getMealFromUrl();
    const params = new URLSearchParams(window.location.search);
    const initialMode = params.get('mode');

    if (params.has('mode')) {
        params.delete('mode');
        const next = params.toString();
        const nextUrl = next ? `${window.location.pathname}?${next}` : window.location.pathname;
        window.history.replaceState({}, '', nextUrl);
    }

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
        openProductsForm(resolvedDate, initialMeal);
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

    if (window.location.hash === '#diary-day-water') {
        openWaterPanel(resolvedDate);
    }
    if (window.location.hash === '#diary-day-sleep') {
        openSleepPanel(resolvedDate);
    }
    if (initialMode === 'water') {
        openWaterPanel(resolvedDate);
    }
    if (initialMode === 'sleep') {
        openSleepPanel(resolvedDate);
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
            closeProductsPanel();
            closeFabMenu();
            if (typeof showNotification === 'function') {
                showNotification('Приём пищи сохранён.');
            }
        });
    }

    const dayWaterInput = document.getElementById('diary-day-water');
    const daySleepInput = document.getElementById('diary-day-sleep');
    const dayActivityInput = document.getElementById('diary-day-activity');
    const persistDayChanges = () => {
        const dateKey = getSelectedDate();
        if (!dateKey) {
            return;
        }
        const waterValue = Number(dayWaterInput?.value);
        const sleepValue = daySleepInput?.value || '';
        const activityValue = Boolean(dayActivityInput?.checked);
        persistDayMeta(dateKey, waterValue, sleepValue, activityValue, { hintId: 'diary-day-hint' });
    };
    dayWaterInput?.addEventListener('change', persistDayChanges);
    daySleepInput?.addEventListener('change', persistDayChanges);
    dayActivityInput?.addEventListener('change', persistDayChanges);

    const handleDateChange = () => {
        const entries = readDiaryEntries();
        const selected = getSelectedDate();
        renderDayScreen(entries, selected);
        updateProductsForm(
            entries,
            selected,
            document.getElementById('diary-products-meal')?.value || 'breakfast'
        );
        if (selected) {
            const params = new URLSearchParams(window.location.search);
            params.set('date', selected);
            const mealValue = document.getElementById('diary-products-meal')?.value;
            if (mealValue && !document.getElementById('diary-products-panel')?.classList.contains('hidden')) {
                params.set('meal', mealValue);
            } else {
                params.delete('meal');
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
    const updated = entries.filter((entryItem) => !(entryItem.date === dateKey && entryItem.meal === meal));
    saveDiaryEntries(updated);
    updateProductsForm(updated, dateKey, meal);
    await refreshDiary();
        });
    }

    if (waterForm) {
        waterForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const dateKey = waterDate?.value || getSelectedDate();
            if (!dateKey) {
                return;
            }
            const waterValue = Number(waterAmount?.value) || 0;
            persistDayMetaWithExisting(dateKey, { waterLiters: Math.max(0, waterValue) }, { hintId: 'diary-water-hint' });
            closeWaterPanel();
            if (typeof showNotification === 'function') {
                showNotification('Вода сохранена.');
            }
        });
    }

    if (waterClose) {
        waterClose.addEventListener('click', () => {
            closeWaterPanel();
        });
    }

    if (waterPanel) {
        waterPanel.addEventListener('click', (event) => {
            if (event.target === waterPanel) {
                closeWaterPanel();
            }
        });
    }

    if (sleepForm) {
        sleepForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const dateKey = sleepDate?.value || getSelectedDate();
            if (!dateKey) {
                return;
            }
            const result = calculateSleepDuration(dateKey, sleepStart?.value || '', sleepEnd?.value || '');
            if (!result) {
                if (typeof showNotification === 'function') {
                    showNotification('Укажите корректное время сна.', 'error');
                }
                return;
            }
            persistDayMetaWithExisting(dateKey, { sleepHours: result.durationHours }, { hintId: 'diary-sleep-hint' });
            closeSleepPanel();
            if (typeof showNotification === 'function') {
                showNotification('Сон сохранён.');
            }
        });
    }

    sleepStart?.addEventListener('input', updateSleepPanelSummary);
    sleepEnd?.addEventListener('input', updateSleepPanelSummary);
    sleepDate?.addEventListener('change', updateSleepPanelSummary);

    if (sleepClose) {
        sleepClose.addEventListener('click', () => {
            closeSleepPanel();
        });
    }

    if (sleepPanel) {
        sleepPanel.addEventListener('click', (event) => {
            if (event.target === sleepPanel) {
                closeSleepPanel();
            }
        });
    }

    window.addEventListener('diary-open-panel', (event) => {
        const mode = event?.detail?.mode;
        const dateKey = getSelectedDate() || ensureDiaryDate();
        if (mode === 'water') {
            openWaterPanel(dateKey);
        }
        if (mode === 'sleep') {
            openSleepPanel(dateKey);
        }
    });

    renderDayScreen(readDiaryEntries(), resolvedDate);

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
