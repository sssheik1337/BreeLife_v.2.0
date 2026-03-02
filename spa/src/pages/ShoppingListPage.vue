<template>
    <section class="min-h-screen bg-gradient-to-br from-[#f8fafc] via-[#f0f9ff] to-[#f0fdf4]" data-spa-shopping-list>
        <main class="flex-1 px-4 py-8">
            <div class="max-w-md mx-auto space-y-8">
                <div class="text-center">
                    <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-400 mb-4 shadow-lg">
                        <i data-feather="shopping-cart" class="w-7 h-7 text-white"></i>
                    </div>
                    <h1 class="text-2xl font-bold text-slate-800">Список покупок</h1>
                    <p class="text-slate-500 mt-2">Собираем продукты по вашему рациону на день или неделю.</p>
                </div>

                <div class="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-3">
                    <div class="flex items-start justify-between gap-3">
                        <div>
                            <p class="text-sm text-slate-500">Диапазон</p>
                            <p class="text-sm text-slate-500">Список формируется из текущего плана питания.</p>
                        </div>
                        <div class="flex items-center gap-2">
                            <button
                                type="button"
                                data-shopping-range="day"
                                class="text-xs font-semibold px-3 py-1 rounded-full"
                                :class="activeRange === 'day' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'"
                                @click="activeRange = 'day'"
                            >День</button>
                            <button
                                type="button"
                                data-shopping-range="week"
                                class="text-xs font-semibold px-3 py-1 rounded-full"
                                :class="activeRange === 'week' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'"
                                @click="activeRange = 'week'"
                            >Неделя</button>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <button type="button" class="btn-secondary w-full" id="shopping-copy" @click="copyShoppingList">Скопировать список</button>
                        <button type="button" class="btn-secondary w-full" id="shopping-clear" @click="clearShoppingChecks">Очистить отметки</button>
                    </div>
                </div>

                <div id="shopping-list-container" class="space-y-6">
                    <p v-if="isLoading" class="text-center text-slate-400">Загрузка списка...</p>
                    <p v-else-if="loadError" class="text-center text-slate-400">{{ loadError }}</p>

                    <template v-else>
                        <p v-if="groupNames.length === 0" class="text-center text-slate-400">Сначала выберите продукты в рационе.</p>

                        <section
                            v-for="groupName in groupNames"
                            :key="groupName"
                            class="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-4"
                        >
                            <div class="flex items-center justify-between">
                                <h2 class="text-base font-semibold text-slate-800">{{ groupName }}</h2>
                                <span class="text-xs text-slate-400">{{ groupedShoppingList[groupName].length }} поз.</span>
                            </div>

                            <div class="space-y-3">
                                <label
                                    v-for="item in groupedShoppingList[groupName]"
                                    :key="buildCheckKey(item)"
                                    class="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"
                                >
                                    <div class="flex items-center gap-3">
                                        <input
                                            type="checkbox"
                                            class="form-checkbox"
                                            :checked="Boolean(shoppingChecks[buildCheckKey(item)])"
                                            :data-shopping-check="buildCheckKey(item)"
                                            @change="toggleShoppingCheck(buildCheckKey(item), ($event.target as HTMLInputElement).checked)"
                                        >
                                        <div>
                                            <div class="text-sm font-semibold text-slate-800">{{ item.name }}</div>
                                            <div class="text-xs text-slate-500">≈ {{ item.weight }} г • {{ item.count }} раз</div>
                                        </div>
                                    </div>
                                </label>
                            </div>
                        </section>
                    </template>
                </div>
            </div>
        </main>
    </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import { useStorageStore } from '../stores/storageStore';

interface Product {
    id: number;
    name: string;
    group?: string;
}

interface ShoppingAggregateItem {
    name: string;
    group: string;
    weight: number;
    count: number;
}

const SHOPPING_PRODUCTS_ENDPOINT = '/api/products';
const SHOPPING_DEFAULT_WEIGHT = 100;

const SHOPPING_MEAL_DISTRIBUTION = [
    { key: 'breakfast', title: 'Завтрак', share: 0.25, items: 2 },
    { key: 'lunch', title: 'Обед', share: 0.35, items: 3 },
    { key: 'snack', title: 'Перекус', share: 0.1, items: 2 },
    { key: 'dinner', title: 'Ужин', share: 0.3, items: 3 }
] as const;

const storageStore = useStorageStore();

const activeRange = ref<'day' | 'week'>('day');
const products = ref<Product[]>([]);
const shoppingChecks = ref<Record<string, boolean>>({});

const isLoading = ref(true);
const loadError = ref('');

const normalizeProfileIdSet = (value: unknown): Set<number> => {
    if (!Array.isArray(value)) {
        return new Set();
    }
    const normalized = value
        .map((item) => Number(item))
        .filter((item) => Number.isInteger(item));
    return new Set(normalized);
};

const buildPreferredProducts = (items: Product[]): Product[] => {
    const profile = storageStore.getUserProfile() as Record<string, unknown>;
    const favorites = normalizeProfileIdSet(profile?.favorite_product_ids);
    const excluded = normalizeProfileIdSet(profile?.excluded_product_ids);

    const available = items.filter((product) => !excluded.has(product.id));
    if (favorites.size > 0) {
        const favoriteProducts = available.filter((product) => favorites.has(product.id));
        if (favoriteProducts.length > 0) {
            return favoriteProducts;
        }
    }
    return available;
};

const pickItems = (list: Product[], startIndex: number, count: number): Product[] => {
    if (list.length === 0) {
        return [];
    }
    const items: Product[] = [];
    for (let index = 0; index < count; index += 1) {
        const itemIndex = (startIndex + index) % list.length;
        items.push(list[itemIndex]);
    }
    return items;
};

const buildDayPlan = (items: Product[], dayIndex: number) => {
    const sorted = [...items].sort((left, right) => {
        const leftGroup = left.group || '';
        const rightGroup = right.group || '';
        if (leftGroup === rightGroup) {
            return (left.name || '').localeCompare(right.name || '');
        }
        return leftGroup.localeCompare(rightGroup);
    });

    return SHOPPING_MEAL_DISTRIBUTION.map((meal, mealIndex) => {
        const startIndex = (dayIndex * 7 + mealIndex * 3) % Math.max(sorted.length, 1);
        return {
            title: meal.title,
            items: pickItems(sorted, startIndex, meal.items)
        };
    });
};

const buildShoppingList = (items: Product[], range: 'day' | 'week'): Record<string, ShoppingAggregateItem[]> => {
    const preferred = buildPreferredProducts(items);
    const days = range === 'week' ? 7 : 1;
    const totals = new Map<string, ShoppingAggregateItem>();

    for (let dayIndex = 0; dayIndex < days; dayIndex += 1) {
        const dayPlan = buildDayPlan(preferred, dayIndex);
        dayPlan.forEach((meal) => {
            meal.items.forEach((item) => {
                if (!item) {
                    return;
                }
                const key = `${item.group || 'Без группы'}::${item.name}`;
                const current = totals.get(key) || {
                    name: item.name,
                    group: item.group || 'Без группы',
                    weight: 0,
                    count: 0
                };
                current.weight += SHOPPING_DEFAULT_WEIGHT;
                current.count += 1;
                totals.set(key, current);
            });
        });
    }

    const grouped: Record<string, ShoppingAggregateItem[]> = {};
    totals.forEach((item) => {
        if (!grouped[item.group]) {
            grouped[item.group] = [];
        }
        grouped[item.group].push(item);
    });

    Object.keys(grouped).forEach((groupName) => {
        grouped[groupName].sort((left, right) => left.name.localeCompare(right.name));
    });

    return grouped;
};

const groupedShoppingList = computed(() => buildShoppingList(products.value, activeRange.value));
const groupNames = computed(() => Object.keys(groupedShoppingList.value));

const buildCheckKey = (item: ShoppingAggregateItem): string => `${item.group}::${item.name}`;

const toggleShoppingCheck = (key: string, checked: boolean): void => {
    const nextChecks = { ...shoppingChecks.value };
    if (checked) {
        nextChecks[key] = true;
    } else {
        delete nextChecks[key];
    }
    shoppingChecks.value = nextChecks;
};

const clearShoppingChecks = (): void => {
    shoppingChecks.value = {};
};

const notify = (message: string, type: 'success' | 'error'): void => {
    const showNotification = (window as any).showNotification;
    if (typeof showNotification === 'function') {
        showNotification(message, type);
        return;
    }
    if (type === 'error') {
        console.error(message);
    } else {
        console.log(message);
    }
};

const fallbackCopy = (text: string): void => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'absolute';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    try {
        document.execCommand('copy');
        notify('Список скопирован!', 'success');
    } catch {
        notify('Не удалось скопировать список.', 'error');
    }
    document.body.removeChild(textarea);
};

const copyShoppingList = async (): Promise<void> => {
    const lines: string[] = [];
    groupNames.value.forEach((groupName) => {
        lines.push(groupName);
        groupedShoppingList.value[groupName].forEach((item) => {
            lines.push(`- ${item.name}: в‰€ ${item.weight} Рі`);
        });
        lines.push('');
    });

    const text = lines.join('\n').trim();

    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        try {
            await navigator.clipboard.writeText(text);
            notify('Список скопирован!', 'success');
            return;
        } catch {
            fallbackCopy(text);
            return;
        }
    }

    fallbackCopy(text);
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
        const response = await storageStore.apiFetch(SHOPPING_PRODUCTS_ENDPOINT);
        if (!response.ok) {
            throw new Error('load_failed');
        }
        const payload = await response.json();
        products.value = Array.isArray(payload) ? payload as Product[] : [];
        await refreshIcons();
    } catch {
        loadError.value = 'Не удалось загрузить список покупок.';
    } finally {
        isLoading.value = false;
    }
};

onMounted(async () => {
    document.body.dataset.preservePageTheme = 'true';
    storageStore.getUserProfile();
    await fetchProducts();
});
</script>
