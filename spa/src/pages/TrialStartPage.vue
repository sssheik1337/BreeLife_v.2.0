<template>
    <section
        class="min-h-screen"
        style="background: var(--tg-bg-color, #f8fafc); color: var(--tg-text-color, #0f172a);"
        data-spa-trial-start
    >
        <main class="flex-1 px-4 py-8 flex items-center justify-center">
            <section class="w-full max-w-md">
                <div class="bg-white/90 rounded-3xl border border-slate-100 shadow-[0_20px_50px_rgba(15,23,42,0.08)] p-7 text-center">
                    <div class="mx-auto mb-5 h-16 w-16 rounded-full bg-emerald-50 flex items-center justify-center text-3xl" aria-hidden="true">🎁</div>
                    <h1 class="text-2xl font-bold text-slate-800">Мы всё подготовили для вас 💚</h1>
                    <p class="mt-3 text-slate-500">Вы получили полный доступ ко всем возможностям приложения</p>

                    <div class="mt-5 rounded-2xl bg-emerald-50 px-4 py-3">
                        <p id="trial-start-keyline" class="text-base font-semibold text-emerald-800">{{ keylineText }}</p>
                    </div>

                    <p class="mt-3 text-xs text-slate-500">Без оплаты и без привязки карты</p>

                    <button
                        id="trial-start-continue"
                        type="button"
                        class="btn-primary w-full mt-6 flex items-center justify-center gap-2"
                        :disabled="submitting"
                        @click="handleContinue"
                    >
                        <span>Продолжить</span>
                        <i data-feather="arrow-right" class="w-5 h-5"></i>
                    </button>
                </div>
            </section>
        </main>
    </section>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { subscriptionApi } from '../api/subscriptionApi';
import { useStorageStore } from '../stores/storageStore';

const router = useRouter();
const storageStore = useStorageStore();

const keylineText = ref('Пробный период активен');
const submitting = ref(false);

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

const formatDateRu = (isoValue: unknown): string | null => {
    if (typeof isoValue !== 'string' || !isoValue) {
        return null;
    }
    const date = new Date(isoValue);
    if (Number.isNaN(date.getTime())) {
        return null;
    }
    return new Intl.DateTimeFormat('ru-RU', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    }).format(date);
};

const refreshFeatherIcons = async (): Promise<void> => {
    await nextTick();
    const feather = (window as any).feather;
    if (typeof feather?.replace === 'function') {
        feather.replace();
    }
};

const ensureTrialStatus = async (): Promise<Record<string, unknown> | null> => {
    try {
        const status = await subscriptionApi.getStatus();
        if (status && typeof status === 'object' && status.subscription_until) {
            return status as Record<string, unknown>;
        }
    } catch {
        // Ignore status errors and fall back to explicit trial start.
    }

    try {
        const started = await subscriptionApi.startTrial();
        return started && typeof started === 'object' ? (started as Record<string, unknown>) : null;
    } catch {
        return null;
    }
};

const updateKeylineText = (subscription: Record<string, unknown> | null): void => {
    const trialEndDate = formatDateRu(subscription?.subscription_until);
    if (!trialEndDate) {
        keylineText.value = 'Пробный период уже активен для вашего аккаунта';
        return;
    }
    keylineText.value = `Пробный период активен до ${trialEndDate}`;
};

const markTrialWelcomeSeen = async (): Promise<boolean> => {
    try {
        const saved = await storageStore.patchUserProfileWithBackend({ trial_welcome_seen: true });
        return Boolean(saved);
    } catch {
        return false;
    }
};

const handleContinue = async (): Promise<void> => {
    if (submitting.value) {
        return;
    }
    submitting.value = true;
    const saved = await markTrialWelcomeSeen();
    if (!saved) {
        submitting.value = false;
        notify('Не удалось завершить настройку. Попробуйте ещё раз.', 'error');
        return;
    }
    await router.replace('/profile');
};

onMounted(() => {
    void (async () => {
        document.body.dataset.preservePageTheme = 'true';
        const subscription = await ensureTrialStatus();
        updateKeylineText(subscription);
        await refreshFeatherIcons();
    })();
});

onBeforeUnmount(() => {
    delete document.body.dataset.preservePageTheme;
});
</script>
