import { createApiClient } from './httpClient';
import type { SubscriptionStatusResponse } from './contracts';

const api = createApiClient();

export interface StartPaymentPayload {
    plan_id: string;
}

export interface StartPaymentResponse {
    ok: boolean;
    provider?: string;
    payment_id?: string;
    confirmation_type?: string;
    confirmation_token?: string;
    confirmation_url?: string;
    return_url?: string;
    status?: string;
    local_payment_id?: number;
    plan?: {
        id: string;
        title: string;
        duration_days: number;
        amount_rub: number;
    };
}

export const subscriptionApi = {
    getStatus: (): Promise<SubscriptionStatusResponse> => {
        return api.request<SubscriptionStatusResponse>('/api/subscription/status');
    },

    startTrial: (): Promise<SubscriptionStatusResponse> => {
        return api.request<SubscriptionStatusResponse>('/api/subscription/start_trial', {
            method: 'POST'
        });
    },

    cancelSubscription: (): Promise<SubscriptionStatusResponse> => {
        return api.request<SubscriptionStatusResponse>('/api/subscription/cancel', {
            method: 'POST',
            body: { confirm: true }
        });
    },

    startPayment: (payload: StartPaymentPayload): Promise<StartPaymentResponse> => {
        return api.request<StartPaymentResponse>('/api/payments/start', {
            method: 'POST',
            body: payload
        });
    },

    syncLastPayment: (): Promise<Record<string, unknown>> => {
        return api.request<Record<string, unknown>>('/api/payments/sync-last', {
            method: 'POST'
        });
    },

    getPaymentStatus: (paymentId: string): Promise<Record<string, unknown>> => {
        return api.request<Record<string, unknown>>(`/api/payments/status/${encodeURIComponent(paymentId)}`);
    }
};
