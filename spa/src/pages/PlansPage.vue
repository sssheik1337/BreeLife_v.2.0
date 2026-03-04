<template>
    <section class="min-h-screen bg-gradient-to-br from-[#f8fafc] via-[#f0f9ff] to-[#f0fdf4]">
        <main class="flex-1 px-4 py-8">
            <div class="max-w-md mx-auto space-y-6">
                <div class="text-center">
                    <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-500 mb-4 shadow-lg">
                        <i data-feather="credit-card" class="w-7 h-7 text-white"></i>
                    </div>
                    <h1 class="text-2xl font-bold text-slate-800">Тарифы</h1>
                    <p class="text-slate-500 mt-2">Выберите подходящий тариф и активируйте пробный период.</p>
                </div>

                <div class="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-4">
                    <p class="text-sm text-slate-500">
                        Пробный период действует 30 дней и открывает функции Premium.
                    </p>
                    <div id="plans-trial-status" class="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                        <div class="flex items-center justify-between gap-3">
                            <p class="font-semibold text-slate-800">Пробный период</p>
                            <span class="plans-trial-chip" :class="trialStatus.badgeClass">{{ trialStatus.badgeText }}</span>
                        </div>
                        <p class="text-sm text-slate-500 mt-1">{{ trialStatus.detailsText }}</p>
                    </div>
                    <div id="plans-container" class="space-y-4">
                        <p v-if="isLoading" class="text-center text-slate-400">Загрузка тарифов...</p>
                        <p v-else-if="loadError" class="text-center text-slate-400">{{ loadError }}</p>

                        <div
                            v-for="plan in plans"
                            :key="plan.id"
                            class="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4"
                            :data-plan="plan.id"
                        >
                            <div class="flex items-center justify-between">
                                <div>
                                    <h2 class="text-lg font-semibold text-slate-800">{{ plan.title }}</h2>
                                    <p class="text-sm text-slate-500">{{ planSubtitle(plan) }}</p>
                                </div>
                                <div class="text-right">
                                    <div v-if="showOldPrice(plan)" class="text-sm text-slate-400 line-through">{{ formatPrice(plan.price_old) }}</div>
                                    <div class="text-xl font-bold text-emerald-600">{{ formatPrice(plan.price_current ?? plan.price) }}</div>
                                </div>
                            </div>

                            <ul class="space-y-2 text-sm text-slate-600">
                                <li v-for="feature in normalizeFeatures(plan.features)" :key="`${plan.id}-${feature}`" class="flex items-start gap-2">
                                    <span class="text-emerald-500">•</span>
                                    <span>{{ feature }}</span>
                                </li>
                            </ul>

                            <button
                                class="btn-primary w-full"
                                type="button"
                                :data-plan="plan.id"
                                :disabled="isPlanSelectionDisabled(plan)"
                                :title="isPlanSelectionDisabled(plan) ? 'Доступ уже открыт в текущем периоде' : undefined"
                                @click="selectPlan(plan)"
                            >
                                {{ planButtonText(plan) }}
                            </button>

                            <p class="text-xs text-slate-500">{{ planStatusText(plan) }}</p>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import { useStorageStore } from '../stores/storageStore';
import { subscriptionApi } from '../api/subscriptionApi';

interface PlanDto {
    id: string;
    title?: string;
    duration_days?: number;
    features?: string[];
    price_current?: string | number;
    price?: string | number;
    price_old_enabled?: boolean;
    price_old?: string | number;
}

const PLANS_ENDPOINT = '/api/plans';

const storageStore = useStorageStore();

const plans = ref<PlanDto[]>([]);
const activePlan = ref('free');
const isLoading = ref(true);
const loadError = ref('');
const selectedPlanId = ref('');
const trialStatus = ref({
    kind: 'loading' as 'loading' | 'active' | 'expired' | 'inactive' | 'error',
    badgeText: 'Проверка...',
    badgeClass: 'plans-trial-chip--inactive',
    detailsText: 'Проверяем срок действия пробного периода.'
});

const normalizeFeatures = (value: unknown): string[] => {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.filter((item) => typeof item === 'string') as string[];
};

const toPriceNumber = (value: unknown): number => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.max(0, Math.round(value));
    }
    if (typeof value === 'string') {
        const digits = value.replace(/\D+/g, '');
        if (digits) {
            return Math.max(0, Number.parseInt(digits, 10));
        }
    }
    return 0;
};

const formatPrice = (value: unknown): string => `${toPriceNumber(value).toLocaleString('ru-RU')} ₽`;
const formatDateRu = (value: unknown): string | null => {
    if (typeof value !== 'string' || !value) {
        return null;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return null;
    }
    return parsed.toLocaleDateString('ru-RU');
};

const showOldPrice = (plan: PlanDto): boolean => plan.price_old_enabled === true && toPriceNumber(plan.price_old) > 0;
const currentPrice = (plan: PlanDto): number => toPriceNumber(plan.price_current ?? plan.price);
const isCommercialPlan = (plan: PlanDto): boolean => currentPrice(plan) > 0;
const hasUnlockedAccess = computed(() => trialStatus.value.kind === 'active');
const isPlanSelectionDisabled = (plan: PlanDto): boolean => (
    selectedPlanId.value === plan.id
    || (hasUnlockedAccess.value && isCommercialPlan(plan))
);

const planSubtitle = (plan: PlanDto): string => {
    const durationDays = Number(plan.duration_days);
    return durationDays > 0 ? `Срок: ${durationDays} дней` : 'Без ограничений по сроку';
};

const planStatusText = (plan: PlanDto): string => {
    if (isCommercialPlan(plan) && hasUnlockedAccess.value) {
        return 'Сейчас этот уровень доступа уже открыт в пробном периоде.';
    }
    if (isCommercialPlan(plan)) {
        return 'Коммерческий тариф';
    }
    return 'Текущий бесплатный план';
};

const planButtonText = (plan: PlanDto): string => {
    if (isCommercialPlan(plan) && hasUnlockedAccess.value) {
        return 'Доступно в пробном периоде';
    }
    if (selectedPlanId.value === plan.id) {
        return 'Выбор...';
    }
    if (activePlan.value === plan.id && !isCommercialPlan(plan)) {
        return 'Выбран';
    }
    return 'Выбрать';
};

const notify = (message: string, type: 'success' | 'error' = 'success'): void => {
    const showNotification = (window as any).showNotification;
    if (typeof showNotification === 'function') {
        showNotification(message, type);
        return;
    }
    alert(message);
};

const selectPlan = async (plan: PlanDto): Promise<void> => {
    if (isPlanSelectionDisabled(plan)) {
        if (hasUnlockedAccess.value && isCommercialPlan(plan)) {
            notify('Пробный период уже активен. Дополнительный выбор тарифа сейчас не требуется.');
        }
        return;
    }

    selectedPlanId.value = plan.id;
    try {
        if (isCommercialPlan(plan)) {
            await subscriptionApi.startPayment({ plan_id: plan.id });
            notify(`Тариф «${plan.title || plan.id}» выбран.`);
            return;
        }

        activePlan.value = plan.id;
        notify('Бесплатный план выбран.');
    } catch {
        notify('Не удалось выбрать тариф. Попробуйте ещё раз.', 'error');
    } finally {
        selectedPlanId.value = '';
    }
};

const refreshIcons = async (): Promise<void> => {
    await nextTick();
    const feather = (window as any).feather;
    if (typeof feather?.replace === 'function') {
        feather.replace();
    }
};

const fetchPlans = async (): Promise<void> => {
    isLoading.value = true;
    loadError.value = '';

    try {
        const response = await storageStore.apiFetch(PLANS_ENDPOINT);
        if (!response.ok) {
            throw new Error('load_failed');
        }
        const payload = await response.json();
        plans.value = Array.isArray(payload) ? payload as PlanDto[] : [];
        await refreshIcons();
    } catch {
        loadError.value = 'Не удалось загрузить тарифы.';
    } finally {
        isLoading.value = false;
    }
};

const fetchTrialStatus = async (): Promise<void> => {
    try {
        const response = await storageStore.apiFetch('/api/subscription/status');
        if (!response.ok) {
            throw new Error('status_failed');
        }
        const payload = await response.json();
        const status = String(payload?.status || '').toLowerCase();
        const until = formatDateRu(payload?.subscription_until);
        const untilRaw = typeof payload?.subscription_until === 'string' ? payload.subscription_until : '';
        const untilDate = untilRaw ? new Date(untilRaw) : null;
        const isExpired = Boolean(untilDate && !Number.isNaN(untilDate.getTime()) && untilDate.getTime() < Date.now());

        if (isExpired) {
            trialStatus.value = {
                kind: 'expired',
                badgeText: 'Завершён',
                badgeClass: 'plans-trial-chip--expired',
                detailsText: until ? `Пробный период завершился ${until}.` : 'Пробный период завершён.'
            };
            return;
        }

        if (status === 'active') {
            trialStatus.value = {
                kind: 'active',
                badgeText: 'Активен',
                badgeClass: 'plans-trial-chip--active',
                detailsText: until ? `Действует до ${until}.` : 'Пробный период активен.'
            };
            return;
        }

        trialStatus.value = {
            kind: 'inactive',
            badgeText: 'Не активирован',
            badgeClass: 'plans-trial-chip--inactive',
            detailsText: 'Пробный период пока не активирован.'
        };
    } catch {
        trialStatus.value = {
            kind: 'error',
            badgeText: '—',
            badgeClass: 'plans-trial-chip--inactive',
            detailsText: 'Не удалось получить статус пробного периода.'
        };
    }
};

onMounted(async () => {
    document.body.dataset.preservePageTheme = 'true';
    await Promise.all([fetchPlans(), fetchTrialStatus()]);
});
</script>

<style scoped>
.plans-trial-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 34px;
  padding: 0 14px;
  border-radius: 9999px;
  border: 1px solid #d1d5db;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
}

.plans-trial-chip--active {
  border-color: transparent;
  background: linear-gradient(135deg, #34d399 0%, #3b82f6 100%);
  color: #ffffff;
  box-shadow: 0 8px 16px rgba(52, 211, 153, 0.24);
}

.plans-trial-chip--expired {
  border-color: #fecdd3;
  background: #fff1f2;
  color: #be123c;
}

.plans-trial-chip--inactive {
  border-color: #e2e8f0;
  background: #f8fafc;
  color: #64748b;
}
</style>
