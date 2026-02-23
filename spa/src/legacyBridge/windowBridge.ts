import type {
    DiaryEntryState,
    HabitEntryState,
    ProfileState,
    ServerUserState
} from '../stores/appStateStore';
import { useAppStateStore } from '../stores/appStateStore';

/**
 * Тип fetch-функции для совместимости с legacy-кодом.
 */
export type LegacyApiFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/**
 * Минимальный набор global-методов, который оставляем на этапе миграции.
 * По мере переноса экранов ключи удаляются из bridge.
 */
export interface LegacyWindowBindings {
    apiFetch: LegacyApiFetch;
    getUserProfile: () => ProfileState;
    getDiaryEntries: () => DiaryEntryState[];
    getHabitEntries: () => HabitEntryState[];
    getServerUser: () => ServerUserState;
    getProfileCompleted: () => boolean;
}

/**
 * Параметры установки bridge.
 */
export interface InstallWindowBridgeOptions {
    /**
     * Если true, bridge не перезаписывает уже существующие legacy-методы.
     */
    preserveExisting?: boolean;
    /**
     * Пробрасываемый fetch-метод (например, обёртка с X-Telegram-Init-Data).
     */
    apiFetch?: LegacyApiFetch;
}

declare global {
    interface Window {
        apiFetch?: LegacyApiFetch;
        getUserProfile?: () => ProfileState;
        getDiaryEntries?: () => DiaryEntryState[];
        getHabitEntries?: () => HabitEntryState[];
        getServerUser?: () => ServerUserState;
        getProfileCompleted?: () => boolean;
    }
}

const BINDING_KEYS: Array<keyof LegacyWindowBindings> = [
    'apiFetch',
    'getUserProfile',
    'getDiaryEntries',
    'getHabitEntries',
    'getServerUser',
    'getProfileCompleted'
];

/**
 * Формирует minimal-bridge из Pinia-store в legacy window API.
 */
export const createLegacyBindings = (
    options: InstallWindowBridgeOptions = {}
): LegacyWindowBindings => {
    const store = useAppStateStore();

    return {
        apiFetch: options.apiFetch || window.fetch.bind(window),
        getUserProfile: () => ({ ...store.profile }),
        getDiaryEntries: () => store.diaryEntries.map((entry) => ({ ...entry })),
        getHabitEntries: () => store.habitEntries.map((entry) => ({ ...entry })),
        getServerUser: () => ({ ...store.serverUser }),
        getProfileCompleted: () => store.profileCompleted === true
    };
};

/**
 * Устанавливает минимально необходимые legacy-глобалы в window.
 */
export const installWindowBridge = (
    targetWindow: Window = window,
    options: InstallWindowBridgeOptions = {}
): LegacyWindowBindings => {
    const bindings = createLegacyBindings(options);
    const preserveExisting = options.preserveExisting === true;

    BINDING_KEYS.forEach((key) => {
        if (preserveExisting && typeof targetWindow[key] !== 'undefined') {
            return;
        }
        (targetWindow as any)[key] = bindings[key];
    });

    return bindings;
};

/**
 * Удаляет конкретный legacy-ключ после миграции экрана.
 */
export const removeLegacyBinding = (
    key: keyof LegacyWindowBindings,
    targetWindow: Window = window
): void => {
    delete (targetWindow as any)[key];
};

/**
 * Полностью снимает установленный bridge.
 */
export const uninstallWindowBridge = (targetWindow: Window = window): void => {
    BINDING_KEYS.forEach((key) => {
        delete (targetWindow as any)[key];
    });
};
