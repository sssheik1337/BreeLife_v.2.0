import { createApiClient } from './httpClient';
import type { ReminderEntity } from './contracts';

const api = createApiClient();

export interface ReminderSchedulePayload {
    type: string;
    when_iso: string;
}

export interface ReminderGeneratePayload {
    type: string;
    time: string;
    enabled: boolean;
}

export interface ReminderAutoGeneratePayload {
    type: string;
    timezone_offset: number;
}

/**
 * Канонический API напоминаний для SPA.
 */
export const remindersApi = {
    list: async (): Promise<ReminderEntity[]> => {
        const response = await api.request<{ reminders: ReminderEntity[] }>('/api/reminders/list');
        return Array.isArray(response.reminders) ? response.reminders : [];
    },

    schedule: (payload: ReminderSchedulePayload): Promise<{ scheduled: unknown }> => {
        return api.request<{ scheduled: unknown }>('/api/reminders/schedule', {
            method: 'POST',
            body: payload
        });
    },

    generate: (payload: ReminderGeneratePayload): Promise<ReminderEntity> => {
        return api.request<ReminderEntity>('/api/reminders/generate', {
            method: 'POST',
            body: payload
        });
    },

    autoGenerate: async (payload: ReminderAutoGeneratePayload): Promise<ReminderEntity[]> => {
        const response = await api.request<{ reminders: ReminderEntity[] }>('/api/reminders/auto-generate', {
            method: 'POST',
            body: payload
        });
        return Array.isArray(response.reminders) ? response.reminders : [];
    }
};
