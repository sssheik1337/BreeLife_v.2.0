import { createRouter, createWebHistory, type NavigationGuardNext, type RouteLocationNormalized, type RouteRecordRaw } from 'vue-router';
import { h, type Component } from 'vue';
import { useAppStateStore, type ProfileState } from '../stores/appStateStore';

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
        meta: ROUTE_META.questionnaire
    },
    {
        path: '/preferences-onboarding-choice',
        name: 'preferences-onboarding-choice',
        component: SpaRouteStubView,
        props: { routeName: 'Выбор онбординга предпочтений' },
        meta: {
            ...ROUTE_META.completedOnly,
            onboardingStep: 'choice'
        } satisfies RouteMetaPolicy
    },
    {
        path: '/preferences-onboarding',
        name: 'preferences-onboarding',
        component: SpaRouteStubView,
        props: { routeName: 'Онбординг предпочтений' },
        meta: {
            ...ROUTE_META.completedOnly,
            onboardingStep: 'preferences'
        } satisfies RouteMetaPolicy
    },
    {
        path: '/trial-start',
        name: 'trial-start',
        component: SpaRouteStubView,
        props: { routeName: 'Welcome триала' },
        meta: {
            ...ROUTE_META.completedOnly,
            onboardingStep: 'trial'
        } satisfies RouteMetaPolicy
    },
    {
        path: '/resume',
        name: 'resume',
        component: SpaRouteStubView,
        props: { routeName: 'Профиль' },
        meta: ROUTE_META.completedOnly
    },
    {
        path: '/profile',
        name: 'profile-progress',
        component: SpaRouteStubView,
        props: { routeName: 'Прогресс' },
        meta: ROUTE_META.completedOnly
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
        meta: ROUTE_META.completedOnly
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
        meta: ROUTE_META.completedOnly
    },
    {
        path: '/my-products',
        name: 'my-products',
        component: SpaRouteStubView,
        props: { routeName: 'Мои продукты' },
        meta: ROUTE_META.completedOnly
    },
    {
        path: '/meal-plan',
        name: 'meal-plan',
        component: SpaRouteStubView,
        props: { routeName: 'Рацион' },
        meta: {
            ...ROUTE_META.completedOnly,
            requiresProductsOnboarding: true
        } satisfies RouteMetaPolicy
    },
    {
        path: '/shopping-list',
        name: 'shopping-list',
        component: SpaRouteStubView,
        props: { routeName: 'Список покупок' },
        meta: {
            ...ROUTE_META.completedOnly,
            requiresProductsOnboarding: true
        } satisfies RouteMetaPolicy
    },
    {
        path: '/menu',
        name: 'menu',
        component: SpaRouteStubView,
        props: { routeName: 'Меню' },
        meta: ROUTE_META.completedOnly
    },
    {
        path: '/references',
        name: 'references',
        component: SpaRouteStubView,
        props: { routeName: 'Справка' },
        meta: ROUTE_META.completedOnly
    },
    {
        path: '/support',
        name: 'support',
        component: SpaRouteStubView,
        props: { routeName: 'Поддержка' },
        meta: ROUTE_META.completedOnly
    },
    {
        path: '/plans',
        name: 'plans',
        component: SpaRouteStubView,
        props: { routeName: 'Тарифы' },
        meta: ROUTE_META.completedOnly
    },
    {
        path: '/settings/reminders',
        name: 'settings-reminders',
        component: SpaRouteStubView,
        props: { routeName: 'Напоминания' },
        meta: ROUTE_META.completedOnly
    }
];

const router = createRouter({
    history: createWebHistory(),
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

/**
 * Повторяет backend-правило: если онбординг завершён или есть списки,
 * считаем продуктовый шаг заполненным.
 */
const hasProductsOnboardingData = (profile: ProfileState | null): boolean => {
    if (!profile || typeof profile !== 'object') {
        return false;
    }
    const completed = profile.preferences_onboarding_completed === true;
    if (completed) {
        return true;
    }
    const favorites = Array.isArray(profile.favorite_product_ids) ? profile.favorite_product_ids : [];
    const excluded = Array.isArray(profile.excluded_product_ids) ? profile.excluded_product_ids : [];
    return favorites.length > 0 || excluded.length > 0;
};

/**
 * Повторяет backend-правило should_redirect_to_trial_start(...).
 */
const shouldRedirectToTrialStart = (profile: ProfileState | null): boolean => {
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

const buildGuardContext = async (to: RouteLocationNormalized): Promise<RouterGuardContext> => {
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

    return { session, profile };
};

/**
 * Единый guard с паритетом текущего backend/ui-поведения.
 */
router.beforeEach(async (to: RouteLocationNormalized, _from: RouteLocationNormalized, next: NavigationGuardNext) => {
    try {
        const { session, profile } = await buildGuardContext(to);
        const requiresAuth = to.meta.requiresAuth === true;
        const requiresCompletedProfile = to.meta.requiresCompletedProfile === true;

        if ((to.path === '/' || to.path === '/index') && session.profile_completed) {
            next('/profile');
            return;
        }

        if (requiresAuth && !session.authorized) {
            // Для неавторизованного пользователя возвращаем entry.
            next('/');
            return;
        }

        if (requiresCompletedProfile && !session.profile_completed) {
            next('/questionnaire');
            return;
        }

        if (to.meta.onboardingStep === 'choice') {
            if (profile?.preferences_onboarding_completed === true) {
                next('/trial-start');
                return;
            }
        }

        if (to.meta.onboardingStep === 'trial') {
            if (!shouldRedirectToTrialStart(profile)) {
                next('/profile');
                return;
            }
        }

        if (to.path === '/profile' && shouldRedirectToTrialStart(profile)) {
            next('/trial-start');
            return;
        }

        if (to.meta.requiresProductsOnboarding === true && !hasProductsOnboardingData(profile)) {
            next('/preferences-onboarding');
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
