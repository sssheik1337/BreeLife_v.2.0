// Расчёты показателей здоровья

function logForecastDebug(debugData) {
    if (window.appDebug === true) {
        console.log('[MODEL_DEBUG] forecast', debugData);
    }
}

function logWeeklyCorrectionDebug(debugData) {
    if (window.appDebug === true) {
        console.log('[MODEL_DEBUG] weekly correction', debugData);
    }
}

function calculateAge(birth_date) {
    if (!birth_date) {
        return null;
    }

    let year = null;
    let month = null;
    let day = null;

    if (birth_date instanceof Date) {
        if (Number.isNaN(birth_date.getTime())) {
            return null;
        }
        year = birth_date.getFullYear();
        month = birth_date.getMonth() + 1;
        day = birth_date.getDate();
    } else {
        const raw = String(birth_date).trim();
        if (!raw) {
            return null;
        }

        let normalized = raw;
        if (typeof window.normalizeLocalDate === 'function') {
            // Сначала пробуем штатный нормализатор даты приложения.
            normalized = window.normalizeLocalDate(raw) || raw;
        }

        let match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!match) {
            // Поддержка формата DD.MM.YYYY.
            const ddmmyyyy = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
            if (ddmmyyyy) {
                year = Number(ddmmyyyy[3]);
                month = Number(ddmmyyyy[2]);
                day = Number(ddmmyyyy[1]);
            } else {
                return null;
            }
        } else {
            year = Number(match[1]);
            month = Number(match[2]);
            day = Number(match[3]);
        }
    }

    const birthDate = new Date(year, month - 1, day);
    if (
        Number.isNaN(birthDate.getTime())
        || birthDate.getFullYear() !== year
        || birthDate.getMonth() !== month - 1
        || birthDate.getDate() !== day
    ) {
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
    // Уравнение Миффлина—Сан Жеора (мужчины): 10*weight + 6.25*height - 5*age + 5
    if (sex === 'male') {
        return 10 * weight + 6.25 * height - 5 * years + 5;
    }
    // Уравнение Миффлина—Сан Жеора (женщины): 10*weight + 6.25*height - 5*age - 161
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
    // Расчёт суточной энергозатраты: TDEE = BMR × коэффициент активности.
    return base * factor;
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function validateGoalWeightConsistency(goal, currentWeight, targetWeight, goalDeadline = null) {
    const current = Number(currentWeight);
    const target = Number(targetWeight);

    if (!goal) {
        return { conflict: false };
    }

    if (goal === 'lose' && Number.isFinite(current) && Number.isFinite(target) && target >= current) {
        return {
            conflict: true,
            reason: 'Цель снижения веса противоречит желаемому весу'
        };
    }

    if (goal === 'gain' && Number.isFinite(current) && Number.isFinite(target) && target <= current) {
        return {
            conflict: true,
            reason: 'Цель набора веса противоречит желаемому весу'
        };
    }

    if (goalDeadline) {
        const deadlineDate = new Date(`${goalDeadline}T00:00:00`);
        if (!Number.isNaN(deadlineDate.getTime())) {
            const todayDate = new Date();
            todayDate.setHours(0, 0, 0, 0);
            if (deadlineDate.getTime() <= todayDate.getTime()) {
                return {
                    conflict: true,
                    reason: 'Дедлайн цели уже прошёл или наступает сегодня'
                };
            }
        }
    }

    return { conflict: false };
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

function applyCaloriesSafetyClamp(caloriesTarget, sex) {
    let safeCaloriesTarget = Number(caloriesTarget);
    if (!Number.isFinite(safeCaloriesTarget)) {
        return null;
    }
    if (sex === 'female') {
        safeCaloriesTarget = Math.max(safeCaloriesTarget, 1200);
    }
    if (sex === 'male') {
        safeCaloriesTarget = Math.max(safeCaloriesTarget, 1500);
    }
    return safeCaloriesTarget;
}

function adjustCaloriesByWeeklyProgress(profile, weeklyAverageWeight) {
    const goal = profile?.goal;
    const tdee = Number(profile?.tdee_calories);
    const currentCaloriesTarget = Number(profile?.calories_target);
    const plannedRate = Number(profile?.weight_rate_kg_per_week);

    if (!goal || !Number.isFinite(tdee) || tdee <= 0 || !Number.isFinite(currentCaloriesTarget)) {
        return {
            calories_target: Number.isFinite(currentCaloriesTarget) ? currentCaloriesTarget : null,
            calorie_delta: Number.isFinite(currentCaloriesTarget) ? currentCaloriesTarget - tdee : null,
            weight_rate_kg_per_week: Number.isFinite(plannedRate) ? plannedRate : null,
            adjusted: false,
            warning_message: null
        };
    }

    if (goal === 'maintain') {
        return {
            calories_target: currentCaloriesTarget,
            calorie_delta: currentCaloriesTarget - tdee,
            weight_rate_kg_per_week: plannedRate,
            adjusted: false,
            warning_message: null
        };
    }

    const previousWeekWeight = Number(weeklyAverageWeight?.previous_week_weight ?? weeklyAverageWeight?.previous);
    const currentWeekWeight = Number(weeklyAverageWeight?.current_week_weight ?? weeklyAverageWeight?.current);
    if (!Number.isFinite(previousWeekWeight) || !Number.isFinite(currentWeekWeight) || !Number.isFinite(plannedRate)) {
        return {
            calories_target: currentCaloriesTarget,
            calorie_delta: currentCaloriesTarget - tdee,
            weight_rate_kg_per_week: plannedRate,
            adjusted: false,
            warning_message: null
        };
    }

    // Унифицированный факт темпа: текущий средний вес минус прошлый.
    const actualRate = currentWeekWeight - previousWeekWeight;
    const deviation = actualRate - plannedRate;

    if (Math.abs(deviation) <= 0.1) {
        logWeeklyCorrectionDebug({
            goal,
            plannedRate,
            actualRate,
            deviation,
            corrected: false,
            reason: 'Отклонение меньше порога'
        });
        return {
            calories_target: currentCaloriesTarget,
            calorie_delta: currentCaloriesTarget - tdee,
            weight_rate_kg_per_week: plannedRate,
            adjusted: false,
            warning_message: null
        };
    }

    const correction = deviation * 1100;
    let nextCaloriesTarget = currentCaloriesTarget - correction;
    nextCaloriesTarget = applyCaloriesSafetyClamp(nextCaloriesTarget, profile?.sex);
    if (!Number.isFinite(nextCaloriesTarget)) {
        return {
            calories_target: currentCaloriesTarget,
            calorie_delta: currentCaloriesTarget - tdee,
            weight_rate_kg_per_week: plannedRate,
            adjusted: false,
            warning_message: null
        };
    }

    const nextCalorieDelta = nextCaloriesTarget - tdee;
    const nextRate = (nextCalorieDelta * 7) / 7700;
    const warningMessage = 'Обновил цель по калориям пропорционально фактическому отклонению недельного темпа.';
    logWeeklyCorrectionDebug({
        goal,
        plannedRate,
        actualRate,
        deviation,
        correction,
        calories_target_before: currentCaloriesTarget,
        calories_target_after: nextCaloriesTarget,
        calorie_delta_after: nextCalorieDelta,
        weight_rate_after: nextRate,
        corrected: true
    });

    return {
        calories_target: nextCaloriesTarget,
        calorie_delta: nextCalorieDelta,
        weight_rate_kg_per_week: nextRate,
        adjusted: true,
        warning_message: warningMessage
    };
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
    const debugInput = { sex, goal, tdee_calories, weight_kg, target_weight_kg, goal_deadline };
    const logForecastPipeline = (stage, payload = {}) => {
        if (window.appDebug === true) {
            console.log('[MODEL_DEBUG] forecast:pipeline', { stage, ...payload });
        }
    };
    if (!goal || tdee_calories === null || tdee_calories === undefined) {
        logForecastPipeline('blocked', { reason: 'MISSING_GOAL_OR_TDEE', input: debugInput });
        return {
            calories_target: null,
            calorie_delta: null,
            required_rate_kg_per_week: null,
            required_calorie_delta: null,
            required_calories_target: null,
            safe_weeks_estimate: null,
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
        logForecastPipeline('blocked', { reason: 'TDEE_NOT_FINITE', input: debugInput, tdee });
        return {
            calories_target: null,
            calorie_delta: null,
            required_rate_kg_per_week: null,
            required_calorie_delta: null,
            required_calories_target: null,
            safe_weeks_estimate: null,
            weight_rate_kg_per_week: null,
            predicted_goal_date: null,
            warning_message: null,
            error: null,
            label: null
        };
    }

    if (goal === 'maintain') {
        logForecastPipeline('maintain', { input: debugInput, tdee });
        // Режим поддержания полностью изолирован: без расчётов deltaKg/rate и без учёта дедлайна.
        logForecastDebug({
            deltaKg: null,
            plannedRate: 0,
            maxSafeRate: null,
            calorie_delta: 0,
            calories_target: tdee,
            safe_weeks_estimate: null
        });
        return {
            calories_target: tdee,
            calorie_delta: 0,
            required_rate_kg_per_week: null,
            required_calorie_delta: null,
            required_calories_target: null,
            safe_weeks_estimate: null,
            weight_rate_kg_per_week: 0,
            predicted_goal_date: null,
            warning_message: null,
            error: null,
            label: 'поддержание веса'
        };
    }

    const adaptiveLimit = resolveAdaptiveRateLimit(goal, weight);
    if (!Number.isFinite(adaptiveLimit)) {
        logForecastPipeline('blocked', { reason: 'ADAPTIVE_LIMIT_NOT_FINITE', input: debugInput, adaptiveLimit });
        return {
            calories_target: null,
            calorie_delta: null,
            required_rate_kg_per_week: null,
            required_calorie_delta: null,
            required_calories_target: null,
            safe_weeks_estimate: null,
            weight_rate_kg_per_week: null,
            predicted_goal_date: null,
            warning_message: null,
            error: null,
            label: null
        };
    }

    const deltaKg = Number.isFinite(weight) && Number.isFinite(target)
        ? target - weight
        : null;
    logForecastPipeline('input_normalized', {
        input: debugInput,
        tdee,
        weight,
        target,
        weightDiff: deltaKg
    });
    const direction = Number.isFinite(deltaKg) ? Math.sign(deltaKg) : 0;
    // Безопасный темп задаётся сразу от направления цели и адаптивного лимита.
    const plannedRate = direction * adaptiveLimit;
    const plannedCalorieDelta = (plannedRate * 7700) / 7;

    let caloriesTarget = tdee + plannedCalorieDelta;
    caloriesTarget = applyCaloriesSafetyClamp(caloriesTarget, sex);
    const calorieDelta = caloriesTarget - tdee;

    const consistency = validateGoalWeightConsistency(goal, weight, target, goal_deadline);
    if (consistency.conflict) {
        logForecastPipeline('consistency_conflict', {
            input: debugInput,
            weightDiff: deltaKg,
            consistency,
            caloriesTarget,
            calorieDelta
        });
        logForecastDebug({
            deltaKg,
            plannedRate,
            maxSafeRate: adaptiveLimit,
            calorie_delta: calorieDelta,
            calories_target: caloriesTarget,
            safe_weeks_estimate: null,
            blocked: true
        });
        return {
            calories_target: caloriesTarget,
            calorie_delta: calorieDelta,
            required_rate_kg_per_week: null,
            required_calorie_delta: null,
            required_calories_target: null,
            safe_weeks_estimate: null,
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
    let safeWeeksEstimate = null;
    let warningMessage = null;

    if (Number.isFinite(deltaKg) && Number.isFinite(adaptiveLimit) && adaptiveLimit > 0) {
        if (deltaKg !== 0) {
            // Безопасный срок считается только от дистанции по весу и безопасного темпа модели.
            safeWeeksEstimate = Math.ceil(Math.abs(deltaKg) / adaptiveLimit);
        }

        if (goal_deadline) {
            const deadlineDate = new Date(`${goal_deadline}T00:00:00`);
            if (!Number.isNaN(deadlineDate.getTime())) {
                const todayDate = new Date();
                todayDate.setHours(0, 0, 0, 0);
                const diffMs = deadlineDate.getTime() - todayDate.getTime();
                const weeksAvailable = diffMs / (1000 * 60 * 60 * 24 * 7);
                logForecastPipeline('deadline_check', {
                    goal_deadline,
                    weeksAvailable,
                    weightDiff: deltaKg,
                    safe_weeks_estimate: safeWeeksEstimate
                });

                if (weeksAvailable <= 0) {
                    warningMessage = 'Дедлайн цели уже прошёл или слишком близко. Укажите более реалистичную дату.';
                } else if (Number.isFinite(safeWeeksEstimate) && weeksAvailable < safeWeeksEstimate) {
                    warningMessage = `К выбранной дате цель может быть недостижима при безопасном темпе. Рекомендуемый срок достижения: ${safeWeeksEstimate} недель.`;
                }
            }
        }
    }

    const rate = plannedRate;
    logForecastDebug({
        deltaKg,
        plannedRate,
        maxSafeRate: adaptiveLimit,
        calorie_delta: calorieDelta,
        calories_target: caloriesTarget,
        safe_weeks_estimate: safeWeeksEstimate
    });

    if (!Number.isFinite(weight) || !Number.isFinite(target)) {
        return {
            calories_target: caloriesTarget,
            calorie_delta: calorieDelta,
            required_rate_kg_per_week: requiredRate,
            required_calorie_delta: requiredCalorieDelta,
            required_calories_target: requiredCaloriesTarget,
            safe_weeks_estimate: safeWeeksEstimate,
            weight_rate_kg_per_week: rate,
            predicted_goal_date: null,
            warning_message: warningMessage,
            error: null,
            label: null
        };
    }

    const weightDelta = target - weight;
    if (rate === 0 || weightDelta === 0) {
        return {
            calories_target: caloriesTarget,
            calorie_delta: calorieDelta,
            required_rate_kg_per_week: requiredRate,
            required_calorie_delta: requiredCalorieDelta,
            required_calories_target: requiredCaloriesTarget,
            safe_weeks_estimate: safeWeeksEstimate,
            weight_rate_kg_per_week: rate,
            predicted_goal_date: null,
            warning_message: warningMessage,
            error: null,
            label: null
        };
    }

    // Дата прогноза — вторичная метрика, рассчитывается только от дистанции и текущего темпа.
    const weeksNeeded = Math.ceil(Math.abs(weightDelta) / Math.abs(rate));
    if (!Number.isFinite(weeksNeeded) || weeksNeeded <= 0) {
        return {
            calories_target: caloriesTarget,
            calorie_delta: calorieDelta,
            required_rate_kg_per_week: requiredRate,
            required_calorie_delta: requiredCalorieDelta,
            required_calories_target: requiredCaloriesTarget,
            safe_weeks_estimate: safeWeeksEstimate,
            weight_rate_kg_per_week: rate,
            predicted_goal_date: null,
            warning_message: warningMessage,
            error: null,
            label: null
        };
    }

    const today = new Date();
    const targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() + weeksNeeded * 7);
    const predictedDate = Number.isNaN(targetDate.getTime())
        ? null
        : targetDate.toISOString().split('T')[0];

    logForecastPipeline('result', {
        input: debugInput,
        weightDiff: deltaKg,
        requiredRate,
        requiredCalorieDelta,
        safeWeeksEstimate,
        caloriesTarget,
        calorieDelta,
        predictedDate,
        warningMessage
    });

    return {
        calories_target: caloriesTarget,
        calorie_delta: calorieDelta,
        required_rate_kg_per_week: requiredRate,
        required_calorie_delta: requiredCalorieDelta,
        required_calories_target: requiredCaloriesTarget,
        safe_weeks_estimate: safeWeeksEstimate,
        weight_rate_kg_per_week: rate,
        predicted_goal_date: predictedDate,
        warning_message: warningMessage,
        error: null,
        label: null
    };
}
