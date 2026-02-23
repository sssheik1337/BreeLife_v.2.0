import { computed, ref } from 'vue';
import { defineStore } from 'pinia';

/**
 * Снимок авторизации пользователя с бэкенда.
 * Поля совпадают с текущим payload `window.serverUser`.
 */
export interface ServerUserState {
    authorized: boolean;
    telegram_user_id: number | null;
    profile_completed: boolean;
    first_name: string | null;
    last_name: string | null;
    username: string | null;
    photo_url: string | null;
}

/**
 * Текущий формат профиля совместим с legacy-структурой,
 * поэтому не ограничиваем схему жёстко на этом этапе миграции.
 */
export type ProfileState = Record<string, unknown>;

/**
 * Текущий формат записи дневника совместим с legacy-структурой.
 */
export type DiaryEntryState = Record<string, unknown>;

/**
 * Текущий формат записи привычек совместим с legacy-структурой.
 */
export type HabitEntryState = Record<string, unknown>;

const DEFAULT_SERVER_USER: ServerUserState = {
    authorized: false,
    telegram_user_id: null,
    profile_completed: false,
    first_name: null,
    last_name: null,
    username: null,
    photo_url: null
};

/**
 * Единый Pinia-store для ключевого состояния приложения на этапе SPA-миграции.
 */
export const useAppStateStore = defineStore('appState', () => {
    const profile = ref<ProfileState>({});
    const diaryEntries = ref<DiaryEntryState[]>([]);
    const habitEntries = ref<HabitEntryState[]>([]);
    const serverUser = ref<ServerUserState>({ ...DEFAULT_SERVER_USER });
    const profileCompleted = ref(false);

    const isAuthorized = computed(() => serverUser.value.authorized === true);

    /**
     * Обновляет профиль без изменения ключей payload.
     */
    const setProfile = (nextProfile: ProfileState | null | undefined): void => {
        profile.value = nextProfile && typeof nextProfile === 'object' ? { ...nextProfile } : {};
    };

    /**
     * Обновляет записи дневника с копированием массива.
     */
    const setDiaryEntries = (entries: DiaryEntryState[] | null | undefined): void => {
        diaryEntries.value = Array.isArray(entries) ? entries.map((entry) => ({ ...entry })) : [];
    };

    /**
     * Обновляет записи привычек с копированием массива.
     */
    const setHabitEntries = (entries: HabitEntryState[] | null | undefined): void => {
        habitEntries.value = Array.isArray(entries) ? entries.map((entry) => ({ ...entry })) : [];
    };

    /**
     * Обновляет статус пользователя так, чтобы ключи payload оставались прежними.
     */
    const setServerUser = (nextServerUser: Partial<ServerUserState> | null | undefined): void => {
        serverUser.value = {
            ...DEFAULT_SERVER_USER,
            ...(nextServerUser || {})
        };
    };

    /**
     * Синхронизирует флаг завершённости профиля для роут-guards и legacy-экрана.
     */
    const setProfileCompleted = (value: unknown): void => {
        profileCompleted.value = value === true;
    };

    /**
     * Инициализирует store текущим window-снимком для плавной миграции.
     */
    const hydrateFromLegacyWindow = (legacyWindow: Record<string, unknown>): void => {
        const legacy = legacyWindow as any;
        if (legacy.serverUser && typeof legacy.serverUser === 'object') {
            setServerUser(legacy.serverUser as Partial<ServerUserState>);
        }
        if (legacy.profileCompleted !== undefined) {
            setProfileCompleted(legacy.profileCompleted);
        }
        if (typeof legacy.getUserProfile === 'function') {
            const snapshot = legacy.getUserProfile();
            if (snapshot && typeof snapshot === 'object') {
                setProfile(snapshot as ProfileState);
            }
        }
        if (typeof legacy.getDiaryEntries === 'function') {
            setDiaryEntries(legacy.getDiaryEntries() as DiaryEntryState[]);
        }
        if (typeof legacy.getHabitEntries === 'function') {
            setHabitEntries(legacy.getHabitEntries() as HabitEntryState[]);
        }
    };

    return {
        profile,
        diaryEntries,
        habitEntries,
        serverUser,
        profileCompleted,
        isAuthorized,
        setProfile,
        setDiaryEntries,
        setHabitEntries,
        setServerUser,
        setProfileCompleted,
        hydrateFromLegacyWindow
    };
});
