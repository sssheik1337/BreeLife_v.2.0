// Заглушки для персонализированных текстов без внешних API

function updateAiBadgesVisibility() {
    const isAiDisabled = window.aiEnabled === false;
    document.querySelectorAll('[data-ai-badge]').forEach((badge) => {
        if (isAiDisabled) {
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    });
}

function formatDateForUser(dateString) {
    if (!dateString) {
        return null;
    }
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) {
        return null;
    }
    return date.toLocaleDateString('ru-RU');
}

function getGoalLabel(goal) {
    const goalMap = {
        lose: 'похудение',
        gain: 'набор веса',
        muscle: 'набор мышечной массы',
        maintain: 'поддержание формы'
    };
    return goalMap[goal] || 'здоровый баланс';
}

function getActivityLabel(activityFactor) {
    const factor = Number(activityFactor);
    if (!Number.isFinite(factor)) {
        return null;
    }
    if (factor <= 1.3) {
        return 'Низкая активность';
    }
    if (factor <= 1.6) {
        return 'Умеренная активность';
    }
    return 'Высокая активность';
}

function getDiaryExplanation(profile) {
    if (!profile) {
        return 'Дневник питания помогает замечать привычки и держать курс.';
    }
    if (profile.food_diary === true) {
        return 'Отлично! Дневник поможет сохранить фокус.';
    }
    if (profile.food_diary === false) {
        return 'Если захочется, дневник можно подключить позже.';
    }
    return 'Дневник питания — простой способ держать план.';
}

function getCaloriesExplanation(profile) {
    const tdee = profile?.tdee_calories;
    const activity = profile?.activity_factor;
    const activityLabel = getActivityLabel(activity);
    const goalLabel = getGoalLabel(profile?.goal);
    if (!tdee) {
        return `Мы учтём активность и цель (${goalLabel}), чтобы подсказать ориентир.`;
    }
    if (activityLabel) {
        return `При уровне «${activityLabel}» ориентир около ${Math.round(tdee)} ккал в день.`;
    }
    return `Ориентир по калориям — около ${Math.round(tdee)} ккал в день.`;
}

function getMacrosExplanation(profile) {
    const macros = profile?.macros;
    if (!macros) {
        return 'Баланс белков, жиров и углеводов помогает сохранять энергию и темп.';
    }
    return `Белки ${Math.round(macros.protein_pct * 100)}%, жиры ${Math.round(macros.fat_pct * 100)}%, углеводы ${Math.round(macros.carbs_pct * 100)}%.`;
}

function getRecommendations(profile) {
    const recommendations = [];
    const goalLabel = getGoalLabel(profile?.goal);
    const goalKey = profile?.goal;
    const activity = profile?.activity_factor;
    const activityLabel = getActivityLabel(activity);
    const tdee = profile?.tdee_calories;
    const predictedDate = formatDateForUser(profile?.predicted_goal_date);
    const currentWeight = Number(profile?.weight_kg);
    const targetWeight = Number(profile?.target_weight_kg);

    if (goalKey === 'lose') {
        recommendations.push('Цель — похудение. Двигайтесь спокойно и уверенно.');
    } else if (goalKey === 'gain') {
        recommendations.push('Цель — набор веса. Небольшие шаги дают стабильный результат.');
    } else if (goalKey === 'muscle') {
        recommendations.push('Цель — набор мышц. Регулярность будет вашим союзником.');
    } else if (goalKey === 'maintain') {
        recommendations.push('Цель — поддержание формы. Всё уже хорошо, просто держим ритм.');
    } else {
        recommendations.push(`Цель: ${goalLabel}.`);
    }

    if (Number.isFinite(currentWeight) && Number.isFinite(targetWeight)) {
        const delta = Math.abs(targetWeight - currentWeight);
        recommendations.push(`До цели осталось около ${delta.toFixed(1)} кг.`);
    }

    if (activityLabel) {
        recommendations.push(`Уровень активности: ${activityLabel}. Это хороший ориентир для стабильного темпа.`);
    } else {
        recommendations.push('Добавьте немного движения — это поддержит настрой.');
    }

    if (tdee) {
        recommendations.push(`Ориентир по калориям: около ${Math.round(tdee)} ккал в день.`);
    }

    if (predictedDate) {
        recommendations.push(`Ориентировочная дата достижения цели: ${predictedDate}.`);
    }

    if (profile?.food_diary === true) {
        recommendations.push('Записывайте приёмы пищи — так легче видеть прогресс.');
    } else if (profile?.food_diary === false) {
        recommendations.push('Можно попробовать дневник пару раз в неделю для ясности.');
    }

    return recommendations.slice(0, 5);
}

function getDeadlineMotivation(profile) {
    const deadlineRaw = profile?.predicted_goal_date || profile?.goal_deadline;
    if (!deadlineRaw) {
        return '';
    }
    const deadlineDate = new Date(deadlineRaw);
    if (Number.isNaN(deadlineDate.getTime())) {
        return '';
    }
    const now = new Date();
    const diffMs = deadlineDate.getTime() - now.getTime();
    const weeks = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 7)));
    const deadline = formatDateForUser(deadlineRaw);
    if (!deadline || weeks === 0) {
        return '';
    }
    return `У вас есть около ${weeks} нед. до ${deadline} — отличный горизонт, чтобы двигаться спокойно.`;
}

function getPaywallMotivation(profile, entriesCount = 0) {
    const goalLabel = getGoalLabel(profile?.goal);
    const deadlineRaw = profile?.predicted_goal_date || profile?.goal_deadline;
    const deadline = formatDateForUser(deadlineRaw);
    const deviation = profile?.deviation_comment;
    const progressText = entriesCount > 0
        ? `Вы уже внесли ${entriesCount} записей в дневник.`
        : 'Вы уже сформировали цель и начали путь.';
    const deadlineText = deadline ? `Цель запланирована на ${deadline}.` : `Цель: ${goalLabel}.`;
    const deviationText = deviation ? `Сейчас важно удержать курс: ${deviation}` : 'Без прогноза и рекомендаций сложнее удерживать темп.';

    return `${progressText} ${deadlineText} ${deviationText} Подписка сохранит для вас прогноз и персональные подсказки.`;
}

function getDeviationStatusFromEntries(entries, tdee, today = new Date()) {
    if (!Array.isArray(entries) || !entries.length) {
        return { status: 'no_data', message: 'Нет данных за последние дни.' };
    }
    const normalizedToday = new Date(today);
    normalizedToday.setHours(0, 0, 0, 0);

    const parseEntryDate = (value) => {
        if (!value) {
            return null;
        }
        const parsed = new Date(`${value}T00:00:00`);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    };

    const lastEntryDate = parseEntryDate(entries[0]?.date);
    if (!lastEntryDate) {
        return { status: 'no_data', message: 'Нет данных за последние дни.' };
    }
    const gapDays = Math.floor((normalizedToday - lastEntryDate) / (1000 * 60 * 60 * 24));
    if (gapDays >= 2) {
        return { status: 'no_data', message: 'Дневник не заполнен более двух дней.' };
    }

    const totalsByDate = new Map();
    entries.forEach((entry) => {
        const entryDate = parseEntryDate(entry.date);
        if (!entryDate) {
            return;
        }
        const diffDays = Math.floor((normalizedToday - entryDate) / (1000 * 60 * 60 * 24));
        if (diffDays >= 0 && diffDays < 7) {
            let calories = Number(entry.calories) || 0;
            if (entry?.mode === 'products' && Array.isArray(entry.items)) {
                calories = entry.items.reduce((sum, item) => sum + (Number(item?.calories) || 0), 0);
            }
            totalsByDate.set(entry.date, (totalsByDate.get(entry.date) || 0) + calories);
        }
    });

    if (!totalsByDate.size) {
        return { status: 'no_data', message: 'Нет данных за последние 7 дней.' };
    }

    if (typeof tdee !== 'number') {
        return { status: 'ok', message: 'Ориентир по калориям пока не рассчитан.' };
    }

    const total = Array.from(totalsByDate.values()).reduce((sum, value) => sum + value, 0);
    const avg = total / totalsByDate.size;
    const thresholds = window.adminConfig?.calorie_threshold || {};
    const overeatThreshold = Number.isFinite(thresholds.overeat) ? thresholds.overeat : 0.1;
    const undereatThreshold = Number.isFinite(thresholds.undereat) ? thresholds.undereat : 0.1;
    const deviation = (avg - tdee) / tdee;
    if (deviation > overeatThreshold) {
        return { status: 'overeat', message: 'Похоже на переедание.' };
    }
    if (deviation < -undereatThreshold) {
        return { status: 'undereat', message: 'Похоже на недоедание.' };
    }
    return { status: 'ok', message: 'План соблюдается.' };
}

function getFoodDiaryDeviationStatus(profile) {
    const entries = typeof window.getDiaryEntries === 'function'
        ? window.getDiaryEntries()
        : [];
    const tdee = typeof profile?.tdee_calories === 'number' ? profile.tdee_calories : null;
    return getDeviationStatusFromEntries(entries, tdee);
}

document.addEventListener('DOMContentLoaded', () => {
    // Показываем бейджи только когда ИИ отключён.
    updateAiBadgesVisibility();
});

async function getPaymentMotivation(profile, deviations) {
    const goalLabel = getGoalLabel(profile?.goal);
    const deadlineRaw = profile?.predicted_goal_date || profile?.goal_deadline;
    const deadline = formatDateForUser(deadlineRaw);
    const diaryText = profile?.food_diary
        ? 'Вы уже начали вести дневник питания.'
        : 'Дневник питания пока не подключён.';
    const deviationText = deviations?.status === 'overeat'
        ? 'Сейчас есть риск переедания.'
        : deviations?.status === 'undereat'
            ? 'Сейчас есть риск недоедания.'
            : deviations?.status === 'no_data'
                ? 'Пока не хватает данных, чтобы оценить отклонения.'
                : 'Отклонений от плана не видно.';
    const deadlineText = deadline ? `Срок цели: ${deadline}.` : `Цель: ${goalLabel}.`;

    const fallback = `${deadlineText} ${diaryText} ${deviationText} Платная версия поможет держать курс и не терять прогресс.`;

    if (window.aiEnabled !== true) {
        return fallback;
    }

    try {
        const response = await fetch('/api/ai/recommendation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...profile,
                source: 'payment_motivation',
                deviations
            })
        });
        if (!response.ok) {
            return fallback;
        }
        const data = await response.json();
        if (data?.text) {
            return data.text;
        }
    } catch (error) {
        return fallback;
    }

    return fallback;
}

function analyzeWeeklyNutrition(profile, foodDiary) {
    const entries = Array.isArray(foodDiary) ? foodDiary : [];
    const now = new Date();
    const weekEndDate = new Date(now);
    weekEndDate.setHours(0, 0, 0, 0);
    const weekStartDate = new Date(weekEndDate);
    weekStartDate.setDate(weekStartDate.getDate() - 6);

    const weekStart = weekStartDate.toISOString().split('T')[0];
    const weekEnd = weekEndDate.toISOString().split('T')[0];

    const totalsByDate = new Map();
    entries.forEach((entry) => {
        const entryDate = entry?.date;
        if (!entryDate || entryDate < weekStart || entryDate > weekEnd) {
            return;
        }
        let calories = Number(entry.calories) || 0;
        let protein = Number(entry.protein) || Number(entry.protein_g) || 0;
        let fat = Number(entry.fat) || Number(entry.fat_g) || 0;
        let carbs = Number(entry.carbs) || Number(entry.carbs_g) || 0;
        if (entry?.mode === 'products' && Array.isArray(entry.items)) {
            calories = entry.items.reduce((sum, item) => sum + (Number(item?.calories) || 0), 0);
            protein = entry.items.reduce((sum, item) => sum + (Number(item?.protein) || 0), 0);
            fat = entry.items.reduce((sum, item) => sum + (Number(item?.fat) || 0), 0);
            carbs = entry.items.reduce((sum, item) => sum + (Number(item?.carbs) || 0), 0);
        }
        const existing = totalsByDate.get(entryDate) || {
            calories: 0,
            protein: 0,
            fat: 0,
            carbs: 0
        };
        totalsByDate.set(entryDate, {
            calories: existing.calories + calories,
            protein: existing.protein + protein,
            fat: existing.fat + fat,
            carbs: existing.carbs + carbs
        });
    });

    const daysLogged = totalsByDate.size;
    const totals = Array.from(totalsByDate.values()).reduce(
        (acc, day) => {
            acc.calories += day.calories;
            acc.protein += day.protein;
            acc.fat += day.fat;
            acc.carbs += day.carbs;
            return acc;
        },
        { calories: 0, protein: 0, fat: 0, carbs: 0 }
    );

    const divisor = daysLogged || 1;
    const avgCalories = totals.calories / divisor;
    const avgProtein = totals.protein / divisor;
    const avgFat = totals.fat / divisor;
    const avgCarbs = totals.carbs / divisor;

    const tdee = typeof profile?.tdee_calories === 'number' ? profile.tdee_calories : null;
    const proteinTarget = typeof profile?.macros?.protein_g === 'number' ? profile.macros.protein_g : null;

    const thresholds = window.adminConfig?.calorie_threshold || {};
    const weeklyRules = window.adminConfig?.weekly_rules || {};
    const overeatThreshold = Number.isFinite(thresholds.overeat) ? thresholds.overeat : 0.1;
    const undereatThreshold = Number.isFinite(thresholds.undereat) ? thresholds.undereat : 0.1;
    const minLoggedDays = Number.isFinite(weeklyRules.min_logged_days) ? weeklyRules.min_logged_days : 4;

    let status = 'ok';
    if (tdee !== null && avgCalories > tdee * (1 + overeatThreshold)) {
        status = 'overeat';
    } else if (tdee !== null && avgCalories < tdee * (1 - undereatThreshold)) {
        status = 'undereat';
    } else if (proteinTarget !== null && avgProtein < proteinTarget) {
        status = 'low_protein';
    } else if (daysLogged < minLoggedDays) {
        status = 'low_discipline';
    }

    const messages = {
        overeat: 'Средняя калорийность недели выше ориентира. Попробуйте чуть снизить калории.',
        undereat: 'Средняя калорийность недели ниже ориентира. Добавьте немного энергии.',
        low_protein: 'Белка в среднем меньше ориентира. Добавьте белковый продукт в приём пищи.',
        low_discipline: 'Недостаточно дней учёта. Записывайте хотя бы 4 дня для точной оценки.',
        ok: 'Недельный ритм выглядит стабильно. Сохраняйте текущий курс.'
    };

    return {
        week_start: weekStart,
        week_end: weekEnd,
        avg_calories: Math.round(avgCalories),
        avg_protein_g: Math.round(avgProtein),
        avg_fat_g: Math.round(avgFat),
        avg_carbs_g: Math.round(avgCarbs),
        days_logged: daysLogged,
        status,
        message: messages[status]
    };
}

function analyzeWeeklyStats(profile) {
    const stats = profile?.weekly_stats || {};
    const tdee = Number(profile?.tdee_calories);
    const proteinTarget = Number(profile?.macros?.protein_g);
    const caloriesAvg = Number(stats.calories_avg);
    const proteinAvg = Number(stats.protein_avg_g);
    const daysLogged = Number(stats.days_logged);

    const adjustments = [];
    const minDays = 4;

    if (!Number.isFinite(daysLogged) || daysLogged < minDays) {
        const message = 'Недостаточно данных для анализа недели.';
        return {
            adjustments: [message],
            text: message
        };
    }

    if (Number.isFinite(tdee) && Number.isFinite(caloriesAvg)) {
        if (caloriesAvg > tdee * 1.1) {
            adjustments.push('Калории выше ориентира. Попробуйте снизить суточную норму на ближайшие дни.');
        } else if (caloriesAvg < tdee * 0.9) {
            adjustments.push('Калории ниже ориентира. Добавьте немного энергии, чтобы поддержать темп.');
        }
    }

    if (Number.isFinite(proteinTarget) && Number.isFinite(proteinAvg) && proteinAvg < proteinTarget) {
        adjustments.push('Белка меньше нормы. Добавьте белковый продукт в один из приёмов пищи.');
    }

    if (Number.isFinite(daysLogged) && daysLogged < 4) {
        adjustments.push('Недостаточно дней учёта. Зафиксируйте хотя бы 4 дня для точной коррекции.');
    }

    if (!adjustments.length) {
        adjustments.push('Показатели за неделю близки к плану. Сохраняйте текущий ритм.');
    }

    return {
        adjustments,
        text: adjustments.join(' ')
    };
}
