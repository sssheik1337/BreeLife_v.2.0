<template>
    <div v-if="visible" class="telegram-gate" role="dialog" aria-modal="true" aria-label="Открытие через Telegram">
        <div class="telegram-gate__backdrop"></div>
        <div class="telegram-gate__card">
            <p class="telegram-gate__eyebrow">BreeLife Mini App</p>
            <h2 class="telegram-gate__title">Приложение работает только внутри Telegram</h2>
            <p class="telegram-gate__text">
                Откройте бота и запустите Mini App из Telegram, чтобы загрузился ваш профиль.
            </p>
            <button
                type="button"
                class="telegram-gate__button"
                :disabled="isResolvingLink"
                @click="openTelegramBot"
            >
                {{ ctaLabel }}
            </button>
            <p v-if="linkError" class="telegram-gate__hint">
                Не удалось получить ссылку на бота. Проверьте `TELEGRAM_BOT_TOKEN`.
            </p>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ensureTelegramAuthSession, getTelegramInitDataSnapshot } from '../platform/telegramAuth';

interface LaunchLinkResponse {
    ok?: boolean;
    bot_url?: string | null;
    bot_deep_link?: string | null;
}

const visible = ref(false);
const isResolvingLink = ref(false);
const linkError = ref(false);
const botUrl = ref('');
const botDeepLink = ref('');

const tryDevSessionLogin = async (): Promise<boolean> => {
    try {
        const response = await fetch('/api/dev/login', {
            method: 'POST',
            credentials: 'same-origin',
        });
        return response.ok;
    } catch {
        return false;
    }
};

const ctaLabel = computed(() => (isResolvingLink.value ? 'Получаем ссылку...' : 'Открыть Telegram-бота'));

const loadBotLink = async (): Promise<void> => {
    isResolvingLink.value = true;
    linkError.value = false;
    try {
        const response = await fetch('/api/telegram/launch-link', {
            method: 'GET',
            credentials: 'same-origin',
        });
        if (!response.ok) {
            linkError.value = true;
            return;
        }
        const payload = (await response.json()) as LaunchLinkResponse;
        botUrl.value = typeof payload.bot_url === 'string' ? payload.bot_url : '';
        botDeepLink.value = typeof payload.bot_deep_link === 'string' ? payload.bot_deep_link : '';
        if (!botUrl.value && !botDeepLink.value) {
            linkError.value = true;
        }
    } catch {
        linkError.value = true;
    } finally {
        isResolvingLink.value = false;
    }
};

const openTelegramBot = (): void => {
    const target = botDeepLink.value || botUrl.value;
    if (!target) {
        return;
    }
    window.location.href = target;
};

const runGateCheck = async (): Promise<void> => {
    if (getTelegramInitDataSnapshot()) {
        visible.value = false;
        return;
    }

    const authorized = await ensureTelegramAuthSession({
        reason: 'telegram-only-gate',
        timeoutMs: 2200,
    });
    const hasInitData = Boolean(getTelegramInitDataSnapshot());
    if (authorized || hasInitData) {
        visible.value = false;
        return;
    }

    // Local browser fallback for development mode.
    const devLoggedIn = await tryDevSessionLogin();
    if (devLoggedIn) {
        visible.value = false;
        return;
    }

    visible.value = true;
    await loadBotLink();
};

onMounted(() => {
    void runGateCheck();
});
</script>

<style scoped>
.telegram-gate {
    position: fixed;
    inset: 0;
    z-index: 2147483646;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
}

.telegram-gate__backdrop {
    position: absolute;
    inset: 0;
    background: rgba(15, 23, 42, 0.62);
    backdrop-filter: blur(4px);
}

.telegram-gate__card {
    position: relative;
    width: min(440px, 100%);
    border-radius: 24px;
    padding: 24px;
    text-align: center;
    background: linear-gradient(145deg, #ecfeff 0%, #f0fdf4 100%);
    border: 1px solid rgba(15, 23, 42, 0.1);
    box-shadow: 0 30px 70px rgba(15, 23, 42, 0.25);
}

.telegram-gate__eyebrow {
    margin: 0 0 8px 0;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #0f766e;
}

.telegram-gate__title {
    margin: 0;
    font-size: 24px;
    line-height: 1.2;
    color: #0f172a;
}

.telegram-gate__text {
    margin: 12px 0 0 0;
    color: #334155;
    line-height: 1.5;
}

.telegram-gate__button {
    margin-top: 18px;
    width: 100%;
    border: 0;
    border-radius: 14px;
    padding: 12px 14px;
    font-size: 16px;
    font-weight: 700;
    color: #ffffff;
    background: linear-gradient(135deg, #0ea5e9 0%, #14b8a6 100%);
    cursor: pointer;
}

.telegram-gate__button[disabled] {
    opacity: 0.7;
    cursor: wait;
}

.telegram-gate__hint {
    margin: 10px 0 0 0;
    font-size: 13px;
    color: #b91c1c;
}
</style>
