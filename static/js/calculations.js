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

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function validateGoalWeightConsistency(goal, currentWeight, targetWeight) {
    const current = Number(currentWeight);
    const target = Number(targetWeight);
    if (!Number.isFinite(current) || !Number.isFinite(target)) {
        return {
            conflict: false,
            warning: false
        };
    }

    if (goal === 'lose' && target >= current) {
        return {
            conflict: true,
            warning: false
        };
    }

    if (goal === 'gain' && target <= current) {
        return {
            conflict: true,
            warning: false
        };
    }

    if (goal === 'maintain' && Math.abs(target - current) > 1) {
        return {
            conflict: false,
            warning: true
        };
    }

    return {
        conflict: false,
        warning: false
    };
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

function calculateWeightGoalForecast({ sex, goal, tdee_calories, weight_kg, target_weight_kg }) {
    if (!goal || tdee_calories === null || tdee_calories === undefined) {
        return {
            calories_target: null,
            calorie_delta: null,
            weight_rate_kg_per_week: null,
            predicted_goal_date: null,
            error: null,
            label: null
        };
    }

    const tdee = Number(tdee_calories);
    const weight = Number(weight_kg);
    const target = Number(target_weight_kg);
    if (!Number.isFinite(tdee)) {
        return {
            calories_target: null,
            calorie_delta: null,
            weight_rate_kg_per_week: null,
            predicted_goal_date: null,
            error: null,
            label: null
        };
    }

    let delta = null;
    if (goal === 'lose') {
        delta = -Math.min(0.20 * tdee, 500);
    } else if (goal === 'gain') {
        delta = Math.min(0.15 * tdee, 400);
    } else if (goal === 'maintain') {
        delta = 0;
    }

    if (delta === null) {
        return {
            calories_target: null,
            calorie_delta: null,
            weight_rate_kg_per_week: null,
            predicted_goal_date: null,
            error: null,
            label: null
        };
    }

    const caloriesTargetRaw = tdee + delta;
    let caloriesTarget = caloriesTargetRaw;
    if (sex === 'female') {
        caloriesTarget = Math.max(caloriesTargetRaw, 1200);
    }
    if (sex === 'male') {
        caloriesTarget = Math.max(caloriesTargetRaw, 1500);
    }

    const calorieDelta = caloriesTarget - tdee;
    const weeklyDeltaKg = (calorieDelta * 7) / 7700;

    const consistency = validateGoalWeightConsistency(goal, weight, target);
    if (consistency.conflict) {
        return {
            calories_target: caloriesTarget,
            calorie_delta: calorieDelta,
            weight_rate_kg_per_week: null,
            predicted_goal_date: null,
            error: 'LOGICAL_INCONSISTENCY',
            label: null
        };
    }

    if (goal === 'maintain') {
        return {
            calories_target: caloriesTarget,
            calorie_delta: calorieDelta,
            weight_rate_kg_per_week: 0,
            predicted_goal_date: null,
            error: null,
            label: 'поддержание веса'
        };
    }

    const rate = goal === 'lose'
        ? clamp(weeklyDeltaKg, -1.0, -0.25)
        : clamp(weeklyDeltaKg, 0.1, 0.5);

    if (!Number.isFinite(weight) || !Number.isFinite(target)) {
        return {
            calories_target: caloriesTarget,
            calorie_delta: calorieDelta,
            weight_rate_kg_per_week: rate,
            predicted_goal_date: null,
            error: null,
            label: null
        };
    }

    const weightDelta = target - weight;
    if (rate === 0) {
        return {
            calories_target: caloriesTarget,
            calorie_delta: calorieDelta,
            weight_rate_kg_per_week: 0,
            predicted_goal_date: null,
            error: null,
            label: null
        };
    }

    const weeksNeeded = weightDelta / rate;
    if (!Number.isFinite(weeksNeeded) || weeksNeeded <= 0) {
        return {
            calories_target: caloriesTarget,
            calorie_delta: calorieDelta,
            weight_rate_kg_per_week: rate,
            predicted_goal_date: null,
            error: 'LOGICAL_INCONSISTENCY',
            label: null
        };
    }

    const today = new Date();
    const targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() + Math.ceil(weeksNeeded) * 7);
    const predictedDate = Number.isNaN(targetDate.getTime())
        ? null
        : targetDate.toISOString().split('T')[0];

    return {
        calories_target: caloriesTarget,
        calorie_delta: calorieDelta,
        weight_rate_kg_per_week: rate,
        predicted_goal_date: predictedDate,
        error: null,
        label: null
    };
}
