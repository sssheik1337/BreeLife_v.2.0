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

function resolveAdaptiveRateLimit(goal, weightKg) {
    const weight = Number(weightKg);
    if (!Number.isFinite(weight) || weight <= 0) {
        return null;
    }
    if (goal === 'lose') {
        return Math.min(weight * 0.01, 1.2);
    }
    if (goal === 'gain') {
        return Math.min(weight * 0.005, 0.6);
    }
    return null;
}

function calculateMacros(payload) {
    const isLegacyNumber = typeof payload === 'number';
    const caloriesValue = isLegacyNumber ? payload : payload?.calories_target;
    const goal = isLegacyNumber ? null : payload?.goal;
    const weightValue = isLegacyNumber ? null : payload?.weight_kg;

    const caloriesTarget = Number(caloriesValue);
    const weight = Number(weightValue);
    if (!Number.isFinite(caloriesTarget) || caloriesTarget <= 0 || !Number.isFinite(weight) || weight <= 0) {
        return null;
    }

    let proteinFactor = 1.6;
    if (goal === 'lose') {
        proteinFactor = 1.8;
    }
    const protein_g = proteinFactor * weight;
    const fat_g = clamp(0.8 * weight, 45, 90);
    const carbs_kcal = caloriesTarget - (protein_g * 4 + fat_g * 9);
    const carbs_g = Math.max(carbs_kcal / 4, 0);

    return {
        protein_g,
        fat_g,
        carbs_g,
        protein_pct: (protein_g * 4) / caloriesTarget,
        fat_pct: (fat_g * 9) / caloriesTarget,
        carbs_pct: (carbs_g * 4) / caloriesTarget
    };
}

function calculateWeightGoalForecast({ sex, goal, tdee_calories, weight_kg, target_weight_kg, goal_deadline }) {
    if (!goal || tdee_calories === null || tdee_calories === undefined) {
        return {
            calories_target: null,
            calorie_delta: null,
            required_rate_kg_per_week: null,
            required_calorie_delta: null,
            required_calories_target: null,
            weight_rate_kg_per_week: null,
            predicted_goal_date: null,
            warning_message: null,
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
            required_rate_kg_per_week: null,
            required_calorie_delta: null,
            required_calories_target: null,
            weight_rate_kg_per_week: null,
            predicted_goal_date: null,
            warning_message: null,
            error: null,
            label: null
        };
    }

    const adaptiveLimit = resolveAdaptiveRateLimit(goal, weight);
    const hasGoalRate = goal === 'maintain' || Number.isFinite(adaptiveLimit);
    if (!hasGoalRate) {
        return {
            calories_target: null,
            calorie_delta: null,
            required_rate_kg_per_week: null,
            required_calorie_delta: null,
            required_calories_target: null,
            weight_rate_kg_per_week: null,
            predicted_goal_date: null,
            warning_message: null,
            error: null,
            label: null
        };
    }

    const baseRate = goal === 'maintain'
        ? 0
        : goal === 'lose'
            ? -adaptiveLimit
            : adaptiveLimit;
    const baseCalorieDelta = (baseRate * 7700) / 7;
    let caloriesTarget = tdee + baseCalorieDelta;
    if (sex === 'female') {
        caloriesTarget = Math.max(caloriesTarget, 1200);
    }
    if (sex === 'male') {
        caloriesTarget = Math.max(caloriesTarget, 1500);
    }
    if (goal === 'maintain') {
        // Для поддержания фиксируем цель калорий на уровне TDEE.
        caloriesTarget = tdee;
    }
    const calorieDelta = goal === 'maintain' ? 0 : (caloriesTarget - tdee);
    const weeklyDeltaKg = (calorieDelta * 7) / 7700;

    const consistency = validateGoalWeightConsistency(goal, weight, target);
    if (consistency.conflict) {
        return {
            calories_target: caloriesTarget,
            calorie_delta: calorieDelta,
            required_rate_kg_per_week: null,
            required_calorie_delta: null,
            required_calories_target: null,
            weight_rate_kg_per_week: null,
            predicted_goal_date: null,
            warning_message: null,
            error: 'LOGICAL_INCONSISTENCY',
            label: null
        };
    }

    let requiredRate = null;
    let requiredCalorieDelta = null;
    let requiredCaloriesTarget = null;
    let warningMessage = null;

    if (goal_deadline && Number.isFinite(weight) && Number.isFinite(target)) {
        const deadlineDate = new Date(`${goal_deadline}T00:00:00`);
        if (!Number.isNaN(deadlineDate.getTime())) {
            const todayDate = new Date();
            todayDate.setHours(0, 0, 0, 0);
            const diffMs = deadlineDate.getTime() - todayDate.getTime();
            const weeksAvailable = diffMs / (1000 * 60 * 60 * 24 * 7);

            if (weeksAvailable > 0) {
                const deadlineDeltaKg = target - weight;
                requiredRate = deadlineDeltaKg / weeksAvailable;
                if (goal === 'lose' && Number.isFinite(adaptiveLimit) && requiredRate < -adaptiveLimit) {
                    warningMessage = 'Выбранный дедлайн требует слишком быстрого снижения веса. Рекомендуется сдвинуть дату цели.';
                }
                if (goal === 'gain' && Number.isFinite(adaptiveLimit) && requiredRate > adaptiveLimit) {
                    warningMessage = 'Выбранный дедлайн требует слишком быстрого набора веса. Рекомендуется сдвинуть дату цели.';
                }

                if (goal === 'lose' && Number.isFinite(adaptiveLimit)) {
                    requiredRate = Math.max(requiredRate, -adaptiveLimit);
                } else if (goal === 'gain' && Number.isFinite(adaptiveLimit)) {
                    requiredRate = Math.min(requiredRate, adaptiveLimit);
                } else if (goal === 'maintain') {
                    requiredRate = 0;
                }

                requiredCalorieDelta = (requiredRate * 7700) / 7;
                requiredCaloriesTarget = tdee + requiredCalorieDelta;
                if (sex === 'female') {
                    requiredCaloriesTarget = Math.max(requiredCaloriesTarget, 1200);
                }
                if (sex === 'male') {
                    requiredCaloriesTarget = Math.max(requiredCaloriesTarget, 1500);
                }
                requiredCalorieDelta = requiredCaloriesTarget - tdee;
            } else {
                warningMessage = 'Дедлайн цели уже прошёл или слишком близко. Укажите более реалистичную дату.';
            }
        }
    }

    if (goal === 'maintain') {
        return {
            calories_target: caloriesTarget,
            calorie_delta: calorieDelta,
            required_rate_kg_per_week: requiredRate,
            required_calorie_delta: requiredCalorieDelta,
            required_calories_target: requiredCaloriesTarget,
            weight_rate_kg_per_week: 0,
            predicted_goal_date: null,
            warning_message: warningMessage,
            error: null,
            label: 'поддержание веса'
        };
    }

    let rate = weeklyDeltaKg;
    if (goal === 'lose' && Number.isFinite(adaptiveLimit)) {
        rate = Math.max(weeklyDeltaKg, -adaptiveLimit);
    }
    if (goal === 'gain' && Number.isFinite(adaptiveLimit)) {
        rate = Math.min(weeklyDeltaKg, adaptiveLimit);
    }

    if (!Number.isFinite(weight) || !Number.isFinite(target)) {
        return {
            calories_target: caloriesTarget,
            calorie_delta: calorieDelta,
            required_rate_kg_per_week: requiredRate,
            required_calorie_delta: requiredCalorieDelta,
            required_calories_target: requiredCaloriesTarget,
            weight_rate_kg_per_week: rate,
            predicted_goal_date: null,
            warning_message: warningMessage,
            error: null,
            label: null
        };
    }

    const weightDelta = target - weight;
    if (rate === 0) {
        return {
            calories_target: caloriesTarget,
            calorie_delta: calorieDelta,
            required_rate_kg_per_week: requiredRate,
            required_calorie_delta: requiredCalorieDelta,
            required_calories_target: requiredCaloriesTarget,
            weight_rate_kg_per_week: 0,
            predicted_goal_date: null,
            warning_message: warningMessage,
            error: null,
            label: null
        };
    }

    const weeksNeeded = weightDelta / rate;
    if (!Number.isFinite(weeksNeeded) || weeksNeeded <= 0) {
        return {
            calories_target: caloriesTarget,
            calorie_delta: calorieDelta,
            required_rate_kg_per_week: requiredRate,
            required_calorie_delta: requiredCalorieDelta,
            required_calories_target: requiredCaloriesTarget,
            weight_rate_kg_per_week: rate,
            predicted_goal_date: null,
            warning_message: warningMessage,
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
        required_rate_kg_per_week: requiredRate,
        required_calorie_delta: requiredCalorieDelta,
        required_calories_target: requiredCaloriesTarget,
        weight_rate_kg_per_week: rate,
        predicted_goal_date: predictedDate,
        warning_message: warningMessage,
        error: null,
        label: null
    };
}
