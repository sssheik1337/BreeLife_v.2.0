<template>
    <div class="min-h-screen bg-gradient-to-br from-[#f8fafc] via-[#f0f9ff] to-[#f0fdf4]">
        <!-- Layout Component -->
        <custom-layout>
            <!-- Navbar Component -->
            <custom-navbar></custom-navbar>

            <main class="flex-1 flex flex-col items-center justify-center px-4 py-12">
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
                                <p id="welcome-greeting" class="text-lg text-slate-600 mt-3">
                                    Ваш персональный спутник здоровья
                                </p>
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

            <!-- Footer Component -->
            <custom-footer></custom-footer>
        </custom-layout>
    </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted } from 'vue';
import { useRouter } from 'vue-router';

interface LegacyWindow extends Window {
    __SPA_MODE__?: boolean;
    __SPA_BASE__?: string;
    initUiShell?: () => Promise<void> | void;
    feather?: { replace: () => void };
}

const router = useRouter();
const appTitle = computed(() => document.documentElement.dataset.appName || 'BreeLife');
const scriptPromises = new Map<string, Promise<void>>();
const entryBodyClass = 'min-h-screen bg-gradient-to-br from-[#f8fafc] via-[#f0f9ff] to-[#f0fdf4]';
let previousBodyClass = '';

const loadScript = (src: string, readyCheck?: () => boolean): Promise<void> => {
    if (readyCheck && readyCheck()) {
        return Promise.resolve();
    }
    const cached = scriptPromises.get(src);
    if (cached) {
        return cached;
    }
    const promise = new Promise<void>((resolve, reject) => {
        const existing = document.querySelector(`script[data-spa-legacy="${src}"]`) as HTMLScriptElement | null;
        if (existing) {
            if (existing.dataset.loaded === 'true') {
                resolve();
                return;
            }
            existing.addEventListener('load', () => resolve(), { once: true });
            existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
            return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.dataset.spaLegacy = src;
        script.onload = () => {
            script.dataset.loaded = 'true';
            resolve();
        };
        script.onerror = () => reject(new Error(`Failed to load ${src}`));
        document.head.appendChild(script);
    });
    scriptPromises.set(src, promise);
    return promise;
};

const ensureStyleSheet = (href: string): void => {
    const existing = document.querySelector(`link[rel="stylesheet"][href="${href}"]`);
    if (existing) {
        return;
    }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
};

const applyBodyClass = (): void => {
    previousBodyClass = document.body.className;
    document.body.className = entryBodyClass;
};

const restoreBodyClass = (): void => {
    document.body.className = previousBodyClass;
};

const bootEntryShell = async (): Promise<void> => {
    const win = window as LegacyWindow;
    win.__SPA_MODE__ = true;
    if (typeof win.__SPA_BASE__ !== 'string') {
        const routerBase = (router as unknown as { options?: { history?: { base?: string } } }).options?.history?.base;
        if (typeof routerBase === 'string') {
            win.__SPA_BASE__ = routerBase;
        }
    }
    document.body.dataset.preservePageTheme = 'true';
    applyBodyClass();
    ensureStyleSheet('/static/css/style.css');

    if (typeof (window as any).spaNavigate !== 'function') {
        (window as any).spaNavigate = (path: string) => router.push(path);
    }
    if (typeof (window as any).spaReplace !== 'function') {
        (window as any).spaReplace = (path: string) => router.replace(path);
    }

    await loadScript('/static/components/layout.js', () => typeof customElements?.get === 'function' && Boolean(customElements.get('custom-layout')));
    await loadScript('/static/components/navbar.js', () => typeof customElements?.get === 'function' && Boolean(customElements.get('custom-navbar')));
    await loadScript('/static/components/footer.js', () => typeof customElements?.get === 'function' && Boolean(customElements.get('custom-footer')));
    await loadScript('/static/js/storage.js', () => typeof (window as any).getUserProfile === 'function');
    await loadScript('/static/js/ui.js', () => typeof (window as any).initUiShell === 'function' || typeof (window as any).setUserDataField === 'function');

    await nextTick();

    if (typeof win.feather?.replace === 'function') {
        win.feather.replace();
    }
    if (typeof win.initUiShell === 'function') {
        await win.initUiShell();
    }
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
