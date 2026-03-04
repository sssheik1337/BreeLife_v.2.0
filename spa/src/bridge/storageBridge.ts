import type { Store } from 'pinia';
import type { DiaryEntryState, HabitEntriesState, ProfileState } from '../storage/storageTypes';
import { useStorageStore } from '../stores/storageStore';

export interface StorageBridge {
    apiFetch: typeof fetch;
    beginProfileTrace: (source?: string) => string;
    getProfileTraceId: () => string;
    getUserProfile: () => ProfileState;
    setUserProfile: (profile: ProfileState) => ProfileState;
    patchUserProfile: (partial: Record<string, unknown>, options?: Record<string, unknown>) => ProfileState;
    patchUserProfileWithBackend: (partial: Record<string, unknown>, options?: Record<string, unknown>) => Promise<ProfileState | null>;
    normalizeLocalDate: (value: string) => string | null;
    validateGoalWeightConsistency: (goal: string, currentWeight: number, targetWeight: number) => Record<string, unknown>;
    getDiaryEntries: () => DiaryEntryState[];
    setDiaryEntries: (entries: DiaryEntryState[], options?: Record<string, unknown>) => DiaryEntryState[];
    getHabitEntries: () => HabitEntriesState;
    setHabitEntries: (entries: HabitEntriesState, options?: Record<string, unknown>) => HabitEntriesState;
    syncProfileWithBackend: () => Promise<ProfileState>;
    syncDiaryEntriesWithBackend: () => Promise<DiaryEntryState[]>;
    syncWaterEntriesWithBackend: (entries: DiaryEntryState[]) => Promise<unknown>;
    syncSleepEntriesWithBackend: (entries: DiaryEntryState[]) => Promise<unknown>;
    syncHabitEntriesWithBackend: () => Promise<HabitEntriesState>;
    runStorageSmokeCheck: (options?: { commit?: boolean }) => Promise<Record<string, unknown>>;
    runSmokeCheck: (options?: { commit?: boolean }) => Promise<Record<string, unknown>>;
}

declare global {
    interface Window {
        __SPA_STORAGE__?: StorageBridge;
        beginProfileTrace?: (source?: string) => string;
        getProfileTraceId?: () => string;
        getUserProfile?: () => ProfileState;
        setUserProfile?: (profile: ProfileState) => ProfileState;
        patchUserProfile?: (partial: Record<string, unknown>, options?: Record<string, unknown>) => ProfileState;
        patchUserProfileWithBackend?: (partial: Record<string, unknown>, options?: Record<string, unknown>) => Promise<ProfileState | null>;
        normalizeLocalDate?: (value: string) => string | null;
        validateGoalWeightConsistency?: (goal: string, currentWeight: number, targetWeight: number) => Record<string, unknown>;
        getDiaryEntries?: () => DiaryEntryState[];
        setDiaryEntries?: (entries: DiaryEntryState[], options?: Record<string, unknown>) => DiaryEntryState[];
        getHabitEntries?: () => HabitEntriesState;
        setHabitEntries?: (entries: HabitEntriesState, options?: Record<string, unknown>) => HabitEntriesState;
        syncProfileWithBackend?: () => Promise<ProfileState>;
        syncDiaryEntriesWithBackend?: () => Promise<DiaryEntryState[]>;
        syncWaterEntriesWithBackend?: (entries: DiaryEntryState[]) => Promise<unknown>;
        syncSleepEntriesWithBackend?: (entries: DiaryEntryState[]) => Promise<unknown>;
        syncHabitEntriesWithBackend?: () => Promise<HabitEntriesState>;
        runStorageSmokeCheck?: (options?: { commit?: boolean }) => Promise<Record<string, unknown>>;
        runSmokeCheck?: (options?: { commit?: boolean }) => Promise<Record<string, unknown>>;
    }
}

export const installStorageBridge = (targetWindow: Window = window, store?: Store): StorageBridge => {
    const storageStore = store ? (store as ReturnType<typeof useStorageStore>) : useStorageStore();

    const bridge: StorageBridge = {
        apiFetch: storageStore.apiFetch,
        beginProfileTrace: storageStore.beginProfileTrace,
        getProfileTraceId: storageStore.getProfileTraceId,
        getUserProfile: storageStore.getUserProfile,
        setUserProfile: storageStore.setUserProfile,
        patchUserProfile: storageStore.patchUserProfile,
        patchUserProfileWithBackend: storageStore.patchUserProfileWithBackend,
        normalizeLocalDate: storageStore.normalizeLocalDate,
        validateGoalWeightConsistency: storageStore.validateGoalWeightConsistency,
        getDiaryEntries: storageStore.getDiaryEntries,
        setDiaryEntries: storageStore.setDiaryEntries,
        getHabitEntries: storageStore.getHabitEntries,
        setHabitEntries: storageStore.setHabitEntries,
        syncProfileWithBackend: storageStore.syncProfileWithBackend,
        syncDiaryEntriesWithBackend: storageStore.syncDiaryEntriesWithBackend,
        syncWaterEntriesWithBackend: storageStore.syncWaterEntriesWithBackend,
        syncSleepEntriesWithBackend: storageStore.syncSleepEntriesWithBackend,
        syncHabitEntriesWithBackend: storageStore.syncHabitEntriesWithBackend,
        runStorageSmokeCheck: storageStore.runStorageSmokeCheck,
        runSmokeCheck: storageStore.runSmokeCheck
    };

    targetWindow.__SPA_STORAGE__ = bridge;
    targetWindow.apiFetch = bridge.apiFetch;
    targetWindow.getUserProfile = bridge.getUserProfile;
    targetWindow.syncProfileWithBackend = bridge.syncProfileWithBackend;
    targetWindow.normalizeLocalDate = bridge.normalizeLocalDate;
    targetWindow.validateGoalWeightConsistency = bridge.validateGoalWeightConsistency;
    targetWindow.runStorageSmokeCheck = bridge.runStorageSmokeCheck;
    targetWindow.runSmokeCheck = bridge.runSmokeCheck;

    return bridge;
};
