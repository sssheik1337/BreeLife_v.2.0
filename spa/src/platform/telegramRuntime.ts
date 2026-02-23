/**
 * Минимальный контракт Telegram WebApp API,
 * который используется в SPA runtime-слое.
 */
export interface TelegramWebApp {
    ready?: () => void;
    expand: () => void;
    isExpanded?: boolean;
    viewportHeight?: number;
    viewportStableHeight?: number;
    safeAreaInset?: {
        top?: number;
    };
    contentSafeAreaInset?: {
        top?: number;
    };
    themeParams?: {
        bg_color?: string;
        text_color?: string;
        button_color?: string;
        button_text_color?: string;
        hint_color?: string;
    };
    onEvent?: (event: 'themeChanged' | 'viewportChanged', handler: () => void) => void;
    offEvent?: (event: 'themeChanged' | 'viewportChanged', handler: () => void) => void;
}

export interface TelegramRuntimeOptions {
    documentRef?: Document;
    navigatorRef?: Navigator;
    telegramWebApp?: TelegramWebApp | null;
    preservePageTheme?: boolean;
}

export interface TelegramRuntimeHandle {
    start: () => void;
    stop: () => void;
    refreshLayout: () => void;
}


declare global {
    interface Window {
        Telegram?: {
            WebApp?: TelegramWebApp;
        };
    }
}

const DEFAULT_HEADER_HEIGHT = '72px';

/**
 * Применяет верхний safe-area inset в CSS-переменную `--tg-safe-top`.
 */
const applyTelegramSafeAreaInsets = (documentRef: Document, tg: TelegramWebApp): void => {
    const viewportHeight = Number(tg.viewportHeight);
    const viewportStableHeight = Number(tg.viewportStableHeight);
    const viewportDeltaTop = Number.isFinite(viewportHeight) && Number.isFinite(viewportStableHeight)
        ? Math.max(viewportHeight - viewportStableHeight, 0)
        : 0;

    const safeAreaTop = Number(tg.safeAreaInset?.top);
    const contentSafeAreaTop = Number(tg.contentSafeAreaInset?.top);
    const safeTopCandidates = [viewportDeltaTop, safeAreaTop, contentSafeAreaTop]
        .filter((value) => Number.isFinite(value) && value >= 0);

    const safeTop = safeTopCandidates.length > 0
        ? Math.max(...safeTopCandidates)
        : 0;

    documentRef.documentElement.style.setProperty('--tg-safe-top', `${safeTop}px`);
};

/**
 * Применяет фиксированный верхний offset для iOS fullscreen в Telegram.
 */
const applyTelegramUiOffset = (documentRef: Document, navigatorRef: Navigator, tg: TelegramWebApp): void => {
    const isIos = /iPhone|iPad|iPod/i.test(navigatorRef.userAgent);
    const isFullscreen = Boolean(tg.isExpanded);

    if (isIos && isFullscreen) {
        documentRef.documentElement.style.setProperty('--tg-ui-top', '48px');
        return;
    }

    documentRef.documentElement.style.setProperty('--tg-ui-top', '0px');
};

/**
 * Синхронизирует тему Telegram в CSS-переменные.
 */
const applyTelegramTheme = (documentRef: Document, tg: TelegramWebApp, preservePageTheme: boolean): void => {
    const theme = tg.themeParams || {};
    const root = documentRef.documentElement;
    const body = documentRef.body;

    if (theme.bg_color) {
        root.style.setProperty('--tg-bg-color', theme.bg_color);
        if (body && !preservePageTheme) {
            body.style.backgroundColor = theme.bg_color;
            body.style.backgroundImage = 'none';
        }
    }

    if (theme.text_color) {
        root.style.setProperty('--tg-text-color', theme.text_color);
        if (body && !preservePageTheme) {
            body.style.color = theme.text_color;
        }
    }

    if (theme.button_color) {
        root.style.setProperty('--tg-button-color', theme.button_color);
    }

    if (theme.button_text_color) {
        root.style.setProperty('--tg-button-text-color', theme.button_text_color);
    }

    if (theme.hint_color) {
        root.style.setProperty('--tg-hint-color', theme.hint_color);
    }
};

/**
 * Обновляет `--header-height`, чтобы избежать «прыжков» шапки/контента.
 */
const applyHeaderHeight = (documentRef: Document): void => {
    const navbarHost = documentRef.querySelector('custom-navbar');
    if (!navbarHost) {
        documentRef.documentElement.style.setProperty('--header-height', DEFAULT_HEADER_HEIGHT);
        return;
    }

    const asElement = navbarHost as HTMLElement & { shadowRoot?: ShadowRoot | null };
    const navbar = asElement.shadowRoot?.querySelector('.navbar');
    if (!navbar) {
        documentRef.documentElement.style.setProperty('--header-height', DEFAULT_HEADER_HEIGHT);
        return;
    }

    const height = Math.max(0, Math.round(navbar.getBoundingClientRect().height));
    const resolved = height > 0 ? `${height}px` : DEFAULT_HEADER_HEIGHT;
    documentRef.documentElement.style.setProperty('--header-height', resolved);
};

/**
 * Создаёт runtime-объект для инициализации Telegram WebApp в SPA.
 */
export const createTelegramRuntime = (options: TelegramRuntimeOptions = {}): TelegramRuntimeHandle => {
    const documentRef = options.documentRef || document;
    const navigatorRef = options.navigatorRef || navigator;
    const tg = options.telegramWebApp || (window.Telegram?.WebApp as TelegramWebApp | undefined) || null;
    const preservePageTheme = options.preservePageTheme === true;

    const onThemeChanged = (): void => {
        if (!tg) {
            return;
        }
        applyTelegramTheme(documentRef, tg, preservePageTheme);
    };

    const onViewportChanged = (): void => {
        if (!tg) {
            return;
        }
        applyTelegramSafeAreaInsets(documentRef, tg);
        applyTelegramUiOffset(documentRef, navigatorRef, tg);
        applyHeaderHeight(documentRef);
    };

    const refreshLayout = (): void => {
        if (!tg) {
            applyHeaderHeight(documentRef);
            return;
        }
        applyTelegramTheme(documentRef, tg, preservePageTheme);
        applyTelegramSafeAreaInsets(documentRef, tg);
        applyTelegramUiOffset(documentRef, navigatorRef, tg);
        applyHeaderHeight(documentRef);
    };

    const start = (): void => {
        if (!tg) {
            applyHeaderHeight(documentRef);
            return;
        }

        if (typeof tg.ready === 'function') {
            tg.ready();
        }

        tg.expand();
        refreshLayout();

        if (typeof tg.onEvent === 'function') {
            tg.onEvent('themeChanged', onThemeChanged);
            tg.onEvent('viewportChanged', onViewportChanged);
        }
    };

    const stop = (): void => {
        if (!tg || typeof tg.offEvent !== 'function') {
            return;
        }

        tg.offEvent('themeChanged', onThemeChanged);
        tg.offEvent('viewportChanged', onViewportChanged);
    };

    return {
        start,
        stop,
        refreshLayout
    };
};
