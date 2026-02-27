import { createRouter, createWebHistory, type NavigationGuardNext, type RouteLocationNormalized, type RouteRecordRaw } from 'vue-router';
import { useAppStateStore, type ProfileState } from '../stores/appStateStore';
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
import PlansPage from '../pages/PlansPage.vue';
import RemindersSettingsPage from '../pages/RemindersSettingsPage.vue';

interface RouteMetaPolicy {
    requiresAuth?: boolean;
    requiresCompletedProfile?: boolean;
    onboardingStep?: 'choice' | 'preferences' | 'trial';
    requiresProductsOnboarding?: boolean;
    migrationPhase?: 1 | 2 | 3 | 4;
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

interface SpaRolloutConfig {
    spa_enabled: boolean;
    phase_1_enabled: boolean;
    phase_2_enabled: boolean;
    phase_3_enabled: boolean;
    phase_4_enabled: boolean;
}

interface AppConfigPayload {
    spa_rollout?: Partial<SpaRolloutConfig>;
}

interface RouterGuardContext {
    session: SessionStatusPayload;
    profile: ProfileState | null;
    rollout: SpaRolloutConfig;
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
        meta: { ...ROUTE_META.questionnaire, migrationPhase: 3 } satisfies RouteMetaPolicy
    },
    {
        path: '/preferences-onboarding-choice',
        name: 'preferences-onboarding-choice',
        component: PreferencesChoicePage,
        meta: {
            ...ROUTE_META.completedOnly,
            onboardingStep: 'choice',
            migrationPhase: 2
        } satisfies RouteMetaPolicy
    },
    {
        path: '/preferences-onboarding',
        name: 'preferences-onboarding',
        component: PreferencesOnboardingPage,
        meta: {
            ...ROUTE_META.completedOnly,
            onboardingStep: 'preferences',
            migrationPhase: 2
        } satisfies RouteMetaPolicy
    },
    {
        path: '/trial-start',
        name: 'trial-start',
        component: TrialStartPage,
        meta: {
            ...ROUTE_META.completedOnly,
            onboardingStep: 'trial',
            migrationPhase: 2
        } satisfies RouteMetaPolicy
    },
    {
        path: '/resume',
        name: 'resume',
        component: ResumePage,
        meta: { ...ROUTE_META.completedOnly, migrationPhase: 3 } satisfies RouteMetaPolicy
    },
    {
        path: '/profile',
        name: 'profile-progress',
        component: ProfilePage,
        meta: { ...ROUTE_META.completedOnly, migrationPhase: 4 } satisfies RouteMetaPolicy
    },
    {
        path: '/profile.html',
        redirect: '/profile'
    },
    {
        path: '/diary',
        name: 'diary',
        component: DiaryPage,
        meta: { ...ROUTE_META.completedOnly, migrationPhase: 4 } satisfies RouteMetaPolicy
    },
    {
        path: '/food-diary',
        redirect: '/diary'
    },
    {
        path: '/foods',
        name: 'foods',
        component: FoodsPage,
        meta: { ...ROUTE_META.completedOnly, migrationPhase: 2 } satisfies RouteMetaPolicy
    },
    {
        path: '/my-products',
        name: 'my-products',
        component: MyProductsPage,
        meta: { ...ROUTE_META.completedOnly, migrationPhase: 2 } satisfies RouteMetaPolicy
    },
    {
        path: '/meal-plan',
        name: 'meal-plan',
        component: MealPlanPage,
        meta: {
            ...ROUTE_META.completedOnly,
            requiresProductsOnboarding: true,
            migrationPhase: 3
        } satisfies RouteMetaPolicy
    },
    {
        path: '/shopping-list',
        name: 'shopping-list',
        component: ShoppingListPage,
        meta: {
            ...ROUTE_META.completedOnly,
            requiresProductsOnboarding: true,
            migrationPhase: 2
        } satisfies RouteMetaPolicy
    },
    {
        path: '/menu',
        name: 'menu',
        component: MenuPage,
        meta: { ...ROUTE_META.completedOnly, migrationPhase: 1 } satisfies RouteMetaPolicy
    },
    {
        path: '/references',
        name: 'references',
        component: ReferencesPage,
        meta: { ...ROUTE_META.completedOnly, migrationPhase: 1 } satisfies RouteMetaPolicy
    },
    {
        path: '/support',
        name: 'support',
        component: SupportPage,
        meta: { ...ROUTE_META.completedOnly, migrationPhase: 1 } satisfies RouteMetaPolicy
    },
    {
        path: '/plans',
        name: 'plans',
        component: PlansPage,
        meta: { ...ROUTE_META.completedOnly, migrationPhase: 1 } satisfies RouteMetaPolicy
    },
    {
        path: '/settings/reminders',
        name: 'settings-reminders',
        component: RemindersSettingsPage,
        meta: { ...ROUTE_META.completedOnly, migrationPhase: 1 } satisfies RouteMetaPolicy
    }
];

const router = createRouter({
    history: createWebHistory('/app'),
    routes
});

const resolveApiFetch = (): typeof fetch => {
    if (typeof window.apiFetch === 'function') {
        return window.apiFetch;
    }
    return window.fetch.bind(window);
};

const loadLocalProfile = (): ProfileState | null => {
    const candidate = typeof (window as any).getUserProfile === 'function'
        ? (window as any).getUserProfile()
        : null;
    return candidate && typeof candidate === 'object' ? (candidate as ProfileState) : null;
};

const loadSessionStatus = async (): Promise<SessionStatusPayload> => {
    const fetcher = resolveApiFetch();
    const response = await fetcher('/api/me/status');
    if (!response.ok) {
        return {
            authorized: false,
            profile_completed: false,
            telegram_user_id: null,
            first_name: null,
            last_name: null,
            username: null,
            photo_url: null
        };
    }
    const data = await response.json();
    const legacyCompleted = typeof (window as any).getProfileCompleted === 'function'
        ? (window as any).getProfileCompleted() === true
        : false;
    const localCompleted = legacyCompleted || (window as any).profileCompleted === true;
    return {
        authorized: data?.authorized === true,
        profile_completed: data?.profile_completed === true || localCompleted,
        telegram_user_id: typeof data?.telegram_user_id === 'number' ? data.telegram_user_id : null,
        first_name: typeof data?.first_name === 'string' ? data.first_name : null,
        last_name: typeof data?.last_name === 'string' ? data.last_name : null,
        username: typeof data?.username === 'string' ? data.username : null,
        photo_url: typeof data?.photo_url === 'string' ? data.photo_url : null
    };
};

const loadProfileForGuards = async (): Promise<ProfileState | null> => {
    const fetcher = resolveApiFetch();
    let serverProfile: ProfileState | null = null;
    try {
        const response = await fetcher('/api/profile');
        if (response.ok) {
            const data = await response.json();
            serverProfile = data && typeof data === 'object' ? (data as ProfileState) : null;
        }
    } catch {
        serverProfile = null;
    }

    const localProfile = loadLocalProfile();
    if (serverProfile && localProfile) {
        if (localProfile.is_completed === true && serverProfile.is_completed !== true) {
            serverProfile = { ...serverProfile, is_completed: true };
        }
        if (
            localProfile.preferences_onboarding_completed === true
            && serverProfile.preferences_onboarding_completed !== true
        ) {
            serverProfile = { ...serverProfile, preferences_onboarding_completed: true };
        }
        if (
            Array.isArray(localProfile.favorite_product_ids)
            && localProfile.favorite_product_ids.length
            && (!Array.isArray(serverProfile.favorite_product_ids) || !serverProfile.favorite_product_ids.length)
        ) {
            serverProfile = { ...serverProfile, favorite_product_ids: [...localProfile.favorite_product_ids] };
        }
        if (
            Array.isArray(localProfile.excluded_product_ids)
            && localProfile.excluded_product_ids.length
            && (!Array.isArray(serverProfile.excluded_product_ids) || !serverProfile.excluded_product_ids.length)
        ) {
            serverProfile = { ...serverProfile, excluded_product_ids: [...localProfile.excluded_product_ids] };
        }
    }

    return serverProfile || localProfile;
};

const DEFAULT_ROLLOUT_CONFIG: SpaRolloutConfig = {
    spa_enabled: false,
    phase_1_enabled: false,
    phase_2_enabled: false,
    phase_3_enabled: false,
    phase_4_enabled: false
};

let cachedRolloutConfig: SpaRolloutConfig | null = null;
const onboardingDebugLog = createOnboardingDebugLogger();

const loadRolloutConfig = async (): Promise<SpaRolloutConfig> => {
    if (cachedRolloutConfig) {
        return cachedRolloutConfig;
    }

    const fetcher = resolveApiFetch();
    const response = await fetcher('/api/app/config');
    if (!response.ok) {
        cachedRolloutConfig = { ...DEFAULT_ROLLOUT_CONFIG };
        return cachedRolloutConfig;
    }

    const data = (await response.json()) as AppConfigPayload;
    const rollout = data?.spa_rollout || {};
    cachedRolloutConfig = {
        spa_enabled: rollout.spa_enabled === true,
        phase_1_enabled: rollout.phase_1_enabled === true,
        phase_2_enabled: rollout.phase_2_enabled === true,
        phase_3_enabled: rollout.phase_3_enabled === true,
        phase_4_enabled: rollout.phase_4_enabled === true
    };
    return cachedRolloutConfig;
};

const isPhaseEnabled = (phase: 1 | 2 | 3 | 4, rollout: SpaRolloutConfig): boolean => {
    if (phase === 1) return rollout.phase_1_enabled;
    if (phase === 2) return rollout.phase_2_enabled;
    if (phase === 3) return rollout.phase_3_enabled;
    return rollout.phase_4_enabled;
};

const redirectToLegacyRoute = (targetPath: string): void => {
    window.location.replace(targetPath);
};

const buildGuardContext = async (to: RouteLocationNormalized): Promise<RouterGuardContext> => {
    const rollout = await loadRolloutConfig();
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

    return { session, profile, rollout };
};

router.beforeEach(async (to: RouteLocationNormalized, _from: RouteLocationNormalized, next: NavigationGuardNext) => {
    try {
        const { session, profile, rollout } = await buildGuardContext(to);

        if (!rollout.spa_enabled) {
            redirectToLegacyRoute(to.path);
            return;
        }

        const phase = to.meta.migrationPhase as (1 | 2 | 3 | 4 | undefined);
        if (phase && !isPhaseEnabled(phase, rollout)) {
            redirectToLegacyRoute(to.path);
            return;
        }

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
    // Reset scroll position on each SPA navigation.
    if (typeof window.scrollTo === 'function') {
        window.scrollTo(0, 0);
    }
    const scroller = document.querySelector('.app-content');
    if (scroller) {
        scroller.scrollTop = 0;
    }
});

export default router;
