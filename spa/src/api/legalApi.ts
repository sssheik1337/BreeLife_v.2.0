import { createApiClient } from './httpClient';
import type { LegalOfferStatusResponse } from './contracts';

const api = createApiClient();

export const legalApi = {
    getCurrent: (): Promise<LegalOfferStatusResponse> => {
        return api.request<LegalOfferStatusResponse>('/api/legal/offer/current');
    },

    getStatus: (): Promise<LegalOfferStatusResponse> => {
        return api.request<LegalOfferStatusResponse>('/api/legal/offer/status');
    },

    acceptCurrent: (): Promise<LegalOfferStatusResponse> => {
        return api.request<LegalOfferStatusResponse>('/api/legal/offer/accept', {
            method: 'POST',
        });
    },
};
