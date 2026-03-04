<template>
    <div class="bg-gradient-to-br from-[#f8fafc] via-[#f0f9ff] to-[#f0fdf4]">
        <main class="flex flex-col items-center px-4 py-8">
            <div class="max-w-md w-full space-y-8">
                    <!-- Hero Section -->
                    <div class="text-center space-y-6">
                        <div class="relative">
                            <div class="absolute inset-0 flex items-center justify-center">
                                <div class="w-72 h-72 bg-gradient-to-r from-emerald-100 to-cyan-100 rounded-full blur-3xl opacity-50"></div>
                            </div>
                            <div class="relative rounded-3xl bg-white/70 backdrop-blur-sm border border-white/30 p-8 shadow-xl">
                                <div class="w-20 h-20 mx-auto mb -6 rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-400 flex items-center justify-center shadow-lg">
                                    <i data-feather="heart" class="w-10 h-10 text-white"></i>
                                </div>
                                <h1 class="text-4xl font-bold bg-gradient-to-r from-emerald-600 to-cyan-600 bg-clip-text text-transparent">
                                    {{ appTitle }}<span class="align-text-top">🌿</span>
                                </h1>
                                <p id="welcome-greeting" class="text-lg text-slate-600 mt-3">{{ welcomeGreeting }}</p>
                            </div>
                        </div>
                        <div class="space-y-3">
                            <p class="text-slate-500 leading-relaxed">
                                Преобразите свой путь к здоровью с персонализированными рекомендациями и красивым отслеживанием прогресса. Начните с простой 5-шаговой оценки.
                            </p>
                        </div>
                    </div>

                    <!-- Features Cards -->
                    <div class="space-y-4">
                        <div class="bg-white rounded-2xl p-5 border border-slate-100 shadow-[0_10px_30px_rgba(15,23,42,0.08)] hover:shadow-[0_16px_40px_rgba(15,23,42,0.14)] transition-shadow duration-300">
                            <div class="flex items-center space-x-4">
                                <div class="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                                    <i data-feather="target" class="w-6 h-6 text-emerald-600"></i>
                                </div>
                                <div class="flex-1">
                                    <h3 class="font-semibold text-slate-800">Персональные цели</h3>
                                    <p class="text-sm text-slate-500">Ставьте достижимые цели на основе вашего профиля</p>
                                </div>
                            </div>
                        </div>

                        <div class="bg-white rounded-2xl p-5 border border-slate-100 shadow-[0_10px_30px_rgba(15,23,42,0.08)] hover:shadow-[0_16px_40px_rgba(15,23,42,0.14)] transition-shadow duration-300">
                            <div class="flex items-center space-x-4">
                                <div class="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0">
                                    <i data-feather="trending-up" class="w-6 h-6 text-purple-600"></i>
                                </div>
                                <div class="flex-1">
                                    <h3 class="font-semibold text-slate-800">Отслеживание прогресса</h3>
                                    <p class="text-sm text-slate-500">Красивая визуализация вашего пути</p>
                                </div>
                            </div>
                        </div>

                        <div class="bg-white rounded-2xl p-5 border border-slate-100 shadow-[0_10px_30px_rgba(15,23,42,0.08)] hover:shadow-[0_16px_40px_rgba(15,23,42,0.14)] transition-shadow duration-300">
                            <div class="flex items-center space-x-4">
                                <div class="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                                    <i data-feather="sun" class="w-6 h-6 text-amber-600"></i>
                                </div>
                                <div class="flex-1">
                                    <h3 class="font-semibold text-slate-800">Ежедневные советы</h3>
                                    <p class="text-sm text-slate-500">Умные предложения для более здоровых привычек</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Start Button -->
                    <div class="pt-8">
                        <a href="/questionnaire" class="btn-primary w-full flex items-center justify-center space-x-3 group" @click.prevent="startJourney">
                            <span>Начать Путешествие</span>
                            <i data-feather="arrow-right" class="w-5 h-5 group-hover:translate-x-1 transition-transform"></i>
                        </a>
                        <p class="text-center text-sm text-slate-400 mt-4">
                            Всего 2 минуты • Конфиденциальность прежде всего
                        </p>
                    </div>
            </div>
        </main>
    </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { useRouter } from 'vue-router';
import { useAppStateStore } from '../stores/appStateStore';

const router = useRouter();
const appStateStore = useAppStateStore();
const { serverUser } = storeToRefs(appStateStore);

const appTitle = computed(() => document.documentElement.dataset.appName || 'BreeLife');
const welcomeGreeting = computed(() => {
    const firstName = typeof serverUser.value.first_name === 'string' ? serverUser.value.first_name.trim() : '';
    const username = typeof serverUser.value.username === 'string' ? serverUser.value.username.trim() : '';
    const displayName = firstName || username;
    if (!displayName) {
        return 'Ваш персональный спутник здоровья';
    }
    return `Привет, ${displayName}, это твой персональный спутник здоровья 👋`;
});

const entryBodyClass = 'min-h-screen bg-gradient-to-br from-[#f8fafc] via-[#f0f9ff] to-[#f0fdf4]';
let previousBodyClass = '';

const applyBodyClass = (): void => {
    previousBodyClass = document.body.className;
    document.body.className = entryBodyClass;
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

const bootEntryShell = async (): Promise<void> => {
    document.body.dataset.preservePageTheme = 'true';
    applyBodyClass();
    await nextTick();
    refreshFeatherIcons();
};

const startJourney = async (): Promise<void> => {
    await router.push('/questionnaire');
};

onMounted(() => {
    void bootEntryShell();
});

onBeforeUnmount(() => {
    delete document.body.dataset.preservePageTheme;
    restoreBodyClass();
});
</script>
