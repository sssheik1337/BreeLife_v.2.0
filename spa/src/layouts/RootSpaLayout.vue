<template>
    <div class="spa-layout" data-spa-layout>
        <!-- Используем те же web-components, чтобы сохранить текущий внешний вид без регрессии. -->
        <custom-navbar />

        <main class="spa-layout__main">
            <slot />
        </main>

        <custom-footer />
    </div>
</template>

<script setup lang="ts">
import { useTelegramRuntime } from '../composables/useTelegramRuntime';

// Запускаем Telegram runtime в корневом layout, чтобы переменные темы/inset были актуальны на всех экранах.
useTelegramRuntime();
</script>

<style scoped>
.spa-layout {
    min-height: 100%;
    background: var(--tg-bg-color, #f8fafc);
    color: var(--tg-text-color, #0f172a);
}

.spa-layout__main {
    padding-top: var(--header-height, 72px);
    padding-bottom: env(safe-area-inset-bottom);
    min-height: 100vh;
}
</style>
