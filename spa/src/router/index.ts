import { createRouter, createWebHistory, type NavigationGuardNext, type RouteLocationNormalized, type RouteRecordRaw } from 'vue-router';
import { useAppStateStore, type ProfileState } from '../stores/appStateStore';
import { useStorageStore } from '../stores/storageStore';
import { ensureTelegramAuthSession } from '../platform/telegramAuth';
import { createOnboardingDebugLogger, evaluateOnboardingState } from '../domain/onboarding';
import EntryPage from '../pages/EntryPage.vue';
import QuestionnairePage from '../pages/QuestionnairePage.vue';
import PreferencesChoicePage from '../pages/PreferencesChoicePage.vue';
import PreferencesOnboardingPage from '../pages/PreferencesOnboardingPage.vue';
import TrialStartPage from '../pages/TrialStartPage.vue';
import ResumePage from '../pages/ResumePage.vue';
import ProfilePage from '../pages/ProfilePage.vue';
import DiaryPage from '../pages/DiaryPage.vue';
import FoodsPage from '../pages/FoodsPage.vue';
import MyProductsPage from '../pages/MyProductsPage.vue';
import MealPlanPage from '../pages/MealPlanPage.vue';
import ShoppingListPage from '../pages/ShoppingListPage.vue';
import MenuPage from '../pages/MenuPage.vue';
import ReferencesPage from '../pages/ReferencesPage.vue';
import SupportPage from '../pages/SupportPage.vue';
import LegalPage from '../pages/LegalPage.vue';
import PlansPage from '../pages/PlansPage.vue';
import SubscriptionManagementPage from '../pages/SubscriptionManagementPage.vue';
import RemindersSettingsPage from '../pages/RemindersSettingsPage.vue';

interface RouteMetaPolicy {
    requiresAuth?: boolean;
    requiresCompletedProfile?: boolean;
    onboardingStep?: 'choice' | 'preferences' | 'trial';
    requiresProductsOnboarding?: boolean;
}

interface SessionStatusPayload {
    authorized: boolean;
    profile_completed: boolean;
    telegram_user_id: number | null;
    first_name: string | null;
    last_name: string | null;
    username: string | null;
    photo_url: string | null;
}

interface RouterGuardContext {
    session: SessionStatusPayload;
    profile: ProfileState | null;
}

const ROUTE_META = {
    publicEntry: { requiresAuth: false, requiresCompletedProfile: false },
    questionnaire: { requiresAuth: false, requiresCompletedProfile: false },
    completedOnly: { requiresAuth: true, requiresCompletedProfile: true }
} satisfies Record<string, RouteMetaPolicy>;

const routes: RouteRecordRaw[] = [
    {
        path: '/',
        name: 'entry-root',
        component: EntryPage,
        meta: ROUTE_META.publicEntry
    },
    {
        path: '/index',
        name: 'entry-index',
        component: EntryPage,
        meta: ROUTE_META.publicEntry
    },
    {
        path: '/questionnaire',
        name: 'questionnaire',
        component: QuestionnairePage,
        meta: { ...ROUTE_META.questionnaire } satisfies RouteMetaPolicy
    },
    {
        path: '/preferences-onboarding-choice',
        name: 'preferences-onboarding-choice',
        component: PreferencesChoicePage,
        meta: {
            ...ROUTE_META.completedOnly,
            onboardingStep: 'choice',
        } satisfies RouteMetaPolicy
    },
    {
        path: '/preferences-onboarding',
        name: 'preferences-onboarding',
        component: PreferencesOnboardingPage,
        meta: {
            ...ROUTE_META.completedOnly,
            onboardingStep: 'preferences',
        } satisfies RouteMetaPolicy
    },
    {
        path: '/trial-start',
        name: 'trial-start',
        component: TrialStartPage,
        meta: {
            ...ROUTE_META.completedOnly,
            onboardingStep: 'trial',
        } satisfies RouteMetaPolicy
    },
    {
        path: '/resume',
        name: 'resume',
        component: ResumePage,
        meta: { ...ROUTE_META.completedOnly } satisfies RouteMetaPolicy
    },
    {
        path: '/profile',
        name: 'profile-progress',
        component: ProfilePage,
        meta: { ...ROUTE_META.completedOnly } satisfies RouteMetaPolicy
    },
    {
        path: '/profile.html',
        redirect: '/profile'
    },
    {
        path: '/diary',
        name: 'diary',
        component: DiaryPage,
        meta: { ...ROUTE_META.completedOnly } satisfies RouteMetaPolicy
    },
    {
        path: '/food-diary',
        redirect: '/diary'
    },
    {
        path: '/foods',
        name: 'foods',
        component: FoodsPage,
        meta: { ...ROUTE_META.completedOnly } satisfies RouteMetaPolicy
    },
    {
        path: '/my-products',
        name: 'my-products',
        component: MyProductsPage,
        meta: { ...ROUTE_META.completedOnly } satisfies RouteMetaPolicy
    },
    {
        path: '/meal-plan',
        name: 'meal-plan',
        component: MealPlanPage,
        meta: {
            ...ROUTE_META.completedOnly,
            requiresProductsOnboarding: true,
        } satisfies RouteMetaPolicy
    },
    {
        path: '/shopping-list',
        name: 'shopping-list',
        component: ShoppingListPage,
        meta: {
            ...ROUTE_META.completedOnly,
            requiresProductsOnboarding: true,
        } satisfies RouteMetaPolicy
    },
    {
        path: '/menu',
        name: 'menu',
        component: MenuPage,
        meta: { ...ROUTE_META.completedOnly } satisfies RouteMetaPolicy
    },
    {
        path: '/references',
        name: 'references',
        component: ReferencesPage,
        meta: { ...ROUTE_META.completedOnly } satisfies RouteMetaPolicy
    },
    {
        path: '/support',
        name: 'support',
        component: SupportPage,
        meta: { ...ROUTE_META.completedOnly } satisfies RouteMetaPolicy
    },
    {
        path: '/legal',
        name: 'legal',
        component: LegalPage,
        meta: { ...ROUTE_META.completedOnly } satisfies RouteMetaPolicy
    },
    {
        path: '/plans',
        name: 'plans',
        component: PlansPage,
        meta: { ...ROUTE_META.completedOnly } satisfies RouteMetaPolicy
    },
    {
        path: '/subscription-management',
        name: 'subscription-management',
        component: SubscriptionManagementPage,
        meta: { ...ROUTE_META.completedOnly } satisfies RouteMetaPolicy
    },
    {
        path: '/settings/reminders',
        name: 'settings-reminders',
        component: RemindersSettingsPage,
        meta: { ...ROUTE_META.completedOnly } satisfies RouteMetaPolicy
    }
];

const resetSpaScrollPosition = (): void => {
    if (typeof window.scrollTo === 'function') {
        window.scrollTo(0, 0);
    }
    const scroller = document.querySelector('.app-content');
    if (scroller) {
        scroller.scrollTop = 0;
    }
};

const router = createRouter({
    history: createWebHistory('/app'),
    routes,
    scrollBehavior(to, _from, savedPosition) {
        if (savedPosition) {
            return savedPosition;
        }
        if (to.hash) {
            return {
                el: to.hash,
                behavior: 'auto'
            };
        }
        return {
            left: 0,
            top: 0,
            behavior: 'auto'
        };
    }
});

const resolveApiFetch = (): typeof fetch => {
    const storageStore = useStorageStore();
    if (typeof storageStore.apiFetch === 'function') {
        return storageStore.apiFetch;
    }
    return window.fetch.bind(window);
};

const parseSessionStatus = (data: any): SessionStatusPayload => ({
    authorized: data?.authorized === true,
    profile_completed: data?.profile_completed === true,
    telegram_user_id: typeof data?.telegram_user_id === 'number' ? data.telegram_user_id : null,
    first_name: typeof data?.first_name === 'string' ? data.first_name : null,
    last_name: typeof data?.last_name === 'string' ? data.last_name : null,
    username: typeof data?.username === 'string' ? data.username : null,
    photo_url: typeof data?.photo_url === 'string' ? data.photo_url : null
});

const buildUnauthorizedSession = (): SessionStatusPayload => ({
    authorized: false,
    profile_completed: false,
    telegram_user_id: null,
    first_name: null,
    last_name: null,
    username: null,
    photo_url: null
});

const loadSessionStatus = async (): Promise<SessionStatusPayload> => {
    const fetcher = resolveApiFetch();
    const response = await fetcher('/api/me/status');
    if (!response.ok) {
        return buildUnauthorizedSession();
    }

    const data = await response.json();
    let parsed = parseSessionStatus(data);
    if (parsed.authorized) {
        return parsed;
    }

    const reAuthorized = await ensureTelegramAuthSession({ reason: 'router-session-check' });
    if (!reAuthorized) {
        return parsed;
    }

    const retryResponse = await fetcher('/api/me/status');
    if (!retryResponse.ok) {
        return buildUnauthorizedSession();
    }
    parsed = parseSessionStatus(await retryResponse.json());
    return parsed;
};

const loadProfileForGuards = async (): Promise<ProfileState | null> => {
    const fetcher = resolveApiFetch();
    const storageStore = useStorageStore();
    try {
        const response = await fetcher('/api/profile');
        if (!response.ok) {
            storageStore.clearProfileLocalCache();
            return storageStore.profile as ProfileState;
        }
        const data = await response.json();
        if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
            storageStore.clearProfileLocalCache();
            return storageStore.profile as ProfileState;
        }
        return data as ProfileState;
    } catch {
        storageStore.clearProfileLocalCache();
        return storageStore.profile as ProfileState;
    }
};

const onboardingDebugLog = createOnboardingDebugLogger();

const buildGuardContext = async (to: RouteLocationNormalized): Promise<RouterGuardContext> => {
    const session = await loadSessionStatus();
    const needsProfile = Boolean(
        to.meta.onboardingStep
        || to.meta.requiresProductsOnboarding
        || to.path === '/questionnaire'
        || to.path === '/profile'
        || to.path === '/trial-start'
    );
    const profile = needsProfile ? await loadProfileForGuards() : null;

    const appStateStore = useAppStateStore();
    appStateStore.setServerUser({
        authorized: session.authorized,
        telegram_user_id: session.telegram_user_id,
        profile_completed: session.profile_completed,
        first_name: session.first_name,
        last_name: session.last_name,
        username: session.username,
        photo_url: session.photo_url
    });
    appStateStore.setProfileCompleted(session.profile_completed);
    if (profile) {
        appStateStore.setProfile(profile);
    }

    return { session, profile };
};

router.beforeEach(async (to: RouteLocationNormalized, _from: RouteLocationNormalized, next: NavigationGuardNext) => {
    try {
        const { session, profile } = await buildGuardContext(to);

        const onboardingDecision = evaluateOnboardingState(
            {
                path: to.path,
                session: {
                    authorized: session.authorized,
                    profile_completed: session.profile_completed
                },
                profile
            },
            onboardingDebugLog
        );

        onboardingDebugLog('guard:decision', {
            path: to.path,
            allow: onboardingDecision.allow,
            reason: onboardingDecision.reason,
            redirectTo: onboardingDecision.redirectTo
        });

        if (!onboardingDecision.allow && onboardingDecision.redirectTo) {
            next(onboardingDecision.redirectTo);
            return;
        }

        next();
    } catch {
        next();
    }
});

router.afterEach(() => {
    resetSpaScrollPosition();
});

export default router;
