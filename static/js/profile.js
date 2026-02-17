// Скрипты визуальных блоков профиля

const apiFetch = window.apiFetch || fetch;

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


function getResolvedProfileForDisplay() {
    const baseProfile = typeof getUserProfile === 'function' ? (getUserProfile() || {}) : {};
    const profile = { ...baseProfile };

    // На части мобильных WebView сначала приходит только userData-слой.
    // Подмешиваем его в профиль, чтобы карточка «План на сегодня» не оставалась пустой.
    const userData = window.userData && typeof window.userData === 'object' ? window.userData : null;
    if (userData) {
        if (typeof mapUserDataToUserProfile === 'function') {
            const mapped = mapUserDataToUserProfile(userData);
            if (mapped && typeof mapped === 'object') {
                Object.entries(mapped).forEach(([key, value]) => {
                    if (profile[key] === null || profile[key] === undefined || profile[key] === '') {
                        profile[key] = value;
                    }
                });
            }
        } else {
            const fallbackMap = {
                gender: 'sex',
                birthDate: 'birth_date',
                height: 'height_cm',
                currentWeight: 'weight_kg',
                targetWeight: 'target_weight_kg',
                goalType: 'goal',
                activityLevel: 'activity_factor',
                deadline: 'goal_deadline'
            };
            Object.entries(fallbackMap).forEach(([userDataKey, profileKey]) => {
                if (profile[profileKey] === null || profile[profileKey] === undefined || profile[profileKey] === '') {
                    profile[profileKey] = userData[userDataKey];
                }
            });
        }
    }

    const hasFiniteNumber = (value) => value !== null && value !== undefined && Number.isFinite(Number(value));

    // Локальные безопасные версии расчётов нужны как fallback для мобильного WebView,
    // если calculations.js ещё не подгрузился из кеша/старого HTML.
    const calculateAgeSafe = (birthDate) => {
        if (typeof calculateAge === 'function') {
            return calculateAge(birthDate);
        }
        if (!birthDate) {
            return null;
        }
        const date = new Date(birthDate);
        if (Number.isNaN(date.getTime())) {
            return null;
        }
        const today = new Date();
        let age = today.getFullYear() - date.getFullYear();
        const monthDiff = today.getMonth() - date.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
            age -= 1;
        }
        return age > 0 ? age : null;
    };

    const calculateBMRSafe = ({ sex, weight_kg, height_cm, age }) => {
        if (typeof calculateBMR === 'function') {
            return calculateBMR({ sex, weight_kg, height_cm, age });
        }
        const weight = Number(weight_kg);
        const height = Number(height_cm);
        const years = Number(age);
        if (!sex || !Number.isFinite(weight) || !Number.isFinite(height) || !Number.isFinite(years)) {
            return null;
        }
        if (sex === 'male') {
            return 10 * weight + 6.25 * height - 5 * years + 5;
        }
        if (sex === 'female') {
            return 10 * weight + 6.25 * height - 5 * years - 161;
        }
        return null;
    };

    const calculateTDEESafe = (bmr, activityFactor) => {
        if (typeof calculateTDEE === 'function') {
            return calculateTDEE(bmr, activityFactor);
        }
        const base = Number(bmr);
        const factor = Number(activityFactor);
        if (!Number.isFinite(base) || !Number.isFinite(factor) || factor <= 0) {
            return null;
        }
        return base * factor;
    };

    const weight = Number(profile.weight_kg);
    const height = Number(profile.height_cm);
    const activityFactor = Number(profile.activity_factor);
    const hasWeight = Number.isFinite(weight) && weight > 0;
    const hasHeight = Number.isFinite(height) && height > 0;

    if (!hasFiniteNumber(profile.age) && profile.birth_date) {
        const calculatedAge = calculateAgeSafe(profile.birth_date);
        if (Number.isFinite(calculatedAge) && calculatedAge > 0) {
            profile.age = calculatedAge;
        }
    }

    const age = Number(profile.age);
    const hasAge = Number.isFinite(age) && age > 0;

    if (!hasFiniteNumber(profile.bmr) && profile.sex && hasWeight && hasHeight && hasAge) {
        const bmr = calculateBMRSafe({
            sex: profile.sex,
            weight_kg: weight,
            height_cm: height,
            age
        });
        if (Number.isFinite(bmr)) {
            profile.bmr = bmr;
        }
    }

    const bmr = Number(profile.bmr);
    if (!hasFiniteNumber(profile.tdee_calories) && Number.isFinite(bmr) && Number.isFinite(activityFactor) && activityFactor > 0) {
        const tdee = calculateTDEESafe(bmr, activityFactor);
        if (Number.isFinite(tdee)) {
            profile.tdee_calories = tdee;
        }
    }

    const tdee = Number(profile.tdee_calories);
    const caloriesTarget = Number(profile.calories_target);
    if (!hasFiniteNumber(profile.calories_target)) {
        if (typeof calculateWeightGoalForecast === 'function') {
            const forecast = calculateWeightGoalForecast({
                sex: profile.sex,
                goal: profile.goal,
                tdee_calories: Number.isFinite(tdee) ? tdee : null,
                weight_kg: hasWeight ? weight : null,
                target_weight_kg: profile.target_weight_kg,
                goal_deadline: profile.goal_deadline
            });
            const forecastCalories = Number(forecast?.calories_target);
            if (Number.isFinite(forecastCalories) && forecastCalories > 0) {
                profile.calories_target = forecastCalories;
            }
        }

        // Резервный расчёт для отображения карточки, если forecast-функция недоступна.
        if (!hasFiniteNumber(profile.calories_target) && Number.isFinite(tdee) && tdee > 0) {
            if (profile.goal === 'lose') {
                profile.calories_target = Math.max(1200, Math.round(tdee * 0.85));
            } else if (profile.goal === 'gain') {
                profile.calories_target = Math.round(tdee * 1.1);
            } else {
                profile.calories_target = Math.round(tdee);
            }
        }
    }

    if ((!profile.macros || typeof profile.macros !== 'object')) {
        const resolvedCalories = Number(profile.calories_target);
        if (Number.isFinite(resolvedCalories) && resolvedCalories > 0 && hasWeight && profile.goal) {
            if (typeof calculateMacros === 'function') {
                const macros = calculateMacros({
                    goal: profile.goal,
                    weight_kg: weight,
                    calories_target: resolvedCalories
                });
                if (macros) {
                    profile.macros = macros;
                }
            } else {
                const proteinFactor = profile.goal === 'lose' ? 1.8 : 1.6;
                const protein_g = proteinFactor * weight;
                const fat_g = Math.min(90, Math.max(45, 0.8 * weight));
                const carbs_g = Math.max((resolvedCalories - (protein_g * 4 + fat_g * 9)) / 4, 0);
                profile.macros = {
                    protein_g,
                    fat_g,
                    carbs_g,
                    protein_pct: (protein_g * 4) / resolvedCalories,
                    fat_pct: (fat_g * 9) / resolvedCalories,
                    carbs_pct: (carbs_g * 4) / resolvedCalories
                };
            }
        }
    }

    return profile;
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

function resolveStatusTone({ type, ratio }) {
    if (type === 'calories') {
        if (!Number.isFinite(ratio)) {
            return { tone: 'neutral', color: '#e2e8f0', bgClass: 'bg-slate-300' };
        }
        if (ratio < 0.9) {
            return { tone: 'warning', color: '#facc15', bgClass: 'bg-yellow-400' };
        }
        if (ratio > 1.1) {
            return { tone: 'danger', color: '#f43f5e', bgClass: 'bg-rose-500' };
        }
        return { tone: 'success', color: '#10b981', bgClass: 'bg-emerald-400' };
    }
    if (type === 'water') {
        if (!Number.isFinite(ratio)) {
            return { tone: 'neutral', color: '#e2e8f0', bgClass: 'bg-slate-300' };
        }
        if (ratio >= 1) {
            return { tone: 'success', color: '#10b981', bgClass: 'bg-emerald-400' };
        }
        return { tone: 'warning', color: '#7dd3fc', bgClass: 'bg-sky-300' };
    }
    if (type === 'weekly') {
        if (ratio === 'overeat') {
            return { tone: 'danger', color: '#f43f5e', bgClass: 'bg-rose-500' };
        }
        if (ratio === 'low_protein' || ratio === 'undereat' || ratio === 'low_discipline') {
            return { tone: 'warning', color: '#facc15', bgClass: 'bg-yellow-400' };
        }
        if (ratio === 'ok') {
            return { tone: 'success', color: '#10b981', bgClass: 'bg-emerald-400' };
        }
        return { tone: 'neutral', color: '#e2e8f0', bgClass: 'bg-slate-300' };
    }
    if (type === 'month') {
        if (ratio === 'good' || ratio === 1 || ratio === true) {
            return { tone: 'success', color: '#10b981', bgClass: 'bg-emerald-400' };
        }
        if (ratio === 'bad' || ratio === -1 || ratio === false) {
            return { tone: 'danger', color: '#ef4444', bgClass: 'bg-rose-500' };
        }
        if (ratio === 'neutral' || ratio === 'empty' || ratio === null) {
            return { tone: 'neutral', color: '#e2e8f0', bgClass: 'bg-slate-300' };
        }
        return { tone: 'neutral', color: '#e2e8f0', bgClass: 'bg-slate-300' };
    }
    return { tone: 'neutral', color: '#e2e8f0', bgClass: 'bg-slate-300' };
}

function resolveCalorieTone(dayCalories, targetCalories) {
    const ratio = Number.isFinite(targetCalories) && targetCalories > 0
        ? safeDivide(dayCalories, targetCalories)
        : NaN;
    const tone = resolveStatusTone({ type: 'calories', ratio });
    if (tone.tone === 'warning') {
        return { color: tone.color, label: 'меньше нужного' };
    }
    if (tone.tone === 'danger') {
        return { color: tone.color, label: 'больше нужного' };
    }
    if (tone.tone === 'success') {
        return { color: tone.color, label: 'в нужном диапазоне' };
    }
    return { color: tone.color, label: 'ориентир не рассчитан' };
}

function safeDivide(a, b) {
    if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) {
        return 0;
    }
    return a / b;
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

function updateWaterRangeButtonState(buttons, activeValue) {
    buttons.forEach((button) => {
        const isActive = button.dataset.waterRange === activeValue;
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
    if (!grid) {
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
    const maxWater = range.reduce((maxValue, { dateKey }) => {
        const value = dateKey ? (waterByDate.get(dateKey) || 0) : 0;
        return Math.max(maxValue, value);
    }, 0);
    const hasValidTarget = Number.isFinite(target) && target > 0;
    const scale = Math.max(maxWater, hasValidTarget ? target : 0, 1);

    grid.innerHTML = '';
    grid.classList.remove('grid-cols-7');
    grid.classList.remove('grid-cols-10');
    grid.classList.add(rangeDays === 30 ? 'grid-cols-10' : 'grid-cols-7');

    range.forEach(({ date, dateKey }) => {
        const dayWater = dateKey ? (waterByDate.get(dateKey) || 0) : 0;
        const height = Math.round(Math.min(Math.max(safeDivide(dayWater, scale) * 100, 0), 100));
        const dayLabel = `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}`;
        const waterRatio = hasValidTarget ? safeDivide(dayWater, target) : NaN;
        const waterTone = resolveStatusTone({ type: 'water', ratio: waterRatio });
        const barColor = waterTone.color;

        const item = document.createElement('div');
        item.className = 'flex flex-col items-center gap-1';

        const barWrapper = document.createElement('div');
        barWrapper.className = 'w-full flex items-end justify-center';
        barWrapper.style.height = rangeDays === 30 ? '48px' : '62px';

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

    // Для режима "Сегодня" проценты круга считаем из тех же округлённых значений,
    // которые уже показываем пользователю в блоке "Факт / цель".
    // Иначе возникают визуальные расхождения вида "Ж: 0 г", но в круге есть доля жиров.
    const displayProtein = rangeKey === 'day' ? Math.max(0, Math.round(protein)) : protein;
    const displayFat = rangeKey === 'day' ? Math.max(0, Math.round(fat)) : fat;
    const displayCarbs = rangeKey === 'day' ? Math.max(0, Math.round(carbs)) : carbs;

    let proteinPercent = 0;
    let fatPercent = 0;
    let carbsPercent = 0;
    let chartGradient = '#e2e8f0';
    let total = displayProtein + displayFat + displayCarbs;

    // Для режима "Сегодня" проценты должны отражать выполнение цели,
    // а не только фактическое распределение между макросами.
    if (rangeKey === 'day') {
        const profile = getResolvedProfileForDisplay();
        const targetProtein = Number(profile?.macros?.protein_g);
        const targetFat = Number(profile?.macros?.fat_g);
        const targetCarbs = Number(profile?.macros?.carbs_g);
        const hasMacroTargets = [targetProtein, targetFat, targetCarbs].every((value) => Number.isFinite(value) && value > 0);

        if (hasMacroTargets) {
            const progressProtein = Math.max(0, Math.min(safeDivide(displayProtein, targetProtein), 1));
            const progressFat = Math.max(0, Math.min(safeDivide(displayFat, targetFat), 1));
            const progressCarbs = Math.max(0, Math.min(safeDivide(displayCarbs, targetCarbs), 1));

            proteinPercent = Math.round(progressProtein * 100);
            fatPercent = Math.round(progressFat * 100);
            carbsPercent = Math.round(progressCarbs * 100);

            const totalTarget = targetProtein + targetFat + targetCarbs;
            const proteinArc = (Math.min(displayProtein, targetProtein) / totalTarget) * 100;
            const fatArc = (Math.min(displayFat, targetFat) / totalTarget) * 100;
            const carbsArc = (Math.min(displayCarbs, targetCarbs) / totalTarget) * 100;
            const usedArc = Math.max(0, Math.min(proteinArc + fatArc + carbsArc, 100));

            chartGradient = `conic-gradient(#10b981 0 ${proteinArc}%, #f59e0b ${proteinArc}% ${proteinArc + fatArc}%, #38bdf8 ${proteinArc + fatArc}% ${usedArc}%, #e2e8f0 ${usedArc}% 100%)`;
            total = usedArc;
            desc.textContent = 'Процент выполнения целей БЖУ за сегодня.';
        }
    }

    if (total > 0 && chartGradient === '#e2e8f0') {
        const safeTotal = total > 0 ? total : 1;
        proteinPercent = Math.round((displayProtein / safeTotal) * 100);
        fatPercent = Math.round((displayFat / safeTotal) * 100);
        carbsPercent = Math.max(0, 100 - proteinPercent - fatPercent);
        chartGradient = `conic-gradient(#10b981 0 ${proteinPercent}%, #f59e0b ${proteinPercent}% ${proteinPercent + fatPercent}%, #38bdf8 ${proteinPercent + fatPercent}% 100%)`;
    }

    if (total <= 0) {
        chart.style.background = '#e2e8f0';
        desc.textContent = 'Нет данных для расчёта.';
        insight.textContent = 'Пока нет записей, поэтому распределение не видно.';
        proteinLabel.textContent = 'Белки — 0%';
        fatLabel.textContent = 'Жиры — 0%';
        carbsLabel.textContent = 'Углеводы — 0%';
        return;
    }

    chart.style.background = chartGradient;
    if (rangeKey !== 'day' || desc.textContent !== 'Процент выполнения целей БЖУ за сегодня.') {
        desc.textContent = label;
    }
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
    if (!grid) {
        return;
    }

    const profile = getResolvedProfileForDisplay();
    const targetCalories = Number(profile?.calories_target ?? profile?.tdee_calories);
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
    const maxCalories = range.reduce((maxValue, { dateKey }) => {
        const value = dateKey ? (caloriesByDate.get(dateKey) || 0) : 0;
        return Math.max(maxValue, value);
    }, 0);
    const hasValidTarget = Number.isFinite(targetCalories) && targetCalories > 0;
    const scale = Math.max(maxCalories, hasValidTarget ? targetCalories : 0, 1);

    grid.innerHTML = '';
    grid.classList.remove('grid-cols-7');
    grid.classList.remove('grid-cols-10');
    grid.classList.add(rangeDays === 30 ? 'grid-cols-10' : 'grid-cols-7');

    range.forEach(({ date, dateKey }) => {
        const dayCalories = dateKey ? (caloriesByDate.get(dateKey) || 0) : 0;
        const height = Math.round(Math.min(Math.max(safeDivide(dayCalories, scale) * 100, 0), 100));
        const tone = hasValidTarget
            ? resolveCalorieTone(dayCalories, targetCalories)
            : resolveStatusTone({ type: 'calories', ratio: NaN });
        const dayLabel = `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}`;

        const item = document.createElement('div');
        item.className = 'flex flex-col items-center gap-1';

        const barWrapper = document.createElement('div');
        barWrapper.className = 'w-full flex items-end justify-center';
        barWrapper.style.height = rangeDays === 30 ? '48px' : '62px';

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

function renderTodayPlanCard() {
    const caloriesElement = document.getElementById('today-fact-calories');
    const proteinElement = document.getElementById('today-fact-protein');
    const fatElement = document.getElementById('today-fact-fat');
    const carbsElement = document.getElementById('today-fact-carbs');
    const waterElement = document.getElementById('today-fact-water');

    if (!caloriesElement || !proteinElement || !fatElement || !carbsElement || !waterElement) {
        return;
    }

    const profile = getResolvedProfileForDisplay();
    const todayTotals = getTodayDiaryTotals();

    const targetCalories = Number(profile?.calories_target ?? profile?.tdee_calories);
    const targetProtein = Number(profile?.macros?.protein_g);
    const targetFat = Number(profile?.macros?.fat_g);
    const targetCarbs = Number(profile?.macros?.carbs_g);
    const targetWater = Number(window.adminConfig?.reminders?.water_min_l);

    const caloriesFact = Math.round(todayTotals.calories || 0);
    const proteinFact = Math.round(todayTotals.protein_g || 0);
    const fatFact = Math.round(todayTotals.fat_g || 0);
    const carbsFact = Math.round(todayTotals.carbs_g || 0);
    const waterFact = Number(todayTotals.water_l) || 0;

    caloriesElement.textContent = Number.isFinite(targetCalories) && targetCalories > 0
        ? `${caloriesFact} / ${Math.round(targetCalories)} ккал`
        : `${caloriesFact} ккал`;
    proteinElement.textContent = Number.isFinite(targetProtein) && targetProtein > 0
        ? `Б: ${proteinFact} / ${Math.round(targetProtein)} г`
        : `Б: ${proteinFact} г`;
    fatElement.textContent = Number.isFinite(targetFat) && targetFat > 0
        ? `Ж: ${fatFact} / ${Math.round(targetFat)} г`
        : `Ж: ${fatFact} г`;
    carbsElement.textContent = Number.isFinite(targetCarbs) && targetCarbs > 0
        ? `У: ${carbsFact} / ${Math.round(targetCarbs)} г`
        : `У: ${carbsFact} г`;
    waterElement.textContent = Number.isFinite(targetWater) && targetWater > 0
        ? `${waterFact.toFixed(1)} / ${targetWater.toFixed(1)} л`
        : `${waterFact.toFixed(1)} л`;
}

function renderWeeklyProgress() {
    const container = document.getElementById('weekly-progress-grid');
    const percentElement = document.getElementById('weekly-progress-percent');
    const descElement = document.getElementById('weekly-progress-desc');
    const insight = document.getElementById('weekly-progress-insight');
    if (!percentElement) {
        return;
    }

    if (container) {
        container.innerHTML = '';
    }

    const dayLabels = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];
    const today = new Date();
    const todayKey = typeof window.normalizeLocalDate === 'function'
        ? window.normalizeLocalDate(today)
        : null;
    const dayIndex = (today.getDay() + 6) % 7;
    const startDate = new Date(today);
    startDate.setHours(0, 0, 0, 0);
    startDate.setDate(today.getDate() - dayIndex);
    const profile = getResolvedProfileForDisplay();
    const targetCalories = Number(profile?.calories_target ?? profile?.tdee_calories);

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
    let totalPercent = 0;
    let loggedDays = 0;
    let totalCalories = 0;
    const hasValidTarget = Number.isFinite(targetCalories) && targetCalories > 0;
    for (let i = 0; i < 7; i += 1) {
        const { dateKey, date: currentDate } = weekDates[i];
        const dateLabel = dateKey
            ? `${String(currentDate.getDate()).padStart(2, '0')}.${String(currentDate.getMonth() + 1).padStart(2, '0')}`
            : '';
        const dayCalories = dateKey ? (caloriesByDate.get(dateKey) || 0) : 0;
        const hasData = dateKey ? caloriesByDate.has(dateKey) : false;
        const dayPercent = hasValidTarget
            ? Math.min(Math.max(safeDivide(dayCalories, targetCalories), 0), 1)
            : 0;
        totalPercent += dayPercent;
        if (hasData) {
            loggedDays += 1;
            totalCalories += dayCalories;
        }

        if (container) {
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
    }

    const resolveWeeklyPercent = () => {
        if (!hasValidTarget) {
            return 0;
        }
        return Math.round(Math.min(Math.max(safeDivide(totalPercent, 7) * 100, 0), 100));
    };
    const percent = resolveWeeklyPercent();
    percentElement.textContent = `${percent}%`;
    if (descElement) {
        descElement.textContent = 'Учитываются записи дневника питания.';
    }
    if (!loggedDays) {
        if (insight) {
            insight.textContent = 'Пока нет записей за неделю. Добавьте несколько дней — и появится понятный вывод.';
        }
        return;
    }
    if (loggedDays < 3) {
        if (insight) {
            insight.textContent = 'Записей пока мало, вывод приблизительный. Попробуйте отмечать питание чаще.';
        }
        return;
    }
    if (!hasValidTarget) {
        if (insight) {
            insight.textContent = 'Есть записи за неделю, но ориентир не задан. Старайтесь держать дни более ровными.';
        }
        return;
    }
    const avgCalories = totalCalories / loggedDays;
    if (avgCalories >= targetCalories * 1.1) {
        if (insight) {
            insight.textContent = 'В среднем за неделю калорий было больше нужного. Если хотите ближе к цели, уменьшайте порции постепенно.';
        }
    } else if (avgCalories <= targetCalories * 0.9) {
        if (insight) {
            insight.textContent = 'В среднем за неделю калорий было меньше нужного. Можно добавить небольшой перекус, чтобы поддерживать энергию.';
        }
    } else {
        if (insight) {
            insight.textContent = 'Неделя выглядит ровно — вы держите хороший ритм.';
        }
    }
}

function renderMonthGrid() {
    const grid = document.getElementById('profile-month-grid');
    if (!grid) {
        return;
    }

    grid.innerHTML = '';

    const profile = getResolvedProfileForDisplay();
    const targetCalories = Number(profile?.calories_target ?? profile?.tdee_calories);
    const hasValidTarget = Number.isFinite(targetCalories) && targetCalories > 0;

    const entries = readDiaryEntries();
    const caloriesByDate = new Map();
    entries.forEach((entry) => {
        const dateKey = normalizeDateKey(entry?.date);
        if (!dateKey) {
            return;
        }
        const totals = resolveEntryTotals(entry);
        const calories = Number(totals.calories) || 0;
        if (calories <= 0) {
            return;
        }
        const current = caloriesByDate.get(dateKey) || 0;
        caloriesByDate.set(dateKey, current + calories);
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayKey = normalizeDateKey(today);

    for (let i = 29; i >= 0; i -= 1) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const dateKey = normalizeDateKey(date);

        const cell = document.createElement('a');
        cell.className = 'month-day';
        cell.textContent = String(date.getDate()).padStart(2, '0');
        cell.href = dateKey ? `/diary?date=${dateKey}&mode=day` : '/diary?mode=day';

        const dayCalories = dateKey ? (caloriesByDate.get(dateKey) || 0) : 0;
        const hasData = Boolean(dateKey && caloriesByDate.has(dateKey));

        if (!hasData) {
            cell.classList.add('month-day--empty');
        } else if (!hasValidTarget) {
            cell.classList.add('month-day--active');
        } else {
            const ratio = safeDivide(dayCalories, targetCalories);
            if (ratio >= 0.9 && ratio <= 1.1) {
                cell.classList.add('month-day--good');
            } else {
                cell.classList.add('month-day--bad');
            }
        }

        if (todayKey && dateKey === todayKey) {
            cell.classList.add('month-day--today');
        }

        grid.appendChild(cell);
    }
}

function renderWeeklyAdjustments() {
    const weeklyReviewCard = document.getElementById('profile-weekly-review');
    const list = weeklyReviewCard?.querySelector('#profile-weekly-adjustments-list')
        || document.getElementById('profile-weekly-adjustments-list');
    if (!list) {
        return;
    }
    if (typeof getUserProfile !== 'function' || typeof analyzeWeeklyStats !== 'function') {
        return;
    }

    const profile = getResolvedProfileForDisplay();
    const entries = readDiaryEntries();
    const analysis = analyzeWeeklyStats(profile, entries);
    const rawAdjustments = Array.isArray(analysis?.adjustments)
        ? analysis.adjustments
        : [];

    const uniqueAdjustments = [];
    const seen = new Set();
    rawAdjustments.forEach((item) => {
        if (typeof item !== 'string') {
            return;
        }
        const normalized = item.trim();
        if (normalized.length < 5) {
            return;
        }
        if (seen.has(normalized)) {
            return;
        }
        seen.add(normalized);
        uniqueAdjustments.push(normalized);
    });

    if (!uniqueAdjustments.length) {
        list.classList.add('hidden');
        list.innerHTML = '';
        return;
    }

    list.classList.remove('hidden');

    if (typeof patchUserProfile === 'function') {
        patchUserProfile({ weekly_adjustments: analysis?.text });
    }

    list.innerHTML = '';
    uniqueAdjustments.slice(0, 3).forEach((item) => {
        const li = document.createElement('li');
        li.className = 'flex items-start gap-2';
        li.innerHTML = '<span class="text-amber-500">•</span>';
        const span = document.createElement('span');
        span.className = 'weekly-review-clamp';
        span.textContent = item;
        li.appendChild(span);
        list.appendChild(li);
    });
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

    const profile = getResolvedProfileForDisplay();
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
    const weeklyTone = resolveStatusTone({ type: 'weekly', ratio: review.status });

    indicator.className = `inline-flex h-3 w-3 rounded-full ${weeklyTone.bgClass || 'bg-slate-300'}`;
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
        const response = await apiFetch('/api/profile/get');
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
        renderTodayPlanCard();
        renderWeeklyProgress();
        renderCalorieTrend(Number(activeRange));
        renderWaterHistory(Number(activeWaterRange));
        renderMacroBalance(activeMacroRange);
        renderCarbSplit(activeMacroRange);
        renderMonthGrid();
        renderWeeklyAdjustments();
        renderWeeklyReview();
    })();
});
