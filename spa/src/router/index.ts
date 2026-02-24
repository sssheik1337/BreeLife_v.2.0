import { createRouter, createWebHistory, type NavigationGuardNext, type RouteLocationNormalized, type RouteRecordRaw } from 'vue-router';
import { h, type Component } from 'vue';
import { useAppStateStore, type ProfileState } from '../stores/appStateStore';
import { createOnboardingDebugLogger, evaluateOnboardingState } from '../domain/onboarding';

/**
 * Техническая заглушка для маршрутов, которые будут заменены
 * реальными SPA-экранами по мере миграции.
 */
const SpaRouteStubView: Component = {
    name: 'SpaRouteStubView',
    props: {
        routeName: {
            type: String,
            required: false,
            default: 'Экран SPA'
        }
    },
    setup(props) {
        return () => h('div', { class: 'spa-route-stub', style: 'padding: 16px;' }, `${props.routeName}: в процессе миграции`);
    }
};

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
        component: SpaRouteStubView,
        props: { routeName: 'Главная' },
        meta: ROUTE_META.publicEntry
    },
    {
        path: '/index',
        name: 'entry-index',
        component: SpaRouteStubView,
        props: { routeName: 'Главная (алиас)' },
        meta: ROUTE_META.publicEntry
    },
    {
        path: '/questionnaire',
        name: 'questionnaire',
        component: SpaRouteStubView,
        props: { routeName: 'Анкета' },
        meta: { ...ROUTE_META.questionnaire, migrationPhase: 3 } satisfies RouteMetaPolicy
    },
    {
        path: '/preferences-onboarding-choice',
        name: 'preferences-onboarding-choice',
        component: SpaRouteStubView,
        props: { routeName: 'Выбор онбординга предпочтений' },
        meta: {
            ...ROUTE_META.completedOnly,
            onboardingStep: 'choice',
            migrationPhase: 2
        } satisfies RouteMetaPolicy
    },
    {
        path: '/preferences-onboarding',
        name: 'preferences-onboarding',
        component: SpaRouteStubView,
        props: { routeName: 'Онбординг предпочтений' },
        meta: {
            ...ROUTE_META.completedOnly,
            onboardingStep: 'preferences',
            migrationPhase: 2
        } satisfies RouteMetaPolicy
    },
    {
        path: '/trial-start',
        name: 'trial-start',
        component: SpaRouteStubView,
        props: { routeName: 'Welcome триала' },
        meta: {
            ...ROUTE_META.completedOnly,
            onboardingStep: 'trial',
            migrationPhase: 2
        } satisfies RouteMetaPolicy
    },
    {
        path: '/resume',
        name: 'resume',
        component: SpaRouteStubView,
        props: { routeName: 'Профиль' },
        meta: { ...ROUTE_META.completedOnly, migrationPhase: 3 } satisfies RouteMetaPolicy
    },
    {
        path: '/profile',
        name: 'profile-progress',
        component: SpaRouteStubView,
        props: { routeName: 'Прогресс' },
        meta: { ...ROUTE_META.completedOnly, migrationPhase: 4 } satisfies RouteMetaPolicy
    },
    {
        path: '/profile.html',
        redirect: '/profile'
    },
    {
        path: '/diary',
        name: 'diary',
        component: SpaRouteStubView,
        props: { routeName: 'Дневник' },
        meta: { ...ROUTE_META.completedOnly, migrationPhase: 4 } satisfies RouteMetaPolicy
    },
    {
        path: '/food-diary',
        redirect: '/diary'
    },
    {
        path: '/foods',
        name: 'foods',
        component: SpaRouteStubView,
        props: { routeName: 'Продукты' },
        meta: { ...ROUTE_META.completedOnly, migrationPhase: 2 } satisfies RouteMetaPolicy
    },
    {
        path: '/my-products',
        name: 'my-products',
        component: SpaRouteStubView,
        props: { routeName: 'Мои продукты' },
        meta: { ...ROUTE_META.completedOnly, migrationPhase: 2 } satisfies RouteMetaPolicy
    },
    {
        path: '/meal-plan',
        name: 'meal-plan',
        component: SpaRouteStubView,
        props: { routeName: 'Рацион' },
        meta: {
            ...ROUTE_META.completedOnly,
            requiresProductsOnboarding: true,
            migrationPhase: 3
        } satisfies RouteMetaPolicy
    },
    {
        path: '/shopping-list',
        name: 'shopping-list',
        component: SpaRouteStubView,
        props: { routeName: 'Список покупок' },
        meta: {
            ...ROUTE_META.completedOnly,
            requiresProductsOnboarding: true,
            migrationPhase: 2
        } satisfies RouteMetaPolicy
    },
    {
        path: '/menu',
        name: 'menu',
        component: SpaRouteStubView,
        props: { routeName: 'Меню' },
        meta: { ...ROUTE_META.completedOnly, migrationPhase: 1 } satisfies RouteMetaPolicy
    },
    {
        path: '/references',
        name: 'references',
        component: SpaRouteStubView,
        props: { routeName: 'Справка' },
        meta: { ...ROUTE_META.completedOnly, migrationPhase: 1 } satisfies RouteMetaPolicy
    },
    {
        path: '/support',
        name: 'support',
        component: SpaRouteStubView,
        props: { routeName: 'Поддержка' },
        meta: { ...ROUTE_META.completedOnly, migrationPhase: 1 } satisfies RouteMetaPolicy
    },
    {
        path: '/plans',
        name: 'plans',
        component: SpaRouteStubView,
        props: { routeName: 'Тарифы' },
        meta: { ...ROUTE_META.completedOnly, migrationPhase: 1 } satisfies RouteMetaPolicy
    },
    {
        path: '/settings/reminders',
        name: 'settings-reminders',
        component: SpaRouteStubView,
        props: { routeName: 'Напоминания' },
        meta: { ...ROUTE_META.completedOnly, migrationPhase: 1 } satisfies RouteMetaPolicy
    }
];

const router = createRouter({
    // SPA работает под backend-роутом `/app`, поэтому задаём history base.
    history: createWebHistory('/app'),
    routes
});

/**
 * Используем общий fetch из legacy-слоя, если он уже проброшен bridge.
 */
const resolveApiFetch = (): typeof fetch => {
    if (typeof window.apiFetch === 'function') {
        return window.apiFetch;
    }
    return window.fetch.bind(window);
};

/**
 * Запрашивает базовый session-статус для route guards.
 */
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
    return {
        authorized: data?.authorized === true,
        profile_completed: data?.profile_completed === true,
        telegram_user_id: typeof data?.telegram_user_id === 'number' ? data.telegram_user_id : null,
        first_name: typeof data?.first_name === 'string' ? data.first_name : null,
        last_name: typeof data?.last_name === 'string' ? data.last_name : null,
        username: typeof data?.username === 'string' ? data.username : null,
        photo_url: typeof data?.photo_url === 'string' ? data.photo_url : null
    };
};

/**
 * Загружает профиль только для тех guard-сценариев, где нужны поля онбординга.
 */
const loadProfileForGuards = async (): Promise<ProfileState | null> => {
    const fetcher = resolveApiFetch();
    const response = await fetcher('/api/profile');
    if (!response.ok) {
        return null;
    }
    const data = await response.json();
    return data && typeof data === 'object' ? (data as ProfileState) : null;
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
    // Быстрый rollback: уводим пользователя на legacy-страницу того же пути.
    window.location.replace(targetPath);
};

const buildGuardContext = async (to: RouteLocationNormalized): Promise<RouterGuardContext> => {
    const rollout = await loadRolloutConfig();
    const session = await loadSessionStatus();
    const needsProfile = Boolean(
        to.meta.onboardingStep
        || to.meta.requiresProductsOnboarding
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

/**
 * Единый guard с паритетом текущего backend/ui-поведения.
 */
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
    } catch (error) {
        // На время миграции оставляем backend HTML-роуты как fallback:
        // при сбое guard не блокируем переход, чтобы пользователь мог продолжить работу.
        next();
    }
});

export default router;
