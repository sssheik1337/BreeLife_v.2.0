import { createApiClient } from './httpClient';

const api = createApiClient();

export interface OnboardingProduct {
    id: number;
    name: string;
    group: string;
    kcal: number;
}

export interface OnboardingProductsMeta {
    groups_total?: number;
    group_sample_size?: number;
    selection_strategy?: string;
}

export interface OnboardingProductsResponse {
    items: OnboardingProduct[];
    total: number;
    limit: number;
    meta?: OnboardingProductsMeta;
}

export const preferencesOnboardingApi = {
    getProducts: async (limit = 30): Promise<OnboardingProductsResponse> => {
        const response = await api.request<OnboardingProductsResponse>('/api/preferences/onboarding-products', {
            query: { limit }
        });

        const items = Array.isArray(response.items)
            ? response.items
                .filter((item) => item && typeof item.id === 'number')
                .map((item) => ({
                    id: item.id,
                    name: typeof item.name === 'string' && item.name.trim() ? item.name : 'Без названия',
                    group: typeof item.group === 'string' && item.group.trim() ? item.group : 'Без группы',
                    kcal: typeof item.kcal === 'number' ? item.kcal : 0
                }))
            : [];

        return {
            ...response,
            items
        };
    }
};

