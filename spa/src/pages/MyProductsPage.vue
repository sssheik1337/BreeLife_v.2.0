<template>
    <section class="min-h-screen bg-gradient-to-br from-[#f8fafc] via-[#f0f9ff] to-[#f0fdf4]" data-spa-my-products>
        <main class="flex-1 px-4 py-8">
            <div class="max-w-md mx-auto space-y-8">
                <div class="text-center">
                    <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-400 mb-4 shadow-lg">
                        <i data-feather="shopping-bag" class="w-7 h-7 text-white"></i>
                    </div>
                    <h1 class="text-2xl font-bold text-slate-800">Мои продукты</h1>
                    <p class="text-slate-500 mt-2">Отмечайте любимое и то, что не едите или вызывает аллергию.</p>
                    <RouterLink id="preferences-entrypoint" to="/preferences-onboarding" class="btn-secondary inline-flex items-center justify-center mt-4">
                        {{ preferencesEntrypointText }}
                    </RouterLink>
                </div>

                <div class="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-3">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm text-slate-500">Любимые</p>
                            <p id="favorites-count" class="text-lg font-semibold text-emerald-600">{{ favoriteIds.length }}</p>
                        </div>
                        <div>
                            <p class="text-sm text-slate-500">Исключено</p>
                            <p id="excluded-count" class="text-lg font-semibold text-rose-500">{{ excludedIds.length }}</p>
                        </div>
                        <div>
                            <p class="text-sm text-slate-500">В базе</p>
                            <p id="total-count" class="text-lg font-semibold text-slate-700">{{ filteredProducts.length }}</p>
                        </div>
                    </div>
                    <p class="text-xs text-slate-500">
                        Мы не используем отмеченные ограничения при составлении рациона и списка покупок.
                    </p>
                </div>

                <div class="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                    <input
                        id="my-products-search-input"
                        v-model="searchInput"
                        type="text"
                        class="form-input"
                        placeholder="Поиск по названию, группе или бренду..."
                    >
                </div>

                <div id="my-products-container" class="space-y-8">
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
                                class="group-toggle sticky top-2 z-10 w-full flex items-center justify-between gap-3 rounded-xl px-3 py-2 border border-slate-100 bg-white/90 backdrop-blur-sm shadow-sm transition-all duration-300 ease-out hover:bg-white active:scale-[0.99]"
                                :aria-expanded="isGroupExpanded(group.name) ? 'true' : 'false'"
                                @click="toggleGroup(group.name)"
                            >
                                <span class="group-toggle__title">{{ group.name }}</span>
                                <span class="group-toggle__pill">
                                    <Transition name="group-pill-text" mode="out-in">
                                        <span :key="isGroupExpanded(group.name) ? `expanded-${group.name}` : `collapsed-${group.name}`">
                                            {{ isGroupExpanded(group.name) ? `Показано ${group.visibleCount} из ${group.totalCount}` : 'Показать' }}
                                        </span>
                                    </Transition>
                                </span>
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
                                        <div class="flex items-start justify-between gap-3">
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

                                        <div class="flex flex-col gap-3 mt-4 text-sm text-slate-600">
                                            <label class="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    class="form-checkbox"
                                                    :checked="favoriteSet.has(product.id)"
                                                    data-preference="favorite"
                                                    @change="onPreferenceToggle(product.id, 'favorite', ($event.target as HTMLInputElement).checked)"
                                                >
                                                <span>❤️ Люблю</span>
                                            </label>
                                            <label class="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    class="form-checkbox"
                                                    :checked="excludedSet.has(product.id)"
                                                    data-preference="excluded"
                                                    @change="onPreferenceToggle(product.id, 'excluded', ($event.target as HTMLInputElement).checked)"
                                                >
                                                <span>🚫 Не ем / аллергия</span>
                                            </label>
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
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { useStorageStore } from '../stores/storageStore';

interface Product {
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

interface GroupEntry {
    name: string;
    totalCount: number;
    visibleCount: number;
    remainingCount: number;
    visibleProducts: Product[];
}

const PRODUCTS_ENDPOINT = '/api/products';
const GROUP_PAGE_SIZE = 12;
const SEARCH_DEBOUNCE_MS = 250;

const storageStore = useStorageStore();
const route = useRoute();
const router = useRouter();

const allProducts = ref<Product[]>([]);
const searchInput = ref('');
const appliedSearch = ref('');
const expandedGroups = ref<string[]>([]);
const visibleCountByGroup = ref<Record<string, number>>({});

const favoriteIds = ref<number[]>([]);
const excludedIds = ref<number[]>([]);

const isLoading = ref(true);
const loadError = ref('');
const debounceTimer = ref<number | null>(null);

const normalizeSearchValue = (value: string): string => value.trim().toLowerCase();

const normalizeIdArray = (value: unknown): number[] => {
    if (!Array.isArray(value)) {
        return [];
    }
    const ids = value
        .map((item) => Number(item))
        .filter((item) => Number.isInteger(item));
    return Array.from(new Set(ids));
};

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

const favoriteSet = computed(() => new Set(favoriteIds.value));
const excludedSet = computed(() => new Set(excludedIds.value));

const hasSelectedPreferences = computed(() => {
    const profile = storageStore.profile as Record<string, unknown>;
    return profile?.preferences_onboarding_completed === true || favoriteIds.value.length > 0 || excludedIds.value.length > 0;
});

const preferencesEntrypointText = computed(() => (hasSelectedPreferences.value ? 'Изменить предпочтения' : 'Настроить предпочтения'));

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

const getQueryParam = (value: unknown): string => {
    if (Array.isArray(value)) {
        return typeof value[0] === 'string' ? value[0] : '';
    }
    return typeof value === 'string' ? value : '';
};

const serializeExpandedGroups = (): string => {
    if (expandedGroups.value.length === 0) {
        return '';
    }
    return expandedGroups.value.map((value) => encodeURIComponent(value)).join(',');
};

const syncStateToUrl = (): void => {
    const normalizedQuery = normalizeSearchValue(searchInput.value);
    const groupsQuery = serializeExpandedGroups();
    const currentQ = getQueryParam(route.query.q);
    const currentGroups = getQueryParam(route.query.groups);

    if (currentQ === normalizedQuery && currentGroups === groupsQuery) {
        return;
    }

    const nextQuery: Record<string, string> = {};
    Object.entries(route.query).forEach(([key, value]) => {
        if (typeof value === 'string' && value) {
            nextQuery[key] = value;
        }
    });

    if (normalizedQuery) {
        nextQuery.q = normalizedQuery;
    } else {
        delete nextQuery.q;
    }

    if (groupsQuery) {
        nextQuery.groups = groupsQuery;
    } else {
        delete nextQuery.groups;
    }

    void router.replace({ query: nextQuery });
};

const hydrateExpandedGroupsFromRoute = (products: Product[]): void => {
    const rawGroups = getQueryParam(route.query.groups);
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

const hydratePreferencesFromProfile = async (): Promise<void> => {
    try {
        await storageStore.syncProfileWithBackend();
    } catch {
        // Fallback to local cache when backend sync is unavailable.
    }
    const profile = storageStore.getUserProfile() as Record<string, unknown>;
    favoriteIds.value = normalizeIdArray(profile.favorite_product_ids);
    excludedIds.value = normalizeIdArray(profile.excluded_product_ids);
};

const savePreferences = async (): Promise<void> => {
    try {
        const savedProfile = await storageStore.patchUserProfileWithBackend({
            favorite_product_ids: [...favoriteIds.value],
            excluded_product_ids: [...excludedIds.value],
            preferences_onboarding_completed: true
        });
        if (savedProfile && typeof savedProfile === 'object') {
            favoriteIds.value = normalizeIdArray((savedProfile as Record<string, unknown>).favorite_product_ids);
            excludedIds.value = normalizeIdArray((savedProfile as Record<string, unknown>).excluded_product_ids);
        }
    } catch {
        // Keep optimistic state; backend reconciliation will happen on next sync.
    }
};

const onPreferenceToggle = (productId: number, mode: 'favorite' | 'excluded', checked: boolean): void => {
    const nextFavorites = new Set(favoriteIds.value);
    const nextExcluded = new Set(excludedIds.value);

    if (mode === 'favorite') {
        if (checked) {
            nextFavorites.add(productId);
            nextExcluded.delete(productId);
        } else {
            nextFavorites.delete(productId);
        }
    } else {
        if (checked) {
            nextExcluded.add(productId);
            nextFavorites.delete(productId);
        } else {
            nextExcluded.delete(productId);
        }
    }

    favoriteIds.value = Array.from(nextFavorites);
    excludedIds.value = Array.from(nextExcluded);

    storageStore.patchUserProfile({
        favorite_product_ids: [...favoriteIds.value],
        excluded_product_ids: [...excludedIds.value],
        preferences_onboarding_completed: true
    });

    void savePreferences();
};

const refreshIcons = async (): Promise<void> => {
    await nextTick();
    const feather = (window as any).feather;
    if (typeof feather?.replace === 'function') {
        feather.replace();
    }
};

const fetchProducts = async (): Promise<void> => {
    isLoading.value = true;
    loadError.value = '';

    try {
        const response = await storageStore.apiFetch(PRODUCTS_ENDPOINT);
        if (!response.ok) {
            throw new Error('load_failed');
        }
        const payload = await response.json();
        allProducts.value = Array.isArray(payload) ? payload as Product[] : [];
        hydrateExpandedGroupsFromRoute(allProducts.value);
        await refreshIcons();
    } catch {
        loadError.value = 'Не удалось загрузить список продуктов.';
    } finally {
        isLoading.value = false;
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
    document.body.dataset.preservePageTheme = 'true';

    const initialQuery = normalizeSearchValue(getQueryParam(route.query.q));
    searchInput.value = initialQuery;
    appliedSearch.value = initialQuery;

    await hydratePreferencesFromProfile();
    await fetchProducts();
});

watch(
    () => route.query.q,
    (value) => {
        const normalized = normalizeSearchValue(getQueryParam(value));
        if (searchInput.value === normalized && appliedSearch.value === normalized) {
            return;
        }
        searchInput.value = normalized;
        appliedSearch.value = normalized;
    }
);

watch(
    () => route.query.groups,
    () => {
        hydrateExpandedGroupsFromRoute(allProducts.value);
    }
);

onBeforeUnmount(() => {
    if (debounceTimer.value !== null) {
        window.clearTimeout(debounceTimer.value);
    }
    delete document.body.dataset.preservePageTheme;
});
</script>

<style scoped>
.group-toggle {
    text-align: left;
}

.group-toggle__title {
    flex: 1;
    min-width: 0;
    color: #0f172a;
    font-size: 1rem;
    font-weight: 700;
    line-height: 1.3;
    text-align: left;
}

.group-toggle__pill {
    flex-shrink: 0;
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 9999px;
    border: 1px solid transparent;
    background: linear-gradient(135deg, #34d399 0%, #3b82f6 100%);
    color: #ffffff;
    font-size: 0.75rem;
    font-weight: 600;
    line-height: 1;
    white-space: nowrap;
    padding: 0.45rem 0.8rem;
    min-height: 34px;
    box-shadow: 0 8px 16px rgba(52, 211, 153, 0.24);
}

.group-pill-text-enter-active,
.group-pill-text-leave-active {
    transition: opacity 0.18s ease, transform 0.18s ease;
}

.group-pill-text-enter-from,
.group-pill-text-leave-to {
    opacity: 0;
    transform: translateY(2px);
}
</style>
