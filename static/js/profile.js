// Скрипты визуальных блоков профиля

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
    const raw = localStorage.getItem('bree_diary_entries');
    if (!raw) {
        return [];
    }
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        return [];
    }
}

function resolveEntryTotals(entry) {
    if (!entry) {
        return { calories: 0, protein_g: 0, fat_g: 0, carbs_g: 0, water_l: 0 };
    }
    if (entry.mode === 'products') {
        if (entry.totals) {
            return { ...entry.totals, water_l: Number(entry.water_l) || 0 };
        }
        if (Array.isArray(entry.items)) {
            return entry.items.reduce(
                (acc, item) => {
                    acc.calories += Number(item?.calories) || 0;
                    acc.protein_g += Number(item?.protein) || Number(item?.protein_g) || 0;
                    acc.fat_g += Number(item?.fat) || Number(item?.fat_g) || 0;
                    acc.carbs_g += Number(item?.carbs) || Number(item?.carbs_g) || 0;
                    return acc;
                },
                { calories: 0, protein_g: 0, fat_g: 0, carbs_g: 0, water_l: 0 }
            );
        }
    }
    return {
        calories: Number(entry.calories) || 0,
        protein_g: Number(entry.protein_g) || 0,
        fat_g: Number(entry.fat_g) || 0,
        carbs_g: Number(entry.carbs_g) || 0,
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
            waterMax = Math.max(waterMax, Number(entry?.water_l) || 0);
            return acc;
        },
        { calories: 0, protein_g: 0, fat_g: 0, carbs_g: 0, water_l: 0 }
    );

    const hasEntries = totals.calories > 0 || totals.protein_g > 0 || totals.fat_g > 0 || totals.carbs_g > 0 || waterMax > 0;
    return { ...totals, water_l: waterMax, hasEntries };
}

function renderProfileRings() {
    const caloriesContainer = document.getElementById('profile-calories-ring');
    const macrosContainer = document.getElementById('profile-macros-rings');
    const waterContainer = document.getElementById('profile-water-ring');

    if (!caloriesContainer || !macrosContainer || !waterContainer) {
        return;
    }

    const profile = typeof getUserProfile === 'function' ? getUserProfile() : {};
    const tdee = Number(profile?.tdee_calories);
    const todayTotals = getTodayDiaryTotals();
    const caloriesPercent = todayTotals.hasEntries && Number.isFinite(tdee) && tdee > 0
        ? (todayTotals.calories / tdee) * 100
        : null;
    const caloriesValue = todayTotals.hasEntries
        ? Number.isFinite(tdee)
            ? `Факт / цель: ${Math.round(todayTotals.calories)} / ${Math.round(tdee)} ккал`
            : `Факт: ${Math.round(todayTotals.calories)} ккал`
        : 'Нет данных';

    caloriesContainer.innerHTML = '';
    caloriesContainer.appendChild(
        createProgressRing({
            percent: caloriesPercent,
            color: '#10b981',
            label: 'Калории сегодня',
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

    animateCountUps(caloriesContainer);
    animateCountUps(macrosContainer);
    animateCountUps(waterContainer);
}

function renderMonthGrid() {
    const container = document.getElementById('profile-month-grid');
    if (!container) {
        return;
    }

    container.innerHTML = '';
    const diaryEntries = readDiaryEntries();
    const daysWithEntries = new Set(
        diaryEntries
            .map((entry) => (typeof window.normalizeLocalDate === 'function'
                ? window.normalizeLocalDate(entry?.date)
                : entry?.date))
            .filter(Boolean)
    );
    const days = 30;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayDate = typeof window.normalizeLocalDate === 'function'
        ? window.normalizeLocalDate(today)
        : null;
    for (let i = 0; i < days; i += 1) {
        const date = new Date(today);
        date.setDate(today.getDate() - (days - 1 - i));
        const dateKey = typeof window.normalizeLocalDate === 'function'
            ? window.normalizeLocalDate(date)
            : null;
        const day = document.createElement('a');
        day.className = 'month-day';
        day.href = dateKey ? `/diary?date=${dateKey}&mode=summary` : '/diary?mode=summary';
        if (todayDate && dateKey === todayDate) {
            day.classList.add('month-day--today');
        }
        if (dateKey && daysWithEntries.has(dateKey)) {
            day.classList.add('month-day--active');
        }
        day.textContent = date.getDate().toString();
        container.appendChild(day);
    }
}

function renderWeeklyProgress() {
    const container = document.getElementById('weekly-progress-grid');
    const percentElement = document.getElementById('weekly-progress-percent');
    const descElement = document.getElementById('weekly-progress-desc');
    if (!container || !percentElement || !descElement) {
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

    let totalPercent = 0;
    for (let i = 0; i < 7; i += 1) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + i);
        const dateKey = typeof window.normalizeLocalDate === 'function'
            ? window.normalizeLocalDate(currentDate)
            : null;
        const dateLabel = dateKey
            ? `${String(currentDate.getDate()).padStart(2, '0')}.${String(currentDate.getMonth() + 1).padStart(2, '0')}`
            : '';
        const dayCalories = dateKey ? (caloriesByDate.get(dateKey) || 0) : 0;
        const hasData = dateKey ? caloriesByDate.has(dateKey) : false;
        const dayPercent = Number.isFinite(targetCalories) && targetCalories > 0
            ? Math.min(Math.max(dayCalories / targetCalories, 0), 1)
            : 0;
        totalPercent += dayPercent;

        const item = document.createElement('a');
        item.className = 'weekly-day flex flex-col items-center gap-1 p-2';
        if (dateKey) {
            item.href = `/diary?date=${dateKey}&mode=summary`;
        } else {
            item.href = '/diary?mode=summary';
        }
        if (todayKey && dateKey === todayKey) {
            item.classList.add('is-today');
        }
        const bar = document.createElement('div');
        bar.className = 'w-6 rounded-full';
        bar.style.transition = 'height 220ms ease, background-color 220ms ease';
        const heightPercent = Math.min(Math.max(dayPercent * 100, 20), 100);
        if (!hasData) {
            bar.style.height = '20%';
            bar.style.background = '#e2e8f0';
        } else {
            bar.style.height = `${heightPercent}%`;
            bar.style.background = percentToGradientColor(dayPercent);
        }
        const barWrapper = document.createElement('div');
        barWrapper.className = 'w-full flex items-end justify-center';
        barWrapper.style.height = '80px';
        barWrapper.appendChild(bar);
        const label = document.createElement('div');
        label.className = 'text-xs text-slate-500';
        label.textContent = dayLabels[i];
        const dateText = document.createElement('div');
        dateText.className = 'text-[10px] text-slate-400';
        dateText.textContent = dateLabel;
        item.appendChild(barWrapper);
        item.appendChild(label);
        item.appendChild(dateText);
        container.appendChild(item);
    }

    const percent = Math.round((totalPercent / 7) * 100);
    percentElement.textContent = `${percent}%`;
    descElement.textContent = 'Учитываются записи дневника питания.';
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
    const analysis = analyzeWeeklyStats(profile);
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
        overeat: 'Калории выше ориентира',
        undereat: 'Калории ниже ориентира',
        low_protein: 'Нужно больше белка',
        low_discipline: 'Низкая регулярность',
        ok: 'Всё стабильно'
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
    if (typeof getUserProfile !== 'function' || typeof setUserProfile !== 'function') {
        return;
    }
    const profile = getUserProfile();
    const telegramUserId = profile.telegram_user_id;
    if (!telegramUserId) {
        return;
    }
    try {
        const response = await fetch(`/api/profile/get?telegram_user_id=${telegramUserId}`);
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

    (async () => {
        await loadProfileFromServer();
        renderProfileRings();
        renderWeeklyProgress();
        renderMonthGrid();
        renderWeeklyAdjustments();
        renderWeeklyReview();
        applySubscriptionAccess();
        renderProfileRecommendations();
    })();
});
