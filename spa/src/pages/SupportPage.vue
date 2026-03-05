<template>
    <section class="min-h-screen bg-gradient-to-br from-[#f8fafc] via-[#f0f9ff] to-[#f0fdf4]">
        <main class="flex-1 px-4 py-8">
            <div class="max-w-md mx-auto space-y-8">
                <div class="text-center">
                    <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 mb-4 shadow-lg">
                        <i data-feather="life-buoy" class="w-7 h-7 text-white"></i>
                    </div>
                    <h1 class="text-2xl font-bold text-slate-800">Помощь</h1>
                    <p class="text-slate-500 mt-2">Если нужна поддержка, воспользуйтесь удобным способом связи.</p>
                </div>

                <div class="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-3">
                    <p v-if="isLoading" class="text-center text-sm text-slate-400">Загрузка контактов...</p>

                    <template v-else-if="hasAnyContacts">
                        <div
                            v-for="item in contactRows"
                            :key="item.key"
                            class="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"
                        >
                            <p class="text-xs text-slate-500">{{ item.label }}</p>
                            <p class="mt-1 text-sm font-semibold text-slate-800 break-all">{{ item.value }}</p>
                        </div>

                        <a
                            v-if="usernameUrl"
                            :href="usernameUrl"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 hover:bg-slate-100 transition"
                        >
                            <div>
                                <p class="font-semibold text-slate-800">Telegram аккаунт</p>
                                <p class="text-sm text-slate-500 break-all">{{ username || usernameUrl }}</p>
                            </div>
                            <i data-feather="external-link" class="w-5 h-5 text-slate-400"></i>
                        </a>

                        <a
                            v-if="channelUrl"
                            :href="channelUrl"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 hover:bg-slate-100 transition"
                        >
                            <div>
                                <p class="font-semibold text-slate-800">Канал</p>
                                <p class="text-sm text-slate-500 break-all">{{ channelUrl }}</p>
                            </div>
                            <i data-feather="external-link" class="w-5 h-5 text-slate-400"></i>
                        </a>
                    </template>

                    <p v-else class="text-center text-sm text-slate-400">Контакты поддержки пока не добавлены.</p>
                </div>
            </div>
        </main>
    </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import { useStorageStore } from '../stores/storageStore';

interface SupportContactsResponse {
    phone?: string | null;
    email?: string | null;
    username?: string | null;
    username_url?: string | null;
    channel_url?: string | null;
}

const storageStore = useStorageStore();
const isLoading = ref(true);
const phone = ref('');
const email = ref('');
const username = ref('');
const usernameUrl = ref('');
const channelUrl = ref('');

const normalizeText = (value: unknown): string => {
    if (typeof value !== 'string') {
        return '';
    }
    return value.trim();
};

const contactRows = computed(() => {
    const rows: Array<{ key: string; label: string; value: string }> = [];
    if (phone.value) {
        rows.push({ key: 'phone', label: 'Номер телефона', value: phone.value });
    }
    if (email.value) {
        rows.push({ key: 'email', label: 'Почтовый адрес', value: email.value });
    }
    if (username.value && !usernameUrl.value) {
        rows.push({ key: 'username', label: 'Telegram аккаунт', value: username.value });
    }
    return rows;
});

const hasAnyContacts = computed(() => contactRows.value.length > 0 || Boolean(usernameUrl.value) || Boolean(channelUrl.value));

const loadSupportContacts = async (): Promise<void> => {
    isLoading.value = true;
    try {
        const response = await storageStore.apiFetch('/api/support/contacts');
        if (!response.ok) {
            return;
        }
        const payload = await response.json() as SupportContactsResponse;
        phone.value = normalizeText(payload?.phone);
        email.value = normalizeText(payload?.email);
        username.value = normalizeText(payload?.username);
        usernameUrl.value = normalizeText(payload?.username_url);
        channelUrl.value = normalizeText(payload?.channel_url);
    } catch {
        // Keep empty state if contacts endpoint is unavailable.
    } finally {
        isLoading.value = false;
    }
};

const refreshIcons = async (): Promise<void> => {
    await nextTick();
    const feather = (window as any).feather;
    if (typeof feather?.replace === 'function') {
        feather.replace();
    }
};

onMounted(() => {
    void (async () => {
        document.body.dataset.preservePageTheme = 'true';
        await loadSupportContacts();
        await refreshIcons();
    })();
});
</script>
