// Скрипты визуальных блоков профиля

const HABITS_STORAGE_KEY = 'bree_habits';
const REMINDER_DEFAULTS = {
    water: { enabled: false, time: '10:00', frequency: 'daily' },
    sleep: { enabled: false, time: '22:30', frequency: 'daily' },
    activity: { enabled: false, time: '18:00', frequency: 'daily' }
};

const REMINDER_TYPES = {
    water: 'water',
    sleep: 'sleep_reminder',
    activity: 'activity'
};

let diaryEntriesMemory = [];
let habitsEntriesMemory = {};

function createProgressRing({ percent, size = 120, stroke = 10, color = '#10b981', label, value, emphasize = false }) {
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const safePercent = Number.isFinite(percent) ? percent : 0;
    const progress = Math.max(0, Math.min(safePercent, 100));

    const wrapper = document.createElement('div');
    wrapper.className = 'profile-ring';

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`);

    const backgroundCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    backgroundCircle.setAttribute('cx', size / 2);
    backgroundCircle.setAttribute('cy', size / 2);
    backgroundCircle.setAttribute('r', radius);
    backgroundCircle.setAttribute('stroke', '#e2e8f0');
    backgroundCircle.setAttribute('stroke-width', stroke);
    backgroundCircle.setAttribute('fill', 'none');

    const progressCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    progressCircle.setAttribute('cx', size / 2);
    progressCircle.setAttribute('cy', size / 2);
    progressCircle.setAttribute('r', radius);
    progressCircle.setAttribute('stroke', color);
    progressCircle.setAttribute('stroke-width', stroke);
    progressCircle.setAttribute('fill', 'none');
    progressCircle.setAttribute('stroke-linecap', 'round');
    progressCircle.setAttribute('stroke-dasharray', circumference);
    progressCircle.setAttribute('stroke-dashoffset', circumference);

    const percentText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    percentText.setAttribute('x', '50%');
    percentText.setAttribute('y', '50%');
    percentText.setAttribute('text-anchor', 'middle');
    percentText.setAttribute('dominant-baseline', 'middle');
    percentText.setAttribute('font-size', '16');
    percentText.setAttribute('font-weight', '700');
    percentText.setAttribute('fill', '#0f172a');
    percentText.textContent = Number.isFinite(percent) ? `${Math.round(progress)}%` : '—';

    svg.appendChild(backgroundCircle);
    svg.appendChild(progressCircle);
    svg.appendChild(percentText);

    const labelNode = document.createElement('div');
    labelNode.className = 'text-sm font-semibold text-slate-700';
    labelNode.textContent = label;

    const valueNode = document.createElement('div');
    valueNode.className = 'text-xs text-slate-500';
    valueNode.innerHTML = formatCountUpValue(value);

    wrapper.appendChild(svg);
    wrapper.appendChild(labelNode);
    wrapper.appendChild(valueNode);

    requestAnimationFrame(() => {
        progressCircle.style.transition = 'stroke-dashoffset 1.2s ease-out';
        progressCircle.setAttribute('stroke-dashoffset', `${circumference - (progress / 100) * circumference}`);
    });

    return wrapper;
}

function formatCountUpValue(value) {
    if (!value) {
        return '';
    }
    const parts = String(value).split(' ');
    const numbers = parts.shift();
    const suffix = parts.join(' ');
    if (!numbers) {
        return value;
    }
    const numericPattern = /^(\d+(?:[.,]\d+)?)(\s*\/\s*(\d+(?:[.,]\d+)?))?$/;
    if (!numericPattern.test(numbers.trim())) {
        return value;
    }
    const values = numbers.split('/');
    if (values.length === 2) {
        return `<span class="countup"><span data-count="${values[0].trim()}">0</span>/<span data-count="${values[1].trim()}">0</span></span>${suffix ? ` ${suffix}` : ''}`;
    }
    return `<span class="countup"><span data-count="${numbers.trim()}">0</span></span>${suffix ? ` ${suffix}` : ''}`;
}

function animateCountUps(container) {
    const elements = container.querySelectorAll('[data-count]');
    elements.forEach((element) => {
        const target = Number(element.dataset.count);
        if (!Number.isFinite(target)) {
            return;
        }
        const duration = 900;
        const start = performance.now();
        const step = (now) => {
            const progress = Math.min((now - start) / duration, 1);
            const value = Math.round(target * progress);
            element.textContent = value.toString();
            if (progress < 1) {
                requestAnimationFrame(step);
            }
        };
        requestAnimationFrame(step);
    });
}

function readDiaryEntries() {
    if (typeof window.getDiaryEntries === 'function') {
        return window.getDiaryEntries();
    }
    return Array.isArray(diaryEntriesMemory) ? diaryEntriesMemory : [];
}

function normalizeDateKey(value) {
    if (typeof window.normalizeLocalDate === 'function') {
        return window.normalizeLocalDate(value);
    }
    if (!value) {
        return null;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return null;
    }
    return parsed.toISOString().split('T')[0];
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

function formatSleepMinutes(minutes) {
    if (!Number.isFinite(minutes)) {
        return '—';
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

function buildDateRange(days) {
    const range = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = days - 1; i >= 0; i -= 1) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const dateKey = normalizeDateKey(date);
        range.push({ date, dateKey });
    }
    return range;
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

function buildHabitDefaults(dateKey, dayData) {
    if (!dateKey) {
        return null;
    }
    const waterTarget = Number(window.adminConfig?.reminders?.water_min_l);
    const sleepTarget = parseSleepMinutes(window.adminConfig?.reminders?.sleep_target);
    const waterOk = Number.isFinite(waterTarget) && waterTarget > 0
        ? dayData.water >= waterTarget
        : dayData.water > 0;
    const sleepOk = dayData.sleepMinutes !== null
        ? (sleepTarget !== null ? dayData.sleepMinutes <= sleepTarget : true)
        : false;
    return {
        water: waterOk,
        sleep: sleepOk,
        diary: dayData.hasDiary,
        activity: Boolean(dayData.activity)
    };
}

function resolveHabitStatus(dateKey, dayData) {
    const habits = readHabitEntries();
    const defaults = buildHabitDefaults(dateKey, dayData);
    const stored = habits[dateKey];
    if (stored && typeof stored === 'object') {
        return { ...defaults, ...stored };
    }
    return defaults;
}

function renderHabitsPlanner() {
    const list = document.getElementById('habits-list');
    const status = document.getElementById('habits-status');
    if (!list || !status) {
        return;
    }
    const todayKey = normalizeDateKey(new Date());
    if (!todayKey) {
        return;
    }
    const entries = readHabitEntries();
    const current = entries[todayKey] && typeof entries[todayKey] === 'object'
        ? entries[todayKey]
        : {};
    const items = [
        { key: 'water', label: 'Выпить воду' },
        { key: 'diary', label: 'Записать питание' },
        { key: 'sleep', label: 'Отойти ко сну вовремя' },
        { key: 'activity', label: 'Двигаться (любая активность)' }
    ];

    list.innerHTML = items.map((item) => {
        const checked = Boolean(current[item.key]);
        return `
            <label class="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3">
                <span class="text-sm font-medium text-slate-700">${item.label}</span>
                <input type="checkbox" class="form-checkbox" data-habit-toggle="${item.key}" ${checked ? 'checked' : ''}>
            </label>
        `;
    }).join('');

    const updateStatus = () => {
        const updated = readHabitEntries()[todayKey] || {};
        const done = items.filter((item) => updated[item.key]).length;
        status.textContent = `Сегодня: ${done} из ${items.length}`;
    };

    updateStatus();

    list.querySelectorAll('[data-habit-toggle]').forEach((input) => {
        input.addEventListener('change', () => {
            const key = input.dataset.habitToggle;
            const updatedEntries = readHabitEntries();
            const todayEntry = updatedEntries[todayKey] && typeof updatedEntries[todayKey] === 'object'
                ? updatedEntries[todayKey]
                : {};
            updatedEntries[todayKey] = { ...todayEntry, [key]: input.checked };
            saveHabitEntries(updatedEntries);
            updateStatus();
            renderMonthGrid();
        });
    });
}

function getReminderSettings() {
    const profile = typeof getUserProfile === 'function' ? getUserProfile() : {};
    const stored = profile?.reminder_settings && typeof profile.reminder_settings === 'object'
        ? profile.reminder_settings
        : {};
    return {
        water: { ...REMINDER_DEFAULTS.water, ...(stored.water || {}) },
        sleep: { ...REMINDER_DEFAULTS.sleep, ...(stored.sleep || {}) },
        activity: { ...REMINDER_DEFAULTS.activity, ...(stored.activity || {}) }
    };
}

function saveReminderSettings(nextSettings) {
    if (typeof patchUserProfile !== 'function') {
        return;
    }
    patchUserProfile({ reminder_settings: nextSettings });
}

function getReminderBaseDate(frequency) {
    const now = new Date();
    if (frequency !== 'weekdays') {
        return now;
    }
    const day = now.getDay();
    if (day >= 1 && day <= 5) {
        return now;
    }
    const daysUntilMonday = day === 6 ? 2 : 1;
    const next = new Date(now);
    next.setDate(now.getDate() + daysUntilMonday);
    return next;
}

function buildReminderIso(timeValue, frequency) {
    if (!timeValue) {
        return null;
    }
    const [hours, minutes] = timeValue.split(':').map((value) => Number(value));
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
        return null;
    }
    const base = getReminderBaseDate(frequency);
    const scheduled = new Date(base);
    scheduled.setHours(hours, minutes, 0, 0);
    return scheduled.toISOString();
}

async function scheduleReminder(type, timeValue, frequency) {
    const profile = typeof getUserProfile === 'function' ? getUserProfile() : {};
    if (!profile?.telegram_user_id) {
        return;
    }
    const whenIso = buildReminderIso(timeValue, frequency);
    if (!whenIso) {
        return;
    }
    try {
        await fetch('/api/reminders/schedule', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                telegram_user_id: profile.telegram_user_id,
                type,
                when_iso: whenIso
            })
        });
    } catch (error) {
        // Заглушка: ошибки отправки напоминаний игнорируем.
    }
}

function initReminderControls() {
    const container = document.getElementById('reminders-settings');
    if (!container) {
        return;
    }
    const settings = getReminderSettings();

    const toggleInputs = container.querySelectorAll('[data-reminder-toggle]');
    toggleInputs.forEach((input) => {
        const key = input.dataset.reminderToggle;
        if (!key || !settings[key]) {
            return;
        }
        input.checked = Boolean(settings[key].enabled);
        input.addEventListener('change', () => {
            const nextSettings = { ...getReminderSettings() };
            nextSettings[key] = { ...nextSettings[key], enabled: input.checked };
            saveReminderSettings(nextSettings);
            if (input.checked) {
                const timeInput = container.querySelector(`[data-reminder-time="${key}"]`);
                const frequencySelect = container.querySelector(`[data-reminder-frequency="${key}"]`);
                scheduleReminder(
                    REMINDER_TYPES[key],
                    timeInput?.value || nextSettings[key].time,
                    frequencySelect?.value || nextSettings[key].frequency
                );
            }
        });
    });

    const timeInputs = container.querySelectorAll('[data-reminder-time]');
    timeInputs.forEach((input) => {
        const key = input.dataset.reminderTime;
        if (!key || !settings[key]) {
            return;
        }
        input.value = settings[key].time || '';
        input.addEventListener('change', () => {
            const nextSettings = { ...getReminderSettings() };
            nextSettings[key] = { ...nextSettings[key], time: input.value };
            saveReminderSettings(nextSettings);
            if (nextSettings[key].enabled) {
                scheduleReminder(
                    REMINDER_TYPES[key],
                    input.value,
                    nextSettings[key].frequency
                );
            }
        });
    });

    const frequencySelects = container.querySelectorAll('[data-reminder-frequency]');
    frequencySelects.forEach((select) => {
        const key = select.dataset.reminderFrequency;
        if (!key || !settings[key]) {
            return;
        }
        select.value = settings[key].frequency || 'daily';
        select.addEventListener('change', () => {
            const nextSettings = { ...getReminderSettings() };
            nextSettings[key] = { ...nextSettings[key], frequency: select.value };
            saveReminderSettings(nextSettings);
            if (nextSettings[key].enabled) {
                const timeInput = container.querySelector(`[data-reminder-time="${key}"]`);
                scheduleReminder(
                    REMINDER_TYPES[key],
                    timeInput?.value || nextSettings[key].time,
                    select.value
                );
            }
        });
    });
}

function resolveCalorieTone(dayCalories, targetCalories) {
    if (!Number.isFinite(targetCalories) || targetCalories <= 0) {
        return { color: '#e2e8f0', label: 'ориентир не рассчитан' };
    }
    if (dayCalories < targetCalories * 0.9) {
        return { color: '#facc15', label: 'меньше нужного' };
    }
    if (dayCalories > targetCalories * 1.1) {
        return { color: '#f43f5e', label: 'больше нужного' };
    }
    return { color: '#10b981', label: 'в нужном диапазоне' };
}

function updateRangeButtonState(buttons, activeValue) {
    buttons.forEach((button) => {
        const isActive = button.dataset.calorieRange === activeValue;
        button.classList.toggle('bg-emerald-100', isActive);
        button.classList.toggle('text-emerald-700', isActive);
        button.classList.toggle('bg-slate-100', !isActive);
        button.classList.toggle('text-slate-500', !isActive);
    });
}

function updateMacroRangeButtonState(buttons, activeValue) {
    buttons.forEach((button) => {
        const isActive = button.dataset.macroRange === activeValue;
        button.classList.toggle('bg-emerald-100', isActive);
        button.classList.toggle('text-emerald-700', isActive);
        button.classList.toggle('bg-slate-100', !isActive);
        button.classList.toggle('text-slate-500', !isActive);
    });
}

function updateWaterRangeButtonState(buttons, activeValue) {
    buttons.forEach((button) => {
        const isActive = button.dataset.waterRange === activeValue;
        button.classList.toggle('bg-emerald-100', isActive);
        button.classList.toggle('text-emerald-700', isActive);
        button.classList.toggle('bg-slate-100', !isActive);
        button.classList.toggle('text-slate-500', !isActive);
    });
}

function summarizeMacrosByDate(entries, range) {
    const totals = new Map();
    range.forEach(({ dateKey }) => {
        if (dateKey) {
            totals.set(dateKey, { protein_g: 0, fat_g: 0, carbs_g: 0 });
        }
    });
    entries.forEach((entry) => {
        const dateKey = normalizeDateKey(entry?.date);
        if (!dateKey || !totals.has(dateKey)) {
            return;
        }
        const resolved = resolveEntryTotals(entry);
        const current = totals.get(dateKey);
        current.protein_g += resolved.protein_g;
        current.fat_g += resolved.fat_g;
        current.carbs_g += resolved.carbs_g;
    });
    return totals;
}

function renderWaterHistory(rangeDays = 7) {
    const grid = document.getElementById('water-history-grid');
    const desc = document.getElementById('water-history-desc');
    const insight = document.getElementById('water-history-insight');
    if (!grid || !desc || !insight) {
        return;
    }

    const entries = readDiaryEntries();
    const waterByDate = new Map();
    const range = buildDateRange(rangeDays);
    range.forEach(({ dateKey }) => {
        if (dateKey) {
            waterByDate.set(dateKey, 0);
        }
    });

    entries.forEach((entry) => {
        const dateKey = normalizeDateKey(entry?.date);
        if (!dateKey || !waterByDate.has(dateKey)) {
            return;
        }
        const waterValue = Number(entry?.water_l) || 0;
        const current = waterByDate.get(dateKey) || 0;
        waterByDate.set(dateKey, Math.max(current, waterValue));
    });

    const target = Number(window.adminConfig?.reminders?.water_min_l);
    let totalWater = 0;
    let daysWithData = 0;
    const maxWater = range.reduce((maxValue, { dateKey }) => {
        const value = dateKey ? (waterByDate.get(dateKey) || 0) : 0;
        if (dateKey && waterByDate.has(dateKey)) {
            totalWater += value;
            daysWithData += 1;
        }
        return Math.max(maxValue, value);
    }, 0);
    const scale = Math.max(maxWater, Number.isFinite(target) ? target : 0, 0.5);

    grid.innerHTML = '';
    grid.classList.remove('grid-cols-7');
    grid.classList.remove('grid-cols-10');
    grid.classList.add(rangeDays === 30 ? 'grid-cols-10' : 'grid-cols-7');

    range.forEach(({ date, dateKey }) => {
        const dayWater = dateKey ? (waterByDate.get(dateKey) || 0) : 0;
        const height = Math.round((dayWater / scale) * 100);
        const dayLabel = `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}`;
        const meetsTarget = Number.isFinite(target) && target > 0 && dayWater >= target;
        const barColor = meetsTarget ? '#10b981' : '#7dd3fc';

        const item = document.createElement('div');
        item.className = 'flex flex-col items-center gap-1';

        const barWrapper = document.createElement('div');
        barWrapper.className = 'w-full flex items-end justify-center';
        barWrapper.style.height = rangeDays === 30 ? '56px' : '72px';

        const bar = document.createElement('div');
        bar.className = 'w-full rounded-lg';
        bar.style.height = `${Math.max(height, 4)}%`;
        bar.style.background = barColor;
        bar.title = `${dayLabel}: ${dayWater.toFixed(1)} л`;

        const value = document.createElement('div');
        value.className = 'text-[10px] text-slate-400';
        value.textContent = `${dayWater.toFixed(1)}`;

        const label = document.createElement('div');
        label.className = 'text-[10px] text-slate-500';
        label.textContent = dayLabel;

        barWrapper.appendChild(bar);
        item.appendChild(barWrapper);
        if (rangeDays === 7) {
            item.appendChild(value);
        }
        item.appendChild(label);
        grid.appendChild(item);
    });

    if (!Number.isFinite(target) || target <= 0) {
        desc.textContent = 'Цель по воде не задана, показываем фактические значения.';
        insight.textContent = daysWithData
            ? 'Есть записи по воде, но цель не задана. Попробуйте отмечать воду регулярно.'
            : 'Пока нет записей по воде. Начните с одного дня — так проще войти в ритм.';
    } else {
        desc.textContent = `Цель: ${target.toFixed(1)} л в день.`;
        if (!daysWithData) {
            insight.textContent = 'Пока нет записей по воде. Заполните пару дней — и появится понятная картина.';
        } else {
            const average = totalWater / daysWithData;
            if (average >= target) {
                insight.textContent = 'Хорошо: в среднем вода на уровне цели. Продолжайте в том же духе.';
            } else {
                insight.textContent = 'Воды в среднем меньше цели. Попробуйте добавить стакан воды в первой половине дня.';
            }
        }
    }
}

function renderMacroBalance(rangeKey = 'day') {
    const chart = document.getElementById('macro-balance-chart');
    const desc = document.getElementById('macro-balance-desc');
    const insight = document.getElementById('macro-balance-insight');
    const proteinLabel = document.getElementById('macro-balance-protein');
    const fatLabel = document.getElementById('macro-balance-fat');
    const carbsLabel = document.getElementById('macro-balance-carbs');
    if (!chart || !desc || !insight || !proteinLabel || !fatLabel || !carbsLabel) {
        return;
    }

    const entries = readDiaryEntries();
    let protein = 0;
    let fat = 0;
    let carbs = 0;
    let label = 'Фактический состав рациона.';

    if (rangeKey === 'week') {
        const range = buildDateRange(7);
        const totals = summarizeMacrosByDate(entries, range);
        let daysWithData = 0;
        totals.forEach((dayTotals) => {
            if (dayTotals.protein_g || dayTotals.fat_g || dayTotals.carbs_g) {
                daysWithData += 1;
                protein += dayTotals.protein_g;
                fat += dayTotals.fat_g;
                carbs += dayTotals.carbs_g;
            }
        });
        if (daysWithData > 0) {
            protein /= daysWithData;
            fat /= daysWithData;
            carbs /= daysWithData;
        }
        label = 'Средние значения за неделю.';
    } else {
        const today = normalizeDateKey(new Date());
        entries.forEach((entry) => {
            const dateKey = normalizeDateKey(entry?.date);
            if (!today || dateKey !== today) {
                return;
            }
            const resolved = resolveEntryTotals(entry);
            protein += resolved.protein_g;
            fat += resolved.fat_g;
            carbs += resolved.carbs_g;
        });
        label = 'Фактические значения за сегодня.';
    }

    const total = protein + fat + carbs;
    const safeTotal = total > 0 ? total : 1;
    const proteinPercent = Math.round((protein / safeTotal) * 100);
    const fatPercent = Math.round((fat / safeTotal) * 100);
    const carbsPercent = Math.max(0, 100 - proteinPercent - fatPercent);

    if (total <= 0) {
        chart.style.background = '#e2e8f0';
        desc.textContent = 'Нет данных для расчёта.';
        insight.textContent = 'Пока нет записей, поэтому распределение не видно.';
        proteinLabel.textContent = 'Белки — 0%';
        fatLabel.textContent = 'Жиры — 0%';
        carbsLabel.textContent = 'Углеводы — 0%';
        return;
    }

    chart.style.background = `conic-gradient(#10b981 0 ${proteinPercent}%, #f59e0b ${proteinPercent}% ${proteinPercent + fatPercent}%, #38bdf8 ${proteinPercent + fatPercent}% 100%)`;
    desc.textContent = label;
    proteinLabel.textContent = `Белки — ${proteinPercent}%`;
    fatLabel.textContent = `Жиры — ${fatPercent}%`;
    carbsLabel.textContent = `Углеводы — ${carbsPercent}%`;
    const maxPercent = Math.max(proteinPercent, fatPercent, carbsPercent);
    if (maxPercent >= 55) {
        const dominant = maxPercent === proteinPercent
            ? 'белков'
            : maxPercent === fatPercent
                ? 'жиров'
                : 'углеводов';
        insight.textContent = `Сейчас заметный упор на долю ${dominant}. Чтобы выровнять баланс, добавьте продукты других групп.`;
    } else if (maxPercent <= 45) {
        insight.textContent = 'Баланс выглядит ровно — хорошо для стабильной энергии.';
    } else {
        const dominant = maxPercent === proteinPercent
            ? 'белкам'
            : maxPercent === fatPercent
                ? 'жирам'
                : 'углеводам';
        insight.textContent = `Баланс слегка смещён к ${dominant}. Можно добавить продукты других групп для ровного распределения.`;
    }
}

function renderCarbSplit(rangeKey = 'day') {
    const value = document.getElementById('macro-carb-split-value');
    const desc = document.getElementById('macro-carb-split-desc');
    if (!value || !desc) {
        return;
    }

    const entries = readDiaryEntries();
    let simple = 0;
    let complex = 0;
    let label = 'Фактические значения за сегодня.';
    const note = 'Сложные углеводы дают стабильную энергию.';

    if (rangeKey === 'week') {
        const range = buildDateRange(7);
        const allowedDates = new Set(range.map((item) => item.dateKey).filter(Boolean));
        entries.forEach((entry) => {
            const dateKey = normalizeDateKey(entry?.date);
            if (!dateKey || !allowedDates.has(dateKey)) {
                return;
            }
            const resolved = resolveEntryTotals(entry);
            simple += resolved.carbs_simple_g;
            complex += resolved.carbs_complex_g;
        });
        label = 'Средние значения за неделю.';
    } else {
        const today = normalizeDateKey(new Date());
        entries.forEach((entry) => {
            const dateKey = normalizeDateKey(entry?.date);
            if (!today || dateKey !== today) {
                return;
            }
            const resolved = resolveEntryTotals(entry);
            simple += resolved.carbs_simple_g;
            complex += resolved.carbs_complex_g;
        });
    }

    const total = simple + complex;
    if (total <= 0) {
        value.textContent = 'Нет данных';
        desc.textContent = `Пока нет данных. ${note}`;
        return;
    }
    const simplePercent = Math.round((simple / total) * 100);
    const complexPercent = Math.max(0, 100 - simplePercent);
    value.textContent = `${simplePercent}% / ${complexPercent}%`;
    desc.textContent = `${label} ${note}`;
}

function renderCalorieTrend(rangeDays = 7) {
    const grid = document.getElementById('calorie-trend-grid');
    const desc = document.getElementById('calorie-trend-desc');
    const insight = document.getElementById('calorie-trend-insight');
    if (!grid || !desc || !insight) {
        return;
    }

    const profile = typeof getUserProfile === 'function' ? getUserProfile() : {};
    const targetCalories = Number(profile?.tdee_calories);
    const entries = readDiaryEntries();
    const caloriesByDate = new Map();

    entries.forEach((entry) => {
        const dateKey = normalizeDateKey(entry?.date);
        if (!dateKey) {
            return;
        }
        const totals = resolveEntryTotals(entry);
        const calories = Number(totals.calories) || 0;
        const current = caloriesByDate.get(dateKey) || 0;
        caloriesByDate.set(dateKey, current + calories);
    });

    const range = buildDateRange(rangeDays);
    let totalCalories = 0;
    let daysWithData = 0;
    const maxCalories = range.reduce((maxValue, { dateKey }) => {
        const value = dateKey ? (caloriesByDate.get(dateKey) || 0) : 0;
        if (dateKey && caloriesByDate.has(dateKey)) {
            totalCalories += value;
            daysWithData += 1;
        }
        return Math.max(maxValue, value);
    }, 0);
    const scale = Math.max(maxCalories, Number.isFinite(targetCalories) ? targetCalories : 0, 1);

    grid.innerHTML = '';
    grid.classList.remove('grid-cols-7');
    grid.classList.remove('grid-cols-10');
    grid.classList.add(rangeDays === 30 ? 'grid-cols-10' : 'grid-cols-7');

    range.forEach(({ date, dateKey }) => {
        const dayCalories = dateKey ? (caloriesByDate.get(dateKey) || 0) : 0;
        const height = Math.round((dayCalories / scale) * 100);
        const tone = resolveCalorieTone(dayCalories, targetCalories);
        const dayLabel = `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}`;

        const item = document.createElement('div');
        item.className = 'flex flex-col items-center gap-1';

        const barWrapper = document.createElement('div');
        barWrapper.className = 'w-full flex items-end justify-center';
        barWrapper.style.height = rangeDays === 30 ? '56px' : '72px';

        const bar = document.createElement('div');
        bar.className = 'w-full rounded-lg';
        bar.style.height = `${Math.max(height, 4)}%`;
        bar.style.background = tone.color;
        bar.title = `${dayLabel}: ${Math.round(dayCalories)} ккал за день`;

        const value = document.createElement('div');
        value.className = 'text-[10px] text-slate-400';
        value.textContent = `${Math.round(dayCalories)}`;

        const label = document.createElement('div');
        label.className = 'text-[10px] text-slate-500';
        label.textContent = dayLabel;

        barWrapper.appendChild(bar);
        item.appendChild(barWrapper);
        if (rangeDays === 7) {
            item.appendChild(value);
        }
        item.appendChild(label);
        grid.appendChild(item);
    });

    if (!Number.isFinite(targetCalories) || targetCalories <= 0) {
        desc.textContent = 'Ориентир по калориям ещё не рассчитан, поэтому показываем факт.';
        insight.textContent = daysWithData
            ? 'Есть записи по калориям, но ориентир не задан. Постарайтесь держать дни примерно на одном уровне.'
            : 'Пока нет записей по калориям. Заполните пару дней, чтобы увидеть тенденции.';
    } else {
        desc.textContent = `Ориентир на день: ${Math.round(targetCalories)} ккал.`;
        if (!daysWithData) {
            insight.textContent = 'Пока нет записей. Как только появятся данные, здесь будет понятный вывод.';
        } else {
            const average = totalCalories / daysWithData;
            if (average >= targetCalories * 1.1) {
                insight.textContent = 'В среднем калорий больше нужного. Если хотите ближе к цели, уменьшите порции или выберите более лёгкие блюда.';
            } else if (average <= targetCalories * 0.9) {
                insight.textContent = 'В среднем калорий меньше нужного. Можно добавить небольшой перекус, чтобы поддерживать энергию.';
            } else {
                insight.textContent = 'В среднем всё близко к ориентиру — это хороший знак стабильности.';
            }
        }
    }
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

function resolveEntryTotals(entry) {
    if (!entry) {
        return {
            calories: 0,
            protein_g: 0,
            fat_g: 0,
            carbs_g: 0,
            carbs_simple_g: 0,
            carbs_complex_g: 0,
            fiber_g: 0,
            water_l: 0
        };
    }
    if (entry.mode === 'products') {
        if (entry.totals) {
            const resolved = resolveCarbTotals(
                entry.totals.carbs_g,
                entry.totals.carbs_simple_g,
                entry.totals.carbs_complex_g
            );
            return {
                ...entry.totals,
                carbs_g: resolved.total,
                carbs_simple_g: resolved.simple,
                carbs_complex_g: resolved.complex,
                water_l: Number(entry.water_l) || 0
            };
        }
        if (Array.isArray(entry.items)) {
            return entry.items.reduce(
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
                    fiber_g: 0,
                    water_l: 0
                }
            );
        }
    }
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
        fiber_g: Number(entry.fiber_g) || 0,
        water_l: Number(entry.water_l) || 0
    };
}

function clamp01(x) {
    return Math.max(0, Math.min(1, x));
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function lerpColor(c1, c2, t) {
    const r = Math.round(lerp(c1[0], c2[0], t));
    const g = Math.round(lerp(c1[1], c2[1], t));
    const b = Math.round(lerp(c1[2], c2[2], t));
    return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Плавный градиент по проценту:
 * 0.00 -> red
 * 0.50 -> yellow
 * 0.75 -> green
 * 1.00 -> dark green
 */
function percentToGradientColor(p) {
    const percent = clamp01(p);

    // серый оставляем только для "нет данных", не для 0%
    // 0% при наличии данных должен быть красным
    const RED = [239, 68, 68];        // #ef4444
    const YELLOW = [234, 179, 8];     // #eab308
    const GREEN = [34, 197, 94];      // #22c55e
    const DARK_GREEN = [4, 120, 87];  // #047857

    if (percent <= 0.5) {
        // 0..0.5: red -> yellow
        return lerpColor(RED, YELLOW, percent / 0.5);
    }
    if (percent <= 0.75) {
        // 0.5..0.75: yellow -> green
        return lerpColor(YELLOW, GREEN, (percent - 0.5) / 0.25);
    }
    // 0.75..1.0: green -> dark green
    return lerpColor(GREEN, DARK_GREEN, (percent - 0.75) / 0.25);
}

function getTodayDiaryTotals() {
    const today = typeof window.normalizeLocalDate === 'function'
        ? window.normalizeLocalDate(new Date())
        : null;
    const entries = readDiaryEntries();
    let waterMax = 0;
    const totals = entries.reduce(
        (acc, entry) => {
            if (!today || entry?.date !== today) {
                return acc;
            }
            const resolved = resolveEntryTotals(entry);
            acc.calories += resolved.calories;
            acc.protein_g += resolved.protein_g;
            acc.fat_g += resolved.fat_g;
            acc.carbs_g += resolved.carbs_g;
            acc.fiber_g += resolved.fiber_g;
            waterMax = Math.max(waterMax, Number(entry?.water_l) || 0);
            return acc;
        },
        { calories: 0, protein_g: 0, fat_g: 0, carbs_g: 0, fiber_g: 0, water_l: 0 }
    );

    const hasEntries = totals.calories > 0 || totals.protein_g > 0 || totals.fat_g > 0 || totals.carbs_g > 0 || totals.fiber_g > 0 || waterMax > 0;
    return { ...totals, water_l: waterMax, hasEntries };
}

function getSleepMinutesForDate(entries, dateKey) {
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

function getActivityForDate(entries, dateKey) {
    if (!dateKey) {
        return false;
    }
    return entries.some((entry) => entry?.date === dateKey && entry?.activity === true);
}

function renderProfileRings() {
    const caloriesContainer = document.getElementById('profile-calories-ring');
    const macrosContainer = document.getElementById('profile-macros-rings');
    const waterContainer = document.getElementById('profile-water-ring');
    const sleepContainer = document.getElementById('profile-sleep-ring');
    const activityContainer = document.getElementById('profile-activity-ring');

    if (!caloriesContainer || !macrosContainer || !waterContainer || !sleepContainer || !activityContainer) {
        return;
    }

    const profile = typeof getUserProfile === 'function' ? getUserProfile() : {};
    const tdee = Number(profile?.tdee_calories);
    const entries = readDiaryEntries();
    const todayTotals = getTodayDiaryTotals();
    const todayKey = typeof window.normalizeLocalDate === 'function'
        ? window.normalizeLocalDate(new Date())
        : null;
    const sleepMinutes = getSleepMinutesForDate(entries, todayKey);
    const activityToday = getActivityForDate(entries, todayKey);
    const sleepTargetRaw = window.adminConfig?.reminders?.sleep_target;
    const sleepTargetMinutes = parseSleepMinutes(sleepTargetRaw);
    const caloriesPercent = todayTotals.hasEntries && Number.isFinite(tdee) && tdee > 0
        ? (todayTotals.calories / tdee) * 100
        : null;
    const caloriesValue = todayTotals.hasEntries
        ? Number.isFinite(tdee)
            ? `Сегодня: ${Math.round(todayTotals.calories)} из ${Math.round(tdee)} ккал`
            : `Сегодня: ${Math.round(todayTotals.calories)} ккал`
        : 'Пока нет данных';

    caloriesContainer.innerHTML = '';
    caloriesContainer.appendChild(
        createProgressRing({
            percent: caloriesPercent,
            color: '#10b981',
            label: 'Съедено сегодня',
            value: caloriesValue,
            emphasize: true
        })
    );

    const macros = profile?.macros;
    const macroItems = [
        {
            label: 'Белки',
            key: 'protein',
            consumed: todayTotals.protein_g,
            target: Number(macros?.protein_g),
            percent: todayTotals.hasEntries && Number.isFinite(macros?.protein_g) && macros.protein_g > 0
                ? Math.round((todayTotals.protein_g / macros.protein_g) * 100)
                : null,
            color: '#a855f7'
        },
        {
            label: 'Жиры',
            key: 'fat',
            consumed: todayTotals.fat_g,
            target: Number(macros?.fat_g),
            percent: todayTotals.hasEntries && Number.isFinite(macros?.fat_g) && macros.fat_g > 0
                ? Math.round((todayTotals.fat_g / macros.fat_g) * 100)
                : null,
            color: '#f59e0b'
        },
        {
            label: 'Углеводы',
            key: 'carbs',
            consumed: todayTotals.carbs_g,
            target: Number(macros?.carbs_g),
            percent: todayTotals.hasEntries && Number.isFinite(macros?.carbs_g) && macros.carbs_g > 0
                ? Math.round((todayTotals.carbs_g / macros.carbs_g) * 100)
                : null,
            color: '#06b6d4'
        }
    ];

    macrosContainer.innerHTML = '';
    macroItems.forEach((item) => {
        const card = document.createElement('div');
        card.className = 'stat-card flex justify-center';
        const ringWrapper = document.createElement('div');
        ringWrapper.className = 'ring-compact flex justify-center';
        const hasTarget = Number.isFinite(item.target) && item.target > 0;
        const macroValue = todayTotals.hasEntries
            ? hasTarget
                ? `Факт / цель: ${Math.round(item.consumed)} / ${Math.round(item.target)} г`
                : `Факт: ${Math.round(item.consumed)} г`
            : 'Нет данных';
        ringWrapper.appendChild(
            createProgressRing({
                size: 96,
                stroke: 8,
                percent: item.percent,
                color: item.color,
                label: item.label,
                value: macroValue
            })
        );
        card.appendChild(ringWrapper);
        macrosContainer.appendChild(card);
    });

    const fiberTarget = Number(window.adminConfig?.reminders?.fiber_target_g);
    const hasFiberTarget = Number.isFinite(fiberTarget) && fiberTarget > 0;
    const fiberPercent = todayTotals.hasEntries && hasFiberTarget
        ? Math.round((todayTotals.fiber_g / fiberTarget) * 100)
        : null;
    const fiberValue = todayTotals.hasEntries
        ? hasFiberTarget
            ? `Факт / цель: ${Math.round(todayTotals.fiber_g)} / ${Math.round(fiberTarget)} г`
            : `Факт: ${Math.round(todayTotals.fiber_g)} г`
        : 'Нет данных';
    const fiberCard = document.createElement('div');
    fiberCard.className = 'stat-card flex justify-center';
    const fiberWrapper = document.createElement('div');
    fiberWrapper.className = 'ring-compact flex justify-center';
    fiberWrapper.appendChild(
        createProgressRing({
            size: 96,
            stroke: 8,
            percent: fiberPercent,
            color: '#84cc16',
            label: 'Клетчатка',
            value: fiberValue
        })
    );
    fiberCard.appendChild(fiberWrapper);
    macrosContainer.appendChild(fiberCard);

    const waterTarget = Number(window.adminConfig?.reminders?.water_min_l);
    const waterTotal = Number(todayTotals.water_l) || 0;
    const hasWater = todayTotals.hasEntries && Number.isFinite(waterTotal);
    const waterPercent = hasWater && Number.isFinite(waterTarget) && waterTarget > 0
        ? Math.round((waterTotal / waterTarget) * 100)
        : null;
    const hasWaterTarget = Number.isFinite(waterTarget) && waterTarget > 0;
    const waterValue = hasWater
        ? hasWaterTarget
            ? `Факт / цель: ${Number(waterTotal).toFixed(1)} / ${Number(waterTarget).toFixed(1)} л`
            : `Факт: ${Number(waterTotal).toFixed(1)} л`
        : 'Нет данных';

    waterContainer.innerHTML = '';
    waterContainer.appendChild(
        createProgressRing({
            percent: waterPercent,
            color: '#38bdf8',
            label: 'Вода',
            value: waterValue
        })
    );

    const hasSleepTarget = sleepTargetMinutes !== null;
    const sleepPercent = sleepMinutes !== null && hasSleepTarget
        ? Math.max(0, Math.min((sleepTargetMinutes / sleepMinutes) * 100, 120))
        : null;
    const sleepValue = sleepMinutes !== null
        ? hasSleepTarget
            ? `Факт / цель: ${formatSleepMinutes(sleepMinutes)} / ${formatSleepMinutes(sleepTargetMinutes)}`
            : `Факт: ${formatSleepMinutes(sleepMinutes)}`
        : 'Нет данных';
    sleepContainer.innerHTML = '';
    sleepContainer.appendChild(
        createProgressRing({
            percent: sleepPercent,
            color: '#8b5cf6',
            label: 'Сон сегодня',
            value: sleepValue
        })
    );

    const activityValue = activityToday ? 'Да' : 'Нет';
    activityContainer.innerHTML = '';
    activityContainer.appendChild(
        createProgressRing({
            percent: activityToday ? 100 : 0,
            color: activityToday ? '#10b981' : '#e2e8f0',
            label: 'Активность сегодня',
            value: activityValue
        })
    );

    animateCountUps(caloriesContainer);
    animateCountUps(macrosContainer);
    animateCountUps(waterContainer);
    animateCountUps(sleepContainer);
    animateCountUps(activityContainer);
}

function renderMonthGrid() {
    const container = document.getElementById('profile-month-grid');
    const insight = document.getElementById('profile-month-grid-insight');
    if (!container || !insight) {
        return;
    }

    container.innerHTML = '';
    const diaryEntries = readDiaryEntries();
    const caloriesByDate = new Map();
    const waterByDate = new Map();
    const sleepByDate = new Map();
    const activityByDate = new Map();
    diaryEntries.forEach((entry) => {
        const dateKey = normalizeDateKey(entry?.date);
        if (!dateKey) {
            return;
        }
        const totals = resolveEntryTotals(entry);
        const currentCalories = caloriesByDate.get(dateKey) || 0;
        caloriesByDate.set(dateKey, currentCalories + (Number(totals.calories) || 0));
        const waterValue = Number(entry?.water_l) || 0;
        const currentWater = waterByDate.get(dateKey) || 0;
        waterByDate.set(dateKey, Math.max(currentWater, waterValue));
        const sleepMinutes = parseSleepMinutes(entry?.sleep_time);
        if (sleepMinutes !== null) {
            const currentSleep = sleepByDate.get(dateKey);
            if (currentSleep === undefined || sleepMinutes < currentSleep) {
                sleepByDate.set(dateKey, sleepMinutes);
            }
        }
        if (entry?.activity === true) {
            activityByDate.set(dateKey, true);
        }
    });
    const days = 30;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayDate = normalizeDateKey(today);
    const profile = typeof getUserProfile === 'function' ? getUserProfile() : {};
    const targetCalories = Number(profile?.tdee_calories);
    const waterTarget = Number(window.adminConfig?.reminders?.water_min_l);
    const sleepTargetMinutes = parseSleepMinutes(window.adminConfig?.reminders?.sleep_target);
    let daysWithData = 0;
    let daysOnTrack = 0;
    let daysOffTrack = 0;
    for (let i = 0; i < days; i += 1) {
        const date = new Date(today);
        date.setDate(today.getDate() - (days - 1 - i));
        const dateKey = normalizeDateKey(date);
        const day = document.createElement('a');
        day.className = 'month-day';
        day.href = dateKey ? `/diary?date=${dateKey}&mode=day` : '/diary?mode=day';
        if (todayDate && dateKey === todayDate) {
            day.classList.add('month-day--today');
        }
        const dayCalories = dateKey ? (caloriesByDate.get(dateKey) || 0) : 0;
        const dayWater = dateKey ? (waterByDate.get(dateKey) || 0) : 0;
        const daySleep = dateKey ? sleepByDate.get(dateKey) : undefined;
        const dayActivity = dateKey ? activityByDate.get(dateKey) === true : false;
        const hasData = dateKey
            ? (caloriesByDate.has(dateKey) || waterByDate.has(dateKey) || sleepByDate.has(dateKey) || activityByDate.has(dateKey))
            : false;
        if (hasData) {
            daysWithData += 1;
        }
        const habitStatus = resolveHabitStatus(dateKey, {
            water: dayWater,
            sleepMinutes: daySleep ?? null,
            hasDiary: hasData,
            activity: dayActivity
        });
        const habitsOk = habitStatus?.water && habitStatus?.sleep && habitStatus?.diary && habitStatus?.activity;
        if (hasData && habitStatus) {
            if (habitsOk) {
                day.classList.add('month-day--good');
                daysOnTrack += 1;
            } else {
                day.classList.add('month-day--bad');
                daysOffTrack += 1;
            }
        } else if (hasData && Number.isFinite(targetCalories) && targetCalories > 0
            && Number.isFinite(waterTarget) && waterTarget > 0
            && sleepTargetMinutes !== null) {
            const caloriesOk = dayCalories >= targetCalories * 0.9 && dayCalories <= targetCalories * 1.1;
            const waterOk = dayWater >= waterTarget;
            const sleepOk = daySleep !== undefined && daySleep <= sleepTargetMinutes;
            const activityOk = dayActivity === true;
            if (caloriesOk && waterOk && sleepOk && activityOk) {
                day.classList.add('month-day--good');
                daysOnTrack += 1;
            } else {
                day.classList.add('month-day--bad');
                daysOffTrack += 1;
            }
        } else if (hasData) {
            day.classList.add('month-day--empty');
        } else {
            day.classList.add('month-day--empty');
        }
        day.textContent = date.getDate().toString();
        container.appendChild(day);
    }
    if (!daysWithData) {
        insight.textContent = 'Пока нет отметок за месяц. Начните с пары дней, и появится понятная картина.';
    } else if (daysOnTrack > daysOffTrack) {
        insight.textContent = 'Большинство дней выглядят ровно — хороший ритм.';
    } else if (daysOffTrack > daysOnTrack) {
        insight.textContent = 'Есть несколько дней вне ритма. Попробуйте сделать график более регулярным.';
    } else {
        insight.textContent = 'Ритм пока смешанный. Если отметить больше дней, вывод будет точнее.';
    }
}

function renderWeeklyProgress() {
    const container = document.getElementById('weekly-progress-grid');
    const percentElement = document.getElementById('weekly-progress-percent');
    const descElement = document.getElementById('weekly-progress-desc');
    const insight = document.getElementById('weekly-progress-insight');
    if (!container || !percentElement || !descElement || !insight) {
        return;
    }

    container.innerHTML = '';

    const dayLabels = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];
    const today = new Date();
    const todayKey = typeof window.normalizeLocalDate === 'function'
        ? window.normalizeLocalDate(today)
        : null;
    const dayIndex = (today.getDay() + 6) % 7;
    const startDate = new Date(today);
    startDate.setHours(0, 0, 0, 0);
    startDate.setDate(today.getDate() - dayIndex);
    const profile = typeof getUserProfile === 'function' ? getUserProfile() : {};
    const targetCalories = Number(profile?.tdee_calories);

    const entries = readDiaryEntries();
    const caloriesByDate = new Map();

    entries.forEach((entry) => {
        const normalizedDate = typeof window.normalizeLocalDate === 'function'
            ? window.normalizeLocalDate(entry?.date)
            : entry?.date;
        if (!normalizedDate) {
            return;
        }
        const totals = resolveEntryTotals(entry);
        const calories = Number(totals.calories) || 0;
        const current = caloriesByDate.get(normalizedDate) || 0;
        caloriesByDate.set(normalizedDate, current + calories);
    });

    const weekDates = [];
    for (let i = 0; i < 7; i += 1) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + i);
        const dateKey = typeof window.normalizeLocalDate === 'function'
            ? window.normalizeLocalDate(currentDate)
            : null;
        weekDates.push({ dateKey, date: currentDate });
    }
    const maxWeekCalories = weekDates.reduce((maxValue, { dateKey }) => {
        if (!dateKey) {
            return maxValue;
        }
        return Math.max(maxValue, caloriesByDate.get(dateKey) || 0);
    }, 0);
    const fallbackTarget = maxWeekCalories > 0 ? maxWeekCalories : null;

    let totalPercent = 0;
    let loggedDays = 0;
    let totalCalories = 0;
    const shouldAverageLoggedDays = !(Number.isFinite(targetCalories) && targetCalories > 0);
    for (let i = 0; i < 7; i += 1) {
        const { dateKey, date: currentDate } = weekDates[i];
        const dateLabel = dateKey
            ? `${String(currentDate.getDate()).padStart(2, '0')}.${String(currentDate.getMonth() + 1).padStart(2, '0')}`
            : '';
        const dayCalories = dateKey ? (caloriesByDate.get(dateKey) || 0) : 0;
        const hasData = dateKey ? caloriesByDate.has(dateKey) : false;
        const target = Number.isFinite(targetCalories) && targetCalories > 0
            ? targetCalories
            : fallbackTarget;
        const dayPercent = target
            ? Math.min(Math.max(dayCalories / target, 0), 1)
            : 0;
        totalPercent += dayPercent;
        if (hasData) {
            loggedDays += 1;
            totalCalories += dayCalories;
        }

        const item = document.createElement('a');
        item.className = 'weekly-day flex flex-col items-center gap-1 p-2';
        if (dateKey) {
            item.href = `/diary?date=${dateKey}&mode=day`;
        } else {
            item.href = '/diary?mode=day';
        }
        if (todayKey && dateKey === todayKey) {
            item.classList.add('is-today');
        }
        const bar = document.createElement('div');
        bar.className = 'w-full rounded-lg';
        bar.style.transition = 'height 220ms ease, background-color 220ms ease';
        const heightPercent = Math.min(Math.max(dayPercent * 100, 0), 100);
        if (!hasData) {
            bar.style.height = '0%';
            bar.style.background = '#e2e8f0';
        } else {
            bar.style.height = `${heightPercent}%`;
            bar.style.background = percentToGradientColor(dayPercent);
        }
        const barWrapper = document.createElement('div');
        barWrapper.className = 'w-full flex items-end justify-center';
        barWrapper.style.height = '64px';
        barWrapper.appendChild(bar);
        const label = document.createElement('div');
        label.className = 'text-xs text-slate-500 mt-1';
        label.textContent = dayLabels[i];
        const dateText = document.createElement('div');
        dateText.className = 'text-[10px] text-slate-400';
        dateText.textContent = dateLabel;
        item.appendChild(barWrapper);
        item.appendChild(label);
        item.appendChild(dateText);
        container.appendChild(item);
    }

    const denominator = shouldAverageLoggedDays ? loggedDays : 7;
    const percent = denominator ? Math.round((totalPercent / denominator) * 100) : 0;
    percentElement.textContent = `${percent}%`;
    descElement.textContent = 'Учитываются записи дневника питания.';
    if (!loggedDays) {
        insight.textContent = 'Пока нет записей за неделю. Добавьте несколько дней — и появится понятный вывод.';
        return;
    }
    if (loggedDays < 3) {
        insight.textContent = 'Записей пока мало, вывод приблизительный. Попробуйте отмечать питание чаще.';
        return;
    }
    if (!Number.isFinite(targetCalories) || targetCalories <= 0) {
        insight.textContent = 'Есть записи за неделю, но ориентир не задан. Старайтесь держать дни более ровными.';
        return;
    }
    const avgCalories = totalCalories / loggedDays;
    if (avgCalories >= targetCalories * 1.1) {
        insight.textContent = 'В среднем за неделю калорий было больше нужного. Если хотите ближе к цели, уменьшайте порции постепенно.';
    } else if (avgCalories <= targetCalories * 0.9) {
        insight.textContent = 'В среднем за неделю калорий было меньше нужного. Можно добавить небольшой перекус, чтобы поддерживать энергию.';
    } else {
        insight.textContent = 'Неделя выглядит ровно — вы держите хороший ритм.';
    }
}

function renderWeeklyAdjustments() {
    const list = document.getElementById('profile-weekly-adjustments-list');
    if (!list) {
        return;
    }
    if (typeof getUserProfile !== 'function' || typeof analyzeWeeklyStats !== 'function') {
        return;
    }

    const profile = getUserProfile();
    const entries = readDiaryEntries();
    const analysis = analyzeWeeklyStats(profile, entries);
    if (!analysis || !Array.isArray(analysis.adjustments)) {
        return;
    }

    if (typeof patchUserProfile === 'function') {
        patchUserProfile({ weekly_adjustments: analysis.text });
    }

    list.innerHTML = '';
    analysis.adjustments.forEach((item) => {
        const li = document.createElement('li');
        li.className = 'flex items-start gap-2';
        li.innerHTML = '<span class="text-amber-500">•</span>';
        const span = document.createElement('span');
        span.textContent = item;
        li.appendChild(span);
        list.appendChild(li);
    });
}

async function applySubscriptionAccess() {
    const paywallElement = document.getElementById('profile-paywall');
    const payButton = document.getElementById('profile-pay-button');
    const paymentMotivation = document.getElementById('profile-payment-motivation');
    const weeklyProgress = document.getElementById('profile-weekly-progress');
    const dailyRings = document.getElementById('profile-daily-rings');
    const monthGrid = document.getElementById('profile-month-grid-section');

    if (!paywallElement || !payButton) {
        return;
    }

    if (typeof getUserProfile !== 'function') {
        return;
    }

    const profile = getUserProfile();
    const telegramUserId = profile.telegram_user_id;
    if (!telegramUserId) {
        paywallElement.classList.add('hidden');
        if (weeklyProgress) {
            weeklyProgress.classList.remove('hidden');
        }
        if (dailyRings) {
            dailyRings.classList.remove('hidden');
        }
        if (monthGrid) {
            monthGrid.classList.remove('hidden');
        }
        return;
    }

    const isDevMode = window.appIsDev === true || window.appMode === 'development';
    if (isDevMode) {
        paywallElement.classList.add('hidden');
        if (payButton) {
            payButton.disabled = true;
            payButton.classList.add('opacity-60', 'cursor-not-allowed');
        }
        if (weeklyProgress) {
            weeklyProgress.classList.remove('hidden');
        }
        if (dailyRings) {
            dailyRings.classList.remove('hidden');
        }
        if (monthGrid) {
            monthGrid.classList.remove('hidden');
        }
        return;
    }

    try {
        const response = await fetch(`/api/subscription/status?telegram_user_id=${telegramUserId}`);
        if (!response.ok) {
            throw new Error('Не удалось получить статус подписки.');
        }
        const subscription = await response.json();
        const isExpired = subscription.subscription_status === 'expired';

        paywallElement.classList.toggle('hidden', !isExpired);
        if (isExpired && paymentMotivation && typeof getPaymentMotivation === 'function') {
            const deviations = typeof getFoodDiaryDeviationStatus === 'function'
                ? getFoodDiaryDeviationStatus(profile)
                : null;
            paymentMotivation.textContent = await getPaymentMotivation(profile, deviations);
        }
        if (weeklyProgress) {
            weeklyProgress.classList.toggle('hidden', isExpired);
        }
        if (dailyRings) {
            dailyRings.classList.toggle('hidden', isExpired);
        }
        if (monthGrid) {
            monthGrid.classList.toggle('hidden', isExpired);
        }
    } catch (error) {
        return;
    }

    payButton.onclick = async () => {
        try {
            const response = await fetch('/api/payments/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ telegram_user_id: telegramUserId, days: 30 })
            });
            if (!response.ok) {
                throw new Error('Не удалось выполнить оплату.');
            }
            const result = await response.json();
            if (result?.status === 'success') {
                if (typeof patchUserProfile === 'function') {
                    patchUserProfile({
                        subscription_status: result.subscription_status ?? 'active',
                        subscription_until: result.subscription_until ?? null
                    });
                }
                await applySubscriptionAccess();
            }
        } catch (error) {
            return;
        }
    };
}

async function renderProfileRecommendations() {
    const list = document.getElementById('profile-recommendations-list');
    if (!list) {
        return;
    }
    if (typeof getUserProfile !== 'function') {
        return;
    }

    const profile = getUserProfile();
    list.innerHTML = '';
    const skeletonItems = Array.from({ length: 3 }).map(() => {
        const item = document.createElement('li');
        item.className = 'skeleton-line';
        return item;
    });
    skeletonItems.forEach((item) => list.appendChild(item));
    try {
        const response = await fetch('/api/ai/recommendation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(profile)
        });
        if (!response.ok) {
            throw new Error('empty');
        }
        const data = await response.json();
        const text = data?.text;
        if (!text) {
            throw new Error('empty');
        }
        const items = text
            .split(/(?<=[.!?])\s+/)
            .map((part) => part.trim())
            .filter(Boolean)
            .slice(0, 4);
        list.innerHTML = '';
        items.forEach((item) => {
            const li = document.createElement('li');
            li.className = 'flex items-start gap-2';
            li.innerHTML = '<span class="text-emerald-500">•</span>';
            const span = document.createElement('span');
            span.textContent = item;
            li.appendChild(span);
            list.appendChild(li);
        });
    } catch (error) {
        list.innerHTML = '';
        const fallback = typeof getRecommendations === 'function'
            ? getRecommendations(profile)
            : [];
        if (fallback.length) {
            fallback.forEach((item) => {
                const li = document.createElement('li');
                li.className = 'flex items-start gap-2';
                li.innerHTML = '<span class="text-emerald-500">•</span>';
                const span = document.createElement('span');
                span.textContent = item;
                li.appendChild(span);
                list.appendChild(li);
            });
            return;
        }
        const empty = document.createElement('li');
        empty.className = 'text-sm text-slate-500';
        empty.textContent = 'Здесь появятся персональные подсказки на основе вашего профиля.';
        list.appendChild(empty);
    }
}

function shouldRefreshWeeklyReview(review) {
    if (!review?.week_end) {
        return true;
    }
    const today = new Date();
    const endDate = new Date(`${review.week_end}T00:00:00`);
    if (Number.isNaN(endDate.getTime())) {
        return true;
    }
    const diffDays = Math.floor((today.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= 7;
}

function renderWeeklyReview() {
    const indicator = document.getElementById('weekly-review-indicator');
    const statusText = document.getElementById('weekly-review-status');
    const messageText = document.getElementById('weekly-review-message');
    if (!indicator || !statusText || !messageText) {
        return;
    }
    if (typeof getUserProfile !== 'function' || typeof analyzeWeeklyNutrition !== 'function') {
        return;
    }

    const profile = getUserProfile();
    let review = profile.weekly_review;

    if (shouldRefreshWeeklyReview(review)) {
        const entries = readDiaryEntries();
        review = analyzeWeeklyNutrition(profile, entries);
        if (typeof patchUserProfile === 'function') {
            patchUserProfile({ weekly_review: review });
        }
    }

    const statusLabels = {
        overeat: 'Еды было больше, чем нужно',
        undereat: 'Еды было меньше, чем нужно',
        low_protein: 'Белка не хватает',
        low_discipline: 'Записей мало',
        ok: 'Ритм стабильный'
    };
    const statusColors = {
        overeat: 'bg-rose-500',
        undereat: 'bg-yellow-400',
        low_protein: 'bg-amber-500',
        low_discipline: 'bg-yellow-400',
        ok: 'bg-emerald-400'
    };

    indicator.className = `inline-flex h-3 w-3 rounded-full ${statusColors[review.status] || 'bg-slate-300'}`;
    statusText.textContent = statusLabels[review.status] || 'Статус недели';
    messageText.textContent = review.message || '';
}

async function loadProfileFromServer() {
    if (typeof window.syncProfileWithBackend === 'function') {
        await window.syncProfileWithBackend();
        return;
    }
    if (typeof getUserProfile !== 'function' || typeof setUserProfile !== 'function') {
        return;
    }
    try {
        const response = await fetch('/api/profile/get');
        if (!response.ok) {
            return;
        }
        const data = await response.json();
        if (data?.status === 'not_found') {
            return;
        }
        if (data && typeof data === 'object') {
            setUserProfile(data);
        }
    } catch (error) {
        return;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const navigateToDiary = (event, link) => {
        if (!link) {
            return;
        }
        event.preventDefault();
        const target = link.getAttribute('href') || '/diary';
        window.location.href = target;
    };

    document.addEventListener(
        'click',
        (event) => {
            const quickActionLink = event.target.closest('.quick-actions a[href^="/diary"]');
            if (quickActionLink) {
                navigateToDiary(event, quickActionLink);
            }
        },
        true
    );

    const quickDiaryLinks = document.querySelectorAll('[data-quick-action^="diary"]');
    quickDiaryLinks.forEach((link) => {
        link.addEventListener('click', (event) => navigateToDiary(event, link));
    });

    const rangeButtons = Array.from(document.querySelectorAll('[data-calorie-range]'));
    let activeRange = '7';
    if (rangeButtons.length) {
        updateRangeButtonState(rangeButtons, activeRange);
        rangeButtons.forEach((button) => {
            button.addEventListener('click', () => {
                activeRange = button.dataset.calorieRange || '7';
                updateRangeButtonState(rangeButtons, activeRange);
                renderCalorieTrend(Number(activeRange));
            });
        });
    }

    const waterRangeButtons = Array.from(document.querySelectorAll('[data-water-range]'));
    let activeWaterRange = '7';
    if (waterRangeButtons.length) {
        updateWaterRangeButtonState(waterRangeButtons, activeWaterRange);
        waterRangeButtons.forEach((button) => {
            button.addEventListener('click', () => {
                activeWaterRange = button.dataset.waterRange || '7';
                updateWaterRangeButtonState(waterRangeButtons, activeWaterRange);
                renderWaterHistory(Number(activeWaterRange));
            });
        });
    }

    const macroRangeButtons = Array.from(document.querySelectorAll('[data-macro-range]'));
    let activeMacroRange = 'day';
    if (macroRangeButtons.length) {
        updateMacroRangeButtonState(macroRangeButtons, activeMacroRange);
        macroRangeButtons.forEach((button) => {
            button.addEventListener('click', () => {
                activeMacroRange = button.dataset.macroRange || 'day';
                updateMacroRangeButtonState(macroRangeButtons, activeMacroRange);
                renderMacroBalance(activeMacroRange);
                renderCarbSplit(activeMacroRange);
            });
        });
    }

    (async () => {
        await loadProfileFromServer();
        if (typeof window.syncDiaryEntriesWithBackend === 'function') {
            await window.syncDiaryEntriesWithBackend();
        }
        if (typeof window.syncHabitEntriesWithBackend === 'function') {
            await window.syncHabitEntriesWithBackend();
        }
        renderProfileRings();
        renderWeeklyProgress();
        renderCalorieTrend(Number(activeRange));
        renderWaterHistory(Number(activeWaterRange));
        renderMacroBalance(activeMacroRange);
        renderCarbSplit(activeMacroRange);
        renderMonthGrid();
        renderWeeklyAdjustments();
        renderWeeklyReview();
        applySubscriptionAccess();
        renderProfileRecommendations();
        renderHabitsPlanner();
        initReminderControls();
    })();
});
