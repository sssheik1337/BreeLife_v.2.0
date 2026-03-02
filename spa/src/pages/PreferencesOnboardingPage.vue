<template>
    <section class="min-h-screen bg-gradient-to-br from-[#f8fafc] via-[#f0f9ff] to-[#f0fdf4]" data-spa-preferences-onboarding>
        <main class="flex-1 px-4 py-8">
            <div class="max-w-md mx-auto space-y-6">
                <div class="text-center">
                    <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-400 mb-4 shadow-lg">
                        <i data-feather="heart" class="w-7 h-7 text-white"></i>
                    </div>
                    <h1 class="text-2xl font-bold text-slate-800">Давай соберём твои любимые продукты</h1>
                    <p class="text-slate-500 mt-2">Это поможет собрать рацион, который тебе реально понравится</p>
                    <p id="preferences-selection-hint" class="text-xs text-slate-400 mt-2">{{ selectionHint }}</p>
                </div>

                <div class="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm space-y-3">
                    <div class="flex items-center justify-between text-sm text-slate-500">
                        <span>Прогресс</span>
                        <span id="preferences-progress">{{ progressText }}</span>
                    </div>
                    <div class="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                            id="preferences-progress-bar"
                            class="h-full bg-gradient-to-r from-emerald-400 to-cyan-400"
                            :style="{ width: `${progressPercent}%` }"
                        ></div>
                    </div>
                    <div class="text-xs text-slate-500 space-y-1">
                        <p id="preferences-kpi-favorites">{{ favoritesHint }}</p>
                        <p id="preferences-kpi-excluded">{{ excludedHint }}</p>
                        <p
                            id="preferences-soft-hint"
                            class="text-slate-400"
                            :class="{ hidden: !showSoftHint }"
                        >{{ softHintText }}</p>
                    </div>
                </div>

                <section
                    id="preferences-card"
                    class="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-4"
                    :class="{ hidden: successVisible }"
                >
                    <div
                        id="preferences-empty-state"
                        class="rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm text-slate-500"
                        :class="{ hidden: totalCount > 0 }"
                    >
                        Пока нет доступных продуктов для выбора.
                    </div>
                    <div class="flex items-start justify-between gap-3">
                        <div>
                            <p class="text-base font-semibold text-slate-800" id="preferences-product-name">{{ currentItem?.name || '—' }}</p>
                            <p class="text-sm text-slate-500" id="preferences-product-group">{{ currentItem?.group || '—' }}</p>
                        </div>
                        <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600" id="preferences-product-kcal">
                            {{ currentItem ? `${Math.round(Number(currentItem.kcal) || 0)} ккал / 100 г` : '0 ккал / 100 г' }}
                        </span>
                    </div>

                    <div class="grid grid-cols-3 gap-2">
                        <button type="button" class="btn-secondary text-sm" id="preferences-like" :disabled="!canInteract" @click="handleLike">❤️ Нравится</button>
                        <button type="button" class="btn-secondary text-sm" id="preferences-skip" :disabled="!canInteract" @click="handleSkip">➡️ Следующий продукт</button>
                        <button type="button" class="btn-secondary text-sm" id="preferences-exclude" :disabled="!canInteract" @click="handleExclude">🙅 Не хочу</button>
                    </div>
                </section>

                <div class="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm space-y-3" :class="{ hidden: successVisible }">
                    <button type="button" class="btn-primary w-full" id="preferences-done" :disabled="isSaving" @click="saveOnboardingChoices">Готово</button>
                    <button type="button" class="btn-secondary w-full text-sm" id="preferences-soft-skip" :disabled="isSaving" @click="skipOnboarding">Настроить позже</button>
                </div>

                <section id="preferences-success" class="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-4" :class="{ hidden: !successVisible }">
                    <p id="preferences-success-with-choices" class="text-base font-semibold text-slate-800" :class="{ hidden: completionType !== 'completed_with_choices' }">
                        Мы учли твои вкусы — теперь рацион будет собран из любимых продуктов ❤️
                    </p>
                    <p id="preferences-success-without-choices" class="text-base font-semibold text-slate-800" :class="{ hidden: completionType !== 'completed_without_choices' }">
                        Вы пропустили настройку предпочтений. Можно вернуться позже в “Мои продукты”.
                    </p>
                    <a id="preferences-continue" :href="continueRoute" class="btn-primary w-full text-center" @click.prevent="goToContinue">Продолжить</a>
                </section>
            </div>
        </main>
    </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { preferencesOnboardingApi } from '../api/preferencesOnboardingApi';
import { profileApi } from '../api/profileApi';
import { resolvePostQuestionnaireRoute } from '../domain/onboarding';
import { useStorageStore } from '../stores/storageStore';

type CompletionType = 'completed_with_choices' | 'completed_without_choices';

const TARGET_FAVORITES = 10;

const router = useRouter();
const storageStore = useStorageStore();

const products = ref<Array<{ id: number; name: string; group: string; kcal: number }>>([]);
const currentIndex = ref(0);
const favoriteIds = ref<number[]>([]);
const excludedIds = ref<number[]>([]);
const isSaving = ref(false);
const successVisible = ref(false);
const completionType = ref<CompletionType>('completed_with_choices');
const interactionLocked = ref(false);
const selectionHint = ref('Показываем продукты из разных групп, чтобы быстрее настроить рацион.');

const totalCount = computed(() => products.value.length);
const currentItem = computed(() => products.value[currentIndex.value] || null);
const viewedCount = computed(() => {
    if (totalCount.value === 0) {
        return 0;
    }
    return Math.min(currentIndex.value + 1, totalCount.value);
});
const progressText = computed(() => `${viewedCount.value} из ${totalCount.value}`);
const progressPercent = computed(() => (totalCount.value > 0 ? Math.round((viewedCount.value / totalCount.value) * 100) : 0));
const favoritesHint = computed(() => `Желательно выбрать 10 любимых продуктов (${favoriteIds.value.length}/10).`);
const excludedHint = computed(() => `Нежелательные продукты: ${excludedIds.value.length} (без ограничений).`);
const remainingFavorites = computed(() => Math.max(0, TARGET_FAVORITES - favoriteIds.value.length));
const showSoftHint = computed(() => remainingFavorites.value > 0);
const softHintText = computed(() => {
    if (!showSoftHint.value) {
        return '';
    }
    return `Можно завершить уже сейчас — для большей точности можно отметить ещё любимых продуктов: ${remainingFavorites.value}.`;
});
const canInteract = computed(() => (
    !successVisible.value
    && !isSaving.value
    && totalCount.value > 0
    && !interactionLocked.value
));
const continueRoute = computed(() => resolvePostQuestionnaireRoute({ preferences_onboarding_completed: true } as any));

const normalizeIdArray = (value: unknown): number[] => {
    if (!Array.isArray(value)) {
        return [];
    }
    const ids = value
        .map((item) => Number(item))
        .filter((item) => Number.isInteger(item));
    return Array.from(new Set(ids));
};

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

const setSelectionHintFromMeta = (meta: unknown): void => {
    const info = meta && typeof meta === 'object' ? (meta as Record<string, unknown>) : null;
    const groupsTotal = Number(info?.groups_total);
    const groupSampleSize = Number(info?.group_sample_size);
    if (Number.isInteger(groupsTotal) && Number.isInteger(groupSampleSize) && groupsTotal > 0 && groupSampleSize > 0) {
        selectionHint.value = `Показываем продукты из разных групп: ${groupsTotal} групп, до ${groupSampleSize} карточек на группу.`;
        return;
    }
    selectionHint.value = 'Показываем продукты из разных групп, чтобы быстрее настроить рацион.';
};

const hydrateSelectedSetsFromProfile = async (): Promise<void> => {
    try {
        await storageStore.syncProfileWithBackend();
    } catch {
        // Ignore sync errors and use local snapshot.
    }
    const profile = storageStore.getUserProfile() as Record<string, unknown>;
    favoriteIds.value = normalizeIdArray(profile.favorite_product_ids);
    excludedIds.value = normalizeIdArray(profile.excluded_product_ids);
};

const sendOnboardingEvent = async (eventName: string): Promise<void> => {
    try {
        await profileApi.sendPreferencesOnboardingEvent({
            event: eventName,
            favorites_count: favoriteIds.value.length,
            excluded_count: excludedIds.value.length,
            viewed_count: viewedCount.value
        });
    } catch {
        // Analytics should not break onboarding flow.
    }
};

const loadProducts = async (): Promise<void> => {
    try {
        const payload = await preferencesOnboardingApi.getProducts(30);
        products.value = payload.items;
        currentIndex.value = 0;
        interactionLocked.value = false;
        setSelectionHintFromMeta(payload.meta || null);
    } catch {
        products.value = [];
        currentIndex.value = 0;
        interactionLocked.value = true;
        setSelectionHintFromMeta(null);
        notify('Не удалось загрузить карточки продуктов. Попробуйте позже.', 'error');
    }
};

const ensureIdInList = (list: number[], id: number): number[] => {
    if (list.includes(id)) {
        return list;
    }
    return [...list, id];
};

const removeIdFromList = (list: number[], id: number): number[] => list.filter((item) => item !== id);

const moveToNextCard = async (): Promise<void> => {
    if (currentIndex.value >= totalCount.value - 1) {
        interactionLocked.value = true;
        return;
    }
    currentIndex.value += 1;
    await refreshIcons();
};

const handleLike = async (): Promise<void> => {
    if (!currentItem.value || !canInteract.value) {
        return;
    }
    favoriteIds.value = ensureIdInList(favoriteIds.value, currentItem.value.id);
    excludedIds.value = removeIdFromList(excludedIds.value, currentItem.value.id);
    await moveToNextCard();
};

const handleExclude = async (): Promise<void> => {
    if (!currentItem.value || !canInteract.value) {
        return;
    }
    excludedIds.value = ensureIdInList(excludedIds.value, currentItem.value.id);
    favoriteIds.value = removeIdFromList(favoriteIds.value, currentItem.value.id);
    await moveToNextCard();
};

const handleSkip = async (): Promise<void> => {
    if (!canInteract.value) {
        return;
    }
    await moveToNextCard();
};

const resolveCompletionType = (forced: CompletionType | null = null): CompletionType => {
    if (forced) {
        return forced;
    }
    return favoriteIds.value.length > 0 || excludedIds.value.length > 0
        ? 'completed_with_choices'
        : 'completed_without_choices';
};

const finishOnboarding = async (forcedType: CompletionType | null, eventName: string | null): Promise<void> => {
    completionType.value = resolveCompletionType(forcedType);
    if (eventName) {
        await sendOnboardingEvent(eventName);
    }
    successVisible.value = true;
    interactionLocked.value = true;
    await refreshIcons();
};

const saveOnboardingChoices = async (): Promise<void> => {
    if (isSaving.value) {
        return;
    }
    isSaving.value = true;
    try {
        const saved = await storageStore.patchUserProfileWithBackend({
            favorite_product_ids: favoriteIds.value,
            excluded_product_ids: excludedIds.value,
            preferences_onboarding_completed: true
        });
        if (!saved) {
            throw new Error('PROFILE_SAVE_FAILED');
        }
        const type = resolveCompletionType();
        await sendOnboardingEvent(type);
        await finishOnboarding(type, null);
    } catch {
        notify('Не удалось сохранить выбор. Попробуйте ещё раз.', 'error');
    } finally {
        isSaving.value = false;
    }
};

const skipOnboarding = async (): Promise<void> => {
    await finishOnboarding('completed_without_choices', 'skipped');
};

const goToContinue = async (): Promise<void> => {
    await router.push(continueRoute.value);
};

onMounted(() => {
    void (async () => {
        document.body.dataset.preservePageTheme = 'true';
        await hydrateSelectedSetsFromProfile();
        await loadProducts();
        await sendOnboardingEvent('entered');
        await refreshIcons();
    })();
});

onBeforeUnmount(() => {
    delete document.body.dataset.preservePageTheme;
});
</script>
