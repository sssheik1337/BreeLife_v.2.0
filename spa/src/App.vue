<template>
    <RootSpaLayout>
        <AnimatedPageShell>
            <RouterView />
        </AnimatedPageShell>
    </RootSpaLayout>
</template>

<script setup lang="ts">
import { RouterView } from 'vue-router';
import RootSpaLayout from './layouts/RootSpaLayout.vue';
import AnimatedPageShell from './components/animations/AnimatedPageShell.vue';
</script>
