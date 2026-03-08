<template>
    <custom-layout class="spa-layout" data-spa-layout>
        <TelegramOnlyGate />
        <OfferConsentGate />
        <SubscriptionExpiredGate />
        <custom-navbar />

        <main class="spa-layout__main">
            <slot />
        </main>

        <custom-footer />
    </custom-layout>
</template>

<script setup lang="ts">
import OfferConsentGate from '../components/OfferConsentGate.vue';
import SubscriptionExpiredGate from '../components/SubscriptionExpiredGate.vue';
import TelegramOnlyGate from '../components/TelegramOnlyGate.vue';
import { useTelegramRuntime } from '../composables/useTelegramRuntime';

// Keep Telegram theme and safe-area CSS vars in sync for all SPA screens.
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
