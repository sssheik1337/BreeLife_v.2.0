import { ref } from 'vue';
import { defineStore } from 'pinia';

export interface FoodsProduct {
    id: number;
    name: string;
    group: string;
    brand?: string;
    health_level?: string;
    tags?: string[];
    kcal?: number;
    protein_g?: number;
    fat_g?: number;
    carbs_g?: number;
}

const PRODUCTS_ENDPOINT = '/api/products';

export const useFoodsStore = defineStore('foods', () => {
    const allProducts = ref<FoodsProduct[]>([]);
    const isLoading = ref(false);
    const loadError = ref('');

    const fetchProducts = async (fetchImpl: typeof fetch): Promise<FoodsProduct[]> => {
        isLoading.value = true;
        loadError.value = '';

        try {
            const response = await fetchImpl(PRODUCTS_ENDPOINT);
            if (!response.ok) {
                throw new Error('load_failed');
            }
            const payload = await response.json();
            allProducts.value = Array.isArray(payload) ? payload as FoodsProduct[] : [];
        } catch {
            allProducts.value = [];
            loadError.value = 'Не удалось загрузить список продуктов.';
        } finally {
            isLoading.value = false;
        }

        return allProducts.value;
    };

    return {
        allProducts,
        isLoading,
        loadError,
        fetchProducts
    };
});
