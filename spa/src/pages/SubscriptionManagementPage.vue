<template>
    <section class="min-h-screen bg-gradient-to-br from-[#f8fafc] via-[#f0f9ff] to-[#f0fdf4]">
        <main class="flex-1 px-4 py-8">
            <div class="max-w-md mx-auto space-y-6">
                <div class="text-center">
                    <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-500 mb-4 shadow-lg">
                        <i data-feather="settings" class="w-7 h-7 text-white"></i>
                    </div>
                    <h1 class="text-2xl font-bold text-slate-800">Управление подпиской</h1>
                    <p class="text-slate-500 mt-2">Здесь можно отключить автопродление и удалить привязанный способ оплаты.</p>
                </div>

                <div class="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-4">
                    <p v-if="isLoading" class="text-center text-slate-400">Загружаем данные...</p>
                    <p v-else-if="loadError" class="text-center text-rose-600">{{ loadError }}</p>

                    <template v-else>
                        <div class="rounded-xl border border-rose-100 bg-rose-50/70 px-4 py-4 space-y-3">
                            <div>
                                <p class="font-semibold text-slate-800">Автопродление</p>
                                <p class="text-sm text-slate-500 mt-1">{{ cancellationDetailsText }}</p>
                            </div>
                            <button
                                v-if="canCancelSubscription"
                                type="button"
                                class="btn-secondary w-full"
                                :disabled="cancelSubscriptionSubmitting || confirmDialog.submitting"
                                @click="openCancelAutoRenewDialog"
                            >
                                {{ cancelSubscriptionSubmitting ? 'Отключаем...' : 'Отключить автопродление' }}
                            </button>
                        </div>

                        <div class="rounded-xl border border-slate-100 bg-slate-50 px-4 py-4 space-y-3">
                            <div class="flex items-center justify-between gap-3">
                                <p class="font-semibold text-slate-800">Привязанный способ оплаты</p>
                                <span class="subscription-method-chip" :class="hasBoundPaymentMethod ? 'subscription-method-chip--bound' : 'subscription-method-chip--none'">
                                    {{ hasBoundPaymentMethod ? 'Привязан' : 'Не привязан' }}
                                </span>
                            </div>
                            <p class="text-sm text-slate-500">{{ paymentMethodDetailsText }}</p>
                            <button
                                v-if="hasBoundPaymentMethod"
                                type="button"
                                class="btn-secondary w-full"
                                :disabled="removePaymentMethodSubmitting || confirmDialog.submitting"
                                @click="openRemovePaymentMethodDialog"
                            >
                                {{ removePaymentMethodSubmitting ? 'Удаляем...' : 'Удалить способ оплаты' }}
                            </button>
                        </div>
                    </template>

                    <button type="button" class="btn-primary w-full" @click="goBackToPlans">
                        Вернуться к тарифам
                    </button>
                </div>
            </div>
        </main>

        <div
            v-if="confirmDialog.visible"
            class="subscription-dialog-overlay"
            role="dialog"
            aria-modal="true"
            :aria-label="confirmDialog.title"
        >
            <div class="subscription-dialog-overlay__backdrop" @click="closeConfirmDialog"></div>
            <div class="subscription-dialog-overlay__card">
                <div class="subscription-dialog-overlay__header">
                    <div>
                        <p class="subscription-dialog-overlay__eyebrow">Подтверждение</p>
                        <h2 class="subscription-dialog-overlay__title">{{ confirmDialog.title }}</h2>
                    </div>
                    <button type="button" class="subscription-dialog-overlay__close" aria-label="Закрыть" @click="closeConfirmDialog">×</button>
                </div>
                <p class="subscription-dialog-overlay__status">{{ confirmDialog.message }}</p>
                <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <button type="button" class="btn-secondary w-full" :disabled="confirmDialog.submitting" @click="closeConfirmDialog">
                        Отмена
                    </button>
                    <button type="button" class="btn-primary w-full" :disabled="confirmDialog.submitting" @click="confirmDialogAction">
                        {{ confirmDialog.submitting ? 'Выполняем...' : confirmDialog.confirmLabel }}
                    </button>
                </div>
            </div>
        </div>
    </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { subscriptionApi } from '../api/subscriptionApi';
import type { SubscriptionStatusResponse } from '../api/contracts';

const router = useRouter();

const isLoading = ref(true);
const loadError = ref('');
const subscriptionStatusPayload = ref<SubscriptionStatusResponse | null>(null);
const cancelSubscriptionSubmitting = ref(false);
const removePaymentMethodSubmitting = ref(false);
const confirmDialog = reactive({
    visible: false,
    submitting: false,
    action: '' as '' | 'cancel_auto_renew' | 'remove_payment_method',
    title: '',
    message: '',
    confirmLabel: 'Подтвердить',
});

let previousBodyOverflow = '';

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

const notify = (message: string, type: 'success' | 'error' = 'success'): void => {
    const showNotification = (window as any).showNotification;
    if (typeof showNotification === 'function') {
        showNotification(message, type);
        return;
    }
    alert(message);
};

const refreshIcons = async (): Promise<void> => {
    await nextTick();
    const feather = (window as any).feather;
    if (typeof feather?.replace === 'function') {
        feather.replace();
    }
};

const lockBodyScroll = (): void => {
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
};

const unlockBodyScroll = (): void => {
    document.body.style.overflow = previousBodyOverflow;
};

const isAutoRenewEnabled = computed<boolean>(() => subscriptionStatusPayload.value?.subscription_auto_renew === true);
const subscriptionStatus = computed<string>(() => String(subscriptionStatusPayload.value?.subscription_status || '').toLowerCase());
const canCancelSubscription = computed<boolean>(() => subscriptionStatus.value === 'paid' && isAutoRenewEnabled.value);

const hasBoundPaymentMethod = computed<boolean>(() => subscriptionStatusPayload.value?.subscription_payment_method_bound === true);
const paymentMethodType = computed<string>(() => String(subscriptionStatusPayload.value?.subscription_payment_method_type || '').trim().toLowerCase());
const paymentMethodTitle = computed<string>(() => String(subscriptionStatusPayload.value?.subscription_payment_method_title || '').trim());
const paymentMethodDisplay = computed<string>(() => {
    if (!hasBoundPaymentMethod.value) {
        return 'Не привязан';
    }
    if (paymentMethodType.value === 'sbp') {
        return 'СБП';
    }
    if (paymentMethodTitle.value) {
        return paymentMethodTitle.value;
    }
    return 'Привязанный способ оплаты';
});

const cancellationDetailsText = computed<string>(() => {
    const until = formatDateRu(subscriptionStatusPayload.value?.subscription_until);
    if (isAutoRenewEnabled.value) {
        return until
            ? `Подписка продлевается автоматически. Если отключить сейчас, доступ сохранится до ${until}.`
            : 'Подписка продлевается автоматически. Если отключить сейчас, доступ сохранится до конца оплаченного периода.';
    }
    if (until) {
        return `Автопродление отключено. Доступ сохранится до ${until}.`;
    }
    return 'Автопродление отключено.';
});

const paymentMethodDetailsText = computed<string>(() => {
    if (!hasBoundPaymentMethod.value) {
        return 'Способ оплаты не привязан.';
    }
    return `Текущий способ: ${paymentMethodDisplay.value}. При удалении автопродление будет отключено.`;
});

const fetchStatus = async (): Promise<void> => {
    isLoading.value = true;
    loadError.value = '';
    try {
        const payload = await subscriptionApi.getStatus();
        subscriptionStatusPayload.value = payload;
    } catch {
        loadError.value = 'Не удалось загрузить статус подписки.';
    } finally {
        isLoading.value = false;
    }
};

const openCancelAutoRenewDialog = (): void => {
    if (cancelSubscriptionSubmitting.value || confirmDialog.submitting || !canCancelSubscription.value) {
        return;
    }
    confirmDialog.visible = true;
    confirmDialog.action = 'cancel_auto_renew';
    confirmDialog.title = 'Отключить автопродление?';
    confirmDialog.message = 'После отключения доступ останется до конца оплаченного периода, новых списаний не будет.';
    confirmDialog.confirmLabel = 'Отключить';
    lockBodyScroll();
};

const openRemovePaymentMethodDialog = (): void => {
    if (removePaymentMethodSubmitting.value || confirmDialog.submitting || !hasBoundPaymentMethod.value) {
        return;
    }
    confirmDialog.visible = true;
    confirmDialog.action = 'remove_payment_method';
    confirmDialog.title = 'Удалить способ оплаты?';
    confirmDialog.message = 'Способ оплаты будет отвязан, автопродление отключится.';
    confirmDialog.confirmLabel = 'Удалить';
    lockBodyScroll();
};

const closeConfirmDialog = (): void => {
    if (confirmDialog.submitting) {
        return;
    }
    confirmDialog.visible = false;
    confirmDialog.action = '';
    confirmDialog.title = '';
    confirmDialog.message = '';
    confirmDialog.confirmLabel = 'Подтвердить';
    unlockBodyScroll();
};

const confirmDialogAction = async (): Promise<void> => {
    if (!confirmDialog.visible || confirmDialog.submitting) {
        return;
    }
    const action = confirmDialog.action;
    if (action !== 'cancel_auto_renew' && action !== 'remove_payment_method') {
        closeConfirmDialog();
        return;
    }

    confirmDialog.submitting = true;
    let success = false;

    try {
        if (action === 'cancel_auto_renew') {
            cancelSubscriptionSubmitting.value = true;
            const payload = await subscriptionApi.cancelSubscription();
            subscriptionStatusPayload.value = payload;
            notify('Автопродление отключено.', 'success');
        } else {
            removePaymentMethodSubmitting.value = true;
            const payload = await subscriptionApi.removePaymentMethod();
            subscriptionStatusPayload.value = payload;
            notify('Способ оплаты удалён. Автопродление отключено.', 'success');
        }
        success = true;
    } catch {
        if (action === 'cancel_auto_renew') {
            notify('Не удалось отключить автопродление. Попробуйте ещё раз.', 'error');
        } else {
            notify('Не удалось удалить способ оплаты. Попробуйте ещё раз.', 'error');
        }
    } finally {
        cancelSubscriptionSubmitting.value = false;
        removePaymentMethodSubmitting.value = false;
        confirmDialog.submitting = false;
        if (success) {
            closeConfirmDialog();
        }
    }
};

const goBackToPlans = async (): Promise<void> => {
    await router.push('/plans');
};

onMounted(() => {
    void fetchStatus();
    void refreshIcons();
});

onBeforeUnmount(() => {
    unlockBodyScroll();
});
</script>

<style scoped>
.subscription-method-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 30px;
  padding: 0 12px;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid transparent;
}

.subscription-method-chip--bound {
  background: #dcfce7;
  color: #166534;
  border-color: #bbf7d0;
}

.subscription-method-chip--none {
  background: #f8fafc;
  color: #64748b;
  border-color: #e2e8f0;
}

.subscription-dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 2147483400;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.subscription-dialog-overlay__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.64);
  backdrop-filter: blur(6px);
}

.subscription-dialog-overlay__card {
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

.subscription-dialog-overlay__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.subscription-dialog-overlay__eyebrow {
  margin: 0 0 6px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #0f766e;
}

.subscription-dialog-overlay__title {
  margin: 0;
  font-size: 24px;
  line-height: 1.2;
  color: #0f172a;
}

.subscription-dialog-overlay__close {
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

.subscription-dialog-overlay__status {
  margin: 12px 0 20px;
  color: #475569;
  line-height: 1.5;
}

@media (max-width: 640px) {
  .subscription-dialog-overlay {
    padding: 12px;
  }

  .subscription-dialog-overlay__card {
    width: 100%;
    max-height: calc(100vh - 24px);
    padding: 18px 16px 16px;
    border-radius: 24px;
  }

  .subscription-dialog-overlay__title {
    font-size: 20px;
  }
}
</style>
