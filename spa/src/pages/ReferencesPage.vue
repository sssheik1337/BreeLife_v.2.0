<template>
    <section class="min-h-screen bg-gradient-to-br from-[#f8fafc] via-[#f0f9ff] to-[#f0fdf4]">
        <main class="flex-1 px-4 py-8">
            <div class="max-w-md mx-auto space-y-8">
                <div class="text-center">
                    <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-r from-indigo-400 to-sky-500 mb-4 shadow-lg">
                        <i data-feather="book-open" class="w-7 h-7 text-white"></i>
                    </div>
                    <h1 class="text-2xl font-bold text-slate-800">Справочники</h1>
                    <p class="text-slate-500 mt-2">Быстрый доступ к полезным разделам по продуктам и рациону.</p>
                </div>

                <div class="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-3">
                    <RouterLink to="/foods" class="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 hover:bg-slate-100 transition">
                        <div>
                            <p class="font-semibold text-slate-800">Каталог продуктов</p>
                            <p class="text-sm text-slate-500">Поиск по базе продуктов</p>
                        </div>
                        <i data-feather="chevron-right" class="w-5 h-5 text-slate-400"></i>
                    </RouterLink>
                    <RouterLink to="/my-products" class="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 hover:bg-slate-100 transition">
                        <div>
                            <p class="font-semibold text-slate-800">Мои продукты</p>
                            <p class="text-sm text-slate-500">Избранное и исключения</p>
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
    document.body.dataset.preservePageTheme = 'true';
    void refreshIcons();
});
</script>
