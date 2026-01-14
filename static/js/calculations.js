// Расчёты показателей здоровья

function calculateAge(birth_date) {
    if (!birth_date) {
        return null;
    }
    const birthDate = new Date(birth_date);
    if (Number.isNaN(birthDate.getTime())) {
        return null;
    }
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age -= 1;
    }
    return age;
}

function calculateBMR({ sex, weight_kg, height_cm, age }) {
    if (!sex || weight_kg === null || height_cm === null || age === null) {
        return null;
    }
    const weight = Number(weight_kg);
    const height = Number(height_cm);
    const years = Number(age);
    if (!Number.isFinite(weight) || !Number.isFinite(height) || !Number.isFinite(years)) {
        return null;
    }
    if (sex === 'male') {
        return 10 * weight + 6.25 * height - 5 * years + 5;
    }
    if (sex === 'female') {
        return 10 * weight + 6.25 * height - 5 * years - 161;
    }
    return null;
}

function calculateTDEE(bmr, activity_factor) {
    if (bmr === null || activity_factor === null) {
        return null;
    }
    const base = Number(bmr);
    const factor = Number(activity_factor);
    if (!Number.isFinite(base) || !Number.isFinite(factor)) {
        return null;
    }
    return base * factor;
}

function calculateMacros(tdee_calories) {
    if (tdee_calories === null) {
        return null;
    }
    const calories = Number(tdee_calories);
    if (!Number.isFinite(calories)) {
        return null;
    }
    const adminConfig = window.adminConfig || {};
    const macrosConfig = adminConfig.default_macros || {};
    const protein_pct = Number.isFinite(macrosConfig.protein_pct) ? macrosConfig.protein_pct : 0.30;
    const fat_pct = Number.isFinite(macrosConfig.fat_pct) ? macrosConfig.fat_pct : 0.25;
    const carbs_pct = Number.isFinite(macrosConfig.carbs_pct) ? macrosConfig.carbs_pct : 0.45;

    return {
        protein_g: (calories * protein_pct) / 4,
        fat_g: (calories * fat_pct) / 9,
        carbs_g: (calories * carbs_pct) / 4,
        protein_pct,
        fat_pct,
        carbs_pct
    };
}

function calculateWeightGoalForecast({ goal, weight_kg, target_weight_kg }) {
    if (!goal || weight_kg === null || target_weight_kg === null) {
        return {
            weight_rate_kg_per_week: null,
            predicted_goal_date: null,
            label: null
        };
    }

    const weight = Number(weight_kg);
    const target = Number(target_weight_kg);
    if (!Number.isFinite(weight) || !Number.isFinite(target)) {
        return {
            weight_rate_kg_per_week: null,
            predicted_goal_date: null,
            label: null
        };
    }

    const adminConfig = window.adminConfig || {};
    const rateMap = adminConfig.weight_rates || {
        lose: -0.5,
        gain: 0.3,
        muscle: 0.25,
        maintain: 0
    };
    const rate = rateMap[goal];
    if (rate === undefined) {
        return {
            weight_rate_kg_per_week: null,
            predicted_goal_date: null,
            label: null
        };
    }

    if (rate === 0) {
        return {
            weight_rate_kg_per_week: 0,
            predicted_goal_date: null,
            label: 'поддержание веса'
        };
    }

    const delta = target - weight;
    const weeksNeeded = Math.abs(delta) / Math.abs(rate);
    const today = new Date();
    const targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() + Math.round(weeksNeeded * 7));
    const predictedDate = Number.isNaN(targetDate.getTime())
        ? null
        : targetDate.toISOString().split('T')[0];

    return {
        weight_rate_kg_per_week: rate,
        predicted_goal_date: predictedDate,
        label: null
    };
}
