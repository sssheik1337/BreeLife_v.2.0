<template>
    <section class="min-h-screen bg-gradient-to-br from-[#f8fafc] via-[#f0f9ff] to-[#f0fdf4]">
        <main class="flex-1 px-4 py-8">
            <div class="max-w-md mx-auto space-y-8">
                <div class="text-center">
                    <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-r from-purple-400 to-pink-400 mb-4 shadow-lg">
                        <i data-feather="settings" class="w-7 h-7 text-white"></i>
                    </div>
                    <h1 class="text-2xl font-bold text-slate-800">Настройки и сервисы</h1>
                    <p class="text-slate-500 mt-2">В этом разделе только служебные экраны: уведомления, помощь и справочники.</p>
                </div>

                <div class="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-3">
                    <RouterLink to="/settings/reminders" class="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 hover:bg-slate-100 transition">
                        <div>
                            <p class="font-semibold text-slate-800">Напоминания</p>
                            <p class="text-sm text-slate-500">Управление уведомлениями Telegram</p>
                        </div>
                        <i data-feather="chevron-right" class="w-5 h-5 text-slate-400"></i>
                    </RouterLink>
                    <RouterLink to="/references" class="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 hover:bg-slate-100 transition">
                        <div>
                            <p class="font-semibold text-slate-800">Справочники</p>
                            <p class="text-sm text-slate-500">Продукты, рацион, покупки</p>
                        </div>
                        <i data-feather="chevron-right" class="w-5 h-5 text-slate-400"></i>
                    </RouterLink>
                    <RouterLink to="/support" class="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 hover:bg-slate-100 transition">
                        <div>
                            <p class="font-semibold text-slate-800">Помощь</p>
                            <p class="text-sm text-slate-500">Куда написать, если нужна поддержка</p>
                        </div>
                        <i data-feather="chevron-right" class="w-5 h-5 text-slate-400"></i>
                    </RouterLink>
                </div>
            </div>
        </main>
    </section>
</template>

<script setup lang="ts">
import { nextTick, onMounted } from 'vue';
import { RouterLink } from 'vue-router';

const refreshIcons = async (): Promise<void> => {
    await nextTick();
    const feather = (window as any).feather;
    if (typeof feather?.replace === 'function') {
        feather.replace();
    }
};

onMounted(() => {
    void refreshIcons();
});
</script>
