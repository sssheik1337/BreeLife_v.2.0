import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// Базовый публичный префикс сборки совпадает с backend mount `/spa-assets`.
export default defineConfig({
    plugins: [vue()],
    base: '/spa-assets/',
    build: {
        outDir: 'dist',
        emptyOutDir: true
    }
});
