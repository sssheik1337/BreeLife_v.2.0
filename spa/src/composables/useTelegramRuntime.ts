import { onBeforeUnmount, onMounted } from 'vue';
import { createTelegramRuntime, type TelegramRuntimeHandle, type TelegramRuntimeOptions } from '../platform/telegramRuntime';

/**
 * Composable для безопасного запуска Telegram runtime в корневом layout SPA.
 */
export const useTelegramRuntime = (options: TelegramRuntimeOptions = {}): TelegramRuntimeHandle => {
    const runtime = createTelegramRuntime(options);

    onMounted(() => {
        runtime.start();
        // Дополнительный проход после первого кадра уменьшает визуальные «прыжки» layout.
        requestAnimationFrame(() => {
            runtime.refreshLayout();
        });
    });

    onBeforeUnmount(() => {
        runtime.stop();
    });

    return runtime;
};
