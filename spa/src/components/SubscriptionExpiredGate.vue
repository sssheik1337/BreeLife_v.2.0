<template>
    <div v-if="visible" class="subscription-gate" role="dialog" aria-modal="true" aria-label="Пробный период истёк">
        <div class="subscription-gate__backdrop"></div>

        <div class="subscription-gate__shell">
            <header class="subscription-gate__header" aria-label="Логотип приложения">
                <div class="subscription-gate__logo">
                    <img :src="logoUrl" alt="" />
                </div>
            </header>

            <div class="subscription-gate__content">
                <div class="subscription-gate__card">
                    <p class="subscription-gate__eyebrow">BreeLife</p>
                    <h2 class="subscription-gate__title">Пробный период истёк</h2>
                    <p class="subscription-gate__text">{{ descriptionText }}</p>

                    <div class="subscription-gate__actions">
                        <button type="button" class="btn-primary" @click="openPlans">
                            Открыть тарифы
                        </button>
                        <button
                            v-if="isPreview"
                            type="button"
                            class="btn-secondary"
                            @click="closePreview"
                        >
                            Закрыть превью
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { subscriptionApi } from '../api/subscriptionApi';

type SubscriptionKind = 'unknown' | 'expired' | 'active' | 'paid' | 'trial' | 'lifetime' | 'inactive';

const route = useRoute();
const router = useRouter();
const logoUrl = new URL('../../../static/emoji_u1f33f.svg', import.meta.url).href;

const statusKind = ref<SubscriptionKind>('unknown');
const expiredAtLabel = ref('');
const isPreview = computed(() => route.query.paywall_preview === '1');
const isPlansRoute = computed(() => route.name === 'plans');
const visible = computed(() => (statusKind.value === 'expired' || isPreview.value) && !isPlansRoute.value);
const descriptionText = computed(() => {
    if (isPreview.value) {
        return 'Это превью полноэкранного экрана после завершения пробного периода.';
    }
    if (expiredAtLabel.value) {
        return `Доступ к приложению ограничен. Чтобы продолжить, оплатите тариф. Пробный период завершился ${expiredAtLabel.value}.`;
    }
    return 'Доступ к приложению ограничен. Чтобы продолжить, оплатите тариф.';
});

let latestRunId = 0;
let previousBodyOverflow = '';

const formatDateRu = (value: unknown): string => {
    if (typeof value !== 'string' || !value) {
        return '';
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return '';
    }
    return parsed.toLocaleDateString('ru-RU');
};

const lockBodyScroll = (locked: boolean): void => {
    if (typeof document === 'undefined') {
        return;
    }
    if (locked) {
        previousBodyOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return;
    }
    document.body.style.overflow = previousBodyOverflow;
};

const refreshSubscriptionState = async (): Promise<void> => {
    const runId = latestRunId + 1;
    latestRunId = runId;

    try {
        const payload = await subscriptionApi.getStatus();
        if (runId !== latestRunId) {
            return;
        }

        const subscriptionStatus = String(payload?.subscription_status || '').toLowerCase();
        expiredAtLabel.value = formatDateRu(payload?.subscription_until);

        if (subscriptionStatus === 'expired') {
            statusKind.value = 'expired';
            return;
        }
        if (subscriptionStatus === 'paid') {
            statusKind.value = 'paid';
            return;
        }
        if (subscriptionStatus === 'lifetime') {
            statusKind.value = 'lifetime';
            return;
        }
        if (subscriptionStatus === 'trial') {
            statusKind.value = 'trial';
            return;
        }
        if (payload?.status === 'active') {
            statusKind.value = 'active';
            return;
        }
        statusKind.value = 'inactive';
    } catch {
        if (runId === latestRunId) {
            statusKind.value = 'inactive';
            expiredAtLabel.value = '';
        }
    }
};

const openPlans = async (): Promise<void> => {
    if (isPlansRoute.value) {
        return;
    }
    await router.push({ name: 'plans' });
};

const closePreview = async (): Promise<void> => {
    const query = { ...route.query };
    delete query.paywall_preview;
    await router.replace({ path: route.path, query, hash: route.hash });
};

watch(visible, (nextVisible) => {
    lockBodyScroll(nextVisible);
}, { immediate: true });

watch(
    () => route.fullPath,
    () => {
        void refreshSubscriptionState();
    }
);

onMounted(() => {
    void refreshSubscriptionState();
});

onBeforeUnmount(() => {
    lockBodyScroll(false);
});
</script>

<style scoped>
.subscription-gate {
    position: fixed;
    inset: 0;
    z-index: 2147483645;
}

.subscription-gate__backdrop {
    position: absolute;
    inset: 0;
    background: rgba(15, 23, 42, 0.72);
    backdrop-filter: blur(6px);
}

.subscription-gate__shell {
    position: relative;
    display: flex;
    min-height: 100%;
    flex-direction: column;
    padding: calc(max(env(safe-area-inset-top), var(--tg-safe-top, 0px)) + 20px) 20px 24px;
}

.subscription-gate__header {
    display: flex;
    justify-content: center;
    padding-bottom: 20px;
}

.subscription-gate__logo {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 68px;
    height: 68px;
    border-radius: 22px;
    background: linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%);
    box-shadow: 0 18px 40px rgba(15, 23, 42, 0.18);
}

.subscription-gate__logo img {
    display: block;
    width: 40px;
    height: 40px;
    object-fit: contain;
}

.subscription-gate__content {
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: center;
}

.subscription-gate__card {
    width: min(440px, 100%);
    border-radius: 28px;
    border: 1px solid rgba(255, 255, 255, 0.72);
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.97) 0%, rgba(248, 250, 252, 0.98) 100%);
    box-shadow: 0 30px 70px rgba(15, 23, 42, 0.24);
    padding: 28px 24px;
    text-align: center;
}

.subscription-gate__eyebrow {
    margin: 0 0 10px 0;
    color: #0f766e;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
}

.subscription-gate__title {
    margin: 0;
    color: #0f172a;
    font-size: 28px;
    line-height: 1.15;
}

.subscription-gate__text {
    margin: 14px 0 0 0;
    color: #334155;
    line-height: 1.55;
}

.subscription-gate__actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 12px;
    margin-top: 24px;
}

.subscription-gate__actions :deep(.btn-primary),
.subscription-gate__actions :deep(.btn-secondary) {
    min-width: 176px;
}

@media (max-width: 640px) {
    .subscription-gate__shell {
        padding-inline: 16px;
        padding-bottom: 20px;
    }

    .subscription-gate__card {
        padding: 24px 18px;
    }

    .subscription-gate__title {
        font-size: 24px;
    }

    .subscription-gate__actions {
        flex-direction: column;
        align-items: center;
    }

    .subscription-gate__actions :deep(.btn-primary),
    .subscription-gate__actions :deep(.btn-secondary) {
        width: 100%;
        min-width: 0;
        max-width: 320px;
    }
}
</style>
