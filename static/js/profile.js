// Скрипты визуальных блоков профиля

function createProgressRing({ percent, size = 120, stroke = 10, color = '#10b981', label, value, emphasize = false }) {
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const progress = Math.max(0, Math.min(percent, 100));

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
    percentText.textContent = `${Math.round(progress)}%`;

    svg.appendChild(backgroundCircle);
    svg.appendChild(progressCircle);
    svg.appendChild(percentText);

    const labelNode = document.createElement('div');
    labelNode.className = emphasize
        ? 'text-base font-semibold text-slate-800'
        : 'text-sm font-semibold text-slate-700';
    labelNode.textContent = label;

    const valueNode = document.createElement('div');
    valueNode.className = emphasize
        ? 'text-sm font-semibold text-slate-700'
        : 'text-xs text-slate-500';
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

function readFoodDiaryEntries() {
    const raw = localStorage.getItem('food_diary_entries');
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

function readManualDiaryEntries() {
    const raw = localStorage.getItem('health_bloom_food_entries');
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

function sumFoodDiaryCalories(entries) {
    const totalsByDate = new Map();
    entries.forEach((entry) => {
        if (!entry?.date) {
            return;
        }
        const calories = Array.isArray(entry.items)
            ? entry.items.reduce((sum, item) => sum + (Number(item?.calories) || 0), 0)
            : 0;
        totalsByDate.set(entry.date, (totalsByDate.get(entry.date) || 0) + calories);
    });
    return Array.from(totalsByDate.values());
}

function sumManualDiaryCalories(entries) {
    const totalsByDate = new Map();
    entries.forEach((entry) => {
        if (!entry?.date) {
            return;
        }
        const calories = Number(entry.calories) || 0;
        totalsByDate.set(entry.date, (totalsByDate.get(entry.date) || 0) + calories);
    });
    return Array.from(totalsByDate.values());
}

function getTodayDiaryTotals() {
    const today = new Date().toISOString().split('T')[0];
    const foodEntries = readFoodDiaryEntries();
    const manualEntries = readManualDiaryEntries();

    const totals = foodEntries.reduce(
        (acc, entry) => {
            if (entry?.date !== today || !Array.isArray(entry.items)) {
                return acc;
            }
            entry.items.forEach((item) => {
                acc.calories += Number(item?.calories) || 0;
                acc.protein += Number(item?.protein) || 0;
                acc.fat += Number(item?.fat) || 0;
                acc.carbs += Number(item?.carbs) || 0;
            });
            return acc;
        },
        { calories: 0, protein: 0, fat: 0, carbs: 0 }
    );

    manualEntries.forEach((entry) => {
        if (entry?.date !== today) {
            return;
        }
        totals.calories += Number(entry.calories) || 0;
        totals.protein += Number(entry.protein_g) || 0;
        totals.fat += Number(entry.fat_g) || 0;
        totals.carbs += Number(entry.carbs_g) || 0;
    });

    const hasEntries = totals.calories > 0 || totals.protein > 0 || totals.fat > 0 || totals.carbs > 0;
    return { ...totals, hasEntries };
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
        : 0;
    const caloriesValue = todayTotals.hasEntries && Number.isFinite(tdee)
        ? `${Math.round(todayTotals.calories)} / ${Math.round(tdee)} ккал`
        : 'нет данных';

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
            consumed: todayTotals.protein,
            percent: todayTotals.hasEntries && Number.isFinite(macros?.protein_g) && macros.protein_g > 0
                ? Math.round((todayTotals.protein / macros.protein_g) * 100)
                : 0,
            color: '#a855f7'
        },
        {
            label: 'Жиры',
            key: 'fat',
            consumed: todayTotals.fat,
            percent: todayTotals.hasEntries && Number.isFinite(macros?.fat_g) && macros.fat_g > 0
                ? Math.round((todayTotals.fat / macros.fat_g) * 100)
                : 0,
            color: '#f59e0b'
        },
        {
            label: 'Углеводы',
            key: 'carbs',
            consumed: todayTotals.carbs,
            percent: todayTotals.hasEntries && Number.isFinite(macros?.carbs_g) && macros.carbs_g > 0
                ? Math.round((todayTotals.carbs / macros.carbs_g) * 100)
                : 0,
            color: '#06b6d4'
        }
    ];

    macrosContainer.innerHTML = '';
    macroItems.forEach((item) => {
        const card = document.createElement('div');
        card.className = 'ring-compact shadow-sm border border-slate-100 flex justify-center';
        card.appendChild(
            createProgressRing({
                percent: item.percent,
                color: item.color,
                label: item.label,
                value: todayTotals.hasEntries ? `${Math.round(item.consumed)} г` : 'нет данных'
            })
        );
        macrosContainer.appendChild(card);
    });

    const waterAvg = profile?.weekly_stats?.water_avg_l;
    const waterTarget = Number(window.adminConfig?.reminders?.water_min_l);
    const hasWater = Number.isFinite(waterAvg);
    const waterPercent = hasWater && Number.isFinite(waterTarget) && waterTarget > 0
        ? Math.round((waterAvg / waterTarget) * 100)
        : 0;
    const waterValue = hasWater ? `${Number(waterAvg).toFixed(1)} л` : 'нет данных';

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
    const diaryEntries = [
        ...readFoodDiaryEntries(),
        ...readManualDiaryEntries()
    ];
    const daysWithEntries = new Set(
        diaryEntries
            .map((entry) => entry?.date)
            .filter(Boolean)
    );
    const days = 30;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < days; i += 1) {
        const date = new Date(today);
        date.setDate(today.getDate() - (days - 1 - i));
        const dateKey = date.toISOString().split('T')[0];
        const day = document.createElement('div');
        day.className = 'month-day';
        if (daysWithEntries.has(dateKey)) {
            day.classList.add('month-day--active');
        }
        day.textContent = date.getDate().toString();
        container.appendChild(day);
    }
}

function renderWeeklyProgress() {
    const container = document.getElementById('weekly-progress-grid');
    const emptyState = document.getElementById('weekly-progress-empty');
    if (!container || !emptyState) {
        return;
    }

    container.innerHTML = '';
    const diaryEntries = [
        ...readFoodDiaryEntries(),
        ...readManualDiaryEntries()
    ];
    const daysWithEntries = new Set(
        diaryEntries
            .map((entry) => entry?.date)
            .filter(Boolean)
    );

    const dayLabels = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];
    const today = new Date();
    const dayIndex = (today.getDay() + 6) % 7;
    const startDate = new Date(today);
    startDate.setHours(0, 0, 0, 0);
    startDate.setDate(today.getDate() - dayIndex);

    let filledDays = 0;
    for (let i = 0; i < 7; i += 1) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + i);
        const dateKey = currentDate.toISOString().split('T')[0];
        const isFilled = daysWithEntries.has(dateKey);
        if (isFilled) {
            filledDays += 1;
        }

        const item = document.createElement('div');
        item.className = 'text-center';

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'flex flex-col items-center gap-1';
        button.setAttribute('aria-label', `${dayLabels[i]}: ${isFilled ? 'Есть запись' : 'Нет данных'}`);

        if (isFilled) {
            const dot = document.createElement('div');
            dot.className = 'h-6 w-6 rounded-full bg-emerald-400';
            button.appendChild(dot);
        }

        const label = document.createElement('div');
        label.className = 'text-xs text-slate-500';
        label.textContent = dayLabels[i];
        button.appendChild(label);

        button.addEventListener('click', () => {
            if (typeof showNotification === 'function') {
                showNotification(isFilled ? 'Есть запись' : 'Нет данных', isFilled ? 'success' : 'error');
            }
        });

        item.appendChild(button);
        container.appendChild(item);
    }

    emptyState.classList.toggle('hidden', filledDays > 0);
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
        const entries = (() => {
            try {
                const raw = localStorage.getItem('food_diary_entries');
                return raw ? JSON.parse(raw) : [];
            } catch (error) {
                return [];
            }
        })();
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
