// @ts-nocheck
import { ensureTelegramAuthSession } from '../platform/telegramAuth';
// Хранилище профиля пользователя и нормализация данных
// Единый canonical-формат профиля между фронтендом и бэкендом.
    // Все чтения/записи профиля должны использовать только эти ключи.
    const CANONICAL_PROFILE_KEYS = [
        'sex',
        'birth_date',
        'age',
        'height_cm',
        'weight_kg',
        'target_weight_kg',
        'goal',
        'activity_factor',
        'goal_deadline',
        'food_diary',
        'bmr',
        'tdee_calories',
        'calories_target',
        'calorie_delta',
        'required_rate_kg_per_week',
        'required_calorie_delta',
        'required_calories_target',
        'safe_weeks_estimate',
        'macros',
        'weight_rate_kg_per_week',
        'predicted_goal_date',
        'weekly_stats',
        'weekly_adjustments',
        'weekly_review',
        'deviation_risk',
        'deviation_comment',
        'subscription',
        'subscription_until',
        'subscription_status',
        'subscription_started_at',
        'subscription_auto_renew',
        'subscription_cancelled_at',
        'terms_offer_accepted_version',
        'terms_offer_accepted_at',
        'trial_started_at',
        'trial_welcome_seen',
        'preferences_onboarding_completed',
        'favorite_product_ids',
        'excluded_product_ids',
        'is_completed',
        'last_updated'
    ];
    const CANONICAL_PROFILE_KEY_SET = new Set(CANONICAL_PROFILE_KEYS);

    const normalizeTelegramInitData = (value) => {
        if (typeof value !== 'string') {
            return '';
        }
        const trimmed = value.trim();
        if (!trimmed) {
            return '';
        }
        const lowered = trimmed.toLowerCase();
        if (lowered === 'null' || lowered === 'undefined') {
            return '';
        }
        return trimmed;
    };

    window.telegramInitData = normalizeTelegramInitData(window.Telegram?.WebApp?.initData);
    const runtimeCache = (window.__SPA_STORAGE_CACHE__ && typeof window.__SPA_STORAGE_CACHE__ === 'object')
        ? window.__SPA_STORAGE_CACHE__
        : {
            memoryStore: new Map(),
            migrationFlags: new Set(),
            cachedProfile: null,
            cachedDiaryEntries: null,
            cachedHabitEntries: null,
            lastProfilePatchPromise: null,
            latestProfileWriteVersion: 0
        };
    window.__SPA_STORAGE_CACHE__ = runtimeCache;

    const memoryStore = runtimeCache.memoryStore;
    const migrationFlags = runtimeCache.migrationFlags;
    const STORAGE_KEY = 'user_profile';
    const HABITS_STORAGE_KEY = 'bree_habits';
    const PROFILE_MIGRATION_KEY = 'bree_profile_migrated_v1';
    const HABITS_MIGRATION_KEY = 'bree_habits_migrated_v1';
    const WATER_MIGRATION_KEY = 'bree_water_migrated_v1';
    const SLEEP_MIGRATION_KEY = 'bree_sleep_migrated_v1';
    const ALLOWED_SEX = new Set(['male', 'female']);
    const ALLOWED_GOALS = new Set(['lose', 'maintain', 'gain']);
    const ALLOWED_RISKS = new Set(['low', 'medium', 'high']);
    let cachedProfile = runtimeCache.cachedProfile;
    let cachedDiaryEntries = runtimeCache.cachedDiaryEntries;
    let cachedHabitEntries = runtimeCache.cachedHabitEntries;
    let lastProfilePatchPromise = runtimeCache.lastProfilePatchPromise;
    let latestProfileWriteVersion = Number.isFinite(Number(runtimeCache.latestProfileWriteVersion))
        ? Number(runtimeCache.latestProfileWriteVersion)
        : 0;

    function setCachedProfile(value) {
        cachedProfile = value;
        runtimeCache.cachedProfile = value;
    }

    function setCachedDiaryEntries(value) {
        cachedDiaryEntries = value;
        runtimeCache.cachedDiaryEntries = value;
    }

    function setCachedHabitEntries(value) {
        cachedHabitEntries = value;
        runtimeCache.cachedHabitEntries = value;
    }

    function setLastProfilePatchPromise(value) {
        lastProfilePatchPromise = value;
        runtimeCache.lastProfilePatchPromise = value;
    }

    function enqueueProfileWrite(task) {
        const previousPromise = lastProfilePatchPromise && typeof lastProfilePatchPromise.then === 'function'
            ? lastProfilePatchPromise.catch(() => null)
            : Promise.resolve(null);
        const queuedPromise = previousPromise.then(() => task());
        setLastProfilePatchPromise(queuedPromise);
        return queuedPromise;
    }

    function nextProfileWriteVersion() {
        latestProfileWriteVersion += 1;
        runtimeCache.latestProfileWriteVersion = latestProfileWriteVersion;
        return latestProfileWriteVersion;
    }

    function isLatestProfileWriteVersion(version) {
        if (!Number.isFinite(Number(version))) {
            return true;
        }
        return Number(version) === latestProfileWriteVersion;
    }

    function getProfileStorageKey() {
        const userId = window.serverUser?.telegram_user_id;
        if (userId === null || userId === undefined || userId === '') {
            return STORAGE_KEY;
        }
        return `${STORAGE_KEY}:${userId}`;
    }

    function createProfileTraceId() {
        const randomPart = Math.random().toString(36).slice(2, 8);
        return `trace-${Date.now()}-${randomPart}`;
    }

    function beginProfileTrace(source = 'unknown') {
        const trace = {
            id: createProfileTraceId(),
            source,
            started_at: new Date().toISOString()
        };
        window.__profileTrace = trace;
        return trace.id;
    }

    function getProfileTraceId() {
        if (window.__profileTrace?.id) {
            return window.__profileTrace.id;
        }
        return beginProfileTrace('getUserProfile');
    }

    function resolveTelegramInitDataForRequest() {
        const fromWindow = normalizeTelegramInitData(window.telegramInitData);
        if (fromWindow) {
            return {
                value: fromWindow,
                source: 'window.telegramInitData'
            };
        }
        const fromTelegramWebApp = normalizeTelegramInitData(window.Telegram?.WebApp?.initData);
        if (fromTelegramWebApp) {
            window.telegramInitData = fromTelegramWebApp;
            return {
                value: fromTelegramWebApp,
                source: 'Telegram.WebApp.initData'
            };
        }
        return {
            value: '',
            source: 'unavailable'
        };
    }
    async function apiFetch(url, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        };
        // Telegram initData is read from window.telegramInitData (normalized Telegram.WebApp.initData).
        // If initData is unavailable during SPA init, requests go out without X-Telegram-Init-Data.
        // No guard/fallback is used to keep legacy request semantics intact.
        // Telegram initData берём из window.telegramInitData.
        // Его источник: Telegram.WebApp.initData на старте + обновления из ui.js (initTelegramAuth).
        // Если initData недоступен (ранний SPA-init/не Telegram), запросы уходят без X-Telegram-Init-Data.
        // Guard/fallback отсутствует, чтобы не менять семантику запросов (как в legacy storage.js).
        // Telegram initData source:
        // 1) window.telegramInitData cache;
        // 2) direct Telegram.WebApp.initData read if cache is empty.
        // If still missing (early SPA init / non-Telegram), no wait/guard is applied and
        // request goes without X-Telegram-Init-Data to keep legacy semantics.
        const initDataState = resolveTelegramInitDataForRequest();
        if (initDataState.value) {
            headers['X-Telegram-Init-Data'] = initDataState.value;
        }
        const requestOptions = {
            ...options,
            headers
        };
        let response = await fetch(url, requestOptions);
        if (response.status === 401) {
            const reAuthorized = await ensureTelegramAuthSession({ reason: 'storage-api-401', force: true });
            if (reAuthorized) {
                const retryHeaders = {
                    'Content-Type': 'application/json',
                    ...(options.headers || {})
                };
                const retryInitDataState = resolveTelegramInitDataForRequest();
                if (retryInitDataState.value) {
                    retryHeaders['X-Telegram-Init-Data'] = retryInitDataState.value;
                }
                response = await fetch(url, {
                    ...options,
                    headers: retryHeaders
                });
            }
        }
        return response;
    }
    function logStorageDebug(stage, payload) {
        if (window.appDebug === true) {
            console.log(`[PROFILE_DEBUG][storage] ${stage}`, payload);
        }
    }

    function memoryGet(key) {
        if (memoryStore.has(key)) {
            return memoryStore.get(key);
        }
        try {
            if (typeof localStorage !== 'undefined') {
                const value = localStorage.getItem(key);
                if (value !== null) {
                    memoryStore.set(key, value);
                }
                return value;
            }
        } catch (error) {
            // Если localStorage недоступен (например, режим приватности), используем только память.
        }
        return null;
    }

    function memorySet(key, value) {
        memoryStore.set(key, value);
        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem(key, value);
            }
        } catch (error) {
            // Если localStorage недоступен, сохраняем хотя бы в памяти текущей вкладки.
        }
    }

    function memoryRemove(key) {
        memoryStore.delete(key);
        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.removeItem(key);
            }
        } catch (error) {
            // Ошибку удаления localStorage игнорируем, чтобы не ломать поток пользователя.
        }
    }

    function getDefaultUserProfile() {
        return {
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
            calories_target: null,
            calorie_delta: null,
            required_rate_kg_per_week: null,
            required_calorie_delta: null,
            required_calories_target: null,
            safe_weeks_estimate: null,
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
            subscription: null,
            subscription_until: null,
            subscription_status: null,
            subscription_started_at: null,
            trial_started_at: null,
            trial_welcome_seen: null,
            preferences_onboarding_completed: null,
            favorite_product_ids: [],
            excluded_product_ids: [],
            is_completed: false,
            last_updated: null
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
        if (typeof value === 'string') {
            const normalized = value.trim().toLowerCase();
            const sexMap = {
                male: 'male',
                man: 'male',
                'мужской': 'male',
                'муж': 'male',
                'Рј': 'male',
                female: 'female',
                woman: 'female',
                'женский': 'female',
                'жен': 'female',
                'Р¶': 'female'
            };
            const mapped = sexMap[normalized] || null;
            if (mapped && ALLOWED_SEX.has(mapped)) {
                return mapped;
            }
        }
        if (ALLOWED_SEX.has(value)) {
            return value;
        }
        return null;
    }

    function normalizeGoal(value) {
        if (value === 'muscle') {
            return 'gain';
        }
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

    function validateGoalWeightConsistency(goal, currentWeight, targetWeight) {
        const current = parseNumber(currentWeight);
        const target = parseNumber(targetWeight);
        if (!goal || current === null || target === null) {
            return {
                valid: true,
                blocking: false,
                warning: false,
                code: null,
                message: null
            };
        }

        if (goal === 'gain' && target <= current) {
            return {
                valid: false,
                blocking: true,
                warning: false,
                code: 'GAIN_TARGET_NOT_ABOVE_CURRENT',
                message: 'Цель набора массы противоречит выбранному желаемому весу'
            };
        }

        if (goal === 'lose' && target >= current) {
            return {
                valid: false,
                blocking: true,
                warning: false,
                code: 'LOSE_TARGET_NOT_BELOW_CURRENT',
                message: 'Цель снижения веса противоречит выбранному желаемому весу'
            };
        }

        return {
            valid: true,
            blocking: false,
            warning: false,
            code: null,
            message: null
        };
    }

    function normalizeIdList(value) {
        if (!Array.isArray(value)) {
            return [];
        }
        const normalized = value
            .map((item) => parseNumber(item))
            .filter((item) => Number.isFinite(item));
        return Array.from(new Set(normalized));
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
        const sourceProfile = profile && typeof profile === 'object' ? profile : {};
        const merged = { ...base };
        CANONICAL_PROFILE_KEYS.forEach((key) => {
            if (Object.prototype.hasOwnProperty.call(sourceProfile, key)) {
                merged[key] = sourceProfile[key];
            }
        });

        logStorageDebug('normalizeUserProfile:input', {
            profile
        });

        merged.sex = normalizeSex(merged.sex);
        const rawBirthDate = merged.birth_date;
        if (rawBirthDate === null || rawBirthDate === undefined || rawBirthDate === '') {
            merged.birth_date = null;
        } else if (typeof window.normalizeLocalDate === 'function') {
            const normalizedBirthDate = window.normalizeLocalDate(rawBirthDate);
            merged.birth_date = typeof normalizedBirthDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(normalizedBirthDate)
                ? normalizedBirthDate
                : null;
        } else {
            merged.birth_date = typeof rawBirthDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawBirthDate)
                ? rawBirthDate
                : null;
        }
        merged.age = parseNumber(merged.age);
        if (merged.age === null) {
            merged.age = getAgeFromBirthDate(merged.birth_date);
        }
        merged.height_cm = parseNumber(merged.height_cm);
        merged.weight_kg = parseNumber(merged.weight_kg);
        merged.target_weight_kg = parseNumber(merged.target_weight_kg);
        merged.goal = normalizeGoal(merged.goal);
        if (merged.goal === 'maintain') {
            // Для поддержания веса целевой вес и дедлайн не используются.
            merged.target_weight_kg = null;
            merged.goal_deadline = null;
        }
        merged.activity_factor = parseNumber(merged.activity_factor);
        merged.goal_deadline = merged.goal_deadline || null;
        merged.food_diary = parseBoolean(merged.food_diary);
        merged.bmr = parseNumber(merged.bmr);
        merged.tdee_calories = parseNumber(merged.tdee_calories);
        merged.calories_target = parseNumber(merged.calories_target);
        merged.calorie_delta = parseNumber(merged.calorie_delta);
        merged.required_rate_kg_per_week = parseNumber(merged.required_rate_kg_per_week);
        merged.required_calorie_delta = parseNumber(merged.required_calorie_delta);
        merged.required_calories_target = parseNumber(merged.required_calories_target);
        merged.safe_weeks_estimate = parseNumber(merged.safe_weeks_estimate);
        merged.macros = normalizeMacros(merged.macros);
        merged.weight_rate_kg_per_week = parseNumber(merged.weight_rate_kg_per_week);
        merged.predicted_goal_date = merged.predicted_goal_date || null;
        merged.weekly_stats = normalizeWeeklyStats(merged.weekly_stats);
        merged.weekly_adjustments = merged.weekly_adjustments || null;
        merged.weekly_review = normalizeWeeklyReview(merged.weekly_review);
        merged.deviation_risk = normalizeRisk(merged.deviation_risk);
        merged.deviation_comment = merged.deviation_comment || null;
        merged.subscription = merged.subscription && typeof merged.subscription === 'object'
            ? merged.subscription
            : null;
        merged.subscription_until = merged.subscription_until || null;
        merged.subscription_status = merged.subscription_status || null;
        merged.subscription_started_at = merged.subscription_started_at || null;
        merged.subscription_auto_renew = parseBoolean(merged.subscription_auto_renew);
        merged.subscription_cancelled_at = typeof merged.subscription_cancelled_at === 'string' && merged.subscription_cancelled_at.trim()
            ? merged.subscription_cancelled_at
            : null;
        merged.terms_offer_accepted_version = typeof merged.terms_offer_accepted_version === 'number' && Number.isFinite(merged.terms_offer_accepted_version)
            ? Math.trunc(merged.terms_offer_accepted_version)
            : null;
        merged.terms_offer_accepted_at = typeof merged.terms_offer_accepted_at === 'string' && merged.terms_offer_accepted_at.trim()
            ? merged.terms_offer_accepted_at
            : null;
        merged.trial_started_at = merged.trial_started_at || null;
        merged.trial_welcome_seen = parseBoolean(merged.trial_welcome_seen);
        merged.preferences_onboarding_completed = parseBoolean(merged.preferences_onboarding_completed);
        merged.is_completed = parseBoolean(merged.is_completed);
        merged.favorite_product_ids = normalizeIdList(merged.favorite_product_ids);
        merged.excluded_product_ids = normalizeIdList(merged.excluded_product_ids);
        merged.last_updated = typeof merged.last_updated === 'string' && merged.last_updated.trim()
            ? merged.last_updated
            : null;

        const requiredFields = [
            merged.sex,
            merged.birth_date,
            merged.height_cm,
            merged.weight_kg,
            merged.goal,
            merged.activity_factor
        ];
        if (merged.goal !== 'maintain') {
            requiredFields.push(merged.target_weight_kg);
        }
        const calculatedCompleted = requiredFields.every((value) => value !== null && value !== undefined && value !== '');

        if (merged.is_completed === null) {
            merged.is_completed = calculatedCompleted;
        }

        logStorageDebug('normalizeUserProfile:output', {
            merged,
            required_inputs: {
                sex: merged.sex,
                birth_date: merged.birth_date,
                height_cm: merged.height_cm,
                weight_kg: merged.weight_kg,
                goal: merged.goal,
                activity_factor: merged.activity_factor,
                target_weight_kg: merged.target_weight_kg
            },
            completion_flags: {
                is_completed: merged.is_completed
            }
        });

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
            trial_started_at: null,
            is_completed: false
        };
        return profile;
    }

    function normalizeLocalDate(input) {
        if (!input) {
            return null;
        }
        if (input instanceof Date) {
            if (Number.isNaN(input.getTime())) {
                return null;
            }
            const year = input.getFullYear();
            const month = String(input.getMonth() + 1).padStart(2, '0');
            const day = String(input.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
        if (typeof input === 'string') {
            const trimmed = input.trim();
            if (!trimmed) {
                return null;
            }
            const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (isoMatch) {
                return trimmed;
            }
            const dotMatch = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
            if (dotMatch) {
                const [, day, month, year] = dotMatch;
                return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            }
            const parsed = new Date(`${trimmed}T00:00:00`);
            if (!Number.isNaN(parsed.getTime())) {
                return normalizeLocalDate(parsed);
            }
            const fallback = new Date(trimmed);
            if (!Number.isNaN(fallback.getTime())) {
                return normalizeLocalDate(fallback);
            }
        }
        return null;
    }

    function calculateDiaryTotals(items) {
        return items.reduce(
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
                acc.carbs_simple_g += resolved.simple;
                acc.carbs_complex_g += resolved.complex;
                acc.fiber_g += Number(item?.fiber) || Number(item?.fiber_g) || 0;
                return acc;
            },
            { calories: 0, protein_g: 0, fat_g: 0, carbs_g: 0, carbs_simple_g: 0, carbs_complex_g: 0, fiber_g: 0 }
        );
    }

    function resolveCarbTotals(totalValue, simpleValue, complexValue) {
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
    }

    function normalizeDiaryEntry(entry) {
        if (!entry) {
            return null;
        }
        const dateKey = normalizeLocalDate(entry.date);
        if (!dateKey) {
            return null;
        }
        const isProducts = entry.mode === 'products' || Array.isArray(entry.items);
        const items = Array.isArray(entry.items) ? entry.items : [];
        const totals = isProducts
            ? (entry.totals
                ? (() => {
                    const resolved = resolveCarbTotals(
                        entry.totals.carbs_g,
                        entry.totals.carbs_simple_g,
                        entry.totals.carbs_complex_g
                    );
                    return {
                        calories: Number(entry.totals.calories) || 0,
                        protein_g: Number(entry.totals.protein_g) || 0,
                        fat_g: Number(entry.totals.fat_g) || 0,
                        carbs_g: resolved.total,
                        carbs_simple_g: resolved.simple,
                        carbs_complex_g: resolved.complex,
                        fiber_g: Number(entry.totals.fiber_g) || 0
                    };
                })()
                : calculateDiaryTotals(items))
            : (() => {
                const resolved = resolveCarbTotals(
                    entry.carbs_g ?? entry.carbs ?? 0,
                    entry.carbs_simple_g ?? entry.carbs_simple ?? 0,
                    entry.carbs_complex_g ?? entry.carbs_complex ?? 0
                );
                return {
                    calories: Number(entry.calories ?? 0) || 0,
                    protein_g: Number(entry.protein_g ?? entry.protein ?? 0) || 0,
                    fat_g: Number(entry.fat_g ?? entry.fat ?? 0) || 0,
                    carbs_g: resolved.total,
                    carbs_simple_g: resolved.simple,
                    carbs_complex_g: resolved.complex,
                    fiber_g: Number(entry.fiber_g ?? entry.fiber ?? 0) || 0,
                    water_l: Number(entry.water_l ?? entry.water ?? 0) || 0
                };
            })();
        if (isProducts) {
            return {
                date: dateKey,
                mode: 'products',
                meal: entry.meal || null,
                items,
                totals,
                water_l: Number(entry.water_l ?? entry.water ?? 0) || 0,
                sleep_time: entry.sleep_time || null
            };
        }
        return {
            date: dateKey,
            mode: 'summary',
            calories: totals.calories,
            protein_g: totals.protein_g,
            fat_g: totals.fat_g,
            carbs_g: totals.carbs_g,
            carbs_simple_g: totals.carbs_simple_g,
            carbs_complex_g: totals.carbs_complex_g,
            fiber_g: totals.fiber_g,
            water_l: totals.water_l,
            sleep_time: entry.sleep_time || null
        };
    }

    function readLegacyUserData() {
        const raw = memoryGet('health_bloom_user_data');
        if (!raw) {
            return null;
        }
        try {
            return JSON.parse(raw);
        } catch (error) {
            return null;
        }
    }

    function clearProfileLocalCache() {
        const emptyProfile = normalizeUserProfile(getDefaultUserProfile());
        setCachedProfile(emptyProfile);
        memoryRemove(getProfileStorageKey());
        memoryRemove(STORAGE_KEY);
        memoryRemove('health_bloom_user_data');
        return emptyProfile;
    }

    function getUserProfile() {
        const traceId = getProfileTraceId();
        if (cachedProfile) {
            logStorageDebug('getUserProfile:from_cache', {
                traceId,
                cachedProfile
            });
            return cachedProfile;
        }
        let storedProfile = null;
        try {
            const raw = memoryGet(getProfileStorageKey());
            logStorageDebug('getUserProfile:raw_storage_value', {
                traceId,
                raw
            });
            storedProfile = raw ? JSON.parse(raw) : null;
        } catch (error) {
            storedProfile = null;
        }

        const normalized = normalizeUserProfile(
            storedProfile && typeof storedProfile === 'object'
                ? storedProfile
                : getDefaultUserProfile()
        );
        setCachedProfile(normalized);
        logStorageDebug('getUserProfile:normalized_result', {
            traceId,
            storedProfile,
            normalized
        });
        return normalized;
    }
    function validateCanonicalProfilePayload(payload) {
        if (!payload || typeof payload !== 'object') {
            return {
                isCanonical: false,
                reason: 'PAYLOAD_NOT_OBJECT',
                conflictingKeys: []
            };
        }
        const keys = Object.keys(payload);
        const conflictingKeys = keys.filter((key) => !CANONICAL_PROFILE_KEY_SET.has(key));
        if (conflictingKeys.length > 0) {
            return {
                isCanonical: false,
                reason: 'UNSUPPORTED_KEYS',
                conflictingKeys
            };
        }
        if (!Object.prototype.hasOwnProperty.call(payload, 'is_completed')) {
            return {
                isCanonical: false,
                reason: 'MISSING_REQUIRED_IS_COMPLETED',
                conflictingKeys: ['is_completed']
            };
        }
        return {
            isCanonical: true,
            reason: null,
            conflictingKeys: []
        };
    }

    function addTrialDays(startedAtIso, days) {
        const date = new Date(startedAtIso);
        if (Number.isNaN(date.getTime())) {
            return null;
        }
        date.setDate(date.getDate() + days);
        return date.toISOString();
    }

    function parseSleepMinutes(value) {
        if (!value || typeof value !== 'string') {
            return null;
        }
        const [hours, minutes] = value.split(':').map((part) => Number(part));
        if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
            return null;
        }
        if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
            return null;
        }
        return hours * 60 + minutes;
    }

    function applyTrialStartIfNeeded(current, merged) {
        const isAuthorized = window.serverUser?.authorized === true;
        const hasSubscriptionStatus = merged.subscription_status !== null && merged.subscription_status !== undefined;
        const hasSubscriptionUntil = merged.subscription_until !== null && merged.subscription_until !== undefined;
        const hasSubscriptionStartedAt = merged.subscription_started_at !== null && merged.subscription_started_at !== undefined;
        const hasTrialStartedAt = merged.trial_started_at !== null && merged.trial_started_at !== undefined;

        if (
            !isAuthorized ||
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

    async function notifyTrialStart(startedAt) {
        try {
            const response = await apiFetch('/api/subscription/start_trial', {
                method: 'POST',
                body: JSON.stringify({
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

    function enforceGoalWeightConsistencyInMerge(candidate, fallbackProfile) {
        const mergedCandidate = { ...(candidate || {}) };
        const normalizedGoal = normalizeGoal(mergedCandidate.goal);
        if (normalizedGoal === 'maintain') {
            mergedCandidate.target_weight_kg = null;
            mergedCandidate.goal_deadline = null;
            return mergedCandidate;
        }

        const consistency = validateGoalWeightConsistency(
            normalizedGoal,
            mergedCandidate.weight_kg,
            mergedCandidate.target_weight_kg
        );
        if (consistency.blocking) {
            // При конфликте цели и веса не теряем остальные обновления профиля:
            // откатываем только конфликтующие поля до последнего валидного состояния.
            const fallback = { ...(fallbackProfile || {}) };
            return {
                ...mergedCandidate,
                goal: fallback.goal ?? null,
                target_weight_kg: fallback.target_weight_kg ?? null,
                goal_deadline: fallback.goal_deadline ?? null
            };
        }

        return mergedCandidate;
    }

    function applyProfileCache(profile) {
        setCachedProfile(profile);
        try {
            memorySet(getProfileStorageKey(), JSON.stringify(profile));
        } catch (error) {
            // Игнорируем ошибку сохранения, данные остаются в памяти.
        }
    }

    function pickCanonicalPatch(partial) {
        const source = partial && typeof partial === 'object' ? partial : {};
        const patch = {};
        CANONICAL_PROFILE_KEYS.forEach((key) => {
            if (Object.prototype.hasOwnProperty.call(source, key)) {
                patch[key] = source[key];
            }
        });
        return patch;
    }

    function setUserProfile(profile) {
        const current = getUserProfile();
        const merged = { ...current, ...(profile || {}) };
        const consistentMerged = enforceGoalWeightConsistencyInMerge(merged, current);
        const trialResult = applyTrialStartIfNeeded(current, consistentMerged);
        const normalized = normalizeUserProfile(trialResult.merged);
        const writeVersion = nextProfileWriteVersion();
        applyProfileCache(normalized);
        if (trialResult.shouldNotifyBackend) {
            void notifyTrialStart(normalized.subscription_started_at);
        }
        void enqueueProfileWrite(() => saveProfileToBackend(
            normalized,
            { skipRequiredValidation: false, mode: 'full', writeVersion }
        ).then((savedProfile) => savedProfile || normalized));
        return normalized;
    }

    function patchUserProfile(partial) {
        const current = getUserProfile();
        const patch = pickCanonicalPatch(partial);
        const merged = { ...current, ...patch };
        if (partial && Object.prototype.hasOwnProperty.call(partial, 'macros')) {
            merged.macros = partial.macros;
        }
        const consistentMerged = enforceGoalWeightConsistencyInMerge(merged, current);
        const trialResult = applyTrialStartIfNeeded(current, consistentMerged);
        const normalized = normalizeUserProfile(trialResult.merged);
        const writeVersion = nextProfileWriteVersion();
        applyProfileCache(normalized);
        if (trialResult.shouldNotifyBackend) {
            void notifyTrialStart(normalized.subscription_started_at);
        }
        const patchPayload = pickCanonicalPatch({ ...patch, ...(trialResult.shouldNotifyBackend ? { subscription_started_at: normalized.subscription_started_at } : {}) });
        void enqueueProfileWrite(() => saveProfileToBackend(patchPayload, { skipRequiredValidation: true, mode: 'patch', writeVersion })
            .then((savedProfile) => savedProfile || normalized)
            .catch(() => normalized));
        return normalized;
    }

    function patchUserProfileWithBackend(partial) {
        const normalized = patchUserProfile(partial);
        if (lastProfilePatchPromise && typeof lastProfilePatchPromise.then === 'function') {
            return lastProfilePatchPromise.then((savedProfile) => savedProfile || normalized);
        }
        return Promise.resolve(normalized);
    }

    function getPendingProfilePatchPromise() {
        return lastProfilePatchPromise;
    }

    async function awaitPendingProfilePatch() {
        if (lastProfilePatchPromise && typeof lastProfilePatchPromise.then === 'function') {
            try {
                await lastProfilePatchPromise;
            } catch {
                // Ошибки patch не блокируют дальнейшие запросы, как и в legacy.
            }
        }
    }

    function getDiaryEntries() {
        return Array.isArray(cachedDiaryEntries) ? cachedDiaryEntries : [];
    }

    function setDiaryEntries(entries, { skipBackend = false } = {}) {
        setCachedDiaryEntries(Array.isArray(entries) ? entries : []);
        if (!skipBackend) {
            void saveDiaryEntriesToBackend(cachedDiaryEntries);
            const waterEntries = buildWaterEntriesFromDiary(cachedDiaryEntries);
            const sleepEntries = buildSleepEntriesFromDiary(cachedDiaryEntries);
            void saveWaterEntriesToBackend(waterEntries);
            void saveSleepEntriesToBackend(sleepEntries);
        }
        return cachedDiaryEntries;
    }

    function getHabitEntries() {
        if (cachedHabitEntries) {
            return cachedHabitEntries;
        }
        const raw = memoryGet(HABITS_STORAGE_KEY);
        if (!raw) {
            setCachedHabitEntries({});
            return cachedHabitEntries;
        }
        try {
            const parsed = JSON.parse(raw);
            setCachedHabitEntries(parsed && typeof parsed === 'object' ? parsed : {});
        } catch (error) {
            setCachedHabitEntries({});
        }
        return cachedHabitEntries;
    }

    function setHabitEntries(entries, { skipBackend = false } = {}) {
        setCachedHabitEntries(entries && typeof entries === 'object' ? entries : {});
        try {
            memorySet(HABITS_STORAGE_KEY, JSON.stringify(cachedHabitEntries));
        } catch (error) {
            // Игнорируем ошибку сохранения, данные остаются в памяти.
        }
        if (!skipBackend) {
            void saveHabitEntriesToBackend(cachedHabitEntries);
        }
        return cachedHabitEntries;
    }

    function isMigrationDone(key) {
        return memoryGet(key) === 'true';
    }

    function markMigrationDone(key) {
        try {
            memorySet(key, 'true');
        } catch (error) {
            // Игнорируем ошибку сохранения, данные остаются в памяти.
        }
    }

    async function saveProfileToBackend(profile, options = {}) {
        const skipRequiredValidation = options?.skipRequiredValidation === true;
        const mode = options?.mode === 'patch' ? 'patch' : 'full';
        const writeVersion = Number(options?.writeVersion);
        const payload = profile && typeof profile === 'object' ? profile : {};

        try {
            if (!skipRequiredValidation) {
                const requiredFields = [
                    payload?.sex,
                    payload?.birth_date,
                    payload?.height_cm,
                    payload?.weight_kg,
                    payload?.goal,
                    payload?.activity_factor
                ];
                if (payload?.goal !== 'maintain') {
                    requiredFields.push(payload?.target_weight_kg);
                }
                const missingFields = requiredFields.filter((value) => value === null || value === undefined || value === '');
                if (window.appDebug) {
                    const fieldNames = ['sex', 'birth_date', 'height_cm', 'weight_kg', 'goal', 'activity_factor'];
                    if (payload?.goal !== 'maintain') {
                        fieldNames.push('target_weight_kg');
                    }
                    const missingFieldNames = fieldNames.filter((name, index) => {
                        const value = requiredFields[index];
                        return value === null || value === undefined || value === '';
                    });
                    console.log('Проверка payload перед /api/profile/save', {
                        mode,
                        payload,
                        missing_required_fields: missingFieldNames
                    });
                }
                if (missingFields.length > 0) {
                    console.error('Профиль не отправлен: отсутствуют обязательные поля', {
                        mode,
                        payload,
                        missingFieldsCount: missingFields.length
                    });
                    return null;
                }
            }

            if (window.appDebug) {
                console.log('Отправка payload в /api/profile/save', {
                    mode,
                    payload_keys: Object.keys(payload)
                });
            }

            const response = await apiFetch('/api/profile/save', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                if (response.status === 401 || response.status === 404) {
                    return clearProfileLocalCache();
                }
                return null;
            }
            const responseData = await response.json();
            try {
                localStorage.removeItem('userData');
            } catch (error) {
                console.warn('Не удалось очистить userData', error);
            }
            const data = responseData && typeof responseData === 'object'
                ? responseData
                : null;
            if (!data || typeof data !== 'object' || Object.keys(data).length === 0 || data?.status === 'not_found') {
                return clearProfileLocalCache();
            }
            const normalized = normalizeUserProfile(data);
            if (Number.isFinite(writeVersion) && writeVersion > 0 && !isLatestProfileWriteVersion(writeVersion)) {
                return getUserProfile();
            }
            applyProfileCache(normalized);
            if (typeof window.resetUserDataDirtyMap === 'function') {
                window.resetUserDataDirtyMap('profile_saved');
            }
            return normalized;
        } catch (error) {
            // Ошибки синхронизации игнорируем, данные остаются локально.
            return null;
        }
    }

    async function syncProfileWithBackend() {
        const traceId = beginProfileTrace('syncProfileWithBackend');
        await awaitPendingProfilePatch();
        if (window.serverUser?.authorized !== true) {
            logStorageDebug('syncProfileWithBackend:skip_unauthorized', {
                traceId,
                serverUser: window.serverUser
            });
            return clearProfileLocalCache();
        }
        try {
            const response = await apiFetch('/api/profile');
            if (!response.ok) {
                logStorageDebug('syncProfileWithBackend:response_not_ok', {
                    traceId,
                    status: response.status
                });
                return clearProfileLocalCache();
            }
            const data = await response.json();
            logStorageDebug('syncProfileWithBackend:raw_backend_payload', {
                traceId,
                data
            });
            if (!data || typeof data !== 'object' || Object.keys(data).length === 0 || data?.status === 'not_found') {
                return clearProfileLocalCache();
            }
            if (data && typeof data === 'object') {
                const validation = validateCanonicalProfilePayload(data);
                if (!validation.isCanonical) {
                    console.warn('[PROFILE_CANONICAL] Получен некорректный формат профиля от сервера', {
                        reason: validation.reason,
                        conflictingKeys: validation.conflictingKeys,
                        payload: data
                    });
                }
                const normalized = normalizeUserProfile(data);
                setCachedProfile(normalized);
                logStorageDebug('syncProfileWithBackend:normalized_backend_payload', {
                    traceId,
                    normalized
                });
                try {
                    memorySet(getProfileStorageKey(), JSON.stringify(normalized));
                } catch (error) {
                    // Игнорируем ошибку сохранения, данные остаются в памяти.
                }
                if (
                    typeof window.mergeUserDataWithoutLosingAnswers === 'function'
                    && typeof window.mapUserProfileToUserData === 'function'
                    && window.userData
                ) {
                    window.mergeUserDataWithoutLosingAnswers(
                        window.userData,
                        window.mapUserProfileToUserData(normalized),
                        { source: 'server' }
                    );
                }
                return normalized;
            }
        } catch (error) {
            return clearProfileLocalCache();
        }
        return clearProfileLocalCache();
    }

    function buildWaterEntriesFromDiary(entries) {
        const totalsByDate = new Map();
        (entries || []).forEach((entry) => {
            if (!entry?.date) {
                return;
            }
            const water = Number(entry.water_l ?? entry.water ?? 0) || 0;
            const current = totalsByDate.get(entry.date) || 0;
            totalsByDate.set(entry.date, Math.max(current, water));
        });
        return Array.from(totalsByDate.entries()).map(([date, water_l]) => ({
            id: `water-${date}`,
            date,
            water_l
        }));
    }

    function buildSleepEntriesFromDiary(entries) {
        const sleepByDate = new Map();
        (entries || []).forEach((entry) => {
            if (!entry?.date || !entry?.sleep_time) {
                return;
            }
            const minutes = parseSleepMinutes(entry.sleep_time);
            if (minutes === null) {
                return;
            }
            const current = sleepByDate.get(entry.date);
            if (current === undefined || minutes < current.minutes) {
                sleepByDate.set(entry.date, { minutes, sleep_time: entry.sleep_time });
            }
        });
        return Array.from(sleepByDate.entries()).map(([date, data]) => ({
            id: `sleep-${date}`,
            date,
            sleep_time: data.sleep_time
        }));
    }

    async function saveDiaryEntriesToBackend(entries) {
        if (window.serverUser?.authorized !== true) {
            return;
        }
        try {
            await apiFetch('/api/diary', {
                method: 'POST',
                body: JSON.stringify({
                    entries: Array.isArray(entries) ? entries : []
                })
            });
        } catch (error) {
            // Ошибки синхронизации игнорируем, данные остаются локально.
        }
    }

    async function fetchDiaryEntriesFromBackend() {
        try {
            const response = await apiFetch('/api/diary');
            if (!response.ok) {
                if (response.status === 401 || response.status === 404) {
                    return clearProfileLocalCache();
                }
                return null;
            }
            const data = await response.json();
            if (data?.status === 'not_found') {
                return [];
            }
            if (data && typeof data === 'object') {
                return Array.isArray(data.entries) ? data.entries : [];
            }
        } catch (error) {
            return null;
        }
        return null;
    }

    async function saveWaterEntriesToBackend(entries) {
        if (window.serverUser?.authorized !== true) {
            return;
        }
        try {
            await apiFetch('/api/water', {
                method: 'POST',
                body: JSON.stringify({
                    entries: Array.isArray(entries) ? entries : []
                })
            });
        } catch (error) {
            // Ошибки синхронизации игнорируем, данные остаются локально.
        }
    }

    async function fetchWaterEntriesFromBackend() {
        try {
            const response = await apiFetch('/api/water');
            if (!response.ok) {
                if (response.status === 401 || response.status === 404) {
                    return clearProfileLocalCache();
                }
                return null;
            }
            const data = await response.json();
            if (data?.status === 'not_found') {
                return [];
            }
            if (data && typeof data === 'object') {
                return Array.isArray(data.entries) ? data.entries : [];
            }
        } catch (error) {
            return null;
        }
        return null;
    }

    async function saveSleepEntriesToBackend(entries) {
        if (window.serverUser?.authorized !== true) {
            return;
        }
        try {
            await apiFetch('/api/sleep', {
                method: 'POST',
                body: JSON.stringify({
                    entries: Array.isArray(entries) ? entries : []
                })
            });
        } catch (error) {
            // Ошибки синхронизации игнорируем, данные остаются локально.
        }
    }

    async function fetchSleepEntriesFromBackend() {
        try {
            const response = await apiFetch('/api/sleep');
            if (!response.ok) {
                if (response.status === 401 || response.status === 404) {
                    return clearProfileLocalCache();
                }
                return null;
            }
            const data = await response.json();
            if (data?.status === 'not_found') {
                return [];
            }
            if (data && typeof data === 'object') {
                return Array.isArray(data.entries) ? data.entries : [];
            }
        } catch (error) {
            return null;
        }
        return null;
    }

    async function syncDiaryEntriesWithBackend() {
        // На iOS Telegram статус авторизации может заполниться позже,
        // поэтому для чтения дневника не блокируемся на window.serverUser.authorized.
        let remoteEntries = await fetchDiaryEntriesFromBackend();

        // Даём один повторный запрос после короткой паузы,
        // чтобы избежать гонки между init auth и первым чтением дневника.
        if (!Array.isArray(remoteEntries) && window.serverUser?.authorized !== true) {
            await new Promise((resolve) => setTimeout(resolve, 250));
            remoteEntries = await fetchDiaryEntriesFromBackend();
        }

        if (Array.isArray(remoteEntries)) {
            return setDiaryEntries(remoteEntries, { skipBackend: true });
        }

        setCachedDiaryEntries([]);
        return [];
    }

    async function syncWaterEntriesWithBackend(entries) {
        if (window.serverUser?.authorized !== true) {
            return [];
        }
        const remoteEntries = await fetchWaterEntriesFromBackend();
        if (Array.isArray(remoteEntries) && remoteEntries.length) {
            return remoteEntries;
        }
        const localEntries = buildWaterEntriesFromDiary(entries);
        if (localEntries.length && !isMigrationDone(WATER_MIGRATION_KEY)) {
            await saveWaterEntriesToBackend(localEntries);
            markMigrationDone(WATER_MIGRATION_KEY);
        }
        return localEntries;
    }

    async function syncSleepEntriesWithBackend(entries) {
        if (window.serverUser?.authorized !== true) {
            return [];
        }
        const remoteEntries = await fetchSleepEntriesFromBackend();
        if (Array.isArray(remoteEntries) && remoteEntries.length) {
            return remoteEntries;
        }
        const localEntries = buildSleepEntriesFromDiary(entries);
        if (localEntries.length && !isMigrationDone(SLEEP_MIGRATION_KEY)) {
            await saveSleepEntriesToBackend(localEntries);
            markMigrationDone(SLEEP_MIGRATION_KEY);
        }
        return localEntries;
    }

    async function saveHabitEntriesToBackend(habits) {
        if (window.serverUser?.authorized !== true) {
            return;
        }
        try {
            await apiFetch('/api/habits', {
                method: 'POST',
                body: JSON.stringify({
                    habits: habits && typeof habits === 'object' ? habits : {}
                })
            });
        } catch (error) {
            // Ошибки синхронизации игнорируем, данные остаются локально.
        }
    }

    async function fetchHabitEntriesFromBackend() {
        try {
            const response = await apiFetch('/api/habits');
            if (!response.ok) {
                if (response.status === 401 || response.status === 404) {
                    return clearProfileLocalCache();
                }
                return null;
            }
            const data = await response.json();
            if (data?.status === 'not_found') {
                return {};
            }
            if (data && typeof data === 'object') {
                return data.habits && typeof data.habits === 'object' ? data.habits : {};
            }
        } catch (error) {
            return null;
        }
        return null;
    }

    async function syncHabitEntriesWithBackend() {
        if (window.serverUser?.authorized !== true) {
            return getHabitEntries();
        }
        const remoteHabits = await fetchHabitEntriesFromBackend();
        if (remoteHabits && Object.keys(remoteHabits).length) {
            return setHabitEntries(remoteHabits, { skipBackend: true });
        }
        const localHabits = getHabitEntries();
        if (Object.keys(localHabits).length && !isMigrationDone(HABITS_MIGRATION_KEY)) {
            await saveHabitEntriesToBackend(localHabits);
            markMigrationDone(HABITS_MIGRATION_KEY);
        }
        return localHabits;
    }

export {
    beginProfileTrace,
    getProfileTraceId,
    getUserProfile,
    setUserProfile,
    patchUserProfile,
    patchUserProfileWithBackend,
    getPendingProfilePatchPromise,
    awaitPendingProfilePatch,
    normalizeLocalDate,
    validateGoalWeightConsistency,
    getDiaryEntries,
    setDiaryEntries,
    getHabitEntries,
    setHabitEntries,
    syncProfileWithBackend,
    syncDiaryEntriesWithBackend,
    syncWaterEntriesWithBackend,
    syncSleepEntriesWithBackend,
    syncHabitEntriesWithBackend,
    clearProfileLocalCache,
    apiFetch
};


