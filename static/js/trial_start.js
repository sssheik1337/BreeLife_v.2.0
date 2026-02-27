(function() {
    function formatDateRu(isoValue) {
        if (!isoValue) {
            return null;
        }
        const date = new Date(isoValue);
        if (Number.isNaN(date.getTime())) {
            return null;
        }
        return new Intl.DateTimeFormat('ru-RU', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        }).format(date);
    }

    async function ensureTrialStatus() {
        const fetcher = window.apiFetch || fetch;

        try {
            const statusResponse = await fetcher('/api/subscription/status');
            if (statusResponse.ok) {
                const status = await statusResponse.json();
                if (status?.subscription_until) {
                    return status;
                }
            }
        } catch (error) {
            // Ошибки чтения статуса пробного периода игнорируем и пробуем запустить пробный период.
        }

        try {
            const startResponse = await fetcher('/api/subscription/start_trial', {
                method: 'POST'
            });
            if (!startResponse.ok) {
                return null;
            }
            return await startResponse.json();
        } catch (error) {
            return null;
        }
    }

    async function markTrialWelcomeSeen() {
        const fetcher = window.apiFetch || fetch;
        try {
            const response = await fetcher('/api/profile/save', {
                method: 'POST',
                body: JSON.stringify({ trial_welcome_seen: true })
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    function setKeylineText(subscription) {
        const keyline = document.getElementById('trial-start-keyline');
        if (!keyline) {
            return;
        }
        const trialEndDate = formatDateRu(subscription?.subscription_until);
        if (!trialEndDate) {
            keyline.textContent = 'Пробный период уже активен для вашего аккаунта';
            return;
        }
        keyline.textContent = `Пробный период активен до ${trialEndDate}`;
    }

    function buildSpaFallbackTarget(path) {
        const spaBase = typeof window.__SPA_BASE__ === 'string' ? window.__SPA_BASE__ : '';
        if (!spaBase || typeof path !== 'string') {
            return path;
        }
        if (path === '/') {
            return `${spaBase}/`;
        }
        if (path.startsWith(`${spaBase}/`) || path === spaBase) {
            return path;
        }
        if (path.startsWith('/')) {
            return `${spaBase}${path}`;
        }
        return `${spaBase}/${path}`;
    }

    function navigateToProfile() {
        const target = '/profile';
        if (typeof window.spaReplace === 'function') {
            window.spaReplace(target);
            return;
        }
        if (typeof window.spaNavigate === 'function') {
            window.spaNavigate(target);
            return;
        }
        const fallbackTarget = buildSpaFallbackTarget(target);
        window.location.href = fallbackTarget;
    }

    async function initTrialStartScreen() {
        const continueButton = document.getElementById('trial-start-continue');
        if (!continueButton) {
            return;
        }

        const subscription = await ensureTrialStatus();
        setKeylineText(subscription);

        continueButton.addEventListener('click', async () => {
            continueButton.disabled = true;
            const saved = await markTrialWelcomeSeen();
            if (!saved) {
                continueButton.disabled = false;
                if (typeof showNotification === 'function') {
                    showNotification('Не удалось завершить настройку. Попробуйте ещё раз.', 'error');
                }
                return;
            }
            navigateToProfile();
        });
    }

    if (typeof window !== 'undefined') {
        window.initTrialStartScreen = initTrialStartScreen;
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTrialStartScreen);
    } else {
        initTrialStartScreen();
    }
})();
