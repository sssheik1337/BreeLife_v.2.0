declare global {
    interface Window {
        telegramInitData?: string;
        Telegram?: {
            WebApp?: {
                initData?: string;
            };
        };
    }
}

interface EnsureTelegramAuthOptions {
    force?: boolean;
    reason?: string;
    timeoutMs?: number;
}

let authInFlight: Promise<boolean> | null = null;
let lastAuthSuccessAt = 0;

const normalizeInitData = (value: unknown): string => {
    if (typeof value !== 'string') {
        return '';
    }
    const trimmed = value.trim();
    if (!trimmed) {
        return '';
    }
    const lowered = trimmed.toLowerCase();
    if (lowered === 'null' || lowered === 'undefined') {
        return '';
    }
    return trimmed;
};

const getInitDataFromHash = (): string => {
    if (typeof window === 'undefined' || typeof window.location?.hash !== 'string') {
        return '';
    }
    const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
    if (!hash) {
        return '';
    }
    const params = new URLSearchParams(hash);
    const encoded = params.get('tgWebAppData') || '';
    if (!encoded) {
        return '';
    }
    try {
        return normalizeInitData(decodeURIComponent(encoded));
    } catch {
        return normalizeInitData(encoded);
    }
};

const resolveTelegramInitDataNow = (): string => {
    if (typeof window === 'undefined') {
        return '';
    }
    const fromWindow = normalizeInitData(window.telegramInitData);
    if (fromWindow) {
        return fromWindow;
    }
    const fromTelegram = normalizeInitData(window.Telegram?.WebApp?.initData);
    if (fromTelegram) {
        window.telegramInitData = fromTelegram;
        return fromTelegram;
    }
    const fromHash = getInitDataFromHash();
    if (fromHash) {
        window.telegramInitData = fromHash;
        return fromHash;
    }
    return '';
};

export const getTelegramInitDataSnapshot = (): string => resolveTelegramInitDataNow();

const waitForTelegramInitData = async (timeoutMs: number): Promise<string> => {
    const startedAt = Date.now();
    let initData = resolveTelegramInitDataNow();
    while (!initData && Date.now() - startedAt < timeoutMs) {
        await new Promise((resolve) => window.setTimeout(resolve, 100));
        initData = resolveTelegramInitDataNow();
    }
    return initData;
};

const postTelegramAuth = async (initData: string): Promise<boolean> => {
    const response = await fetch('/api/auth/telegram', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
            'Content-Type': 'application/json',
            'X-Telegram-Init-Data': initData
        },
        body: JSON.stringify({ initData })
    });
    return response.ok;
};

export const ensureTelegramAuthSession = async (options: EnsureTelegramAuthOptions = {}): Promise<boolean> => {
    const force = options.force === true;
    const timeoutMs = Number.isFinite(options.timeoutMs) ? Number(options.timeoutMs) : 1800;
    const authTtlMs = 8000;

    if (!force && Date.now() - lastAuthSuccessAt < authTtlMs) {
        return true;
    }
    if (authInFlight) {
        return authInFlight;
    }

    authInFlight = (async () => {
        const initData = await waitForTelegramInitData(timeoutMs);
        if (!initData) {
            return false;
        }
        const ok = await postTelegramAuth(initData);
        if (ok) {
            lastAuthSuccessAt = Date.now();
        }
        return ok;
    })();

    try {
        return await authInFlight;
    } catch {
        return false;
    } finally {
        authInFlight = null;
    }
};

