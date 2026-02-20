// Resume/Summary Page Logic for Health Bloom App

const apiFetch = window.apiFetch || fetch;

let resumeLastGoalDeadlineWarning = null;
let resumeLastDiagnostics = null;
let resumeBackendProfile = null;

function logResumeDebug(stage, payload) {
    if (window.appDebug === true) {
        console.log(`[PROFILE_DEBUG][resume] ${stage}`, payload);
    }
}

function getResumeTraceId() {
    if (typeof window.getProfileTraceId === 'function') {
        return window.getProfileTraceId();
    }
    if (window.__profileTrace?.id) {
        return window.__profileTrace.id;
    }
    const fallback = `resume-${Date.now()}`;
    window.__profileTrace = { id: fallback, source: 'resume' };
    return fallback;
}

function buildResumeDiagnostics(profile) {
    const toNumber = (value) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    };
    const age = typeof calculateAge === 'function' ? calculateAge(profile?.birth_date) : null;
    const weight = toNumber(profile?.weight_kg);
    const height = toNumber(profile?.height_cm);
    const activityFactor = toNumber(profile?.activity_factor);
    const goal = profile?.goal || null;
    const targetWeight = toNumber(profile?.target_weight_kg);

    const stages = {
        age: {
            valid: Number.isFinite(age) && age > 0,
            reason: null
        },
        bmr: {
            valid: Boolean(profile?.sex) && Number.isFinite(age) && age > 0 && Number.isFinite(weight) && weight > 0 && Number.isFinite(height) && height > 0,
            reason: null
        },
        tdee: {
            valid: false,
            reason: null
        },
        macros: {
            valid: false,
            reason: null
        },
        forecast: {
            valid: false,
            reason: null
        }
    };

    if (!stages.age.valid) {
        stages.age.reason = 'Некорректная или отсутствующая дата рождения';
    }
    if (!stages.bmr.valid) {
        const missing = [];
        if (!profile?.sex) missing.push('sex');
        if (!(Number.isFinite(age) && age > 0)) missing.push('age');
        if (!(Number.isFinite(weight) && weight > 0)) missing.push('weight_kg');
        if (!(Number.isFinite(height) && height > 0)) missing.push('height_cm');
        stages.bmr.reason = `Не хватает полей: ${missing.join(', ')}`;
    }

    stages.tdee.valid = stages.bmr.valid && Number.isFinite(activityFactor) && activityFactor > 0;
    if (!stages.tdee.valid) {
        stages.tdee.reason = stages.bmr.valid
            ? 'Не хватает activity_factor'
            : 'TDEE недоступен, пока невалиден BMR';
    }

    const caloriesTarget = toNumber(profile?.calories_target);
    stages.macros.valid = Boolean(goal) && Number.isFinite(weight) && weight > 0 && Number.isFinite(caloriesTarget) && caloriesTarget > 0;
    if (!stages.macros.valid) {
        const missing = [];
        if (!goal) missing.push('goal');
        if (!(Number.isFinite(weight) && weight > 0)) missing.push('weight_kg');
        if (!(Number.isFinite(caloriesTarget) && caloriesTarget > 0)) missing.push('calories_target');
        stages.macros.reason = `Не хватает полей: ${missing.join(', ')}`;
    }

    stages.forecast.valid = Boolean(goal) && Number.isFinite(weight) && weight > 0 && stages.tdee.valid;
    if (stages.forecast.valid && goal !== 'maintain' && !(Number.isFinite(targetWeight) && targetWeight > 0)) {
        stages.forecast.valid = false;
        stages.forecast.reason = 'Для прогноза нужен target_weight_kg';
    }
    if (!stages.forecast.valid && !stages.forecast.reason) {
        stages.forecast.reason = 'Не хватает данных для прогноза';
    }

    const firstFailureReason = stages.age.reason || stages.bmr.reason || stages.tdee.reason || stages.macros.reason || stages.forecast.reason || null;

    return {
        critical_fields: {
            sex: profile?.sex ?? null,
            birth_date: profile?.birth_date ?? null,
            age,
            height_cm: height,
            weight_kg: weight,
            activity_factor: activityFactor,
            goal,
            target_weight_kg: targetWeight,
            calories_target: caloriesTarget,
            goal_deadline: profile?.goal_deadline ?? null
        },
        stages,
        first_failure_reason: firstFailureReason
    };
}

function copyResumeDiagnosticsToClipboard() {
    const diagnostics = resumeLastDiagnostics || buildResumeDiagnostics(resumeBackendProfile || {});
    const payload = JSON.stringify(diagnostics, null, 2);
    const notify = (message, type = 'success') => {
        if (typeof showNotification === 'function') {
            showNotification(message, type);
        }
    };

    if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(payload)
            .then(() => notify('Диагностика скопирована в буфер обмена.'))
            .catch(() => notify('Не удалось скопировать диагностику.', 'error'));
        return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = payload;
    document.body.appendChild(textarea);
    textarea.select();
    try {
        document.execCommand('copy');
        notify('Диагностика скопирована в буфер обмена.');
    } catch (error) {
        notify('Не удалось скопировать диагностику.', 'error');
    } finally {
        document.body.removeChild(textarea);
    }
}

async function loadProfileFromBackend() {
    try {
        const response = await apiFetch('/api/profile');
        if (!response.ok) {
            if (window.appDebug === true) {
                console.error('[RESUME][backend] Ошибка загрузки профиля', { status: response.status });
            }
            return null;
        }
        const data = await response.json();
        if (!data || typeof data !== 'object') {
            if (window.appDebug === true) {
                console.error('[RESUME][backend] Некорректный payload профиля', { data });
            }
            return null;
        }
        if (data.status === 'not_found') {
            if (window.appDebug === true) {
                console.warn('[RESUME][backend] Профиль не найден');
            }
            return null;
        }
        return data;
    } catch (error) {
        if (window.appDebug === true) {
            console.error('[RESUME][backend] Исключение при загрузке профиля', error);
        }
        return null;
    }
}



function hasProfileTargetFieldsDrift(profile, computedTargets) {
    const safeProfile = profile && typeof profile === 'object' ? profile : {};
    const safeTargets = computedTargets && typeof computedTargets === 'object' ? computedTargets : {};

    const equalsNumber = (left, right) => {
        const leftNum = Number(left);
        const rightNum = Number(right);
        if (!Number.isFinite(leftNum) && !Number.isFinite(rightNum)) {
            return true;
        }
        if (!Number.isFinite(leftNum) || !Number.isFinite(rightNum)) {
            return false;
        }
        return Math.abs(leftNum - rightNum) < 1e-9;
    };

    const equalsNullableString = (left, right) => {
        const leftValue = typeof left === 'string' ? left : null;
        const rightValue = typeof right === 'string' ? right : null;
        return leftValue === rightValue;
    };

    const fields = [
        'tdee_calories',
        'calories_target',
        'calorie_delta',
        'weight_rate_kg_per_week',
        'safe_weeks_estimate'
    ];

    for (const field of fields) {
        if (!equalsNumber(safeProfile?.[field], safeTargets?.[field])) {
            return true;
        }
    }

    if (!equalsNullableString(safeProfile?.predicted_goal_date, safeTargets?.predicted_goal_date)) {
        return true;
    }

    // warning_message остаётся runtime-сигналом UI и не участвует в критерии синхронизации профиля.

    return false;
}

async function ensureComputedTargetsSaved(profile) {
    const safeProfile = profile && typeof profile === 'object' ? profile : {};
    if (typeof window.computeTargets !== 'function') {
        return safeProfile;
    }

    const computedTargets = window.computeTargets(safeProfile, new Date());
    const hasDrift = hasProfileTargetFieldsDrift(safeProfile, computedTargets);
    if (!hasDrift) {
        return safeProfile;
    }

    const payload = {
        tdee_calories: computedTargets?.tdee_calories,
        calories_target: computedTargets?.calories_target,
        calorie_delta: computedTargets?.calorie_delta,
        weight_rate_kg_per_week: computedTargets?.weight_rate_kg_per_week,
        predicted_goal_date: computedTargets?.predicted_goal_date,
        safe_weeks_estimate: computedTargets?.safe_weeks_estimate
    };

    if (typeof window.patchUserProfileWithBackend === 'function') {
        try {
            const saved = await window.patchUserProfileWithBackend(payload);
            return saved && typeof saved === 'object'
                ? saved
                : { ...safeProfile, ...payload };
        } catch (error) {
            return { ...safeProfile, ...payload };
        }
    }

    return { ...safeProfile, ...payload };
}

// Initialize summary page
function generateSummary(profile) {
    const cardsContainer = document.getElementById('data-cards');
    
    // Clear container
    cardsContainer.innerHTML = '';
    
    // Get user data
    const data = typeof mapUserProfileToUserData === 'function'
        ? mapUserProfileToUserData(profile || {})
        : {};
    const isMaintainGoal = data.goalType === 'maintain';
    
    // Create cards for each data point
    const dataPoints = [
        {
            label: 'Пол',
            value: formatGender(data.gender),
            icon: 'user',
            color: 'emerald',
            details: null
        },
        {
            label: 'Дата рождения',
            value: formatDate(data.birthDate),
            icon: 'calendar',
            color: 'purple',
            details: data.birthDate ? `Возраст: ${calculateAge(data.birthDate)} лет` : null
        },
        {
            label: 'Рост',
            value: data.height ? `${data.height} см` : 'Не указано',
            icon: 'maximize-2',
            color: 'blue',
            details: data.height ? `Примерно ${cmToFeetInches(data.height)}` : null
        },
        {
            label: 'Текущий вес',
            value: data.currentWeight ? `${data.currentWeight} кг` : 'Не указано',
            icon: 'scale',
            color: 'amber',
            details: data.currentWeight ? `${kgToLbs(data.currentWeight)} фунтов` : null
        },
        ...(isMaintainGoal
            ? []
            : [{
                label: 'Желаемый вес',
                value: data.targetWeight ? `${data.targetWeight} кг` : 'Не указано',
                icon: 'target',
                color: 'pink',
                details: data.currentWeight && data.targetWeight
                    ? `${calculateWeightDifference(data.currentWeight, data.targetWeight)}`
                    : null
            }])
];
    
    // Create and append cards
    dataPoints.forEach((point, index) => {
        const card = createDataCard(point, index);
        cardsContainer.appendChild(card);
    });
    
    // Update feather icons
    if (window.feather) {
        feather.replace();
    }
}

// Обновление расчётных показателей профиля
function updateCalculatedMetrics(profile) {
    const traceId = getResumeTraceId();
    const safeProfile = profile && typeof profile === 'object' ? profile : {};
    const weight = Number(safeProfile.weight_kg);
    const height = Number(safeProfile.height_cm);
    const activityFactor = Number(safeProfile.activity_factor);
    const hasValidWeight = Number.isFinite(weight) && weight > 0;
    const hasValidHeight = Number.isFinite(height) && height > 0;

    const normalizeFieldTitle = (field) => {
        const titles = {
            birth_date: 'дата рождения',
            sex: 'пол',
            weight_kg: 'текущий вес',
            height_cm: 'рост',
            age: 'возраст',
            activity_factor: 'уровень активности',
            calories_target: 'целевые калории',
            goal: 'цель',
            target_weight_kg: 'желаемый вес',
            goal_deadline: 'дедлайн'
        };
        return titles[field] || field;
    };

    const formatMissingFields = (fields) => {
        if (!Array.isArray(fields) || fields.length === 0) {
            return '';
        }
        return fields.map((field) => normalizeFieldTitle(field)).join(', ');
    };

    const levelA = {
        name: 'A',
        missing: [],
        age: null,
        status: ''
    };
    if (!safeProfile.birth_date) {
        levelA.missing.push('birth_date');
        levelA.status = `Не хватает: ${formatMissingFields(levelA.missing)}`;
    } else {
        levelA.age = typeof calculateAge === 'function' ? calculateAge(safeProfile.birth_date) : null;
        if (!Number.isFinite(levelA.age) || levelA.age <= 0) {
            levelA.status = 'Проверьте корректность даты рождения';
        } else {
            levelA.status = 'Возраст рассчитан';
        }
    }

    const hasValidAge = Number.isFinite(levelA.age) && levelA.age > 0;
    // Технический флаг диагностики: не блокирует расчёты сам по себе, только отражает полноту входа.
    const hasValidMetrics = hasValidWeight && hasValidHeight && hasValidAge;

    const levelB = {
        name: 'B',
        missing: [],
        bmr: null,
        status: ''
    };
    if (!safeProfile.sex) {
        levelB.missing.push('sex');
    }
    if (!hasValidAge) {
        levelB.missing.push('age');
    }
    if (!hasValidWeight) {
        levelB.missing.push('weight_kg');
    }
    if (!hasValidHeight) {
        levelB.missing.push('height_cm');
    }
    if (levelB.missing.length === 0 && typeof calculateBMR === 'function') {
        levelB.bmr = calculateBMR({
            sex: safeProfile.sex,
            weight_kg: weight,
            height_cm: height,
            age: levelA.age
        });
    }
    levelB.status = levelB.missing.length > 0
        ? `Не хватает: ${formatMissingFields(levelB.missing)}`
        : 'BMR рассчитан';

    const levelC = {
        name: 'C',
        missing: [],
        tdee: null,
        status: ''
    };
    if (!Number.isFinite(levelB.bmr)) {
        levelC.missing.push('bmr');
    }
    if (!(Number.isFinite(activityFactor) && activityFactor > 0)) {
        levelC.missing.push('activity_factor');
    }
    if (window.appDebug === true) {
        console.log('LEVEL C DEBUG', {
            bmr: levelB.bmr,
            activity_factor: safeProfile.activity_factor,
            type_activity: typeof safeProfile.activity_factor,
            missing: levelC.missing
        });
    }
    if (levelC.missing.length === 0 && typeof calculateTDEE === 'function') {
        levelC.tdee = calculateTDEE(levelB.bmr, safeProfile.activity_factor);
    }
    levelC.status = levelC.missing.length > 0
        ? `Не хватает: ${formatMissingFields(levelC.missing)}`
        : 'TDEE рассчитан';

    const consistency = typeof validateGoalWeightConsistency === 'function'
        ? validateGoalWeightConsistency(safeProfile.goal, safeProfile.weight_kg, safeProfile.target_weight_kg, safeProfile.goal_deadline)
        : { conflict: false };

    const weightForecast = typeof calculateWeightGoalForecast === 'function'
        ? calculateWeightGoalForecast({
            sex: safeProfile.sex,
            goal: safeProfile.goal,
            tdee_calories: levelC.tdee,
            weight_kg: Number.isFinite(weight) && weight > 0 ? weight : null,
            target_weight_kg: safeProfile.target_weight_kg,
            goal_deadline: safeProfile.goal_deadline
        })
        : {
            calories_target: null,
            calorie_delta: null,
            required_rate_kg_per_week: null,
            required_calorie_delta: null,
            required_calories_target: null,
            safe_weeks_estimate: null,
            weight_rate_kg_per_week: null,
            predicted_goal_date: null,
            warning_message: null,
            label: null
        };

    const weeklySourceProfile = {
        ...safeProfile,
        tdee_calories: levelC.tdee,
        calories_target: weightForecast.calories_target,
        weight_rate_kg_per_week: weightForecast.weight_rate_kg_per_week
    };
    const weeklyAdjustment = typeof adjustCaloriesByWeeklyProgress === 'function'
        ? adjustCaloriesByWeeklyProgress(weeklySourceProfile, safeProfile?.weekly_stats)
        : null;

    const profileCaloriesTarget = Number(safeProfile?.calories_target);
    const effectiveCaloriesTarget = Number.isFinite(profileCaloriesTarget) && profileCaloriesTarget > 0
        ? profileCaloriesTarget
        : null;
    const effectiveCalorieDelta = Number.isFinite(weeklyAdjustment?.calorie_delta)
        ? weeklyAdjustment.calorie_delta
        : weightForecast.calorie_delta;
    const effectiveWeightRate = Number.isFinite(weeklyAdjustment?.weight_rate_kg_per_week)
        ? weeklyAdjustment.weight_rate_kg_per_week
        : weightForecast.weight_rate_kg_per_week;

    const levelD = {
        name: 'D',
        missing: [],
        macros: null,
        status: ''
    };
    if (!Number.isFinite(effectiveCaloriesTarget)) {
        levelD.missing.push('calories_target');
    }
    if (!hasValidWeight) {
        levelD.missing.push('weight_kg');
    }
    if (!safeProfile.goal) {
        levelD.missing.push('goal');
    }
    if (levelD.missing.length === 0 && typeof calculateMacros === 'function') {
        levelD.macros = calculateMacros({
            goal: safeProfile.goal,
            weight_kg: weight,
            calories_target: effectiveCaloriesTarget
        });
    }
    levelD.status = levelD.missing.length > 0
        ? `Не хватает: ${formatMissingFields(levelD.missing)}`
        : 'Макросы рассчитаны';

    const levelE = {
        name: 'E',
        missing: [],
        status: ''
    };
    if (!safeProfile.goal) {
        levelE.missing.push('goal');
    }
    if (!hasValidWeight) {
        levelE.missing.push('weight_kg');
    }
    if (!Number.isFinite(levelC.tdee)) {
        levelE.missing.push('tdee');
    }
    if (safeProfile.goal && safeProfile.goal !== 'maintain' && !(Number.isFinite(Number(safeProfile.target_weight_kg)) && Number(safeProfile.target_weight_kg) > 0)) {
        levelE.missing.push('target_weight_kg');
    }
    if (safeProfile.goal && safeProfile.goal !== 'maintain' && safeProfile.goal_deadline === '') {
        levelE.missing.push('goal_deadline');
    }
    if (consistency?.conflict === true) {
        levelE.status = consistency?.reason || 'Цель и желаемый вес противоречат друг другу';
    } else {
        levelE.status = levelE.missing.length > 0
            ? `Не хватает: ${formatMissingFields(levelE.missing)}`
            : 'Прогноз рассчитан (требуемые дедлайн-метрики не рассчитываются)';
    }

    const diagnostics = buildResumeDiagnostics({
        ...safeProfile,
        age: levelA.age,
        bmr: levelB.bmr,
        tdee_calories: levelC.tdee,
        calories_target: effectiveCaloriesTarget,
        weight_rate_kg_per_week: effectiveWeightRate
    });
    resumeLastDiagnostics = {
        trace_id: traceId,
        diagnostics
    };

    logResumeDebug('updateCalculatedMetrics:levels', {
        traceId,
        safeProfile,
        levelA,
        levelB,
        levelC,
        levelD,
        levelE,
        effectiveCaloriesTarget,
        effectiveCalorieDelta,
        effectiveWeightRate
    });

    if (window.appDebug === true) {
        const missingFields = {
            levelA: [...levelA.missing],
            levelB: [...levelB.missing],
            levelC: [...levelC.missing],
            levelD: [...levelD.missing],
            levelE: [...levelE.missing]
        };
        console.groupCollapsed(`[RESUME_DEBUG][pipeline] ${traceId}`);
        console.log('Входной профиль', safeProfile);
        console.log('Входной профиль (сырые значения)', {
            profile: safeProfile,
            weight,
            height,
            activityFactor
        });
        console.log('Возраст (age)', {
            called: typeof calculateAge === 'function',
            value: levelA.age,
            valid: hasValidAge
        });
        console.log('BMR', {
            called: typeof calculateBMR === 'function' && levelB.missing.length === 0,
            value: levelB.bmr,
            valid: Number.isFinite(levelB.bmr)
        });
        console.log('TDEE', {
            called: typeof calculateTDEE === 'function' && levelC.missing.length === 0,
            value: levelC.tdee,
            valid: Number.isFinite(levelC.tdee),
            // Сигнатура ожидается как calculateTDEE(bmr, activity_factor).
            args: { bmr: levelB.bmr, activity_factor: safeProfile.activity_factor }
        });
        console.log('Флаги валидности метрик', {
            hasValidWeight,
            hasValidHeight,
            hasValidAge,
            hasValidMetrics
        });
        console.log('Weight forecast', weightForecast);
        console.log('Effective calories target', effectiveCaloriesTarget);
        console.log('Macros', levelD.macros);
        console.log('Missing fields', missingFields);
        if (!Number.isFinite(levelC.tdee)) {
            console.log('Причина null TDEE', {
                line: 'static/js/resume.js:levelC.tdee = calculateTDEE(levelB.bmr, safeProfile.activity_factor)',
                levelCMissing: [...levelC.missing],
                bmr: levelB.bmr,
                activity_factor: safeProfile.activity_factor
            });
        }
        console.groupEnd();
    }

    if (window.appDebug === true) {
        console.groupCollapsed(`[RESUME_DIAGNOSTICS] ${traceId}`);
        console.log(resumeLastDiagnostics);
        console.groupEnd();
    }

    if (weightForecast.warning_message && typeof showNotification === 'function') {
        if (resumeLastGoalDeadlineWarning !== weightForecast.warning_message) {
            showNotification(weightForecast.warning_message, 'warning');
            resumeLastGoalDeadlineWarning = weightForecast.warning_message;
        }
    } else if (weeklyAdjustment?.warning_message && typeof showNotification === 'function') {
        if (resumeLastGoalDeadlineWarning !== weeklyAdjustment.warning_message) {
            showNotification(weeklyAdjustment.warning_message, 'warning');
            resumeLastGoalDeadlineWarning = weeklyAdjustment.warning_message;
        }
    } else {
        resumeLastGoalDeadlineWarning = null;
    }

    const ageElement = document.getElementById('age-value');
    const bmrElement = document.getElementById('bmr-value');
    const tdeeElement = document.getElementById('tdee-value');
    const caloriesElement = document.getElementById('calories-value');
    const proteinElement = document.getElementById('protein-value');
    const fatElement = document.getElementById('fat-value');
    const carbsElement = document.getElementById('carbs-value');
    const fiberElement = document.getElementById('fiber-value');
    const weightRateElement = document.getElementById('weight-rate-value');
    const weightDateElement = document.getElementById('weight-date-value');
    const levelAStatusElement = document.getElementById('level-a-status');
    const levelBStatusElement = document.getElementById('level-b-status');
    const levelCStatusElement = document.getElementById('level-c-status');
    const levelDStatusElement = document.getElementById('level-d-status');
    const levelEStatusElement = document.getElementById('level-e-status');

    if (ageElement) {
        ageElement.textContent = Number.isFinite(levelA.age) && levelA.age > 0
            ? `${levelA.age} лет`
            : 'Нет расчёта';
    }
    if (bmrElement) {
        bmrElement.textContent = Number.isFinite(levelB.bmr)
            ? `${Math.round(levelB.bmr)} ккал`
            : 'Нет расчёта';
    }
    if (tdeeElement) {
        tdeeElement.textContent = Number.isFinite(levelC.tdee)
            ? `${Math.round(levelC.tdee)} ккал`
            : 'Нет расчёта';
    }
    if (caloriesElement) {
        caloriesElement.textContent = Number.isFinite(effectiveCaloriesTarget)
            ? `${Math.round(effectiveCaloriesTarget)} ккал`
            : 'Нет расчёта';
    }
    if (proteinElement) {
        proteinElement.textContent = levelD.macros === null
            ? 'Нет расчёта'
            : `${Math.round(levelD.macros.protein_g)} г • ${Math.round(levelD.macros.protein_pct * 100)}%`;
    }
    if (fatElement) {
        fatElement.textContent = levelD.macros === null
            ? 'Нет расчёта'
            : `${Math.round(levelD.macros.fat_g)} г • ${Math.round(levelD.macros.fat_pct * 100)}%`;
    }
    if (carbsElement) {
        carbsElement.textContent = levelD.macros === null
            ? 'Нет расчёта'
            : `${Math.round(levelD.macros.carbs_g)} г • ${Math.round(levelD.macros.carbs_pct * 100)}%`;
    }
    if (fiberElement) {
        const fiberTarget = Number(window.adminConfig?.reminders?.fiber_target_g);
        fiberElement.textContent = Number.isFinite(fiberTarget) && fiberTarget > 0
            ? `${Math.round(fiberTarget)} г`
            : 'Нет цели';
    }
    if (weightRateElement) {
        if (weightForecast.label) {
            weightRateElement.textContent = weightForecast.label;
        } else {
            weightRateElement.textContent = Number.isFinite(effectiveWeightRate)
                ? `${effectiveWeightRate} кг в неделю`
                : 'Нет расчёта';
        }
    }
    if (weightDateElement) {
        if (weightForecast.predicted_goal_date === null) {
            weightDateElement.textContent = 'Нет расчёта';
        } else {
            const date = new Date(weightForecast.predicted_goal_date);
            weightDateElement.textContent = Number.isNaN(date.getTime())
                ? weightForecast.predicted_goal_date
                : date.toLocaleDateString('ru-RU');
        }
    }

    if (levelAStatusElement) {
        levelAStatusElement.textContent = `Уровень A: ${levelA.status}`;
    }
    if (levelBStatusElement) {
        levelBStatusElement.textContent = `Уровень B: ${levelB.status}`;
    }
    if (levelCStatusElement) {
        levelCStatusElement.textContent = `Уровень C: ${levelC.status}`;
    }
    if (levelDStatusElement) {
        levelDStatusElement.textContent = `Уровень D: ${levelD.status}`;
    }
    if (levelEStatusElement) {
        levelEStatusElement.textContent = `Уровень E: ${levelE.status}`;
    }
}

// Рендер персональных рекомендаций
function updateRecommendationsState(state, message) {
    const stateElement = document.getElementById('recommendations-state');
    if (!stateElement) {
        return;
    }
    const labels = {
        loading: 'Состояние: загрузка',
        partial: 'Состояние: частично',
        ready: 'Состояние: готово',
        error: 'Состояние: ошибка'
    };
    stateElement.textContent = message || labels[state] || labels.partial;
    stateElement.className = 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium';
    if (state === 'loading') {
        stateElement.classList.add('bg-amber-100', 'text-amber-700');
        return;
    }
    if (state === 'ready') {
        stateElement.classList.add('bg-emerald-100', 'text-emerald-700');
        return;
    }
    if (state === 'error') {
        stateElement.classList.add('bg-rose-100', 'text-rose-700');
        return;
    }
    stateElement.classList.add('bg-slate-100', 'text-slate-600');
}

function getBaselineRecommendations(profile) {
    const baseline = [
        'Пейте воду равномерно в течение дня и не ждите сильной жажды.',
        'Старайтесь держать стабильный режим сна: это помогает контролировать аппетит и энергию.'
    ];
    if (profile?.food_diary !== true) {
        baseline.push('Добавьте 1–2 записи в дневник питания на этой неделе для более точной персонализации.');
    }
    return baseline.slice(0, 2);
}

function normalizeAiRecommendationResponse(data) {
    if (!data || typeof data !== 'object') {
        return {
            text: '',
            source: 'empty'
        };
    }
    const text = typeof data.text === 'string' && data.text.trim()
        ? data.text.trim()
        : (typeof data.recommendation === 'string' && data.recommendation.trim() ? data.recommendation.trim() : '');
    return {
        text,
        source: typeof data.text === 'string' ? 'text' : 'recommendation'
    };
}

function getPersonalizationMissingFields(profile) {
    const required = [
        { key: 'sex', label: 'пол' },
        { key: 'birth_date', label: 'дата рождения' },
        { key: 'height_cm', label: 'рост' },
        { key: 'weight_kg', label: 'текущий вес' },
        { key: 'activity_factor', label: 'активность' },
        { key: 'goal', label: 'цель' }
    ];
    if (profile?.goal && profile.goal !== 'maintain') {
        required.push({ key: 'target_weight_kg', label: 'желаемый вес' });
    }
    return required
        .filter((item) => {
            const value = profile?.[item.key];
            return value === null || value === undefined || value === '';
        })
        .map((item) => item.label);
}

function renderPersonalRecommendations(profile) {
    const safeProfile = profile && typeof profile === 'object' ? profile : {};
    const baseline = getBaselineRecommendations(safeProfile);
    const recommendations = typeof getRecommendations === 'function'
        ? getRecommendations(safeProfile)
        : [];
    const combinedRecommendations = [...baseline, ...recommendations]
        .filter((item, index, arr) => typeof item === 'string' && item.trim() && arr.indexOf(item) === index)
        .slice(0, 6);

    const diaryExplanation = typeof getDiaryExplanation === 'function'
        ? getDiaryExplanation(safeProfile)
        : '';
    const caloriesExplanation = typeof getCaloriesExplanation === 'function'
        ? getCaloriesExplanation(safeProfile)
        : '';
    const macrosExplanation = typeof getMacrosExplanation === 'function'
        ? getMacrosExplanation(safeProfile)
        : '';
    const deadlineMotivation = typeof getDeadlineMotivation === 'function'
        ? getDeadlineMotivation(safeProfile)
        : '';

    const listElement = document.getElementById('recommendations-list');
    const diaryElement = document.getElementById('diary-explanation');
    const caloriesElement = document.getElementById('calories-explanation');
    const macrosElement = document.getElementById('macros-explanation');
    const deadlineElement = document.getElementById('deadline-motivation');
    const deadlineWarning = document.getElementById('deadline-warning');

    if (listElement) {
        listElement.innerHTML = '';
        combinedRecommendations.forEach((item) => {
            const listItem = document.createElement('li');
            listItem.className = 'flex items-start space-x-2';
            listItem.innerHTML = '<span class="text-emerald-500">•</span>';
            const textNode = document.createElement('span');
            textNode.textContent = item;
            listItem.appendChild(textNode);
            listElement.appendChild(listItem);
        });
    }

    if (diaryElement) {
        diaryElement.textContent = diaryExplanation;
    }
    if (caloriesElement) {
        caloriesElement.textContent = caloriesExplanation;
    }
    if (macrosElement) {
        macrosElement.textContent = macrosExplanation;
    }
    if (deadlineElement) {
        if (deadlineMotivation) {
            deadlineElement.textContent = deadlineMotivation;
            deadlineElement.classList.remove('hidden');
        } else {
            deadlineElement.textContent = '';
            deadlineElement.classList.add('hidden');
        }
    }
    if (deadlineWarning) {
        const deadlineRaw = safeProfile.goal_deadline;
        if (deadlineRaw) {
            const deadlineDate = new Date(deadlineRaw);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            deadlineDate.setHours(0, 0, 0, 0);
            if (!Number.isNaN(deadlineDate.getTime()) && deadlineDate < today) {
                deadlineWarning.textContent = 'Дедлайн уже прошёл. Можно выбрать новую дату, чтобы план был актуальным.';
                deadlineWarning.classList.remove('hidden');
            } else {
                deadlineWarning.textContent = '';
                deadlineWarning.classList.add('hidden');
            }
        } else {
            deadlineWarning.textContent = '';
            deadlineWarning.classList.add('hidden');
        }
    }

    const missingForPersonalization = getPersonalizationMissingFields(safeProfile);
    if (missingForPersonalization.length > 0) {
        updateRecommendationsState('partial', `Состояние: частично — для персонализации добавьте: ${missingForPersonalization.join(', ')}`);
    } else {
        updateRecommendationsState('ready', 'Состояние: готово — рекомендации персонализированы.');
    }
}

// Получить AI-рекомендацию и обновить текстовые блоки
async function applyAiRecommendationToResume(profile) {
    const safeProfile = profile && typeof profile === 'object' ? profile : {};
    const caloriesElement = document.getElementById('calories-explanation');
    const macrosElement = document.getElementById('macros-explanation');
    const deadlineElement = document.getElementById('deadline-motivation');

    if (!caloriesElement && !macrosElement && !deadlineElement) {
        return;
    }

    if (window.profileCompleted !== true) {
        const missingForPersonalization = getPersonalizationMissingFields(safeProfile);
        updateRecommendationsState(
            'partial',
            `Состояние: частично — заполните поля для персонализации: ${missingForPersonalization.join(', ') || 'основные данные профиля'}`
        );
        return;
    }

    updateRecommendationsState('loading', 'Состояние: загрузка — получаем AI-рекомендации...');

    try {
        const response = await apiFetch('/api/ai/recommendation', {
            method: 'POST',
            body: JSON.stringify(profile)
        });
        if (!response.ok) {
            updateRecommendationsState('error', 'Состояние: ошибка — не удалось получить AI-рекомендации.');
            return;
        }
        const data = await response.json();
        const normalized = normalizeAiRecommendationResponse(data);
        if (!normalized.text) {
            updateRecommendationsState('partial', 'Состояние: частично — используем базовые рекомендации без AI.');
            return;
        }

        const sentences = normalized.text
            .split(/(?<=[.!?])\s+/)
            .map((part) => part.trim())
            .filter(Boolean);

        const caloriesSentence = sentences.find((item) => item.toLowerCase().includes('ккал'));
        const macrosSentence = sentences.find((item) => item.toLowerCase().includes('бжу'));
        const deadlineSentence = sentences.find((item) =>
            item.toLowerCase().includes('дата') || item.toLowerCase().includes('нед')
        );

        if (caloriesElement && caloriesSentence) {
            caloriesElement.textContent = caloriesSentence;
        }
        if (macrosElement && macrosSentence) {
            macrosElement.textContent = macrosSentence;
        }
        if (deadlineElement && deadlineSentence) {
            deadlineElement.textContent = deadlineSentence;
            deadlineElement.classList.remove('hidden');
        }

        updateRecommendationsState('ready', 'Состояние: готово — AI-рекомендации применены.');
    } catch (error) {
        updateRecommendationsState('error', 'Состояние: ошибка — не удалось применить AI-рекомендации.');
    }
}

// Create a data card element
function createDataCard(point, index) {
    const colorClasses = {
        emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
        purple: 'bg-purple-50 text-purple-600 border-purple-100',
        blue: 'bg-blue-50 text-blue-600 border-blue-100',
        amber: 'bg-amber-50 text-amber-600 border-amber-100',
        pink: 'bg-pink-50 text-pink-600 border-pink-100'
    };
    
    const card = document.createElement('div');
    card.className = 'card animate-slide-in';
    card.style.animationDelay = `${index * 0.1}s`;
    
    card.innerHTML = `
        <div class="flex items-center justify-between mb-4">
            <div class="flex items-center space-x-3">
                <div class="w-10 h-10 rounded-xl ${colorClasses[point.color]} flex items-center justify-center">
                    <i data-feather="${point.icon}" class="w-5 h-5"></i>
                </div>
                <h3 class="font-semibold text-slate-800">${point.label}</h3>
            </div>
        </div>
        <div class="text-2xl font-semibold text-slate-800 mb-2">${point.value}</div>
        ${point.details ? `<div class="text-xs text-slate-500">${point.details}</div>` : ''}
    `;
    
    return card;
}

// Format gender for display
function formatGender(gender) {
    const genderMap = {
        'male': 'Мужской',
        'female': 'Женский',
        'other': 'Предпочитаю не указывать'
    };
    return genderMap[gender] || 'Не указано';
}

// Convert cm to feet and inches
function cmToFeetInches(cm) {
    if (!cm) return '';
    const inches = cm / 2.54;
    const feet = Math.floor(inches / 12);
    const remainingInches = Math.round(inches % 12);
    return `${feet}'${remainingInches}"`;
}

// Convert kg to lbs
function kgToLbs(kg) {
    if (!kg) return '';
    return Math.round(kg * 2.20462);
}

// Calculate weight difference
function calculateWeightDifference(current, target) {
    if (!current || !target) return '';
    const diff = current - target;
    if (diff > 0) {
        return `Сбросить ${diff.toFixed(1)} кг (${kgToLbs(diff)} фунтов)`;
    } else if (diff < 0) {
        return `Набрать ${Math.abs(diff).toFixed(1)} кг (${kgToLbs(Math.abs(diff))} фунтов)`;
    } else {
        return 'Идеальный вес!';
    }
}

// Calculate and display BMI
function calculateBMI(profile) {
    const data = typeof mapUserProfileToUserData === 'function'
        ? mapUserProfileToUserData(profile || {})
        : {};
    const height = parseFloat(data.height);
    const weight = parseFloat(data.currentWeight);
    
    if (!height || !weight || height <= 0 || weight <= 0) {
        document.getElementById('bmi-value').textContent = '--';
        document.getElementById('bmi-category').textContent = 'Введите рост и вес';
return;
    }
    
    // Calculate BMI: weight (kg) / height (m)²
    const heightInMeters = height / 100;
    const bmi = weight / (heightInMeters * heightInMeters);
    const bmiRounded = bmi.toFixed(1);
    
    // Determine BMI category and color
    const { category, color } = getBMICategory(bmi);
    
    // Update display
    document.getElementById('bmi-value').textContent = bmiRounded;
    document.getElementById('bmi-category').textContent = category;
    document.getElementById('bmi-category').className = `text-${color}-600 font-medium`;
    
    // Update progress bar
    updateBMIProgress(bmi);
}

// Get BMI category
function getBMICategory(bmi) {
    if (bmi < 18.5) {
        return { category: 'Недостаточный вес', color: 'blue', progress: (bmi / 18.5) * 25 };
    } else if (bmi < 25) {
        return { category: 'Нормальный вес', color: 'emerald', progress: 25 + ((bmi - 18.5) / (25 - 18.5)) * 25 };
    } else if (bmi < 30) {
        return { category: 'Избыточный вес', color: 'amber', progress: 50 + ((bmi - 25) / (30 - 25)) * 25 };
    } else {
        return { category: 'Ожирение', color: 'red', progress: 75 + ((bmi - 30) / (40 - 30)) * 25 };
    }
}

// Update BMI progress visualization
function updateBMIProgress(bmi) {
    const progressBar = document.getElementById('bmi-progress');
    const { color, progress } = getBMICategory(bmi);
    
    // Set color based on category
    const colorMap = {
        'blue': '#3b82f6',
        'emerald': '#10b981',
        'amber': '#f59e0b',
        'red': '#ef4444'
    };
    
    progressBar.style.width = `${Math.min(progress, 100)}%`;
    progressBar.style.backgroundColor = colorMap[color] || colorMap.emerald;
    
    // Animate the progress
    progressBar.style.transition = 'width 1s ease-out, background-color 1s ease-out';
}

// Рендер круговых индикаторов питания
function renderNutritionRings(profile) {
    const resolveCarbTotals = (totalValue, simpleValue, complexValue) => {
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
    };
    const resolveEntryTotals = (entry) => {
        if (!entry) {
            return { calories: 0, protein_g: 0, fat_g: 0, carbs_g: 0, fiber_g: 0, water_l: 0 };
        }
        if (entry.mode === 'products') {
            if (entry.totals) {
                const resolved = resolveCarbTotals(
                    entry.totals.carbs_g,
                    entry.totals.carbs_simple_g,
                    entry.totals.carbs_complex_g
                );
                return { ...entry.totals, carbs_g: resolved.total, water_l: Number(entry.water_l) || 0 };
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
                        acc.fiber_g += Number(item?.fiber) || Number(item?.fiber_g) || 0;
                        return acc;
                    },
                    { calories: 0, protein_g: 0, fat_g: 0, carbs_g: 0, fiber_g: 0, water_l: 0 }
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
            fiber_g: Number(entry.fiber_g) || 0,
            water_l: Number(entry.water_l) || 0
        };
    };
    const today = typeof window.normalizeLocalDate === 'function'
        ? window.normalizeLocalDate(new Date())
        : null;
    const diaryEntries = typeof window.getDiaryEntries === 'function'
        ? window.getDiaryEntries()
        : [];

    let waterMax = 0;
    const totals = diaryEntries.reduce(
        (acc, entry) => {
            if (!today || entry?.date !== today) {
                return acc;
            }
            const totals = resolveEntryTotals(entry);
            acc.calories += totals.calories;
            acc.protein += totals.protein_g;
            acc.fat += totals.fat_g;
            acc.carbs += totals.carbs_g;
            acc.fiber += totals.fiber_g;
            waterMax = Math.max(waterMax, Number(entry?.water_l) || 0);
            return acc;
        },
        { calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, water: 0 }
    );
    totals.water = waterMax;

    const hasEntriesToday = totals.calories > 0 || totals.protein > 0 || totals.fat > 0 || totals.carbs > 0 || totals.fiber > 0 || totals.water > 0;

    const safeProfile = profile && typeof profile === 'object' ? profile : {};
    const recommended = {
        calories: Number(safeProfile?.calories_target) || null,
        protein: Number(safeProfile?.macros?.protein_g) || null,
        fat: Number(safeProfile?.macros?.fat_g) || null,
        carbs: Number(safeProfile?.macros?.carbs_g) || null,
        fiber: Number(window.adminConfig?.reminders?.fiber_target_g) || null,
        water: Number(window.adminConfig?.reminders?.water_min_l) || null,
    };

    const buildValue = (consumed, target, unit) => {
        if (!hasEntriesToday) {
            return 'Нет данных';
        }
        if (Number.isFinite(target) && target > 0) {
            return `Факт / цель: ${Math.round(consumed)} / ${Math.round(target)} ${unit}`;
        }
        return `Факт: ${Math.round(consumed)} ${unit}`;
    };

    const calcPercent = (consumed, target) => {
        if (!hasEntriesToday) {
            return null;
        }
        if (!Number.isFinite(target) || target <= 0) {
            return null;
        }
        return (consumed / target) * 100;
    };

    const rings = [
        {
            id: 'calorie-ring',
            data: {
                percent: calcPercent(totals.calories, recommended.calories),
                value: buildValue(totals.calories, recommended.calories, 'ккал'),
                label: 'Калории сегодня',
                color: '#10b981',
            },
        },
        {
            id: 'water-ring',
            data: {
                percent: calcPercent(totals.water, recommended.water),
                value: buildValue(totals.water, recommended.water, 'л'),
                label: 'Вода сегодня',
                color: '#38bdf8',
            },
        },
        {
            id: 'macro-protein-ring',
            data: {
                percent: calcPercent(totals.protein, recommended.protein),
                value: buildValue(totals.protein, recommended.protein, 'г'),
                label: 'Белки сегодня',
                color: '#a855f7',
            },
        },
        {
            id: 'macro-fat-ring',
            data: {
                percent: calcPercent(totals.fat, recommended.fat),
                value: buildValue(totals.fat, recommended.fat, 'г'),
                label: 'Жиры сегодня',
                color: '#f59e0b',
            },
        },
        {
            id: 'macro-carb-ring',
            data: {
                percent: calcPercent(totals.carbs, recommended.carbs),
                value: buildValue(totals.carbs, recommended.carbs, 'г'),
                label: 'Углеводы сегодня',
                color: '#06b6d4',
            },
        },
        {
            id: 'macro-fiber-ring',
            data: {
                percent: calcPercent(totals.fiber, recommended.fiber),
                value: buildValue(totals.fiber, recommended.fiber, 'г'),
                label: 'Клетчатка сегодня',
                color: '#84cc16',
            },
        },
    ];

    rings.forEach(({ id, data }) => {
        const container = document.getElementById(id);
        if (!container) {
            return;
        }
        container.innerHTML = '';
        container.appendChild(createProgressRing(data));
    });
}

// Создание SVG-круга с анимацией заполнения
function createProgressRing({ percent, value, label, color }) {
    const size = 120;
    const strokeWidth = 10;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const safePercent = Number.isFinite(percent) ? percent : 0;
    const progress = Math.max(0, Math.min(safePercent, 100));

    const wrapper = document.createElement('div');
    wrapper.className = 'flex flex-col items-center text-center gap-2';

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`);

    const backgroundCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    backgroundCircle.setAttribute('cx', size / 2);
    backgroundCircle.setAttribute('cy', size / 2);
    backgroundCircle.setAttribute('r', radius);
    backgroundCircle.setAttribute('stroke', '#e2e8f0');
    backgroundCircle.setAttribute('stroke-width', strokeWidth);
    backgroundCircle.setAttribute('fill', 'none');

    const progressCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    progressCircle.setAttribute('cx', size / 2);
    progressCircle.setAttribute('cy', size / 2);
    progressCircle.setAttribute('r', radius);
    progressCircle.setAttribute('stroke', color);
    progressCircle.setAttribute('stroke-width', strokeWidth);
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

    const labelText = document.createElement('div');
    labelText.className = 'text-sm font-semibold text-slate-700';
    labelText.textContent = label;

    const valueText = document.createElement('div');
    valueText.className = 'text-xs text-slate-500';
    valueText.textContent = value;

    wrapper.appendChild(svg);
    wrapper.appendChild(labelText);
    wrapper.appendChild(valueText);

    requestAnimationFrame(() => {
        progressCircle.style.transition = 'stroke-dashoffset 1.2s ease-out';
        progressCircle.setAttribute(
            'stroke-dashoffset',
            `${circumference - (progress / 100) * circumference}`
        );
    });

    return wrapper;
}

// Рендер статуса пробного периода
async function renderTrialStatus(profile) {
    const safeProfile = profile && typeof profile === 'object' ? profile : {};
    const datesElement = document.getElementById('trial-dates');
    const badgeElement = document.getElementById('trial-badge');
    const warningElement = document.getElementById('trial-warning');
    const paywallElement = document.getElementById('paywall');
    const payButton = document.getElementById('pay-button');
    const trialCard = document.getElementById('trial-card');
    const paymentMotivation = document.getElementById('payment-motivation');
    const recommendationsSection = document.getElementById('recommendations-section');
    const nutritionSection = document.getElementById('nutrition-rings-section');

    if (!datesElement || !badgeElement || !paywallElement || !payButton) {
        return;
    }

    const isDevMode = window.appIsDev === true || window.appMode === 'development';
    if (window.serverUser?.authorized !== true) {
        datesElement.textContent = 'Откройте приложение через кнопку бота.';
        badgeElement.textContent = 'Пробный период до --';
        if (warningElement) {
            warningElement.textContent = '';
            warningElement.classList.add('hidden');
        }
        paywallElement.classList.add('hidden');
        if (recommendationsSection) {
            recommendationsSection.classList.remove('hidden');
        }
        if (nutritionSection) {
            nutritionSection.classList.remove('hidden');
        }
        return;
    }

    const formatDateRu = (iso) => {
        if (!iso) {
            return null;
        }
        const date = new Date(iso);
        if (Number.isNaN(date.getTime())) {
            return null;
        }
        return date.toLocaleDateString('ru-RU');
    };

    const fetchSubscriptionStatus = async () => {
        const response = await apiFetch('/api/subscription/status');
        if (!response.ok) {
            throw new Error('Не удалось получить статус подписки.');
        }
        return response.json();
    };

    const startTrial = async () => {
        const response = await apiFetch('/api/subscription/start_trial', {
            method: 'POST',
            body: JSON.stringify({})
        });
        if (!response.ok) {
            throw new Error('Не удалось запустить пробный период.');
        }
        return response.json();
    };

    const startPayment = async () => {
        const response = await apiFetch('/api/payments/start', {
            method: 'POST',
            body: JSON.stringify({ days: 30 })
        });
        if (!response.ok) {
            throw new Error('Не удалось выполнить оплату.');
        }
        return response.json();
    };

    let subscription;
    if (trialCard) {
        trialCard.classList.add('is-loading');
    }
    try {
        subscription = await fetchSubscriptionStatus();
    } catch (error) {
        datesElement.textContent = 'Попробуйте обновить страницу.';
        badgeElement.textContent = 'Пробный период до --';
        paywallElement.classList.add('hidden');
        if (trialCard) {
            trialCard.classList.remove('is-loading');
        }
        return;
    }

    if (subscription.subscription_status === 'disabled' || isDevMode) {
        datesElement.textContent = 'Оплата и пробный период недоступны в режиме разработки.';
        badgeElement.textContent = 'DEV MODE';
        paywallElement.classList.add('hidden');
        if (warningElement) {
            warningElement.textContent = '';
            warningElement.classList.add('hidden');
        }
        if (recommendationsSection) {
            recommendationsSection.classList.remove('hidden');
        }
        if (nutritionSection) {
            nutritionSection.classList.remove('hidden');
        }
        if (payButton) {
            payButton.disabled = true;
            payButton.classList.add('opacity-60', 'cursor-not-allowed');
        }
        if (trialCard) {
            trialCard.classList.remove('is-loading');
        }
        return;
    }
    if (subscription.subscription_status === 'none') {
        try {
            subscription = await startTrial();
        } catch (error) {
            datesElement.textContent = 'Попробуйте обновить страницу.';
            badgeElement.textContent = 'Пробный период до --';
            paywallElement.classList.add('hidden');
            if (trialCard) {
                trialCard.classList.remove('is-loading');
            }
            return;
        }
    }
    if (trialCard) {
        trialCard.classList.remove('is-loading');
    }

    const untilDate = formatDateRu(subscription.subscription_until);
    const accessUntilText = untilDate
        ? `Максимальный доступ открыт до ${untilDate}`
        : 'Максимальный доступ открыт до --';
    paywallElement.classList.add('hidden');
    badgeElement.textContent = accessUntilText;
    if (warningElement) {
        warningElement.textContent = '';
        warningElement.classList.add('hidden');
    }

    const isExpired = subscription.subscription_status === 'expired';
    if (recommendationsSection) {
        recommendationsSection.classList.toggle('hidden', isExpired);
    }
    if (nutritionSection) {
        nutritionSection.classList.toggle('hidden', isExpired);
    }

    if (subscription.subscription_status === 'trial') {
        datesElement.textContent = accessUntilText;
        if (warningElement && subscription.subscription_until) {
            const endDate = new Date(subscription.subscription_until);
            const now = new Date();
            const diffMs = endDate.getTime() - now.getTime();
            const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
            if (daysLeft <= 3 && daysLeft >= 0) {
                warningElement.textContent = 'Пробный период скоро закончится. Можно заранее оформить подписку.';
                warningElement.classList.remove('hidden');
            }
        }
    } else if (subscription.subscription_status === 'active') {
        datesElement.textContent = accessUntilText;
    } else if (subscription.subscription_status === 'expired') {
        datesElement.textContent = untilDate
            ? `Пробный период закончился ${untilDate}.`
            : 'Пробный период завершён.';
        paywallElement.classList.remove('hidden');
        badgeElement.textContent = 'Пробный период завершён';
        if (paymentMotivation && typeof getPaymentMotivation === 'function') {
            const deviations = typeof getFoodDiaryDeviationStatus === 'function'
                ? getFoodDiaryDeviationStatus(safeProfile)
                : null;
            paymentMotivation.textContent = await getPaymentMotivation(safeProfile, deviations);
        }
    } else {
        datesElement.textContent = 'Попробуйте обновить страницу.';
        badgeElement.textContent = 'Пробный период до --';
    }

    payButton.onclick = async () => {
        try {
            const result = await startPayment();
            if (result?.status === 'success') {
                if (typeof showNotification === 'function') {
                    showNotification('Оплата прошла успешно!', 'success');
                }
                payButton.classList.add('btn-confirmed');
                setTimeout(() => payButton.classList.remove('btn-confirmed'), 900);
                await renderTrialStatus({
                    ...safeProfile,
                    subscription_status: result.subscription_status ?? 'active',
                    subscription_until: result.subscription_until ?? subscription.subscription_until
                });
            }
        } catch (error) {
            if (typeof showNotification === 'function') {
                showNotification('Не удалось выполнить оплату.', 'error');
            }
        }
    };
}

// Рендер кнопок напоминаний для Telegram

async function persistResumeProfile(profile) {
    if (!profile || window.serverUser?.authorized !== true) {
        return true;
    }
    try {
        const fetcher = window.apiFetch || fetch;
        const response = await fetcher('/api/profile/save', {
            method: 'POST',
            body: JSON.stringify(profile)
        });
        return response.ok;
    } catch (error) {
        return false;
    }
}

// Сохранить изменения и перейти в прогресс
async function saveAndContinue(profile) {
    const profileForSave = {
        ...(profile || {}),
        is_completed: true
    };

    const saved = await persistResumeProfile(profileForSave);
    if (!saved) {
        if (typeof showNotification === 'function') {
            showNotification('Не удалось сохранить профиль. Проверьте подключение и попробуйте снова.', 'error');
        }
        return;
    }

    if (typeof showNotification === 'function') {
        showNotification('Изменения сохранены. Переходим в прогресс.', 'success');
    }

    setTimeout(() => {
        window.location.href = '/profile';
    }, 600);
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async function() {
    if (window.serverUser?.authorized !== true && typeof loadProfileStatus === 'function') {
        const status = await loadProfileStatus();
        window.serverUser = {
            authorized: status.authorized === true,
            telegram_user_id: status.telegram_user_id ?? null,
            profile_completed: status.profile_completed === true
        };
        window.profileCompleted = status.profile_completed;
    }

    const profile = await loadProfileFromBackend();
    if (!profile) {
        if (window.appDebug === true) {
            console.warn('[RESUME] Профиль не загружен, рендер пропущен.');
        }
        return;
    }

    const resolvedProfile = await ensureComputedTargetsSaved(profile);
    resumeBackendProfile = resolvedProfile;

    generateSummary(resolvedProfile);
    calculateBMI(resolvedProfile);
    updateCalculatedMetrics(resolvedProfile);
    renderPersonalRecommendations(resolvedProfile);
    applyAiRecommendationToResume(resolvedProfile);
    renderNutritionRings(resolvedProfile);

    const copyDiagnosticsButton = document.getElementById('resume-copy-diagnostics-button');
    if (copyDiagnosticsButton) {
        copyDiagnosticsButton.classList.toggle('hidden', window.appDebug !== true);
        copyDiagnosticsButton.addEventListener('click', () => {
            copyResumeDiagnosticsToClipboard();
        });
    }
    await renderTrialStatus(resolvedProfile);

    const saveButton = document.getElementById('resume-save-button');
    if (saveButton) {
        saveButton.addEventListener('click', function(event) {
            event.preventDefault();
            saveAndContinue(resolvedProfile);
        });
    }
});
