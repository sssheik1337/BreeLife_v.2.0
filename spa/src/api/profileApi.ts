import { createApiClient } from './httpClient';
import type { UserProfile } from './contracts';

const api = createApiClient();

/**
 * Канонический API для профиля (используется новым SPA-кодом).
 */
export const profileApi = {
    getProfile: (): Promise<UserProfile> => {
        return api.request<UserProfile>('/api/profile');
    },

    saveProfilePatch: (patch: Partial<UserProfile>): Promise<UserProfile> => {
        return api.request<UserProfile>('/api/profile/save', {
            method: 'POST',
            body: patch
        });
    },

    sendPreferencesOnboardingEvent: (payload: Record<string, unknown>): Promise<Record<string, unknown>> => {
        return api.request<Record<string, unknown>>('/api/preferences/onboarding/event', {
            method: 'POST',
            body: payload
        });
    }
};

/**
 * Адаптер совместимости для legacy-дубликатов.
 * Новый SPA-код не должен использовать эти методы напрямую.
 */
export const profileApiLegacyAdapter = {
    getProfileByPost: (): Promise<UserProfile> => {
        return api.request<UserProfile>('/api/profile', { method: 'POST' });
    },

    getProfileByLegacyGet: (): Promise<UserProfile> => {
        return api.request<UserProfile>('/api/profile/get');
    }
};
