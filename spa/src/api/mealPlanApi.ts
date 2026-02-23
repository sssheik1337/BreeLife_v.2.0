import { createApiClient } from './httpClient';
import type { MealPlanDayResponse, MealPlanWeekResponse } from './contracts';

const api = createApiClient();

/**
 * Канонический API рациона для SPA.
 */
export const mealPlanApi = {
    getDay: (date?: string): Promise<MealPlanDayResponse> => {
        return api.request<MealPlanDayResponse>('/api/meal-plan', {
            query: {
                date
            }
        });
    },

    getWeek: (weekStart?: string): Promise<MealPlanWeekResponse> => {
        return api.request<MealPlanWeekResponse>('/api/meal-plan/week', {
            query: {
                week_start: weekStart
            }
        });
    }
};
