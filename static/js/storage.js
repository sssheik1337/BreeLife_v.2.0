// Хранилище профиля пользователя и нормализация данных

(function() {
    const STORAGE_KEY = 'user_profile';
    const ALLOWED_SEX = new Set(['male', 'female']);
    const ALLOWED_GOALS = new Set(['lose', 'maintain', 'gain', 'muscle']);
    const ALLOWED_RISKS = new Set(['low', 'medium', 'high']);

    function getTelegramUserId() {
        const rawId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
        if (typeof rawId === 'number') {
            return rawId;
        }
        if (typeof rawId === 'string') {
            const parsed = Number(rawId);
            return Number.isFinite(parsed) ? parsed : null;
        }
        return null;
    }

    function getDefaultUserProfile() {
        return {
            telegram_user_id: null,
            sex: null,
            birth_date: null,
            age: null,
            height_cm: null,
            weight_kg: null,
            target_weight_kg: null,
            goal: null,
            activity_factor: null,
            goal_deadline: null,
            food_diary: null,
            bmr: null,
            tdee_calories: null,
            macros: null,
            weight_rate_kg_per_week: null,
            predicted_goal_date: null,
            weekly_stats: {
                calories_avg: null,
                protein_avg_g: null,
                fat_avg_g: null,
                carbs_avg_g: null,
                water_avg_l: null,
                days_logged: null,
                week_start: null,
                week_end: null
            },
            weekly_adjustments: null,
            weekly_review: null,
            deviation_risk: null,
            deviation_comment: null,
            subscription_until: null,
            subscription_status: null,
            subscription_started_at: null,
            trial_started_at: null
        };
    }

    function parseNumber(value) {
        if (value === null || value === undefined || value === '') {
            return null;
        }
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }

    function parseBoolean(value) {
        if (value === true || value === false) {
            return value;
        }
        if (value === 'yes') {
            return true;
        }
        if (value === 'no') {
            return false;
        }
        return null;
    }

    function normalizeSex(value) {
        if (ALLOWED_SEX.has(value)) {
            return value;
        }
        return null;
    }

    function normalizeGoal(value) {
        if (ALLOWED_GOALS.has(value)) {
            return value;
        }
        return null;
    }

    function normalizeRisk(value) {
        if (ALLOWED_RISKS.has(value)) {
            return value;
        }
        return null;
    }

    function normalizeMacros(macros) {
        if (!macros) {
            return null;
        }
        return {
            protein_g: parseNumber(macros.protein_g),
            fat_g: parseNumber(macros.fat_g),
            carbs_g: parseNumber(macros.carbs_g),
            protein_pct: parseNumber(macros.protein_pct),
            fat_pct: parseNumber(macros.fat_pct),
            carbs_pct: parseNumber(macros.carbs_pct)
        };
    }

    function normalizeWeeklyStats(stats) {
        if (!stats || typeof stats !== 'object') {
            return null;
        }
        return {
            calories_avg: parseNumber(stats.calories_avg),
            protein_avg_g: parseNumber(stats.protein_avg_g),
            fat_avg_g: parseNumber(stats.fat_avg_g),
            carbs_avg_g: parseNumber(stats.carbs_avg_g),
            water_avg_l: parseNumber(stats.water_avg_l),
            days_logged: parseNumber(stats.days_logged),
            week_start: stats.week_start || null,
            week_end: stats.week_end || null
        };
    }

    function normalizeWeeklyReview(review) {
        if (!review || typeof review !== 'object') {
            return null;
        }
        return {
            week_start: review.week_start || null,
            week_end: review.week_end || null,
            avg_calories: parseNumber(review.avg_calories),
            avg_protein_g: parseNumber(review.avg_protein_g),
            avg_fat_g: parseNumber(review.avg_fat_g),
            avg_carbs_g: parseNumber(review.avg_carbs_g),
            days_logged: parseNumber(review.days_logged),
            status: review.status || null,
            message: review.message || null
        };
    }

    function getAgeFromBirthDate(birthDate) {
        if (!birthDate) {
            return null;
        }
        const birth = new Date(birthDate);
        if (Number.isNaN(birth.getTime())) {
            return null;
        }
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
            age -= 1;
        }
        return age;
    }

    function normalizeUserProfile(profile) {
        const base = getDefaultUserProfile();
        const merged = { ...base, ...(profile || {}) };

        const telegramId = getTelegramUserId();
        merged.telegram_user_id = parseNumber(merged.telegram_user_id) ?? telegramId;
        if (merged.telegram_user_id === null && telegramId !== null) {
            merged.telegram_user_id = telegramId;
        }

        merged.sex = normalizeSex(merged.sex);
        merged.birth_date = merged.birth_date || null;
        merged.age = parseNumber(merged.age);
        if (merged.age === null) {
            merged.age = getAgeFromBirthDate(merged.birth_date);
        }
        merged.height_cm = parseNumber(merged.height_cm);
        merged.weight_kg = parseNumber(merged.weight_kg);
        merged.target_weight_kg = parseNumber(merged.target_weight_kg);
        merged.goal = normalizeGoal(merged.goal);
        merged.activity_factor = parseNumber(merged.activity_factor);
        merged.goal_deadline = merged.goal_deadline || null;
        merged.food_diary = parseBoolean(merged.food_diary);
        merged.bmr = parseNumber(merged.bmr);
        merged.tdee_calories = parseNumber(merged.tdee_calories);
        merged.macros = normalizeMacros(merged.macros);
        merged.weight_rate_kg_per_week = parseNumber(merged.weight_rate_kg_per_week);
        merged.predicted_goal_date = merged.predicted_goal_date || null;
        merged.weekly_stats = normalizeWeeklyStats(merged.weekly_stats);
        merged.weekly_adjustments = merged.weekly_adjustments || null;
        merged.weekly_review = normalizeWeeklyReview(merged.weekly_review);
        merged.deviation_risk = normalizeRisk(merged.deviation_risk);
        merged.deviation_comment = merged.deviation_comment || null;
        merged.subscription_until = merged.subscription_until || null;
        merged.subscription_status = merged.subscription_status || null;
        merged.subscription_started_at = merged.subscription_started_at || null;
        merged.trial_started_at = merged.trial_started_at || null;

        return merged;
    }

    function mapLegacyUserDataToProfile(legacy) {
        if (!legacy) {
            return null;
        }
        const goalMap = {
            loss: 'lose',
            maintain: 'maintain',
            gain: 'gain'
        };
        const sex = legacy.gender === 'male' || legacy.gender === 'female' ? legacy.gender : null;
        const birthDate = legacy.birthDate || null;
        const profile = {
            telegram_user_id: null,
            sex,
            birth_date: birthDate,
            age: getAgeFromBirthDate(birthDate),
            height_cm: parseNumber(legacy.height),
            weight_kg: parseNumber(legacy.currentWeight),
            target_weight_kg: parseNumber(legacy.targetWeight),
            goal: goalMap[legacy.goalType] || null,
            activity_factor: parseNumber(legacy.activityLevel),
            goal_deadline: legacy.deadline || null,
            food_diary: parseBoolean(legacy.foodDiary),
            bmr: null,
            tdee_calories: null,
            macros: null,
            weight_rate_kg_per_week: null,
            predicted_goal_date: null,
            weekly_stats: null,
            weekly_adjustments: null,
            weekly_review: null,
            deviation_risk: null,
            deviation_comment: null,
            subscription_until: null,
            subscription_status: null,
            subscription_started_at: null,
            trial_started_at: null
        };
        return profile;
    }

    function readLegacyUserData() {
        const raw = localStorage.getItem('health_bloom_user_data');
        if (!raw) {
            return null;
        }
        try {
            return JSON.parse(raw);
        } catch (error) {
            return null;
        }
    }

    function getUserProfile() {
        let storedProfile = null;
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            storedProfile = raw ? JSON.parse(raw) : null;
        } catch (error) {
            storedProfile = null;
        }

        if (!storedProfile) {
            const legacy = readLegacyUserData();
            storedProfile = mapLegacyUserDataToProfile(legacy) || {};
        }

        const normalized = normalizeUserProfile(storedProfile);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
        } catch (error) {
            // Игнорируем ошибку сохранения, данные остаются в памяти.
        }
        return normalized;
    }

    function addTrialDays(startedAtIso, days) {
        const date = new Date(startedAtIso);
        if (Number.isNaN(date.getTime())) {
            return null;
        }
        date.setDate(date.getDate() + days);
        return date.toISOString();
    }

    function applyTrialStartIfNeeded(current, merged) {
        const hasTelegramId = merged.telegram_user_id !== null && merged.telegram_user_id !== undefined;
        const isFirstTelegramId = !current.telegram_user_id && hasTelegramId;
        const hasSubscriptionStatus = merged.subscription_status !== null && merged.subscription_status !== undefined;
        const hasSubscriptionUntil = merged.subscription_until !== null && merged.subscription_until !== undefined;
        const hasSubscriptionStartedAt = merged.subscription_started_at !== null && merged.subscription_started_at !== undefined;
        const hasTrialStartedAt = merged.trial_started_at !== null && merged.trial_started_at !== undefined;

        if (
            !isFirstTelegramId ||
            hasSubscriptionStatus ||
            hasSubscriptionUntil ||
            hasSubscriptionStartedAt ||
            hasTrialStartedAt
        ) {
            return { merged, shouldNotifyBackend: false };
        }

        const adminConfig = window.adminConfig || {};
        const trialDays = Number.isFinite(adminConfig.trial_days) ? adminConfig.trial_days : 30;
        const startedAt = new Date().toISOString();
        const until = addTrialDays(startedAt, trialDays);
        if (!until) {
            return { merged, shouldNotifyBackend: false };
        }

        return {
            merged: {
                ...merged,
                subscription_status: 'trial',
                subscription_started_at: startedAt,
                trial_started_at: startedAt,
                subscription_until: until
            },
            shouldNotifyBackend: true
        };
    }

    async function notifyTrialStart(telegramUserId, startedAt) {
        try {
            const response = await fetch('/api/subscription/start_trial', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    telegram_user_id: telegramUserId,
                    trial_started_at: startedAt,
                    subscription_started_at: startedAt
                })
            });
            if (!response.ok) {
                throw new Error('Не удалось синхронизировать старт пробного периода.');
            }
            return await response.json();
        } catch (error) {
            return null;
        }
    }

    function setUserProfile(profile) {
        const current = getUserProfile();
        const merged = { ...current, ...(profile || {}) };
        const trialResult = applyTrialStartIfNeeded(current, merged);
        const normalized = normalizeUserProfile(trialResult.merged);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
        } catch (error) {
            // Игнорируем ошибку сохранения, данные остаются в памяти.
        }
        if (trialResult.shouldNotifyBackend) {
            void notifyTrialStart(normalized.telegram_user_id, normalized.subscription_started_at);
        }
        return normalized;
    }

    function patchUserProfile(partial) {
        const current = getUserProfile();
        const merged = { ...current, ...(partial || {}) };
        if (partial && Object.prototype.hasOwnProperty.call(partial, 'macros')) {
            merged.macros = partial.macros;
        }
        const trialResult = applyTrialStartIfNeeded(current, merged);
        const normalized = normalizeUserProfile(trialResult.merged);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
        } catch (error) {
            // Игнорируем ошибку сохранения, данные остаются в памяти.
        }
        if (trialResult.shouldNotifyBackend) {
            void notifyTrialStart(normalized.telegram_user_id, normalized.subscription_started_at);
        }
        return normalized;
    }

    window.getUserProfile = getUserProfile;
    window.setUserProfile = setUserProfile;
    window.patchUserProfile = patchUserProfile;
})();
