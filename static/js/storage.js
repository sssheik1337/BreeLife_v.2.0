// Хранилище профиля пользователя и нормализация данных

(function() {
    const STORAGE_KEY = 'user_profile';
    const ALLOWED_SEX = new Set(['male', 'female']);
    const ALLOWED_GOALS = new Set(['lose', 'maintain', 'gain', 'muscle']);

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
            subscription_until: null,
            subscription_status: null
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
        merged.subscription_until = merged.subscription_until || null;
        merged.subscription_status = merged.subscription_status || null;

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
            subscription_until: null,
            subscription_status: null
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
            console.warn('Не удалось разобрать сохранённые данные пользователя:', error);
            return null;
        }
    }

    function getUserProfile() {
        let storedProfile = null;
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            storedProfile = raw ? JSON.parse(raw) : null;
        } catch (error) {
            console.warn('Не удалось прочитать профиль пользователя:', error);
        }

        if (!storedProfile) {
            const legacy = readLegacyUserData();
            storedProfile = mapLegacyUserDataToProfile(legacy) || {};
        }

        const normalized = normalizeUserProfile(storedProfile);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
        } catch (error) {
            console.warn('Не удалось сохранить профиль пользователя:', error);
        }
        return normalized;
    }

    function setUserProfile(profile) {
        const normalized = normalizeUserProfile(profile);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
        } catch (error) {
            console.warn('Не удалось сохранить профиль пользователя:', error);
        }
        return normalized;
    }

    function patchUserProfile(partial) {
        const current = getUserProfile();
        const merged = { ...current, ...(partial || {}) };
        if (partial && Object.prototype.hasOwnProperty.call(partial, 'macros')) {
            merged.macros = partial.macros;
        }
        const normalized = normalizeUserProfile(merged);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
        } catch (error) {
            console.warn('Не удалось сохранить профиль пользователя:', error);
        }
        return normalized;
    }

    window.getUserProfile = getUserProfile;
    window.setUserProfile = setUserProfile;
    window.patchUserProfile = patchUserProfile;
})();
