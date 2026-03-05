<template>
    <section class="min-h-screen bg-gradient-to-br from-[#f8fafc] via-[#f0f9ff] to-[#f0fdf4]" data-spa-shopping-list>
        <main class="flex-1 px-4 py-8">
            <div class="max-w-md mx-auto space-y-8">
                <div class="text-center">
                    <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-400 mb-4 shadow-lg">
                        <i data-feather="shopping-cart" class="w-7 h-7 text-white"></i>
                    </div>
                    <h1 class="text-2xl font-bold text-slate-800">Список покупок</h1>
                    <p class="text-slate-500 mt-2">Собираем продукты по сохраненному рациону на день или неделю.</p>
                </div>

                <div class="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-3">
                    <div class="flex items-start justify-between gap-3">
                        <div>
                            <p class="text-sm text-slate-500">Диапазон</p>
                            <p class="text-sm text-slate-500">Список формируется только из сохраненного плана питания.</p>
                        </div>
                        <div class="flex items-center gap-2">
                            <button
                                type="button"
                                class="text-xs font-semibold px-3 py-1 rounded-full"
                                :class="activeRange === 'day' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'"
                                @click="activeRange = 'day'"
                            >День</button>
                            <button
                                type="button"
                                class="text-xs font-semibold px-3 py-1 rounded-full"
                                :class="activeRange === 'week' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'"
                                @click="activeRange = 'week'"
                            >Неделя</button>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <button type="button" class="btn-secondary w-full" id="shopping-copy" @click="copyShoppingList">Скопировать список</button>
                    </div>
                </div>

                <div id="shopping-list-container" class="space-y-6">
                    <p v-if="isLoading" class="text-center text-slate-400">Загрузка списка...</p>
                    <p v-else-if="loadError" class="text-center text-slate-400">{{ loadError }}</p>

                    <template v-else>
                        <p v-if="!hasAnyItems" class="text-center text-slate-400">Сначала сохраните рацион, чтобы собрать список покупок.</p>

                        <section
                            v-for="group in foodGroups"
                            :key="group.name"
                            class="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-4"
                        >
                            <div class="flex items-center justify-between">
                                <h2 class="text-base font-semibold text-slate-800">{{ group.name }}</h2>
                                <span class="text-xs text-slate-400">{{ group.items.length }} поз.</span>
                            </div>

                            <div class="space-y-3">
                                <div
                                    v-for="item in group.items"
                                    :key="`${group.name}::${item.name}`"
                                    class="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"
                                >
                                    <div>
                                        <div class="text-sm font-semibold text-slate-800">{{ item.name }}</div>
                                        <div class="text-xs text-slate-500">≈ {{ item.amount }} {{ item.unit }} • {{ item.count }} раз</div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section
                            v-if="beverageItems.length > 0"
                            class="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-4"
                        >
                            <div class="flex items-center justify-between">
                                <h2 class="text-base font-semibold text-slate-800">Напитки</h2>
                                <span class="text-xs text-slate-400">{{ beverageItems.length }} поз.</span>
                            </div>

                            <div class="space-y-3">
                                <div
                                    v-for="item in beverageItems"
                                    :key="`beverage::${item.name}`"
                                    class="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"
                                >
                                    <div>
                                        <div class="text-sm font-semibold text-slate-800">{{ item.name }}</div>
                                        <div class="text-xs text-slate-500">≈ {{ item.amount }} мл • {{ item.count }} раз</div>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </template>
                </div>
            </div>
        </main>
    </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useStorageStore } from '../stores/storageStore';

interface ShoppingListItem {
    product_id?: number | null;
    name: string;
    amount: number;
    unit: 'g' | 'ml';
    count: number;
}

interface ShoppingListGroup {
    name: string;
    items: ShoppingListItem[];
}

interface ShoppingListResponse {
    range: 'day' | 'week';
    date?: string;
    week_start?: string;
    days_used: number;
    missing_dates: string[];
    groups: ShoppingListGroup[];
    beverages: ShoppingListItem[];
}

const SHOPPING_LIST_V2_ENDPOINT = '/api/shopping-list/v2';
const MEAL_PLAN_WEEK_V2_ENDPOINT = '/api/meal-plan/v2/week';

const storageStore = useStorageStore();
const activeRange = ref<'day' | 'week'>('day');
const shoppingData = ref<ShoppingListResponse | null>(null);
const isLoading = ref(true);
const loadError = ref('');

const foodGroups = computed(() => shoppingData.value?.groups ?? []);
const beverageItems = computed(() => shoppingData.value?.beverages ?? []);
const hasAnyItems = computed(() => foodGroups.value.length > 0 || beverageItems.value.length > 0);

const buildTodayIsoDate = (): string => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const buildCurrentWeekStartIso = (): string => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    now.setDate(now.getDate() + diffToMonday);
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
    foodGroups.value.forEach((group) => {
        lines.push(group.name);
        group.items.forEach((item) => {
            lines.push(`- ${item.name}: ≈ ${item.amount} ${item.unit}`);
        });
        lines.push('');
    });

    if (beverageItems.value.length > 0) {
        lines.push('Напитки');
        beverageItems.value.forEach((item) => {
            lines.push(`- ${item.name}: ≈ ${item.amount} мл`);
        });
        lines.push('');
    }

    const text = lines.join('\n').trim();
    if (!text) {
        notify('Список пуст.', 'error');
        return;
    }

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

const ensureWeekMealPlan = async (weekStartIso: string): Promise<void> => {
    try {
        const response = await storageStore.apiFetch(
            `${MEAL_PLAN_WEEK_V2_ENDPOINT}?week_start=${encodeURIComponent(weekStartIso)}`
        );
        if (!response.ok) {
            console.warn('[shopping-list] failed to warm up week meal plan');
        }
    } catch {
        console.warn('[shopping-list] failed to warm up week meal plan');
    }
};

const fetchShoppingList = async (): Promise<void> => {
    isLoading.value = true;
    loadError.value = '';

    const params = new URLSearchParams();
    if (activeRange.value === 'week') {
        const weekStartIso = buildCurrentWeekStartIso();
        await ensureWeekMealPlan(weekStartIso);
        params.set('week_start', weekStartIso);
    } else {
        params.set('date', buildTodayIsoDate());
    }

    try {
        const response = await storageStore.apiFetch(`${SHOPPING_LIST_V2_ENDPOINT}?${params.toString()}`);
        if (!response.ok) {
            throw new Error('load_failed');
        }
        const payload = await response.json();
        shoppingData.value = (payload && typeof payload === 'object')
            ? payload as ShoppingListResponse
            : null;
        await refreshIcons();
    } catch {
        loadError.value = 'Не удалось загрузить список покупок.';
        shoppingData.value = null;
    } finally {
        isLoading.value = false;
    }
};

watch(activeRange, () => {
    void fetchShoppingList();
});

onMounted(async () => {
    document.body.dataset.preservePageTheme = 'true';
    storageStore.getUserProfile();
    await fetchShoppingList();
});
</script>
