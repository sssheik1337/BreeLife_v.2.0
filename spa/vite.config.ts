import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

const backendOrigin = process.env.VITE_BACKEND_ORIGIN || 'http://127.0.0.1:8000';

// Базовый публичный префикс сборки совпадает с backend mount `/spa-assets`.
export default defineConfig({
    plugins: [vue()],
    base: '/spa-assets/',
    server: {
        proxy: {
            '/api': { target: backendOrigin, changeOrigin: true },
            '/static': { target: backendOrigin, changeOrigin: true },
            '/fonts': { target: backendOrigin, changeOrigin: true }
        }
    },
    build: {
        outDir: 'dist',
        emptyOutDir: true
    }
});
