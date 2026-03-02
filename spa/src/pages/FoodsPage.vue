<template>
    <section class="min-h-screen bg-gradient-to-br from-[#f8fafc] via-[#f0f9ff] to-[#f0fdf4]">
        <main class="flex-1 px-4 py-8">
            <div class="max-w-md mx-auto space-y-8">
                <div class="text-center">
                    <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-400 mb-4 shadow-lg">
                        <i data-feather="coffee" class="w-7 h-7 text-white"></i>
                    </div>
                    <h1 class="text-2xl font-bold text-slate-800">Список продуктов</h1>
                    <p class="text-slate-500 mt-2">Подборка продуктов по группам и уровню полезности.</p>
                </div>

                <div class="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                    <input
                        id="foods-search-input"
                        v-model="searchInput"
                        type="text"
                        class="form-input"
                        placeholder="Поиск по названию, группе или бренду..."
                    >
                </div>

                <div id="foods-container" class="space-y-8">
                    <p v-if="isLoading" class="text-center text-slate-400">Загрузка...</p>
                    <p v-else-if="loadError" class="text-center text-slate-400">{{ loadError }}</p>
                    <template v-else>
                        <div
                            v-if="groupEntries.length === 0"
                            class="rounded-2xl border border-slate-100 bg-white p-6 text-center shadow-sm"
                        >
                            <p class="text-base font-semibold text-slate-700">{{ hasActiveSearch ? 'Ничего не найдено' : 'Пока нет продуктов' }}</p>
                            <p class="mt-2 text-sm text-slate-500">{{ hasActiveSearch ? 'Попробуйте изменить запрос по названию, группе или бренду.' : 'Список продуктов пока пуст. Вернитесь позже.' }}</p>
                        </div>

                        <section
                            v-for="group in groupEntries"
                            :key="group.name"
                            class="space-y-3 rounded-2xl border border-slate-100 bg-white/70 p-3 shadow-sm"
                        >
                            <button
                                type="button"
                                data-action="toggle-group"
                                class="sticky top-2 z-10 w-full flex items-center justify-between rounded-xl px-2 py-2 border border-slate-100 bg-white/90 backdrop-blur-sm shadow-sm transition-all duration-300 ease-out hover:bg-white active:scale-[0.99]"
                                :aria-expanded="isGroupExpanded(group.name) ? 'true' : 'false'"
                                @click="toggleGroup(group.name)"
                            >
                                <span class="flex items-center gap-3">
                                    <span class="text-lg font-semibold text-slate-800">{{ group.name }}</span>
                                    <span class="text-sm text-slate-400">{{ group.totalCount }} поз.</span>
                                    <span class="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                                        Показано {{ group.visibleCount }} из {{ group.totalCount }}
                                    </span>
                                </span>
                                <svg
                                    class="h-4 w-4 text-slate-400 transition-transform duration-300 ease-out"
                                    :class="{ 'rotate-180': isGroupExpanded(group.name) }"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                    aria-hidden="true"
                                >
                                    <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.51a.75.75 0 01-1.08 0l-4.25-4.51a.75.75 0 01.02-1.06z" clip-rule="evenodd" />
                                </svg>
                            </button>

                            <div
                                class="overflow-hidden transition-all duration-300 ease-out"
                                :style="isGroupExpanded(group.name)
                                    ? { maxHeight: '9999px', opacity: '1', transform: 'translateY(0px)' }
                                    : { maxHeight: '0px', opacity: '0', transform: 'translateY(-4px)' }"
                            >
                                <div class="grid grid-cols-1 gap-4 pt-2">
                                    <div
                                        v-for="product in group.visibleProducts"
                                        :key="product.id"
                                        class="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm"
                                    >
                                        <div class="flex items-center justify-between">
                                            <div>
                                                <div class="text-base font-semibold text-slate-800">{{ product.name }}</div>
                                                <div class="text-sm text-slate-500">{{ product.group }}</div>
                                            </div>
                                            <span
                                                class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                                                :class="healthIndicatorClass(product.health_level)"
                                            ></span>
                                        </div>

                                        <div class="mt-4 grid grid-cols-2 gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm text-slate-600">
                                            <div
                                                v-for="stat in nutritionStats(product)"
                                                :key="`${product.id}-${stat.label}`"
                                                class="flex items-center justify-between gap-2"
                                            >
                                                <span class="text-slate-500">{{ stat.label }}</span>
                                                <span class="font-semibold text-slate-700">{{ stat.value }}</span>
                                            </div>
                                        </div>

                                        <div class="flex flex-wrap gap-2 mt-4">
                                            <span
                                                v-if="hasFiberTag(product)"
                                                class="px-2 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-600"
                                            >клетчатка</span>
                                            <span
                                                v-for="tag in filteredTags(product.tags)"
                                                :key="`${product.id}-${tag}`"
                                                class="px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600"
                                            >{{ tag }}</span>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    v-if="group.remainingCount > 0"
                                    type="button"
                                    class="btn-secondary w-full text-sm transition-all duration-300 ease-out"
                                    @click="showMore(group.name, group.totalCount)"
                                >
                                    Показать ещё ({{ group.remainingCount }})
                                </button>
                            </div>
                        </section>
                    </template>
                </div>
            </div>
        </main>
    </section>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useFoodsStore, type FoodsProduct } from '../stores/foodsStore';
import { useStorageStore } from '../stores/storageStore';

type Product = FoodsProduct;

interface GroupEntry {
    name: string;
    totalCount: number;
    visibleCount: number;
    remainingCount: number;
    visibleProducts: Product[];
}

const GROUP_PAGE_SIZE = 12;
const SEARCH_DEBOUNCE_MS = 250;

const route = useRoute();
const router = useRouter();
const storageStore = useStorageStore();
const foodsStore = useFoodsStore();
const { allProducts, isLoading, loadError } = storeToRefs(foodsStore);

const searchInput = ref('');
const appliedSearch = ref('');
const expandedGroups = ref<string[]>([]);
const visibleCountByGroup = ref<Record<string, number>>({});

const debounceTimer = ref<number | null>(null);

const normalizeSearchValue = (value: string): string => value.trim().toLowerCase();

const normalizeTags = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item) => typeof item === 'string') as string[] : []);

const groupBy = (items: Product[]): Record<string, Product[]> => {
    return items.reduce<Record<string, Product[]>>((result, item) => {
        const groupName = item.group || 'Без группы';
        if (!result[groupName]) {
            result[groupName] = [];
        }
        result[groupName].push(item);
        return result;
    }, {});
};

const isInteger = (value: unknown): value is number => Number.isInteger(value);

const hasActiveSearch = computed(() => appliedSearch.value.length > 0);

const filteredProducts = computed<Product[]>(() => {
    if (!appliedSearch.value) {
        return allProducts.value;
    }
    return allProducts.value.filter((product) => {
        const name = String(product?.name || '').toLowerCase();
        const group = String(product?.group || '').toLowerCase();
        const brand = String(product?.brand || '').toLowerCase();
        return name.includes(appliedSearch.value) || group.includes(appliedSearch.value) || brand.includes(appliedSearch.value);
    });
});

const groupEntries = computed<GroupEntry[]>(() => {
    const entries = Object.entries(groupBy(filteredProducts.value));
    return entries.map(([name, products]) => {
        const defaultVisibleCount = Math.min(GROUP_PAGE_SIZE, products.length);
        const stored = visibleCountByGroup.value[name];
        const visibleCount = isInteger(stored)
            ? Math.max(defaultVisibleCount, Math.min(stored, products.length))
            : defaultVisibleCount;
        return {
            name,
            totalCount: products.length,
            visibleCount,
            remainingCount: Math.max(0, products.length - visibleCount),
            visibleProducts: products.slice(0, visibleCount)
        };
    });
});

const syncStateToUrl = (): void => {
    const normalizedQuery = normalizeSearchValue(searchInput.value);
    const groupsValue = expandedGroups.value.length > 0 ? expandedGroups.value.join(',') : '';
    const currentQueryValue = typeof route.query.q === 'string' ? normalizeSearchValue(route.query.q) : '';
    const currentGroupsValue = typeof route.query.groups === 'string' ? route.query.groups : '';

    if (normalizedQuery === currentQueryValue && groupsValue === currentGroupsValue) {
        return;
    }

    const query: Record<string, string> = {};
    if (normalizedQuery) {
        query.q = normalizedQuery;
    }
    if (groupsValue) {
        query.groups = groupsValue;
    }
    void router.replace({ path: '/foods', query });
};

const hydrateExpandedGroupsFromUrl = (products: Product[]): void => {
    const rawGroups = typeof route.query.groups === 'string' ? route.query.groups : '';
    if (!rawGroups) {
        expandedGroups.value = [];
        return;
    }
    const groups = new Set(Object.keys(groupBy(products)));
    const parsed = rawGroups
        .split(',')
        .map((value) => decodeURIComponent(value).trim())
        .filter((value) => value && groups.has(value));
    expandedGroups.value = Array.from(new Set(parsed));
};

const isGroupExpanded = (groupName: string): boolean => {
    if (hasActiveSearch.value) {
        return true;
    }
    return expandedGroups.value.includes(groupName);
};

const toggleGroup = (groupName: string): void => {
    const current = new Set(expandedGroups.value);
    if (current.has(groupName)) {
        current.delete(groupName);
    } else {
        current.add(groupName);
    }
    expandedGroups.value = Array.from(current);
    syncStateToUrl();
};

const showMore = (groupName: string, totalCount: number): void => {
    const defaultVisibleCount = Math.min(GROUP_PAGE_SIZE, totalCount);
    const currentValue = visibleCountByGroup.value[groupName];
    const currentVisibleCount = isInteger(currentValue) ? currentValue : defaultVisibleCount;
    visibleCountByGroup.value = {
        ...visibleCountByGroup.value,
        [groupName]: Math.min(currentVisibleCount + GROUP_PAGE_SIZE, totalCount)
    };
};

const formatNutritionValue = (value: unknown, suffix: string): string => {
    const numberValue = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(numberValue)) {
        return 'вЂ”';
    }
    const normalized = Number.isInteger(numberValue) ? String(numberValue) : numberValue.toFixed(1);
    return `${normalized} ${suffix}`;
};

const nutritionStats = (product: Product): Array<{ label: string; value: string }> => {
    return [
        { label: 'Ккал', value: formatNutritionValue(product.kcal, 'ккал') },
        { label: 'Белки', value: formatNutritionValue(product.protein_g, 'г') },
        { label: 'Жиры', value: formatNutritionValue(product.fat_g, 'г') },
        { label: 'Углеводы', value: formatNutritionValue(product.carbs_g, 'г') }
    ];
};

const healthIndicatorClass = (level: string | undefined): string => {
    if (level === 'good') return 'bg-emerald-100 text-emerald-700';
    if (level === 'medium') return 'bg-amber-100 text-amber-700';
    if (level === 'bad') return 'bg-rose-100 text-rose-700';
    return 'bg-slate-100 text-slate-600';
};

const hasFiberTag = (product: Product): boolean => normalizeTags(product.tags).includes('клетчатка');

const filteredTags = (tags: unknown): string[] => normalizeTags(tags).filter((tag) => tag !== 'клетчатка');

const refreshIcons = async (): Promise<void> => {
    await nextTick();
    const feather = (window as any).feather;
    if (typeof feather?.replace === 'function') {
        feather.replace();
    }
};

const fetchProducts = async (): Promise<void> => {
    const products = await foodsStore.fetchProducts(storageStore.apiFetch);
    if (!loadError.value) {
        hydrateExpandedGroupsFromUrl(products);
        await refreshIcons();
    }
};

watch(
    () => normalizeSearchValue(searchInput.value),
    (query) => {
        syncStateToUrl();
        if (debounceTimer.value !== null) {
            window.clearTimeout(debounceTimer.value);
        }
        debounceTimer.value = window.setTimeout(() => {
            appliedSearch.value = query;
        }, SEARCH_DEBOUNCE_MS);
    }
);

onMounted(async () => {
    const initialQuery = typeof route.query.q === 'string'
        ? normalizeSearchValue(route.query.q)
        : '';
    searchInput.value = initialQuery;
    appliedSearch.value = initialQuery;

    await fetchProducts();
});

onBeforeUnmount(() => {
    if (debounceTimer.value !== null) {
        window.clearTimeout(debounceTimer.value);
    }
});
</script>
