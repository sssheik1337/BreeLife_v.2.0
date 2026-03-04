<template>
    <div class="bg-gradient-to-br from-[#f8fafc] via-[#f0f9ff] to-[#f0fdf4]">
        <main class="px-4 py-8">
            <div class="max-w-md mx-auto space-y-6">
                <div class="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4 text-center">
                    <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-400 shadow-lg mx-auto">
                        <i data-feather="heart" class="w-7 h-7 text-white"></i>
                    </div>
                    <h1 class="text-2xl font-bold text-slate-800">Хотите настроить любимые продукты сейчас?</h1>
                    <p class="text-slate-500">Это поможет сразу собрать более точный рацион и список покупок под ваш вкус.</p>
                    <div class="rounded-xl bg-slate-50 border border-slate-100 p-3 text-sm text-slate-600 text-left">
                        Если выберете «Позже», приложение продолжит работу, а настройку можно будет пройти в любой момент в разделе «Мои продукты».
                    </div>
                </div>

                <div class="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm space-y-3">
                    <a href="/preferences-onboarding" class="btn-primary w-full inline-flex items-center justify-center" @click.prevent="goToPreferencesOnboarding">Заполнить сейчас</a>
                    <a href="/trial-start" class="btn-secondary w-full inline-flex items-center justify-center" @click.prevent="goToTrialStart">Сделать позже</a>
                </div>
            </div>
        </main>
    </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const bodyClass = 'min-h-screen bg-gradient-to-br from-[#f8fafc] via-[#f0f9ff] to-[#f0fdf4]';
let previousBodyClass = '';

const applyBodyClass = (): void => {
    previousBodyClass = document.body.className;
    document.body.className = bodyClass;
};

const restoreBodyClass = (): void => {
    document.body.className = previousBodyClass;
};

const refreshFeatherIcons = (): void => {
    const feather = (window as any).feather;
    if (typeof feather?.replace === 'function') {
        feather.replace();
    }
};

const bootChoiceScreen = async (): Promise<void> => {
    applyBodyClass();
    await nextTick();
    refreshFeatherIcons();
};

const goToPreferencesOnboarding = async (): Promise<void> => {
    await router.push('/preferences-onboarding');
};

const goToTrialStart = async (): Promise<void> => {
    await router.push('/trial-start');
};

onMounted(() => {
    void bootChoiceScreen();
});

onBeforeUnmount(() => {
    restoreBodyClass();
});
</script>
