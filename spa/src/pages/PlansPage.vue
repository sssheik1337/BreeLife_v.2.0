<template>
    <section class="min-h-screen bg-gradient-to-br from-[#f8fafc] via-[#f0f9ff] to-[#f0fdf4]">
        <main class="flex-1 px-4 py-8">
            <div class="max-w-md mx-auto space-y-6">
                <div class="text-center">
                    <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-500 mb-4 shadow-lg">
                        <i data-feather="credit-card" class="w-7 h-7 text-white"></i>
                    </div>
                    <h1 class="text-2xl font-bold text-slate-800">Тарифы</h1>
                    <p class="text-slate-500 mt-2">Оплатить подписку можно заранее, не дожидаясь окончания пробного периода.</p>
                </div>

                <div class="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-4">
                    <p class="text-sm text-slate-500">
                        Пробный период действует 30 дней и открывает Premium. Если хотите, подписку можно оформить заранее и продлить доступ без паузы.
                    </p>
                    <div id="plans-trial-status" class="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                        <div class="flex items-center justify-between gap-3">
                            <p class="font-semibold text-slate-800">Пробный период</p>
                            <span class="plans-trial-chip" :class="trialStatus.badgeClass">{{ trialStatus.badgeText }}</span>
                        </div>
                        <p class="text-sm text-slate-500 mt-1">{{ trialStatus.detailsText }}</p>
                    </div>
                    <button type="button" class="btn-secondary w-full" @click="goToSubscriptionManagement">
                        Управление подпиской
                    </button>
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
                                :title="selectedPlanId === plan.id ? 'Переходим к оплате...' : (isCommercialPlan(plan) && trialStatus.kind === 'lifetime' ? 'Супердоступ уже активен' : undefined)"
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

        <div v-if="paymentWidget.visible" class="plans-payment-overlay" role="dialog" aria-modal="true" aria-label="Оплата YooKassa">
            <div class="plans-payment-overlay__backdrop" @click="closePaymentWidget"></div>
            <div class="plans-payment-overlay__card">
                <div class="plans-payment-overlay__header">
                    <div>
                        <p class="plans-payment-overlay__eyebrow">YooKassa Widget</p>
                        <h2 class="plans-payment-overlay__title">{{ paymentWidget.title || 'Оплата подписки' }}</h2>
                    </div>
                    <button type="button" class="plans-payment-overlay__close" aria-label="Закрыть оплату" @click="closePaymentWidget">×</button>
                </div>

                <p v-if="paymentWidget.statusText" class="plans-payment-overlay__status">{{ paymentWidget.statusText }}</p>
                <p v-if="paymentWidget.errorText" class="plans-payment-overlay__error">{{ paymentWidget.errorText }}</p>

                <div v-show="paymentWidget.isLoading" class="plans-payment-overlay__loading">
                    Загружаем встроенную форму оплаты...
                </div>
                <div id="plans-payment-widget-host" ref="paymentWidgetHost" class="plans-payment-overlay__widget-host"></div>
            </div>
        </div>
    </section>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useStorageStore } from '../stores/storageStore';
import { subscriptionApi, type StartPaymentResponse } from '../api/subscriptionApi';

declare global {
    interface Window {
        YooMoneyCheckoutWidget?: new (options: {
            confirmation_token: string;
            return_url?: string;
            error_callback?: (error: unknown) => void;
        }) => {
            render: (target: string | HTMLElement) => void;
            destroy?: () => void;
        };
    }
}

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
const router = useRouter();

const plans = ref<PlanDto[]>([]);
const activePlan = ref('free');
const isLoading = ref(true);
const loadError = ref('');
const selectedPlanId = ref('');
const paymentWidgetHost = ref<HTMLElement | null>(null);
const trialStatus = ref({
    kind: 'loading' as 'loading' | 'active' | 'paid' | 'lifetime' | 'expired' | 'inactive' | 'error',
    badgeText: 'Проверка...',
    badgeClass: 'plans-trial-chip--inactive',
    detailsText: 'Проверяем срок действия пробного периода.'
});
const paymentWidget = reactive({
    visible: false,
    isLoading: false,
    title: '',
    paymentId: '',
    statusText: '',
    errorText: ''
});

let widgetScriptPromise: Promise<void> | null = null;
let widgetInstance: { render: (target: string | HTMLElement) => void; destroy?: () => void } | null = null;
let paymentStatusPollTimer: number | null = null;
let previousBodyOverflow = '';

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
const isLifetimeAccessActive = (): boolean => trialStatus.value.kind === 'lifetime';
const isPlanSelectionDisabled = (plan: PlanDto): boolean => selectedPlanId.value === plan.id || (isCommercialPlan(plan) && isLifetimeAccessActive());

const planSubtitle = (plan: PlanDto): string => {
    const durationDays = Number(plan.duration_days);
    return durationDays > 0 ? `Срок: ${durationDays} дней` : 'Без ограничений по сроку';
};

const planStatusText = (plan: PlanDto): string => {
    if (isCommercialPlan(plan)) {
        if (trialStatus.value.kind === 'paid') {
            return 'Коммерческий тариф. Повторная оплата продлит оплаченный доступ.';
        }
        if (trialStatus.value.kind === 'lifetime') {
            return 'У пользователя бессрочный доступ. Дополнительная оплата не требуется.';
        }
        if (trialStatus.value.kind === 'active') {
            return 'Коммерческий тариф. Можно оплатить заранее, чтобы доступ не оборвался после trial.';
        }
        if (trialStatus.value.kind === 'expired') {
            return 'Коммерческий тариф. После оплаты доступ восстановится.';
        }
        return 'Коммерческий тариф';
    }
    return 'Текущий бесплатный план';
};

const planButtonText = (plan: PlanDto): string => {
    if (selectedPlanId.value === plan.id) {
        return 'Открываем оплату...';
    }
    if (activePlan.value === plan.id && !isCommercialPlan(plan)) {
        return 'Выбран';
    }
    if (isCommercialPlan(plan) && trialStatus.value.kind === 'active') {
        return 'Оплатить заранее';
    }
    if (isCommercialPlan(plan) && trialStatus.value.kind === 'paid') {
        return 'Продлить доступ';
    }
    if (isCommercialPlan(plan) && trialStatus.value.kind === 'lifetime') {
        return 'Супердоступ активен';
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

const lockBodyScroll = (): void => {
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
};

const unlockBodyScroll = (): void => {
    document.body.style.overflow = previousBodyOverflow;
};

const stopPaymentStatusPolling = (): void => {
    if (paymentStatusPollTimer !== null) {
        window.clearInterval(paymentStatusPollTimer);
        paymentStatusPollTimer = null;
    }
};

const destroyPaymentWidgetInstance = (): void => {
    stopPaymentStatusPolling();
    if (widgetInstance && typeof widgetInstance.destroy === 'function') {
        try {
            widgetInstance.destroy();
        } catch {
            // Ignore widget cleanup errors.
        }
    }
    widgetInstance = null;
};

const closePaymentWidget = (): void => {
    destroyPaymentWidgetInstance();
    paymentWidget.visible = false;
    paymentWidget.isLoading = false;
    paymentWidget.title = '';
    paymentWidget.paymentId = '';
    paymentWidget.statusText = '';
    paymentWidget.errorText = '';
    unlockBodyScroll();
};

const goToSubscriptionManagement = async (): Promise<void> => {
    await router.push('/subscription-management');
};

const loadWidgetScript = async (): Promise<void> => {
    if (window.YooMoneyCheckoutWidget) {
        return;
    }
    if (!widgetScriptPromise) {
        widgetScriptPromise = new Promise<void>((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://yookassa.ru/checkout-widget/v1/checkout-widget.js';
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('widget_script_failed'));
            document.head.appendChild(script);
        });
    }
    await widgetScriptPromise;
};

const startPaymentStatusPolling = (paymentId: string): void => {
    stopPaymentStatusPolling();
    paymentStatusPollTimer = window.setInterval(async () => {
        try {
            const payload = await subscriptionApi.getPaymentStatus(paymentId);
            const payment = (payload as { payment?: Record<string, unknown> }).payment || {};
            const status = String(payment.status || '').toLowerCase();
            if (status === 'succeeded') {
                stopPaymentStatusPolling();
                await fetchTrialStatus();
                notify('Оплата прошла успешно. Доступ обновлён.', 'success');
                closePaymentWidget();
                return;
            }
            if (status === 'canceled' || status === 'cancelled') {
                stopPaymentStatusPolling();
                paymentWidget.isLoading = false;
                paymentWidget.statusText = '';
                paymentWidget.errorText = 'Платёж был отменён. Можно закрыть окно и попробовать снова.';
                return;
            }
            paymentWidget.statusText = 'Ожидаем подтверждение оплаты от YooKassa...';
        } catch {
            // Keep polling: webhook/API status may lag for a short time.
        }
    }, 3000);
};

const openEmbeddedPaymentWidget = async (payment: StartPaymentResponse): Promise<void> => {
    const confirmationToken = String(payment.confirmation_token || '').trim();
    const paymentId = String(payment.payment_id || '').trim();
    if (!confirmationToken || !paymentId) {
        throw new Error('payment_widget_payload_missing');
    }

    paymentWidget.visible = true;
    paymentWidget.isLoading = true;
    paymentWidget.title = String(payment.plan?.title || 'Оплата подписки');
    paymentWidget.paymentId = paymentId;
    paymentWidget.statusText = 'Подготавливаем встроенную форму оплаты...';
    paymentWidget.errorText = '';
    lockBodyScroll();

    await nextTick();
    await loadWidgetScript();

    if (!paymentWidgetHost.value || !window.YooMoneyCheckoutWidget) {
        throw new Error('payment_widget_unavailable');
    }

    destroyPaymentWidgetInstance();
    widgetInstance = new window.YooMoneyCheckoutWidget({
        confirmation_token: confirmationToken,
        return_url: String(payment.return_url || `${window.location.origin}/payments/return`),
        error_callback: () => {
            paymentWidget.isLoading = false;
            paymentWidget.statusText = '';
            paymentWidget.errorText = 'YooKassa Widget вернул ошибку. Проверьте данные оплаты и попробуйте снова.';
        }
    });
    widgetInstance.render('plans-payment-widget-host');
    paymentWidget.isLoading = false;
    paymentWidget.statusText = 'Форма оплаты загружена. После подтверждения доступ обновится автоматически.';
    startPaymentStatusPolling(paymentId);
};

const requestOfferConsentBeforePayment = (): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
        let settled = false;
        const finish = (accepted: boolean): void => {
            if (settled) {
                return;
            }
            settled = true;
            resolve(accepted === true);
        };
        window.dispatchEvent(new CustomEvent('offer-consent-request', {
            detail: { resolve: finish }
        }));
        // Safety fallback in case the gate component is not mounted for any reason.
        window.setTimeout(() => finish(false), 10000);
    });
};

const selectPlan = async (plan: PlanDto): Promise<void> => {
    if (isPlanSelectionDisabled(plan)) {
        return;
    }

    selectedPlanId.value = plan.id;
    try {
        if (isCommercialPlan(plan)) {
            const offerAccepted = await requestOfferConsentBeforePayment();
            if (!offerAccepted) {
                return;
            }
            const payment = await subscriptionApi.startPayment({ plan_id: plan.id });
            if (String(payment.confirmation_type || '').toLowerCase() !== 'embedded' || !payment.confirmation_token) {
                throw new Error('payment_widget_missing');
            }
            notify('Открываем встроенную форму оплаты.');
            await openEmbeddedPaymentWidget(payment);
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
        const subscriptionStatus = String(payload?.subscription_status || '').toLowerCase();
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

        if (status === 'active' && subscriptionStatus === 'lifetime') {
            trialStatus.value = {
                kind: 'lifetime',
                badgeText: 'Супердоступ',
                badgeClass: 'plans-trial-chip--active',
                detailsText: 'У пользователя бессрочный доступ без ограничения по сроку.'
            };
            return;
        }

        if (status === 'active' && subscriptionStatus === 'paid') {
            const autoRenewEnabled = payload?.subscription_auto_renew === true;
            trialStatus.value = {
                kind: 'paid',
                badgeText: 'Оплачен',
                badgeClass: 'plans-trial-chip--active',
                detailsText: autoRenewEnabled
                    ? (until ? `Оплаченный доступ активен до ${until}. Автопродление включено.` : 'Оплаченный доступ активен. Автопродление включено.')
                    : (until ? `Оплаченный доступ активен до ${until}. Автопродление отключено.` : 'Оплаченный доступ активен. Автопродление отключено.')
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

const syncLatestPayment = async (): Promise<void> => {
    try {
        await subscriptionApi.syncLastPayment();
    } catch {
        // Trial/subscription status will still be loaded from backend afterwards.
    }
};

onMounted(async () => {
    document.body.dataset.preservePageTheme = 'true';
    await fetchPlans();
    await syncLatestPayment();
    await fetchTrialStatus();
});

onBeforeUnmount(() => {
    closePaymentWidget();
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

.plans-payment-overlay {
  position: fixed;
  inset: 0;
  z-index: 2147483400;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.plans-payment-overlay__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.64);
  backdrop-filter: blur(6px);
}

.plans-payment-overlay__card {
  position: relative;
  width: min(100%, 520px);
  max-height: calc(100vh - 40px);
  overflow: auto;
  border-radius: 28px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, #f8fafc 100%);
  border: 1px solid rgba(148, 163, 184, 0.22);
  box-shadow: 0 28px 70px rgba(15, 23, 42, 0.24);
  padding: 22px 20px 20px;
}

.plans-payment-overlay__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.plans-payment-overlay__eyebrow {
  margin: 0 0 6px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #0f766e;
}

.plans-payment-overlay__title {
  margin: 0;
  font-size: 24px;
  line-height: 1.2;
  color: #0f172a;
}

.plans-payment-overlay__close {
  border: none;
  background: #e2e8f0;
  color: #0f172a;
  width: 36px;
  height: 36px;
  border-radius: 999px;
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
}

.plans-payment-overlay__status {
  margin: 12px 0 0;
  color: #475569;
  line-height: 1.5;
}

.plans-payment-overlay__error {
  margin: 12px 0 0;
  color: #b91c1c;
  line-height: 1.5;
}

.plans-payment-overlay__loading {
  margin-top: 18px;
  padding: 14px 16px;
  border-radius: 16px;
  background: #ecfeff;
  color: #0f766e;
  font-weight: 600;
}

.plans-payment-overlay__widget-host {
  margin-top: 18px;
  min-height: 320px;
}

@media (max-width: 640px) {
  .plans-payment-overlay {
    padding: 12px;
  }

  .plans-payment-overlay__card {
    width: 100%;
    max-height: calc(100vh - 24px);
    padding: 18px 16px 16px;
    border-radius: 24px;
  }

  .plans-payment-overlay__title {
    font-size: 20px;
  }
}
</style>
