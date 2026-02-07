// UI Utilities and Shared Functions for Health Bloom App

// State management for questionnaire
const userData = {
    gender: null,
    birthDate: null,
    height: null,
    currentWeight: null,
    targetWeight: null,
    activityLevel: null,
    goalType: null,
    deadline: null,
    foodDiary: null,
    registrationDate: null
};

window.userData = userData;

// Преобразование user_profile в данные анкеты
function mapUserProfileToUserData(profile) {
    if (!profile) {
        return {};
    }
    return {
        gender: profile.sex ?? null,
        birthDate: profile.birth_date ?? null,
        height: profile.height_cm ?? null,
        currentWeight: profile.weight_kg ?? null,
        targetWeight: profile.target_weight_kg ?? null,
        activityLevel: profile.activity_factor ?? null,
        goalType: profile.goal ?? null,
        deadline: profile.goal_deadline ?? null,
        foodDiary: profile.food_diary ?? null
    };
}

// Преобразование данных анкеты в user_profile
function mapUserDataToUserProfile(data) {
    if (!data) {
        return {};
    }
    const parseNumber = (value) => {
        if (value === null || value === undefined || value === '') {
            return null;
        }
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    };
    const normalizeSex = (value) => {
        if (!value) {
            return null;
        }
        const normalized = String(value).trim().toLowerCase();
        const map = {
            male: 'male',
            man: 'male',
            мужской: 'male',
            муж: 'male',
            female: 'female',
            woman: 'female',
            женский: 'female',
            жен: 'female'
        };
        return map[normalized] || null;
    };
    const normalizeActivity = (value) => {
        const numeric = parseNumber(value);
        if (numeric !== null) {
            return numeric;
        }
        if (!value) {
            return null;
        }
        const normalized = String(value).trim().toLowerCase();
        const directMap = {
            low: 1.2,
            minimal: 1.2,
            sedentary: 1.2,
            medium: 1.55,
            moderate: 1.55,
            high: 1.725,
            very_high: 1.9
        };
        if (directMap[normalized]) {
            return directMap[normalized];
        }
        if (normalized.includes('1.2')) {
            return 1.2;
        }
        if (normalized.includes('1.375')) {
            return 1.375;
        }
        if (normalized.includes('1.55')) {
            return 1.55;
        }
        if (normalized.includes('1.725')) {
            return 1.725;
        }
        if (normalized.includes('1.9')) {
            return 1.9;
        }
        if (normalized.includes('миним') || normalized.includes('низк') || normalized.includes('сидяч') || normalized.includes('мало')) {
            return 1.2;
        }
        if (normalized.includes('прогул') || normalized.includes('1-3') || normalized.includes('1–3')) {
            return 1.375;
        }
        if (normalized.includes('регуляр') || normalized.includes('умерен') || normalized.includes('3-5') || normalized.includes('3–5')) {
            return 1.55;
        }
        if (normalized.includes('высок') || normalized.includes('каждый день')) {
            return 1.725;
        }
        if (normalized.includes('очень') || normalized.includes('интенсив')) {
            return 1.9;
        }
        return null;
    };
    const normalizeGoal = (value) => {
        if (!value) {
            return null;
        }
        const normalized = String(value).trim().toLowerCase();
        if (['lose', 'loss', 'weight_loss', 'slim'].includes(normalized) || normalized.includes('сниж') || normalized.includes('похуд')) {
            return 'lose';
        }
        if (['maintain', 'keep', 'maintenance', 'balance'].includes(normalized) || normalized.includes('поддерж')) {
            return 'maintain';
        }
        if (['gain', 'bulk', 'mass', 'muscle', 'build'].includes(normalized) || normalized.includes('набор') || normalized.includes('масса') || normalized.includes('мышц')) {
            return 'gain';
        }
        return null;
    };
    const rawGender = data.gender ?? data.sex ?? null;
    const birthDate = data.birthDate ?? data.birth_date ?? null;
    const heightValue = data.height ?? data.height_cm ?? null;
    const weightValue = data.currentWeight ?? data.weight_kg ?? null;
    const targetWeightValue = data.targetWeight ?? data.target_weight_kg ?? null;
    const activityValue = data.activityLevel ?? data.activity_factor ?? null;
    const goalValue = data.goalType ?? data.goal ?? null;
    const deadlineValue = data.deadline ?? data.goal_deadline ?? null;
    const foodDiaryValue = data.foodDiary ?? data.food_diary ?? null;
    const age = calculateAge(birthDate);

    return {
        sex: normalizeSex(rawGender),
        birth_date: birthDate,
        age: age ?? null,
        height_cm: parseNumber(heightValue),
        weight_kg: parseNumber(weightValue),
        target_weight_kg: parseNumber(targetWeightValue),
        goal: normalizeGoal(goalValue),
        activity_factor: normalizeActivity(activityValue),
        goal_deadline: deadlineValue || null,
        food_diary: foodDiaryValue === true || foodDiaryValue === false
            ? foodDiaryValue
            : foodDiaryValue === 'yes'
                ? true
                : foodDiaryValue === 'no'
                    ? false
                    : null
    };
}

// Форматировать дату для отображения на русском языке
function formatDate(dateString) {
    if (!dateString) return 'Не указано';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) {
        return 'Не указано';
    }
    return date.toLocaleDateString('ru-RU', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Calculate age from birth date
function calculateAge(birthDate) {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
    }
    
    return age;
}

// Validate form inputs
function validateForm() {
    const allFilled = Object.values(userData).every(value => value !== null && value !== '');
    return allFilled;
}

// Show notification
function showNotification(message, type = 'success') {
    // Check if notification container exists
    let container = document.getElementById('notification-container');
    
    if (!container) {
        container = document.createElement('div');
        container.id = 'notification-container';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 1000;
            max-width: 320px;
        `;
        document.body.appendChild(container);
    }
    
    const notification = document.createElement('div');
    notification.style.cssText = `
        background: ${type === 'success' ? '#10b981' : '#ef4444'};
        color: white;
        padding: 16px 20px;
        border-radius: 16px;
        margin-bottom: 10px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
        animation: slideIn 0.3s ease-out;
        display: flex;
        align-items: center;
        gap: 12px;
    `;
    
    const icon = document.createElement('i');
    icon.setAttribute('data-feather', type === 'success' ? 'check-circle' : 'alert-circle');
    
    const text = document.createElement('span');
    text.textContent = message;
    
    notification.appendChild(icon);
    notification.appendChild(text);
    container.appendChild(notification);
    
    // Feather icons replacement
    if (window.feather) {
        feather.replace();
    }
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'fadeIn 0.3s ease-out reverse';
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

// Create circular progress SVG
function createCircularProgress(percent, size = 100, strokeWidth = 8, color = '#10b981') {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (percent / 100) * circumference;
    
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
    svg.classList.add('progress-ring');
    
    // Background circle
    const bgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    bgCircle.setAttribute('cx', size / 2);
    bgCircle.setAttribute('cy', size / 2);
    bgCircle.setAttribute('r', radius);
    bgCircle.setAttribute('stroke', '#e2e8f0');
    bgCircle.setAttribute('stroke-width', strokeWidth);
    bgCircle.setAttribute('fill', 'transparent');
    
    // Progress circle
    const progressCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    progressCircle.setAttribute('cx', size / 2);
    progressCircle.setAttribute('cy', size / 2);
    progressCircle.setAttribute('r', radius);
    progressCircle.setAttribute('stroke', color);
    progressCircle.setAttribute('stroke-width', strokeWidth);
    progressCircle.setAttribute('fill', 'transparent');
    progressCircle.setAttribute('stroke-dasharray', circumference);
    progressCircle.setAttribute('stroke-dashoffset', offset);
    progressCircle.setAttribute('stroke-linecap', 'round');
    progressCircle.classList.add('progress-ring-circle');
    
    // Percentage text
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', size / 2);
    text.setAttribute('y', size / 2 + 6);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('fill', '#1e293b');
    text.setAttribute('font-weight', 'bold');
    text.setAttribute('font-size', '16');
    text.textContent = `${Math.round(percent)}%`;
    
    svg.appendChild(bgCircle);
    svg.appendChild(progressCircle);
    svg.appendChild(text);
    
    return svg;
}

// Debounce function for performance
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

const memoryStore = new Map();

// Временное хранилище в памяти (без сохранения состояния приложения).
const storage = {
    set(key, value) {
        memoryStore.set(`health_bloom_${key}`, value);
    },
    
    get(key) {
        return memoryStore.get(`health_bloom_${key}`) ?? null;
    },
    
    remove(key) {
        memoryStore.delete(`health_bloom_${key}`);
    },
    
    clear() {
        memoryStore.clear();
    }
};

// Page transition animation
function animatePageTransition() {
    const body = document.body;
    body.style.opacity = '0';
    body.style.transition = 'opacity 0.2s ease';
    
    setTimeout(() => {
        body.style.opacity = '1';
    }, 50);
}

async function fetchBotInfo() {
    try {
        const response = await fetch('/api/telegram/bot-info');
        if (!response.ok) {
            return null;
        }
        return await response.json();
    } catch (error) {
        return null;
    }
}

function isSameOriginRequest(input) {
    if (typeof input === 'string') {
        return input.startsWith('/') || input.startsWith(window.location.origin);
    }
    if (input && typeof input.url === 'string') {
        return input.url.startsWith('/') || input.url.startsWith(window.location.origin);
    }
    return false;
}

function normalizeTelegramInitData(value) {
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
}

function getTelegramInitDataFromUrl() {
    const extractParam = (source, key) => {
        if (!source) {
            return '';
        }
        const params = new URLSearchParams(source);
        const value = params.get(key);
        return value ? decodeURIComponent(value) : '';
    };
    const hash = window.location.hash ? window.location.hash.replace(/^#/, '') : '';
    const search = window.location.search ? window.location.search.replace(/^\?/, '') : '';
    return extractParam(hash, 'tgWebAppData') || extractParam(search, 'tgWebAppData');
}

function installTelegramInitDataInterceptor(initData) {
    const normalized = normalizeTelegramInitData(initData);
    if (!normalized || window.__telegramInitDataInterceptorInstalled) {
        return;
    }
    window.__telegramInitDataInterceptorInstalled = true;
    const originalFetch = window.fetch;
    window.fetch = function(input, init = {}) {
        if (isSameOriginRequest(input)) {
            const headers = new Headers(init.headers || {});
            if (!headers.has('X-Telegram-Init-Data')) {
                headers.set('X-Telegram-Init-Data', normalized);
            }
            return originalFetch(input, { ...init, headers });
        }
        return originalFetch(input, init);
    };
}

async function loadAppConfig() {
    try {
        const response = await fetch('/api/app/config');
        if (!response.ok) {
            return { mode: 'production', is_dev: false, is_prod: true };
        }
        return await response.json();
    } catch (error) {
        return { mode: 'production', is_dev: false, is_prod: true };
    }
}

function showDevModeBadge() {
    if (document.getElementById('dev-mode-badge')) {
        return;
    }
    const badge = document.createElement('div');
    badge.id = 'dev-mode-badge';
    badge.className = 'dev-mode-badge';
    badge.textContent = 'DEV MODE';
    document.body.appendChild(badge);
}

function setTelegramAccessLock(isLocked) {
    if (!document.body) {
        return;
    }
    document.body.classList.toggle('telegram-auth-locked', Boolean(isLocked));
}

function buildBotLink(username) {
    if (!username) {
        return null;
    }
    return `https://t.me/${username}?start=miniapp`;
}

function showTelegramAuthErrorOverlay(message) {
    let overlay = document.getElementById('telegram-auth-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'telegram-auth-overlay';
        overlay.className = 'telegram-auth-overlay';
    }
    overlay.innerHTML = `
        <div class="telegram-auth-overlay__card">
            <div class="telegram-auth-overlay__icon">⚠️</div>
            <h2>Не удалось авторизоваться</h2>
            <p>${message}</p>
        </div>
    `;
    document.body.appendChild(overlay);
}

async function showTelegramRequiredOverlay() {
    if (window.appDebug) {
        console.warn('[TG_DEBUG_FRONT] showTelegramRequiredOverlay: показ заглушки "Откройте в Telegram"');
    }
    let overlay = document.getElementById('telegram-auth-overlay');
    if (overlay) {
        overlay.classList.remove('hidden');
        return;
    }
    const botInfo = await fetchBotInfo();
    const botLink = buildBotLink(botInfo?.username);
    overlay = document.createElement('div');
    overlay.id = 'telegram-auth-overlay';
    overlay.className = 'telegram-auth-overlay';
    overlay.innerHTML = `
        <div class="telegram-auth-overlay__card">
            <div class="telegram-auth-overlay__icon">📲</div>
            <h2>Откройте в Telegram</h2>
            <p>Это приложение работает только внутри Telegram.</p>
            ${botLink ? `<a class="telegram-auth-overlay__button" href="${botLink}">Открыть в Telegram</a>` : ''}
        </div>
    `;
    document.body.appendChild(overlay);
}

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForTelegramWebApp(timeoutMs = 8000) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
        const tg = window.Telegram?.WebApp;
        if (tg) {
            return tg;
        }
        await wait(100);
    }
    return window.Telegram?.WebApp || null;
}

async function waitForTelegramInitData(tg, timeoutMs = 15000) {
    if (!tg) {
        return '';
    }
    const startedAt = Date.now();
    let initData = tg.initData;
    while (!initData && Date.now() - startedAt < timeoutMs) {
        await wait(100);
        initData = tg.initData;
    }
    const fallback = getTelegramInitDataFromUrl();
    return initData || fallback || '';
}

async function initTelegramAuth(appConfig) {
    if (window.appDebug) {
        console.warn('[TG_DEBUG_FRONT] initTelegramAuth: вызов инициализации');
    }
    if (window.appDebug) {
        console.debug('initTelegramAuth: запуск инициализации Telegram авторизации');
    }
    if (appConfig?.is_dev) {
        showDevModeBadge();
        setTelegramAccessLock(false);
        // В DEV режиме пропускаем проверку Telegram.
        return true;
    }
    setTelegramAccessLock(true);
    const tg = await waitForTelegramWebApp();
    if (window.appDebug) {
        console.debug('initTelegramAuth: tg =', tg);
    }
    if (!tg) {
        if (window.appDebug) {
            console.warn('NOT_IN_TELEGRAM');
        }
        await showTelegramRequiredOverlay();
        return false;
    }
    if (typeof tg.ready === 'function') {
        tg.ready();
    }
    let initData = await waitForTelegramInitData(tg, 15000);
    initData = normalizeTelegramInitData(initData);
    if (window.appDebug) {
        console.debug('initTelegramAuth: initData =', initData);
        console.debug('TELEGRAM_WEBAPP_READY', {
            hasWebApp: Boolean(tg),
            initDataLength: initData ? initData.length : 0
        });
    }
    if (!initData) {
        if (window.appDebug) {
            console.warn('INITDATA_EMPTY');
        }
        await showTelegramRequiredOverlay();
        return false;
    }
    window.telegramInitData = initData;
    installTelegramInitDataInterceptor(initData);
    try {
        const response = await fetch('/api/auth/telegram', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initData })
        });
        if (!response.ok) {
            showTelegramAuthErrorOverlay('Не удалось подтвердить Telegram-сессию. Откройте приложение через бота.');
            return false;
        }
        const data = await response.json();
        if (!data?.ok) {
            showTelegramAuthErrorOverlay('Ответ авторизации некорректен. Попробуйте открыть приложение через бота ещё раз.');
            return false;
        }
        setTelegramAccessLock(false);
        return true;
    } catch (error) {
        showTelegramAuthErrorOverlay('Сервис недоступен. Попробуйте позже или откройте приложение через бота.');
        return false;
    }
}

async function loadProfileStatus() {
    try {
        const response = await fetch('/api/me/status');
        if (!response.ok) {
            return { authorized: false, profile_completed: false, telegram_user_id: null };
        }
        const data = await response.json();
        return {
            authorized: Boolean(data?.authorized),
            profile_completed: Boolean(data?.profile_completed),
            telegram_user_id: data?.telegram_user_id ?? null
        };
    } catch (error) {
        return { authorized: false, profile_completed: false, telegram_user_id: null };
    }
}

function getLocalProfileCompletedFlag() {
    if (typeof getUserProfile !== 'function') {
        return false;
    }
    const profile = getUserProfile();
    if (!profile || typeof profile !== 'object') {
        return false;
    }
    return profile.profile_completed === true || profile.completed === true;
}

function redirectToQuestionnaireIfNeeded(status) {
    const path = window.location.pathname || '/';
    const serverCompleted = status?.profile_completed === true;
    const localCompleted = getLocalProfileCompletedFlag();
    const profileCompleted = serverCompleted || localCompleted;
    if (path === '/' || path === '/index') {
        if (profileCompleted) {
            window.location.replace('/profile');
        } else {
            window.location.replace('/questionnaire');
        }
        return;
    }
    if (path.startsWith('/questionnaire')) {
        return;
    }
    if (!profileCompleted) {
        window.location.replace('/questionnaire');
    }
}

function redirectFromMenuIfCompleted(profileCompleted) {
    if (!profileCompleted) {
        return;
    }
    const path = window.location.pathname || '/';
    if (path.startsWith('/menu')) {
        // Для завершённого профиля не уводим пользователя из меню автоматически.
        return;
    }
}

function syncLocalProfileCompletion(status) {
    const serverCompleted = status?.profile_completed === true;
    const isAuthorized = status?.authorized === true;
    const localCompleted = getLocalProfileCompletedFlag();
    const mergedCompleted = serverCompleted || localCompleted;
    window.profileCompleted = mergedCompleted;
    if (typeof patchUserProfile === 'function') {
        // Если Telegram-сессия временно недоступна, не затираем локально подтверждённый профиль.
        const safeCompleted = isAuthorized ? mergedCompleted : localCompleted;
        patchUserProfile({
            completed: safeCompleted,
            profile_completed: safeCompleted
        });
    }
}

function notifyProfileStatus() {
    const detail = {
        profileCompleted: window.profileCompleted === true,
        isDevMode: window.appIsDev === true || window.appMode === 'development'
    };
    window.dispatchEvent(new CustomEvent('profile-status-updated', { detail }));
}

function restoreUserDataFromLocalStorage() {
    try {
        const raw = localStorage.getItem('userData');
        if (!raw) {
            return;
        }
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
            window.userData = parsed;
            console.log('[USERDATA] восстановлено из localStorage');
        }
    } catch (error) {
        console.warn('Не удалось восстановить userData', error);
    }
}

// Применение темы Telegram WebApp к CSS-переменным
function applyTelegramTheme() {
    const tg = window.Telegram?.WebApp;
    if (!tg) {
        return;
    }
    const theme = tg.themeParams || {};
    const root = document.documentElement;
    const body = document.body;
    if (theme.bg_color) {
        root.style.setProperty('--tg-bg-color', theme.bg_color);
        if (body) {
            body.style.backgroundColor = theme.bg_color;
            body.style.backgroundImage = 'none';
        }
    }
    if (theme.text_color) {
        root.style.setProperty('--tg-text-color', theme.text_color);
        if (body) {
            body.style.color = theme.text_color;
        }
    }
    if (theme.button_color) {
        root.style.setProperty('--tg-button-color', theme.button_color);
    }
    if (theme.button_text_color) {
        root.style.setProperty('--tg-button-text-color', theme.button_text_color);
    }
    if (theme.hint_color) {
        root.style.setProperty('--tg-hint-color', theme.hint_color);
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', async function() {
    animatePageTransition();
    restoreUserDataFromLocalStorage();
    const appConfig = await loadAppConfig();
    window.appMode = appConfig?.mode || 'production';
    window.appIsDev = Boolean(appConfig?.is_dev);
    window.appDebug = Boolean(appConfig?.debug);
    const currentPath = window.location.pathname || '/';
    const isEntryPoint = currentPath === '/' || currentPath === '/index';
    const tg = window.Telegram?.WebApp;
    if (tg) {
        tg.expand();
        applyTelegramTheme();
        if (typeof tg.onEvent === 'function') {
            tg.onEvent('themeChanged', () => {
                applyTelegramTheme();
            });
        }
    }
    if (isEntryPoint && window.appDebug) {
        console.group('🔍 Telegram WebApp DEBUG');
        console.log('window.Telegram:', window.Telegram);
        console.log('Telegram.WebApp:', window.Telegram?.WebApp);
        console.log('initData:', window.Telegram?.WebApp?.initData);
        console.log('initData length:', window.Telegram?.WebApp?.initData?.length);
        console.log('initDataUnsafe:', window.Telegram?.WebApp?.initDataUnsafe);
        console.log('platform:', window.Telegram?.WebApp?.platform);
        console.log('version:', window.Telegram?.WebApp?.version);
        console.groupEnd();
        console.log(
            window.Telegram,
            window.Telegram?.WebApp,
            window.Telegram?.WebApp?.initData?.length
        );
        const isAuthorized = await initTelegramAuth(appConfig);
        if (!isAuthorized) {
            return;
        }
    }
    const status = await loadProfileStatus();
    window.serverUser = {
        authorized: status.authorized === true,
        telegram_user_id: status.telegram_user_id ?? null,
        profile_completed: status.profile_completed === true
    };
    window.profileCompleted = status.profile_completed;
    if (typeof window.syncProfileWithBackend === 'function') {
        await window.syncProfileWithBackend();
    }
    if (typeof window.syncDiaryEntriesWithBackend === 'function') {
        await window.syncDiaryEntriesWithBackend();
    }
    const diaryEntries = typeof getDiaryEntries === 'function' ? getDiaryEntries() : [];
    if (typeof window.syncWaterEntriesWithBackend === 'function') {
        await window.syncWaterEntriesWithBackend(diaryEntries);
    }
    if (typeof window.syncSleepEntriesWithBackend === 'function') {
        await window.syncSleepEntriesWithBackend(diaryEntries);
    }
    if (typeof window.syncHabitEntriesWithBackend === 'function') {
        await window.syncHabitEntriesWithBackend();
    }
    syncLocalProfileCompletion(status);
    redirectToQuestionnaireIfNeeded(status);
    redirectFromMenuIfCompleted(window.profileCompleted === true);
    notifyProfileStatus();

    // Add ripple effect to all primary buttons
    document.querySelectorAll('.btn-primary').forEach(button => {
        button.addEventListener('click', function(e) {
            // Create ripple element
            const ripple = document.createElement('span');
            const rect = this.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;
            
            ripple.style.cssText = `
                position: absolute;
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.7);
                transform: scale(0);
                animation: ripple 0.6s linear;
                left: ${x}px;
                top: ${y}px;
                width: ${size}px;
                height: ${size}px;
                pointer-events: none;
            `;
            
            this.appendChild(ripple);
            
            setTimeout(() => {
                ripple.remove();
            }, 600);
        });
    });
    
    // Load saved data if available
    if (typeof getUserProfile === 'function') {
        const profile = getUserProfile();
        Object.assign(userData, mapUserProfileToUserData(profile));
    } else {
        const savedData = storage.get('user_data');
        if (savedData) {
            Object.assign(userData, savedData);
        }
    }

    if (!userData.registrationDate) {
        userData.registrationDate = new Date().toISOString();
    }
});
