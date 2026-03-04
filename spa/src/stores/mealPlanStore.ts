import { ref } from 'vue';
import { defineStore } from 'pinia';

export interface MealPlanItem {
    product_id?: number;
    name?: string;
    grams?: number;
    amount?: number;
    unit?: 'g' | 'ml';
    ml?: number;
    portion_is_dry?: boolean;
    cooked_grams_est?: number;
}

export interface MealPlanMeal {
    key?: string;
    title?: string;
    items?: MealPlanItem[];
    target_calories?: number | null;
    suggestion?: string | null;
}

export interface MealPlanPayload {
    meals?: MealPlanMeal[];
    targets?: {
        calories?: number;
        macros?: {
            protein_g?: number;
            fat_g?: number;
            carbs_g?: number;
        };
    };
    meta?: {
        pool_size?: number;
    };
    target_status?: string;
    targets_source?: string;
}

export type MealPlanRange = 'day' | 'week';

export const useMealPlanStore = defineStore('mealPlan', () => {
    const activeRange = ref<MealPlanRange>('day');
    const plans = ref<MealPlanPayload[]>([]);
    const isLoading = ref(true);
    const loadError = ref('');

    return {
        activeRange,
        plans,
        isLoading,
        loadError
    };
});
