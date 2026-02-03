// Хранилище профиля пользователя и нормализация данных

(function() {
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
    const memoryStore = new Map();
    const migrationFlags = new Set();
    const STORAGE_KEY = 'user_profile';
    const DIARY_STORAGE_KEY = 'bree_diary_entries';
    const LEGACY_DIARY_KEYS = ['health_bloom_food_entries', 'food_diary_entries'];
    const HABITS_STORAGE_KEY = 'bree_habits';
    const PROFILE_MIGRATION_KEY = 'bree_profile_migrated_v1';
    const DIARY_MIGRATION_KEY = 'bree_diary_migrated_v1';
    const HABITS_MIGRATION_KEY = 'bree_habits_migrated_v1';
    const WATER_MIGRATION_KEY = 'bree_water_migrated_v1';
    const SLEEP_MIGRATION_KEY = 'bree_sleep_migrated_v1';
    const ALLOWED_SEX = new Set(['male', 'female']);
    const ALLOWED_GOALS = new Set(['lose', 'maintain', 'gain']);
    const ALLOWED_RISKS = new Set(['low', 'medium', 'high']);
    let cachedProfile = null;
    let cachedDiaryEntries = null;
    let cachedHabitEntries = null;

    function apiFetch(url, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        };
        const initData = normalizeTelegramInitData(window.telegramInitData);
        if (initData) {
            headers['X-Telegram-Init-Data'] = initData;
        }
        return fetch(url, {
            ...options,
            headers
        });
    }

    function memoryGet(key) {
        return memoryStore.has(key) ? memoryStore.get(key) : null;
    }

    function memorySet(key, value) {
        memoryStore.set(key, value);
    }

    function memoryRemove(key) {
        memoryStore.delete(key);
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
            trial_started_at: null,
            completed: false,
            favorite_product_ids: [],
            excluded_product_ids: []
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
        const merged = { ...base, ...(profile || {}) };

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
        merged.completed = parseBoolean(merged.completed);
        merged.favorite_product_ids = normalizeIdList(merged.favorite_product_ids);
        merged.excluded_product_ids = normalizeIdList(merged.excluded_product_ids);

        if (merged.completed === null) {
            const requiredFields = [
                merged.sex,
                merged.birth_date,
                merged.height_cm,
                merged.weight_kg,
                merged.target_weight_kg,
                merged.goal,
                merged.activity_factor
            ];
            merged.completed = requiredFields.every((value) => value !== null && value !== undefined && value !== '');
        }

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
            trial_started_at: null
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

    function readRawDiaryEntries(key) {
        const raw = memoryGet(key);
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

    let diaryMigrationDone = false;

    function migrateDiaryEntries() {
        if (diaryMigrationDone) {
            return readRawDiaryEntries(DIARY_STORAGE_KEY)
                .map(normalizeDiaryEntry)
                .filter(Boolean);
        }
        const unified = [];
        const seen = new Set();

        const collect = (entry) => {
            const normalized = normalizeDiaryEntry(entry);
            if (!normalized) {
                return;
            }
            const totals = normalized.mode === 'products'
                ? normalized.totals
                : {
                    calories: normalized.calories,
                    protein_g: normalized.protein_g,
                    fat_g: normalized.fat_g,
                    carbs_g: normalized.carbs_g,
                    carbs_simple_g: normalized.carbs_simple_g,
                    carbs_complex_g: normalized.carbs_complex_g
                };
            const key = `${normalized.date}-${normalized.mode}-${normalized.meal || ''}-${totals.calories}-${totals.protein_g}-${totals.fat_g}-${totals.carbs_g}-${totals.carbs_simple_g || 0}-${totals.carbs_complex_g || 0}-${normalized.items?.length || 0}`;
            if (seen.has(key)) {
                return;
            }
            seen.add(key);
            unified.push(normalized);
        };

        readRawDiaryEntries(DIARY_STORAGE_KEY).forEach(collect);
        readRawDiaryEntries(LEGACY_DIARY_KEYS[0]).forEach((entry) => {
            collect({
                date: entry.date,
                mode: 'summary',
                calories: entry.calories,
                protein: entry.protein_g,
                fat: entry.fat_g,
                carbs: entry.carbs_g
            });
        });
        readRawDiaryEntries(LEGACY_DIARY_KEYS[1]).forEach((entry) => {
            collect({
                date: entry.date,
                mode: 'products',
                meal: entry.meal,
                items: Array.isArray(entry.items) ? entry.items : []
            });
        });

        memorySet(DIARY_STORAGE_KEY, JSON.stringify(unified));
        diaryMigrationDone = true;
        return unified;
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

    function getUserProfile() {
        if (cachedProfile) {
            return cachedProfile;
        }
        let storedProfile = null;
        try {
            const raw = memoryGet(STORAGE_KEY);
            storedProfile = raw ? JSON.parse(raw) : null;
        } catch (error) {
            storedProfile = null;
        }

        if (!storedProfile) {
            const legacy = readLegacyUserData();
            storedProfile = mapLegacyUserDataToProfile(legacy) || {};
        }

        const normalized = normalizeUserProfile(storedProfile);
        cachedProfile = normalized;
        try {
            memorySet(STORAGE_KEY, JSON.stringify(normalized));
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

    function setUserProfile(profile) {
        const current = getUserProfile();
        const merged = { ...current, ...(profile || {}) };
        const trialResult = applyTrialStartIfNeeded(current, merged);
        const normalized = normalizeUserProfile(trialResult.merged);
        cachedProfile = normalized;
        try {
            memorySet(STORAGE_KEY, JSON.stringify(normalized));
        } catch (error) {
            // Игнорируем ошибку сохранения, данные остаются в памяти.
        }
        if (trialResult.shouldNotifyBackend) {
            void notifyTrialStart(normalized.subscription_started_at);
        }
        void saveProfileToBackend(normalized);
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
        cachedProfile = normalized;
        try {
            memorySet(STORAGE_KEY, JSON.stringify(normalized));
        } catch (error) {
            // Игнорируем ошибку сохранения, данные остаются в памяти.
        }
        if (trialResult.shouldNotifyBackend) {
            void notifyTrialStart(normalized.subscription_started_at);
        }
        void saveProfileToBackend(normalized);
        return normalized;
    }

    function getDiaryEntries() {
        if (cachedDiaryEntries) {
            return cachedDiaryEntries;
        }
        cachedDiaryEntries = migrateDiaryEntries();
        return cachedDiaryEntries;
    }

    function setDiaryEntries(entries, { skipBackend = false } = {}) {
        cachedDiaryEntries = Array.isArray(entries) ? entries : [];
        try {
            memorySet(DIARY_STORAGE_KEY, JSON.stringify(cachedDiaryEntries));
        } catch (error) {
            // Игнорируем ошибку сохранения, данные остаются в памяти.
        }
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
            cachedHabitEntries = {};
            return cachedHabitEntries;
        }
        try {
            const parsed = JSON.parse(raw);
            cachedHabitEntries = parsed && typeof parsed === 'object' ? parsed : {};
        } catch (error) {
            cachedHabitEntries = {};
        }
        return cachedHabitEntries;
    }

    function setHabitEntries(entries, { skipBackend = false } = {}) {
        cachedHabitEntries = entries && typeof entries === 'object' ? entries : {};
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

    async function saveProfileToBackend(profile) {
        try {
            await apiFetch('/api/profile', {
                method: 'POST',
                body: JSON.stringify({
                    user_profile: profile
                })
            });
        } catch (error) {
            // Ошибки синхронизации игнорируем, данные остаются локально.
        }
    }

    async function syncProfileWithBackend() {
        if (window.serverUser?.authorized !== true) {
            return getUserProfile();
        }
        try {
            const response = await apiFetch('/api/profile');
            if (!response.ok) {
                return getUserProfile();
            }
            const data = await response.json();
            if (data?.status === 'not_found') {
                const localProfile = getUserProfile();
                if (localProfile && !isMigrationDone(PROFILE_MIGRATION_KEY)) {
                    await saveProfileToBackend(localProfile);
                    markMigrationDone(PROFILE_MIGRATION_KEY);
                }
                return localProfile;
            }
            if (data && typeof data === 'object') {
                const normalized = normalizeUserProfile(data);
                cachedProfile = normalized;
                try {
                    memorySet(STORAGE_KEY, JSON.stringify(normalized));
                } catch (error) {
                    // Игнорируем ошибку сохранения, данные остаются в памяти.
                }
                return normalized;
            }
        } catch (error) {
            return getUserProfile();
        }
        return getUserProfile();
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
        if (window.serverUser?.authorized !== true) {
            return getDiaryEntries();
        }
        const remoteEntries = await fetchDiaryEntriesFromBackend();
        if (Array.isArray(remoteEntries) && remoteEntries.length) {
            const merged = setDiaryEntries(remoteEntries, { skipBackend: true });
            return merged;
        }
        const localEntries = getDiaryEntries();
        if (localEntries.length && !isMigrationDone(DIARY_MIGRATION_KEY)) {
            await saveDiaryEntriesToBackend(localEntries);
            markMigrationDone(DIARY_MIGRATION_KEY);
        }
        return localEntries;
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

    window.getUserProfile = getUserProfile;
    window.setUserProfile = setUserProfile;
    window.patchUserProfile = patchUserProfile;
    window.normalizeLocalDate = normalizeLocalDate;
    window.getDiaryEntries = getDiaryEntries;
    window.setDiaryEntries = setDiaryEntries;
    window.getHabitEntries = getHabitEntries;
    window.setHabitEntries = setHabitEntries;
    window.syncProfileWithBackend = syncProfileWithBackend;
    window.syncDiaryEntriesWithBackend = syncDiaryEntriesWithBackend;
    window.syncWaterEntriesWithBackend = syncWaterEntriesWithBackend;
    window.syncSleepEntriesWithBackend = syncSleepEntriesWithBackend;
    window.syncHabitEntriesWithBackend = syncHabitEntriesWithBackend;
    window.DIARY_STORAGE_KEY = DIARY_STORAGE_KEY;
    window.apiFetch = apiFetch;

})();
