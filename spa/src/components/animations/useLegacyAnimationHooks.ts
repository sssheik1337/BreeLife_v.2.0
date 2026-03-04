import { onBeforeUnmount, onMounted } from 'vue';

/**
 * Включает page transition, эквивалентный legacy `animatePageTransition()`.
 */
export const useLegacyPageTransition = (target: Document = document): void => {
    onMounted(() => {
        const body = target.body;
        if (!body) {
            return;
        }
        body.style.opacity = '0';
        body.style.transition = 'opacity 0.2s ease';
        requestAnimationFrame(() => {
            body.style.opacity = '1';
        });
    });
};

/**
 * Подключает ripple-эффект к `.btn-primary` без изменения контракта анимации.
 */
export const useLegacyRippleButtons = (target: Document = document): void => {
    const listeners: Array<{ element: Element; handler: EventListener }> = [];

    onMounted(() => {
        const buttons = target.querySelectorAll('.btn-primary');

        buttons.forEach((button) => {
            const handler: EventListener = (event) => {
                const mouseEvent = event as MouseEvent;
                const element = button as HTMLElement;
                const rect = element.getBoundingClientRect();
                const size = Math.max(rect.width, rect.height);
                const x = mouseEvent.clientX - rect.left - size / 2;
                const y = mouseEvent.clientY - rect.top - size / 2;

                const ripple = target.createElement('span');
                ripple.style.cssText = `
                    position: absolute;
                    border-radius: 50%;
                    background: rgba(255, 255, 255, 0.7);
                    transform: scale(0);
                    animation: ripple 0.6s linear;
                    left: ${x}px;
                    top: ${y}px;
                    width: ${size}px;
                    height: ${size}px;
                    pointer-events: none;
                `;

                element.appendChild(ripple);
                window.setTimeout(() => {
                    ripple.remove();
                }, 600);
            };

            button.addEventListener('click', handler);
            listeners.push({ element: button, handler });
        });
    });

    onBeforeUnmount(() => {
        listeners.forEach(({ element, handler }) => {
            element.removeEventListener('click', handler);
        });
    });
};

/**
 * Хук управления состоянием diary-panel с сохранением legacy-классов.
 */
export const useLegacyDiaryPanelAnimation = () => {
    const openPanelClasses = ['diary-panel', 'animate-fade-in'];
    const closedPanelClasses = ['hidden'];

    const resolvePanelClasses = (opened: boolean): string[] => {
        return opened ? [...openPanelClasses] : [...closedPanelClasses];
    };

    return {
        resolvePanelClasses
    };
};

/**
 * Хук управления состоянием FAB-меню дневника с сохранением legacy-классов.
 */
export const useLegacyDiaryFabAnimation = () => {
    const resolveFabMenuClasses = (opened: boolean): string[] => {
        if (opened) {
            return ['diary-fab__menu'];
        }
        return ['diary-fab__menu', 'hidden'];
    };

    const resolveFabBackdropClasses = (opened: boolean): string[] => {
        if (opened) {
            return ['diary-fab-backdrop'];
        }
        return ['diary-fab-backdrop', 'hidden'];
    };

    return {
        resolveFabMenuClasses,
        resolveFabBackdropClasses
    };
};
