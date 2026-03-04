<template>
    <section class="animate-fade-in">
        <slot />
    </section>
</template>

<script setup lang="ts">
import './legacy-animation-contract.css';
import { useLegacyPageTransition, useLegacyRippleButtons } from './useLegacyAnimationHooks';

// Подключаем legacy-эквиваленты page transition и ripple в SPA-оболочке экрана.
useLegacyPageTransition();
useLegacyRippleButtons();
</script>
