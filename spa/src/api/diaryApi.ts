import { createApiClient } from './httpClient';
import type { DiaryEntry, HabitCollection } from './contracts';

const api = createApiClient();

interface DiaryEntriesResponse {
    entries: DiaryEntry[];
}

interface HabitsResponse {
    habits: HabitCollection;
}

/**
 * Канонический API дневника/привычек для SPA.
 */
export const diaryApi = {
    getDiaryEntries: async (): Promise<DiaryEntry[]> => {
        const response = await api.request<DiaryEntriesResponse>('/api/diary');
        return Array.isArray(response.entries) ? response.entries : [];
    },

    saveDiaryEntries: async (entries: DiaryEntry[]): Promise<DiaryEntry[]> => {
        const response = await api.request<DiaryEntriesResponse>('/api/diary', {
            method: 'POST',
            body: { entries }
        });
        return Array.isArray(response.entries) ? response.entries : [];
    },

    getHabits: async (): Promise<HabitCollection> => {
        const response = await api.request<HabitsResponse>('/api/habits');
        return response.habits && typeof response.habits === 'object' ? response.habits : {};
    },

    saveHabits: async (entries: HabitCollection): Promise<HabitCollection> => {
        const response = await api.request<HabitsResponse>('/api/habits', {
            method: 'POST',
            body: { entries }
        });
        return response.habits && typeof response.habits === 'object' ? response.habits : {};
    }
};

/**
 * Адаптер совместимости для legacy-дубликатов.
 */
export const diaryApiLegacyAdapter = {
    getDiaryEntriesLegacy: async (): Promise<DiaryEntry[]> => {
        const response = await api.request<DiaryEntriesResponse>('/api/diary/get');
        return Array.isArray(response.entries) ? response.entries : [];
    },

    saveDiaryEntriesLegacy: async (entries: DiaryEntry[]): Promise<DiaryEntry[]> => {
        const response = await api.request<DiaryEntriesResponse>('/api/diary/save', {
            method: 'POST',
            body: { entries }
        });
        return Array.isArray(response.entries) ? response.entries : [];
    },

    getHabitsLegacy: async (): Promise<HabitCollection> => {
        const response = await api.request<HabitsResponse>('/api/habits/get');
        return response.habits && typeof response.habits === 'object' ? response.habits : {};
    },

    saveHabitsLegacy: async (entries: HabitCollection): Promise<HabitCollection> => {
        const response = await api.request<HabitsResponse>('/api/habits/save', {
            method: 'POST',
            body: { entries }
        });
        return response.habits && typeof response.habits === 'object' ? response.habits : {};
    }
};
