import { ref } from 'vue';
import { defineStore } from 'pinia';
import type { DiaryEntryState, HabitEntriesState, ProfileState } from '../storage/storageTypes';
import { computeTargets as computeTargetsCore } from '../core/calculations';
import {
    apiFetch,
    awaitPendingProfilePatch,
    beginProfileTrace,
    clearProfileLocalCache as legacyClearProfileLocalCache,
    getDiaryEntries as legacyGetDiaryEntries,
    getHabitEntries as legacyGetHabitEntries,
    getPendingProfilePatchPromise,
    getProfileTraceId,
    getUserProfile as legacyGetUserProfile,
    normalizeLocalDate,
    patchUserProfile as legacyPatchUserProfile,
    patchUserProfileWithBackend as legacyPatchUserProfileWithBackend,
    setDiaryEntries as legacySetDiaryEntries,
    setHabitEntries as legacySetHabitEntries,
    setUserProfile as legacySetUserProfile,
    syncDiaryEntriesWithBackend as legacySyncDiaryEntriesWithBackend,
    syncHabitEntriesWithBackend as legacySyncHabitEntriesWithBackend,
    syncProfileWithBackend as legacySyncProfileWithBackend,
    syncSleepEntriesWithBackend as legacySyncSleepEntriesWithBackend,
    syncWaterEntriesWithBackend as legacySyncWaterEntriesWithBackend,
    validateGoalWeightConsistency
} from '../storage/storageService';

export interface PatchOptions {
    skipBackend?: boolean;
    skipRequiredValidation?: boolean;
    mode?: 'patch' | 'full';
}

export const useStorageStore = defineStore('storage', () => {
    // Source of truth: store state drives UI; storageService keeps legacy cache only.
    // Reactivity: every public call re-syncs cache into reactive refs, so UI updates without manual refresh.
    // РСЃС‚РѕС‡РЅРёРє РёСЃС‚РёРЅС‹ РґР»СЏ UI вЂ” СЃРѕСЃС‚РѕСЏРЅРёСЏ store. storageService С…СЂР°РЅРёС‚ С‚РѕР»СЊРєРѕ legacy-РєРµС€,
    // Р° store СЃРёРЅС…СЂРѕРЅРёР·РёСЂСѓРµС‚ РµРіРѕ РІ СЂРµР°РєС‚РёРІРЅС‹Рµ refs РїСЂРё РєР°Р¶РґРѕРј РІС‹Р·РѕРІРµ.
    const profile = ref<ProfileState>(legacyGetUserProfile());
    const diaryEntries = ref<DiaryEntryState[]>(legacyGetDiaryEntries());
    const habitEntries = ref<HabitEntriesState>(legacyGetHabitEntries());

    const setProfileState = (nextProfile: ProfileState | null | undefined): void => {
        profile.value = nextProfile && typeof nextProfile === 'object' ? { ...nextProfile } : {};
    };

    const setDiaryState = (entries: DiaryEntryState[] | null | undefined): void => {
        diaryEntries.value = Array.isArray(entries) ? entries.map((entry) => ({ ...entry })) : [];
    };

    const setHabitState = (entries: HabitEntriesState | null | undefined): void => {
        habitEntries.value = entries && typeof entries === 'object' ? { ...entries } : {};
    };

    const getUserProfile = (): ProfileState => {
        const nextProfile = legacyGetUserProfile();
        setProfileState(nextProfile);
        return nextProfile;
    };

    const setUserProfile = (nextProfile: ProfileState | null | undefined): ProfileState => {
        const updated = legacySetUserProfile(nextProfile as ProfileState);
        setProfileState(updated);
        return updated;
    };

    const patchUserProfile = (partial: Record<string, unknown> = {}, options: PatchOptions = {}): ProfileState => {
        const updated = legacyPatchUserProfile(partial, options);
        setProfileState(updated);
        return updated;
    };

    const patchUserProfileWithBackend = async (
        partial: Record<string, unknown> = {},
        options: PatchOptions = {}
    ): Promise<ProfileState | null> => {
        const updated = await legacyPatchUserProfileWithBackend(partial, options);
        if (updated) {
            setProfileState(updated);
        }
        return updated;
    };

    const syncProfileWithBackend = async (): Promise<ProfileState> => {
        await awaitPendingProfilePatch();
        const updated = await legacySyncProfileWithBackend();
        setProfileState(updated);
        return updated;
    };

    const clearProfileLocalCache = (): ProfileState => {
        const cleared = legacyClearProfileLocalCache();
        setProfileState(cleared);
        return cleared;
    };

    const getDiaryEntries = (): DiaryEntryState[] => {
        const entries = legacyGetDiaryEntries();
        setDiaryState(entries);
        return entries;
    };

    const setDiaryEntries = (
        entries: DiaryEntryState[] | null | undefined,
        options: { skipBackend?: boolean } = {}
    ): DiaryEntryState[] => {
        const updated = legacySetDiaryEntries(entries as DiaryEntryState[], options);
        setDiaryState(updated);
        return updated;
    };

    const syncDiaryEntriesWithBackend = async (): Promise<DiaryEntryState[]> => {
        const updated = await legacySyncDiaryEntriesWithBackend();
        setDiaryState(updated);
        return updated;
    };

    const syncWaterEntriesWithBackend = async (entries: DiaryEntryState[]): Promise<unknown> => {
        return legacySyncWaterEntriesWithBackend(entries);
    };

    const syncSleepEntriesWithBackend = async (entries: DiaryEntryState[]): Promise<unknown> => {
        return legacySyncSleepEntriesWithBackend(entries);
    };

    const getHabitEntries = (): HabitEntriesState => {
        const entries = legacyGetHabitEntries();
        setHabitState(entries);
        return entries;
    };

    const setHabitEntries = (
        entries: HabitEntriesState | null | undefined,
        options: { skipBackend?: boolean } = {}
    ): HabitEntriesState => {
        const updated = legacySetHabitEntries(entries as HabitEntriesState, options);
        setHabitState(updated);
        return updated;
    };

    const syncHabitEntriesWithBackend = async (): Promise<HabitEntriesState> => {
        const updated = await legacySyncHabitEntriesWithBackend();
        setHabitState(updated);
        return updated;
    };

    // Example of importing pure core calculations from store layer.
    const computeTargetsForProfile = (
        profileInput: Record<string, unknown> = profile.value as Record<string, unknown>,
        nowDate: Date | string | null = null,
        debug = false
    ): Record<string, unknown> => {
        return computeTargetsCore(profileInput, nowDate, {
            debug,
            normalizeLocalDate
        }) as Record<string, unknown>;
    };

    const runStorageSmokeCheck = async (options: { commit?: boolean } = {}) => {
        const commit = options.commit === true;
        const requests: Array<Record<string, unknown>> = [];
        let requestCounter = 0;
        const originalFetch = window.fetch.bind(window);
        const cloneValue = <T>(value: T): T => {
            if (typeof structuredClone === 'function') {
                return structuredClone(value);
            }
            return JSON.parse(JSON.stringify(value)) as T;
        };
        const snapshotState = () => ({
            profile: cloneValue(profile.value),
            diaryEntries: cloneValue(diaryEntries.value),
            habitEntries: cloneValue(habitEntries.value)
        });
        const normalizeHeaders = (headers?: HeadersInit): Record<string, string> => {
            if (!headers) {
                return {};
            }
            const result: Record<string, string> = {};
            if (headers instanceof Headers) {
                headers.forEach((value, key) => {
                    result[key] = value;
                });
                return result;
            }
            if (Array.isArray(headers)) {
                headers.forEach(([key, value]) => {
                    result[key] = String(value);
                });
                return result;
            }
            Object.entries(headers).forEach(([key, value]) => {
                if (value !== undefined) {
                    result[key] = String(value);
                }
            });
            return result;
        };
        const pickHeader = (headers: Record<string, string>, key: string): string | null => {
            const direct = headers[key];
            if (direct !== undefined) {
                return direct;
            }
            const matchedKey = Object.keys(headers).find((headerKey) => headerKey.toLowerCase() === key.toLowerCase());
            return matchedKey ? headers[matchedKey] : null;
        };
        const summarizeBody = (body?: BodyInit | null) => {
            if (!body) {
                return null;
            }
            if (typeof body === 'string') {
                try {
                    const parsed = JSON.parse(body);
                    const keys = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? Object.keys(parsed) : [];
                    return {
                        type: 'json',
                        key_count: keys.length,
                        keys: keys.slice(0, 20),
                        is_array: Array.isArray(parsed),
                        size_chars: body.length
                    };
                } catch {
                    return {
                        type: 'text',
                        length: body.length,
                        preview: body.slice(0, 200)
                    };
                }
            }
            if (body instanceof URLSearchParams) {
                const encoded = body.toString();
                return { type: 'urlencoded', size_chars: encoded.length, preview: encoded.slice(0, 200) };
            }
            if (body instanceof FormData) {
                const keys: string[] = [];
                body.forEach((_value, key) => keys.push(key));
                return { type: 'form-data', key_count: keys.length, keys: keys.slice(0, 20) };
            }
            return { type: typeof body };
        };
        window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
            const isRequest = typeof input !== 'string' && !(input instanceof URL);
            const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
            const method = init?.method || (isRequest ? input.method : 'GET');
            const rawHeaders = normalizeHeaders(init?.headers || (isRequest ? input.headers : undefined));
            const requestId = ++requestCounter;
            const keyHeaders: Record<string, string | null> = {
                'content-type': pickHeader(rawHeaders, 'content-type'),
                'x-telegram-init-data': pickHeader(rawHeaders, 'x-telegram-init-data'),
                accept: pickHeader(rawHeaders, 'accept')
            };
            const requestEntry: Record<string, unknown> = {
                id: requestId,
                method,
                url,
                key_headers: keyHeaders,
                headers: rawHeaders,
                payload_summary: summarizeBody(init?.body),
                started_at: new Date().toISOString()
            };
            const startedAt = Date.now();
            try {
                const response = await originalFetch(input, init);
                requestEntry.status = response.status;
                requestEntry.ok = response.ok;
                return response;
            } catch (error) {
                requestEntry.error = error instanceof Error ? error.message : String(error);
                throw error;
            } finally {
                requestEntry.duration_ms = Date.now() - startedAt;
                requests.push(requestEntry);
            }
        }) as typeof window.fetch;

        const windowInitData = typeof window.telegramInitData === 'string' ? window.telegramInitData.trim() : '';
        const telegramWebAppInitData = typeof window.Telegram?.WebApp?.initData === 'string'
            ? window.Telegram.WebApp.initData.trim()
            : '';

        const report: Record<string, unknown> = {
            ok: true,
            stages: [] as Array<Record<string, unknown>>,
            requests,
            telegram_init_data: {
                source: windowInitData ? 'window.telegramInitData' : (telegramWebAppInitData ? 'Telegram.WebApp.initData' : 'unavailable'),
                present: Boolean(windowInitData || telegramWebAppInitData)
            },
            before: snapshotState(),
            after: null as Record<string, unknown> | null
        };

        const logStage = (stage: string, payload: Record<string, unknown>) => {
            const entry = { stage, ...payload };
            (report.stages as Array<Record<string, unknown>>).push(entry);
            console.log('[STORAGE_SMOKE]', stage, payload);
        };

        try {
            logStage('state:before', { state: report.before as Record<string, unknown> });
            const snapshotProfile = getUserProfile();
            logStage('getProfile', { profile: snapshotProfile });

            if (commit) {
                const patched = await patchUserProfileWithBackend({
                    last_updated: snapshotProfile?.last_updated || new Date().toISOString()
                });
                logStage('patchProfile', { patched });
            } else {
                logStage('patchProfile', { skipped: true });
            }

            // РЎС†РµРЅР°СЂРёР№ РіРѕРЅРєРё: С‚СЂРё Р±С‹СЃС‚СЂС‹С… patch в†’ sync.
            const raceStamp = Date.now();
            const raceValues = [
                new Date(raceStamp).toISOString(),
                new Date(raceStamp + 5).toISOString(),
                new Date(raceStamp + 10).toISOString()
            ];
            raceValues.forEach((value) => {
                patchUserProfile({ last_updated: value });
            });
            const pendingPatch = getPendingProfilePatchPromise();
            logStage('race:patches', { values: raceValues, pendingPatch: Boolean(pendingPatch) });

            const syncedProfile = await syncProfileWithBackend();
            logStage('syncProfile', { profile: syncedProfile });

            const diarySnapshot = getDiaryEntries();
            logStage('getDiary', { count: diarySnapshot.length });

            const syncedDiary = await syncDiaryEntriesWithBackend();
            logStage('syncDiary', { count: syncedDiary.length });

            await syncWaterEntriesWithBackend(syncedDiary);
            logStage('syncWater', { ok: true });

            await syncSleepEntriesWithBackend(syncedDiary);
            logStage('syncSleep', { ok: true });

            const habitsSnapshot = getHabitEntries();
            logStage('getHabits', { keys: Object.keys(habitsSnapshot).length });

            const syncedHabits = await syncHabitEntriesWithBackend();
            logStage('syncHabits', { keys: Object.keys(syncedHabits).length });
        } catch (error) {
            report.ok = false;
            logStage('error', { message: error instanceof Error ? error.message : String(error) });
        } finally {
            report.after = snapshotState();
            logStage('state:after', { state: report.after as Record<string, unknown> });
            window.fetch = originalFetch;
        }

        return report;
    };

    const runSmokeCheck = runStorageSmokeCheck;

    return {
        profile,
        diaryEntries,
        habitEntries,
        apiFetch,
        beginProfileTrace,
        getProfileTraceId,
        normalizeLocalDate,
        validateGoalWeightConsistency,
        getUserProfile,
        setUserProfile,
        patchUserProfile,
        patchUserProfileWithBackend,
        syncProfileWithBackend,
        clearProfileLocalCache,
        getDiaryEntries,
        setDiaryEntries,
        syncDiaryEntriesWithBackend,
        syncWaterEntriesWithBackend,
        syncSleepEntriesWithBackend,
        getHabitEntries,
        setHabitEntries,
        syncHabitEntriesWithBackend,
        computeTargetsForProfile,
        // Exposed for diagnostics and ordered syncs.
        // РћР¶РёРґР°РЅРёРµ РїРѕСЃР»РµРґРЅРµРіРѕ patch РґРѕСЃС‚СѓРїРЅРѕ РґР»СЏ РІРЅРµС€РЅРµР№ РґРёР°РіРЅРѕСЃС‚РёРєРё.
        awaitPendingProfilePatch,
        runStorageSmokeCheck,
        runSmokeCheck
    };
});

