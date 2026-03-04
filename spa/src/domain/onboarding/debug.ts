import type { OnboardingDebugLogger } from './stateMachine';

const DEBUG_KEY = 'spa_onboarding_debug';

const isDebugEnabled = (): boolean => {
    if (typeof window === 'undefined') {
        return false;
    }

    const localStorageFlag = window.localStorage?.getItem(DEBUG_KEY);
    if (localStorageFlag === '1' || localStorageFlag === 'true') {
        return true;
    }

    const query = window.location.search || '';
    return /(?:\?|&)onboardingDebug=1(?:&|$)/.test(query);
};

export const createOnboardingDebugLogger = (): OnboardingDebugLogger => {
    return (message, payload) => {
        if (!isDebugEnabled()) {
            return;
        }
        if (payload) {
            console.info(`[spa:onboarding] ${message}`, payload);
            return;
        }
        console.info(`[spa:onboarding] ${message}`);
    };
};
