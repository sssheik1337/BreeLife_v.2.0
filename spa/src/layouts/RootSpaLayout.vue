<template>
    <custom-layout class="spa-layout" data-spa-layout>
        <!-- Используем те же web-components, чтобы сохранить текущий внешний вид без регрессии. -->
        <custom-navbar />

        <main class="spa-layout__main">
            <slot />
        </main>

        <custom-footer />
    </custom-layout>
</template>

<script setup lang="ts">
import { useTelegramRuntime } from '../composables/useTelegramRuntime';

// Запускаем Telegram runtime в корневом layout, чтобы переменные темы/inset были актуальны на всех экранах.
useTelegramRuntime();
</script>

<style scoped>
:global(#app) {
    height: 100%;
}

.spa-layout {
    height: 100%;
    background: var(--tg-bg-color, #f8fafc);
    color: var(--tg-text-color, #0f172a);
}

.spa-layout__main {
    flex: 1;
    width: 100%;
}
</style>
