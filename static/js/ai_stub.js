// Заглушки для персонализированных текстов без внешних API

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
        lose: 'снижение веса',
        gain: 'набор веса',
        muscle: 'набор мышц',
        maintain: 'поддержание веса'
    };
    return goalMap[goal] || 'здоровый баланс';
}

function getDiaryExplanation(profile) {
    if (!profile) {
        return 'Дневник питания поможет лучше понимать свои привычки и корректировать рацион.';
    }
    if (profile.food_diary === true) {
        return 'Отлично, дневник питания даст больше контроля и сделает прогресс заметнее.';
    }
    if (profile.food_diary === false) {
        return 'Если появится желание, дневник питания можно включить для более точных результатов.';
    }
    return 'Дневник питания — полезный инструмент для более точного контроля рациона.';
}

function getCaloriesExplanation(profile) {
    const tdee = profile?.tdee_calories;
    const activity = profile?.activity_factor;
    const goalLabel = getGoalLabel(profile?.goal);
    if (!tdee) {
        return `Мы учтём уровень активности и цель (${goalLabel}), чтобы рассчитать дневную норму.`;
    }
    if (activity) {
        return `При активности ${activity} ваша поддерживающая норма около ${Math.round(tdee)} ккал.`;
    }
    return `Ваша ориентировочная норма около ${Math.round(tdee)} ккал в день.`;
}

function getMacrosExplanation(profile) {
    const macros = profile?.macros;
    if (!macros) {
        return 'Баланс БЖУ поможет поддерживать энергию и стабильный прогресс.';
    }
    return `Баланс БЖУ распределён как ${Math.round(macros.protein_pct * 100)}% белка, ${Math.round(macros.fat_pct * 100)}% жиров и ${Math.round(macros.carbs_pct * 100)}% углеводов.`;
}

function getRecommendations(profile) {
    const recommendations = [];
    const goalLabel = getGoalLabel(profile?.goal);
    const activity = profile?.activity_factor;
    const tdee = profile?.tdee_calories;
    const predictedDate = formatDateForUser(profile?.predicted_goal_date);

    recommendations.push(`Фокус на цель: ${goalLabel}.`);

    if (activity) {
        recommendations.push(`Сохраняйте активность на уровне ${activity} для устойчивого результата.`);
    } else {
        recommendations.push('Добавьте регулярную активность, чтобы ускорить прогресс и улучшить самочувствие.');
    }

    if (tdee) {
        recommendations.push(`Ориентируйтесь на дневную норму около ${Math.round(tdee)} ккал.`);
    }

    if (predictedDate) {
        recommendations.push(`При текущем темпе цель достижима примерно к ${predictedDate}.`);
    }

    if (profile?.food_diary === true) {
        recommendations.push('Фиксируйте приёмы пищи — это поможет держать план.');
    } else if (profile?.food_diary === false) {
        recommendations.push('Попробуйте вести дневник хотя бы несколько дней в неделю для ясности.');
    }

    return recommendations.slice(0, 5);
}

function getDeadlineMotivation(profile) {
    const deadline = formatDateForUser(profile?.predicted_goal_date || profile?.goal_deadline);
    if (!deadline) {
        return '';
    }
    return `У вас есть ориентир до ${deadline}. Двигайтесь шаг за шагом, и результат будет ближе.`;
}
