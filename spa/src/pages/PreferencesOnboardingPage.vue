<template>
    <section class="min-h-screen bg-gradient-to-br from-[#f8fafc] via-[#f0f9ff] to-[#f0fdf4]" data-spa-preferences-onboarding>
        <main class="flex-1 px-4 py-8">
            <div class="max-w-5xl mx-auto space-y-6">
                <div class="text-center">
                    <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-400 mb-4 shadow-lg">
                        <i data-feather="heart" class="w-7 h-7 text-white"></i>
                    </div>
                    <h1 class="text-2xl font-bold text-slate-800">Соберем ваши любимые продукты</h1>
                    <p class="text-slate-500 mt-2">Это поможет собрать рацион, который действительно вам подходит.</p>
                </div>

                <section v-if="step === 'categories'" class="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-4">
                    <div class="space-y-1 text-center">
                        <p class="text-sm font-semibold text-slate-700">Шаг 1 из 2</p>
                        <p class="text-slate-600">Выберите минимум 3 категории продуктов. Затем перейдете к выбору конкретных продуктов.</p>
                    </div>

                    <div v-if="allCategories.length" class="grid grid-cols-2 md:grid-cols-3 gap-2">
                        <button
                            v-for="category in allCategories"
                            :key="category"
                            type="button"
                            class="category-chip rounded-xl border px-3 py-2 text-sm font-semibold transition-all duration-200 text-center"
                            :class="{ 'is-selected': selectedCategorySet.has(category) }"
                            @click="toggleCategory(category)"
                        >
                            {{ category }}
                        </button>
                    </div>

                    <div v-else class="rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm text-slate-500 text-center">
                        Не удалось загрузить категории продуктов.
                    </div>

                    <div class="flex items-center justify-between pt-2">
                        <p class="text-sm text-slate-500">Выбрано категорий: {{ selectedCategories.length }}</p>
                        <button type="button" class="btn-primary" :disabled="!canProceedToProducts" @click="goToProductsStep">Далее</button>
                    </div>
                </section>

                <section v-else class="space-y-4">
                    <div class="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm space-y-3 text-center">
                        <div class="flex items-center justify-between">
                            <p class="text-sm font-semibold text-slate-700">Шаг 2 из 2</p>
                            <p class="text-sm text-slate-500">Выбрано {{ selectedCount }} из {{ MIN_SELECTED_PRODUCTS }}</p>
                        </div>
                        <p class="text-sm text-slate-500" :class="{ 'text-cyan-700 font-medium': canContinue }">
                            {{
                                canContinue
                                    ? 'Можно продолжать.'
                                    : `Для полноценного разнообразного рациона выберите еще ${remainingToMinimum}.`
                            }}
                        </p>
                    </div>

                    <section class="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm space-y-4">
                        <div class="overflow-x-auto flex-1">
                            <div class="flex items-center gap-2 min-w-max">
                                <button
                                    v-for="category in selectedCategories"
                                    :key="category"
                                    type="button"
                                    class="category-filter-chip rounded-full border px-3 py-1.5 text-sm font-semibold whitespace-nowrap transition-all duration-200"
                                    :class="{ 'is-selected': category === activeCategory }"
                                    @click="setActiveCategory(category)"
                                >
                                    {{ category }}
                                </button>
                            </div>
                        </div>

                        <div v-if="filteredProducts.length" class="relative">
                            <TransitionGroup name="product-grid" tag="div" class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                                <button
                                    v-for="product in filteredProducts"
                                    :key="product.id"
                                    type="button"
                                    class="product-card flex min-h-[122px] flex-col items-center justify-center rounded-2xl border p-3 shadow-sm text-center"
                                    :class="{ 'is-selected': isProductSelected(product.id) }"
                                    @click="toggleProduct(product.id)"
                                >
                                    <span
                                        class="product-card__check absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full border transition-all duration-200"
                                        :class="{ 'is-selected': isProductSelected(product.id) }"
                                    >
                                        <svg viewBox="0 0 24 24" class="h-4 w-4" aria-hidden="true">
                                            <path d="M20 7L10 17L5 12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
                                        </svg>
                                    </span>
                                    <p class="product-title px-5 text-sm font-semibold leading-snug">{{ product.name }}</p>
                                    <p class="product-meta mt-2 text-xs">{{ Math.round(Number(product.kcal) || 0) }} ккал / 100 г</p>
                                </button>
                            </TransitionGroup>
                        </div>

                        <div v-else class="rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm text-slate-500 text-center">
                            В выбранной категории пока нет продуктов.
                        </div>
                    </section>

                    <div
                        ref="bottomActionsRef"
                        class="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm grid grid-cols-1 gap-2"
                        :class="isNextCategoryDocked ? 'sm:grid-cols-3' : 'sm:grid-cols-2'"
                    >
                        <button
                            v-if="step === 'products'"
                            type="button"
                            class="onboarding-next-category-btn"
                            :class="[
                                isNextCategoryDocked ? 'is-docked' : 'is-floating',
                                hasNextCategory ? 'btn-secondary' : 'btn-primary'
                            ]"
                            :disabled="nextCategoryActionDisabled"
                            @click="handleNextCategoryAction"
                        >
                            {{ nextCategoryActionLabel }}
                        </button>
                        <button type="button" class="btn-secondary" :disabled="isSaving" @click="goToCategoriesStep">Назад к категориям</button>
                        <button type="button" class="btn-secondary" :disabled="isSaving" @click="openSkipConfirm">Заполнить позже</button>
                        <button v-if="false" type="button" class="btn-primary" :disabled="!canContinue || isSaving" @click="saveOnboardingChoices">
                            {{ isSaving ? 'Сохраняем...' : 'Продолжить' }}
                        </button>
                    </div>
                </section>
            </div>
        </main>

        <Transition name="skip-fade">
            <div v-if="skipConfirmVisible" class="fixed inset-0 z-[80] bg-slate-900/45 px-4 flex items-center justify-center">
                <div class="w-full max-w-md rounded-2xl border border-slate-100 bg-white p-5 shadow-xl space-y-4">
                    <div class="space-y-1 text-center">
                        <p class="text-lg font-semibold text-slate-800">Вы уверены?</p>
                        <p class="text-sm text-slate-500">
                            Если пропустить этот шаг, рацион не будет рассчитан. Онбординг продуктов можно пройти позже в разделе «Рацион».
                        </p>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button type="button" class="btn-secondary" :disabled="isSaving" @click="closeSkipConfirm">Остаться</button>
                        <button type="button" class="btn-primary" :disabled="isSaving" @click="skipOnboarding">Пропустить</button>
                    </div>
                </div>
            </div>
        </Transition>
    </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { preferencesOnboardingApi, type OnboardingProduct } from '../api/preferencesOnboardingApi';
import { profileApi } from '../api/profileApi';
import { resolvePostQuestionnaireRoute } from '../domain/onboarding';
import { useStorageStore } from '../stores/storageStore';

type Step = 'categories' | 'products';

const MIN_SELECTED_CATEGORIES = 3;
const MIN_SELECTED_PRODUCTS = 20;

const router = useRouter();
const storageStore = useStorageStore();

const step = ref<Step>('categories');
const products = ref<OnboardingProduct[]>([]);
const selectedCategories = ref<string[]>([]);
const activeCategory = ref<string>('');
const selectedProductIds = ref<number[]>([]);
const isSaving = ref(false);
const skipConfirmVisible = ref(false);
const selectionToastTimer = ref<number | null>(null);
const bottomActionsRef = ref<HTMLElement | null>(null);
const isBottomActionRowVisible = ref(false);
let bottomActionsObserver: IntersectionObserver | null = null;

const continueRoute = computed(() => resolvePostQuestionnaireRoute({ preferences_onboarding_completed: true } as any));

const allCategories = computed<string[]>(() => {
    const unique = new Set<string>();
    for (const item of products.value) {
        const category = typeof item.group === 'string' && item.group.trim() ? item.group.trim() : 'Без группы';
        unique.add(category);
    }
    return Array.from(unique).sort((a, b) => a.localeCompare(b, 'ru'));
});

const selectedCategorySet = computed(() => new Set(selectedCategories.value));

const filteredProducts = computed<OnboardingProduct[]>(() => {
    if (!activeCategory.value) {
        return [];
    }
    return products.value.filter((item) => item.group === activeCategory.value);
});

const selectedCount = computed(() => selectedProductIds.value.length);
const remainingToMinimum = computed(() => Math.max(0, MIN_SELECTED_PRODUCTS - selectedCount.value));
const canProceedToProducts = computed(() => selectedCategories.value.length >= MIN_SELECTED_CATEGORIES);
const canContinue = computed(() => selectedCount.value >= MIN_SELECTED_PRODUCTS);
const activeCategoryIndex = computed(() => selectedCategories.value.indexOf(activeCategory.value));
const hasNextCategory = computed(() => activeCategoryIndex.value >= 0 && activeCategoryIndex.value < selectedCategories.value.length - 1);
const nextCategoryActionLabel = computed(() => (hasNextCategory.value ? 'Следующая категория' : 'Продолжить'));
const nextCategoryActionDisabled = computed(() => {
    if (isSaving.value) {
        return true;
    }
    if (hasNextCategory.value) {
        return selectedCategories.value.length <= 1;
    }
    return !canContinue.value;
});

const isNextCategoryDocked = computed(() => step.value === 'products' && isBottomActionRowVisible.value);

const notify = (message: string, type: 'success' | 'error' = 'error'): void => {
    const showNotification = (window as any).showNotification;
    if (typeof showNotification === 'function') {
        showNotification(message, type);
        return;
    }
    if (type === 'error') {
        console.error(message);
        return;
    }
    console.log(message);
};

const refreshIcons = async (): Promise<void> => {
    await nextTick();
    const feather = (window as any).feather;
    if (typeof feather?.replace === 'function') {
        feather.replace();
    }
};

const sendOnboardingEvent = async (eventName: string): Promise<void> => {
    try {
        await profileApi.sendPreferencesOnboardingEvent({
            event: eventName,
            favorites_count: selectedCount.value,
            excluded_count: Math.max(0, products.value.length - selectedCount.value),
            viewed_count: filteredProducts.value.length
        });
    } catch {
        // Analytics should not break onboarding flow.
    }
};

const normalizeProducts = (items: OnboardingProduct[]): OnboardingProduct[] => {
    return items
        .map((item) => ({
            ...item,
            group: typeof item.group === 'string' && item.group.trim() ? item.group.trim() : 'Без группы'
        }))
        .sort((left, right) => {
            const byGroup = left.group.localeCompare(right.group, 'ru');
            if (byGroup !== 0) {
                return byGroup;
            }
            return left.name.localeCompare(right.name, 'ru');
        });
};

const loadProducts = async (): Promise<void> => {
    try {
        products.value = normalizeProducts(await preferencesOnboardingApi.getCatalogProducts());
    } catch {
        products.value = [];
        notify('Не удалось загрузить продукты. Попробуйте позже.', 'error');
    }
};

const resetProductsScroll = (): void => {
    const candidates = new Set<(Element | null)>([
        document.scrollingElement,
        document.documentElement,
        document.body,
        document.querySelector('custom-layout.app-content'),
        document.querySelector('custom-layout[data-spa-layout]'),
        document.querySelector('[data-spa-layout]')
    ]);

    candidates.forEach((candidate) => {
        if (!(candidate instanceof HTMLElement)) {
            return;
        }
        candidate.scrollTop = 0;
        if (typeof candidate.scrollTo === 'function') {
            candidate.scrollTo({ top: 0, behavior: 'auto' });
        }
    });

    if (typeof window.scrollTo === 'function') {
        window.scrollTo({ top: 0, behavior: 'auto' });
    }
};

const resetProductsScrollDeferred = (): void => {
    resetProductsScroll();
    window.requestAnimationFrame(() => {
        resetProductsScroll();
    });
};

const setActiveCategory = (category: string): void => {
    if (!selectedCategorySet.value.has(category)) {
        return;
    }
    if (activeCategory.value === category) {
        return;
    }
    activeCategory.value = category;
    resetProductsScroll();
};

const goToNextCategory = (): void => {
    const categories = selectedCategories.value;
    if (categories.length <= 1) {
        return;
    }

    const currentIndex = categories.indexOf(activeCategory.value);
    if (currentIndex < 0) {
        activeCategory.value = categories[0];
        resetProductsScrollDeferred();
        return;
    }
    if (currentIndex >= categories.length - 1) {
        return;
    }
    activeCategory.value = categories[currentIndex + 1];
    resetProductsScrollDeferred();
};

const handleNextCategoryAction = (): void => {
    if (nextCategoryActionDisabled.value) {
        return;
    }
    if (hasNextCategory.value) {
        goToNextCategory();
        return;
    }
    void saveOnboardingChoices();
};

const toggleCategory = (category: string): void => {
    const isSelected = selectedCategorySet.value.has(category);
    if (isSelected) {
        selectedCategories.value = selectedCategories.value.filter((item) => item !== category);
        if (activeCategory.value === category) {
            activeCategory.value = selectedCategories.value[0] || '';
        }
        return;
    }
    selectedCategories.value = [...selectedCategories.value, category];
    if (!activeCategory.value) {
        activeCategory.value = category;
    }
};

const goToProductsStep = (): void => {
    if (!canProceedToProducts.value) {
        return;
    }
    if (!selectedCategorySet.value.has(activeCategory.value)) {
        activeCategory.value = selectedCategories.value[0] || '';
    }
    step.value = 'products';
};

const goToCategoriesStep = (): void => {
    step.value = 'categories';
};

const disconnectBottomActionsObserver = (): void => {
    if (bottomActionsObserver) {
        bottomActionsObserver.disconnect();
        bottomActionsObserver = null;
    }
};

const setupBottomActionsObserver = (): void => {
    disconnectBottomActionsObserver();

    if (step.value !== 'products') {
        isBottomActionRowVisible.value = false;
        return;
    }

    if (!bottomActionsRef.value || typeof window.IntersectionObserver !== 'function') {
        isBottomActionRowVisible.value = true;
        return;
    }

    bottomActionsObserver = new window.IntersectionObserver(
        (entries) => {
            const entry = entries[0];
            if (!entry) {
                return;
            }
            isBottomActionRowVisible.value = entry.isIntersecting;
        },
        { threshold: 0 }
    );

    bottomActionsObserver.observe(bottomActionsRef.value);
};

const getCssPxVariable = (name: string, fallback = 0): number => {
    const value = window.getComputedStyle(document.documentElement).getPropertyValue(name);
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const computeNotificationTopOffset = (): number => {
    const navbarHost = document.querySelector('custom-navbar') as HTMLElement | null;
    const navbar = navbarHost?.shadowRoot?.querySelector('.navbar') as HTMLElement | null;
    const navbarBottom = navbar ? navbar.getBoundingClientRect().bottom : 0;
    if (Number.isFinite(navbarBottom) && navbarBottom > 0) {
        return Math.round(navbarBottom + 12);
    }

    const safeTop = getCssPxVariable('--tg-safe-top', 0);
    const uiTop = getCssPxVariable('--tg-ui-top', 0);
    const maxTop = Math.max(12, window.innerHeight - 96);
    const rawTop = Math.round(72 + safeTop + uiTop + 12);
    return Math.min(Math.max(rawTop, 12), maxTop);
};

const ensureNotificationContainer = (): HTMLDivElement => {
    let container = document.getElementById('notification-container') as HTMLDivElement | null;
    if (!container) {
        container = document.createElement('div');
        container.id = 'notification-container';
        (document.documentElement || document.body).appendChild(container);
    }

    container.style.setProperty('position', 'fixed', 'important');
    container.style.setProperty('top', `${computeNotificationTopOffset()}px`, 'important');
    container.style.setProperty('right', '12px', 'important');
    container.style.setProperty('left', 'auto', 'important');
    container.style.setProperty('bottom', 'auto', 'important');
    container.style.setProperty('z-index', '2147483647', 'important');
    container.style.setProperty('width', 'min(320px, calc(100vw - 24px))', 'important');
    container.style.setProperty('display', 'flex', 'important');
    container.style.setProperty('flex-direction', 'column', 'important');
    container.style.setProperty('align-items', 'flex-end', 'important');
    container.style.setProperty('pointer-events', 'none', 'important');
    container.style.setProperty('visibility', 'visible', 'important');
    container.style.setProperty('opacity', '1', 'important');
    container.style.setProperty('isolation', 'isolate', 'important');

    return container;
};

const removeSelectionToast = (): void => {
    const toast = document.getElementById('preferences-selection-toast');
    if (toast) {
        toast.remove();
    }
    if (selectionToastTimer.value !== null) {
        window.clearTimeout(selectionToastTimer.value);
        selectionToastTimer.value = null;
    }
};

const showSelectionToast = (): void => {
    const container = ensureNotificationContainer();
    let toast = document.getElementById('preferences-selection-toast') as HTMLDivElement | null;

    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'preferences-selection-toast';
        toast.style.background = '#10b981';
        toast.style.color = '#ffffff';
        toast.style.padding = '14px 16px';
        toast.style.borderRadius = '14px';
        toast.style.marginBottom = '10px';
        toast.style.maxWidth = '100%';
        toast.style.boxShadow = '0 10px 26px rgba(15, 23, 42, 0.28)';
        toast.style.wordBreak = 'break-word';
        toast.style.pointerEvents = 'auto';
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-8px)';
        toast.style.transition = 'transform 180ms ease, opacity 180ms ease';
        container.appendChild(toast);
        requestAnimationFrame(() => {
            if (toast) {
                toast.style.opacity = '1';
                toast.style.transform = 'translateY(0)';
            }
        });
    }

    toast.textContent = `Выбрано ${selectedCount.value} из ${MIN_SELECTED_PRODUCTS}`;
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';

    if (selectionToastTimer.value !== null) {
        window.clearTimeout(selectionToastTimer.value);
    }
    selectionToastTimer.value = window.setTimeout(() => {
        const current = document.getElementById('preferences-selection-toast') as HTMLDivElement | null;
        if (!current) {
            return;
        }
        current.style.opacity = '0';
        current.style.transform = 'translateY(-6px)';
        window.setTimeout(() => current.remove(), 180);
        selectionToastTimer.value = null;
    }, 1500);
};

const isProductSelected = (productId: number): boolean => selectedProductIds.value.includes(productId);

const toggleProduct = (productId: number): void => {
    if (isProductSelected(productId)) {
        selectedProductIds.value = selectedProductIds.value.filter((id) => id !== productId);
        showSelectionToast();
        return;
    }
    selectedProductIds.value = [...selectedProductIds.value, productId];
    showSelectionToast();
};

const openSkipConfirm = (): void => {
    if (isSaving.value) {
        return;
    }
    skipConfirmVisible.value = true;
};

const closeSkipConfirm = (): void => {
    skipConfirmVisible.value = false;
};

const skipOnboarding = async (): Promise<void> => {
    if (isSaving.value) {
        return;
    }
    skipConfirmVisible.value = false;
    await sendOnboardingEvent('skipped');
    await router.push('/trial-start');
};

const saveOnboardingChoices = async (): Promise<void> => {
    if (isSaving.value || !canContinue.value) {
        return;
    }

    isSaving.value = true;
    const selectedSet = new Set(selectedProductIds.value);
    const excludedIds = products.value
        .map((item) => item.id)
        .filter((id) => !selectedSet.has(id));

    try {
        const saved = await storageStore.patchUserProfileWithBackend({
            favorite_product_ids: selectedProductIds.value,
            excluded_product_ids: excludedIds,
            preferences_onboarding_completed: true
        });

        if (!saved) {
            throw new Error('PROFILE_SAVE_FAILED');
        }

        await sendOnboardingEvent('completed_with_choices');
        await router.push(continueRoute.value);
    } catch {
        notify('Не удалось сохранить выбор. Попробуйте еще раз.', 'error');
    } finally {
        isSaving.value = false;
    }
};

onMounted(() => {
    void (async () => {
        document.body.dataset.preservePageTheme = 'true';
        await loadProducts();
        await sendOnboardingEvent('entered');
        await refreshIcons();
        await nextTick();
        setupBottomActionsObserver();
    })();
});

watch(step, async () => {
    await nextTick();
    setupBottomActionsObserver();
});

watch(bottomActionsRef, async () => {
    await nextTick();
    setupBottomActionsObserver();
});

onBeforeUnmount(() => {
    disconnectBottomActionsObserver();
    removeSelectionToast();
    delete document.body.dataset.preservePageTheme;
});
</script>

<style scoped>
.category-chip {
    border-color: #e2e8f0;
    background: #ffffff;
    color: #334155;
}

.category-chip:hover {
    border-color: #7dd3fc;
    background: #f0f9ff;
}

.category-chip.is-selected {
    border-color: #059669;
    background: linear-gradient(135deg, #10b981, #06b6d4);
    color: #ffffff;
    box-shadow: 0 10px 22px rgba(16, 185, 129, 0.26);
}

.category-filter-chip {
    border-color: #e2e8f0;
    background: #ffffff;
    color: #475569;
}

.category-filter-chip:hover {
    border-color: #7dd3fc;
    color: #0f766e;
}

.category-filter-chip.is-selected {
    border-color: #059669;
    background: linear-gradient(135deg, #10b981, #06b6d4);
    color: #ffffff;
    box-shadow: 0 8px 20px rgba(16, 185, 129, 0.24);
}

.product-card {
    position: relative;
    border-color: #e2e8f0;
    background: #ffffff;
    transition: transform 0.18s ease, border-color 0.18s ease, background-color 0.18s ease, box-shadow 0.18s ease;
}

.product-card .product-title {
    color: #0f172a;
    text-align: center;
}

.product-card .product-meta {
    color: #64748b;
}

.product-card:hover {
    border-color: #7dd3fc;
    background: #f0f9ff;
}

.product-card:active {
    transform: scale(0.985);
}

.product-card.is-selected {
    transform: translateY(-1px);
    border-color: #059669;
    background: linear-gradient(145deg, #10b981, #06b6d4);
    box-shadow: 0 12px 24px rgba(16, 185, 129, 0.3);
}

.product-card.is-selected .product-title,
.product-card.is-selected .product-meta {
    color: #ffffff;
}

.product-card__check {
    border-color: #cbd5e1;
    background: #ffffff;
    color: transparent;
    opacity: 0;
    transform: scale(0.9);
}

.product-card__check.is-selected {
    border-color: rgba(255, 255, 255, 0.75);
    background: rgba(255, 255, 255, 0.2);
    color: #ffffff;
    opacity: 1;
    transform: scale(1);
}

.product-grid-enter-active,
.product-grid-leave-active,
.product-grid-move {
    transition: all 0.2s ease;
}

.product-grid-enter-from,
.product-grid-leave-to {
    opacity: 0;
    transform: translateY(8px);
}

.skip-fade-enter-active,
.skip-fade-leave-active {
    transition: opacity 0.18s ease;
}

.skip-fade-enter-from,
.skip-fade-leave-to {
    opacity: 0;
}

.onboarding-next-category-btn {
    transition: transform 0.24s ease, opacity 0.24s ease;
}

.onboarding-next-category-btn.is-floating {
    position: fixed;
    left: 50%;
    bottom: calc(96px + var(--tg-safe-bottom, 0px));
    transform: translateX(-50%);
    z-index: 58;
    box-shadow: 0 10px 24px rgba(15, 23, 42, 0.2);
    white-space: nowrap;
    max-width: calc(100vw - 24px);
}

.onboarding-next-category-btn.is-docked {
    position: static;
    left: auto;
    bottom: auto;
    transform: none;
    z-index: auto;
    box-shadow: none;
    white-space: normal;
    width: 100%;
}
</style>

