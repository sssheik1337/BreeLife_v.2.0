import { createApiClient } from './httpClient';
import type { SubscriptionStatusResponse } from './contracts';

const api = createApiClient();

export interface StartPaymentPayload {
    plan_id: string;
}

/**
 * Канонический API подписки/оплаты для SPA.
 */
export const subscriptionApi = {
    getStatus: (): Promise<SubscriptionStatusResponse> => {
        return api.request<SubscriptionStatusResponse>('/api/subscription/status');
    },

    startTrial: (): Promise<SubscriptionStatusResponse> => {
        return api.request<SubscriptionStatusResponse>('/api/subscription/start_trial', {
            method: 'POST'
        });
    },

    startPayment: (payload: StartPaymentPayload): Promise<Record<string, unknown>> => {
        return api.request<Record<string, unknown>>('/api/payments/start', {
            method: 'POST',
            body: payload
        });
    }
};
