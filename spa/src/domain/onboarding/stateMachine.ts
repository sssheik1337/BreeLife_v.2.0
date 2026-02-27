import type { ProfileState } from '../../stores/appStateStore';

export interface SessionState {
    authorized: boolean;
    profile_completed: boolean;
}

export interface OnboardingContext {
    path: string;
    session: SessionState;
    profile: ProfileState | null;
}

export interface OnboardingDecision {
    allow: boolean;
    redirectTo: string | null;
    reason: string;
}

export type OnboardingDebugLogger = (message: string, payload?: Record<string, unknown>) => void;

const PRODUCTS_ONBOARDING_ROUTES = new Set(['/meal-plan', '/shopping-list']);
const QUESTIONNAIRE_ROUTES = new Set(['/questionnaire']);
const PREFERENCES_ROUTES = new Set(['/preferences-onboarding-choice', '/preferences-onboarding']);
const ENTRY_ROUTES = new Set(['/', '/index']);

const normalizePath = (path: string): string => {
    if (!path) {
        return '/';
    }
    const [cleanPath] = path.split('?');
    return cleanPath || '/';
};

export const shouldRedirectToTrialStart = (profile: ProfileState | null): boolean => {
    if (!profile || typeof profile !== 'object') {
        return false;
    }
    if (profile.trial_welcome_seen === true) {
        return false;
    }
    if (profile.trial_started_at) {
        return false;
    }
    const subscriptionStatus = typeof profile.subscription_status === 'string' ? profile.subscription_status : '';
    if (['trial', 'active', 'expired'].includes(subscriptionStatus)) {
        return false;
    }
    return true;
};

export const hasProductsOnboardingData = (profile: ProfileState | null): boolean => {
    if (!profile || typeof profile !== 'object') {
        return false;
    }
    if (profile.preferences_onboarding_completed === true) {
        return true;
    }
    const favorites = Array.isArray(profile.favorite_product_ids) ? profile.favorite_product_ids : [];
    const excluded = Array.isArray(profile.excluded_product_ids) ? profile.excluded_product_ids : [];
    return favorites.length > 0 || excluded.length > 0;
};

export const resolvePostQuestionnaireRoute = (profile: ProfileState | null): string => {
    if (profile?.preferences_onboarding_completed === true) {
        return '/trial-start';
    }
    return '/preferences-onboarding-choice';
};

export const evaluateOnboardingState = (
    context: OnboardingContext,
    logger?: OnboardingDebugLogger
): OnboardingDecision => {
    const path = normalizePath(context.path);
    const authorized = context.session.authorized === true;
    const serverProfileCompleted = context.session.profile_completed === true;
    const localProfileCompleted = context.profile?.is_completed === true;
    const profileCompleted = serverProfileCompleted || localProfileCompleted;

    logger?.('guard:start', {
        path,
        authorized,
        serverProfileCompleted,
        localProfileCompleted,
        profileCompleted
    });

    if (ENTRY_ROUTES.has(path) && profileCompleted) {
        return {
            allow: false,
            redirectTo: '/profile',
            reason: 'ENTRY_TO_PROFILE'
        };
    }

    if (!authorized && !ENTRY_ROUTES.has(path) && !QUESTIONNAIRE_ROUTES.has(path)) {
        return {
            allow: false,
            redirectTo: '/',
            reason: 'UNAUTHORIZED_TO_ENTRY'
        };
    }

    if (!profileCompleted && !QUESTIONNAIRE_ROUTES.has(path) && !PREFERENCES_ROUTES.has(path) && !ENTRY_ROUTES.has(path)) {
        return {
            allow: false,
            redirectTo: '/questionnaire',
            reason: 'PROFILE_INCOMPLETE_TO_QUESTIONNAIRE'
        };
    }

    if (QUESTIONNAIRE_ROUTES.has(path) && profileCompleted) {
        return {
            allow: false,
            redirectTo: resolvePostQuestionnaireRoute(context.profile),
            reason: 'QUESTIONNAIRE_ALREADY_COMPLETED'
        };
    }

    if (path === '/preferences-onboarding-choice') {
        if (!profileCompleted) {
            return {
                allow: false,
                redirectTo: '/questionnaire',
                reason: 'CHOICE_REQUIRES_COMPLETED_PROFILE'
            };
        }
        if (context.profile?.preferences_onboarding_completed === true) {
            return {
                allow: false,
                redirectTo: '/trial-start',
                reason: 'CHOICE_ALREADY_COMPLETED'
            };
        }
    }

    if (path === '/profile' && shouldRedirectToTrialStart(context.profile)) {
        return {
            allow: false,
            redirectTo: '/trial-start',
            reason: 'PROFILE_TO_TRIAL_START'
        };
    }

    if (path === '/trial-start' && !shouldRedirectToTrialStart(context.profile)) {
        return {
            allow: false,
            redirectTo: '/profile',
            reason: 'TRIAL_START_ALREADY_SEEN'
        };
    }

    if (PRODUCTS_ONBOARDING_ROUTES.has(path) && !hasProductsOnboardingData(context.profile)) {
        return {
            allow: false,
            redirectTo: '/preferences-onboarding',
            reason: 'PRODUCTS_ONBOARDING_REQUIRED'
        };
    }

    return {
        allow: true,
        redirectTo: null,
        reason: 'ALLOW'
    };
};
