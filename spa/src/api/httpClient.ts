/**
 * Унифицированная ошибка API-клиента.
 */
export class ApiHttpError extends Error {
    status: number;
    payload: unknown;

    constructor(status: number, message: string, payload: unknown) {
        super(message);
        this.name = 'ApiHttpError';
        this.status = status;
        this.payload = payload;
    }
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiRequestOptions {
    method?: HttpMethod;
    query?: Record<string, string | number | boolean | null | undefined>;
    body?: unknown;
    headers?: Record<string, string>;
    signal?: AbortSignal;
}

export interface ApiClientConfig {
    baseUrl?: string;
    fetchImpl?: typeof fetch;
}

declare global {
    interface Window {
        apiFetch?: typeof fetch;
        telegramInitData?: string;
        Telegram?: {
            WebApp?: {
                initData?: string;
            };
        };
    }
}

const resolveFetch = (config?: ApiClientConfig): typeof fetch => {
    if (config?.fetchImpl) {
        return config.fetchImpl;
    }
    if (typeof window !== 'undefined' && typeof window.apiFetch === 'function') {
        return window.apiFetch.bind(window);
    }
    return fetch.bind(globalThis);
};

const resolveTelegramInitData = (): string => {
    if (typeof window === 'undefined') {
        return '';
    }
    const fromWindow = typeof window.telegramInitData === 'string' ? window.telegramInitData.trim() : '';
    if (fromWindow) {
        return fromWindow;
    }
    const fromTelegram = typeof window.Telegram?.WebApp?.initData === 'string'
        ? window.Telegram.WebApp.initData.trim()
        : '';
    return fromTelegram;
};

const withQuery = (path: string, query?: ApiRequestOptions['query']): string => {
    if (!query) {
        return path;
    }
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
        if (value === null || value === undefined) {
            return;
        }
        params.set(key, String(value));
    });
    const queryString = params.toString();
    return queryString ? `${path}?${queryString}` : path;
};

const parseResponsePayload = async (response: Response): Promise<unknown> => {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
        return response.json();
    }
    return response.text();
};

/**
 * Создаёт единый typed http-клиент для SPA API-слоя.
 */
export const createApiClient = (config: ApiClientConfig = {}) => {
    const fetchImpl = resolveFetch(config);
    const baseUrl = config.baseUrl || '';

    const request = async <T>(path: string, options: ApiRequestOptions = {}): Promise<T> => {
        const url = `${baseUrl}${withQuery(path, options.query)}`;
        const method = options.method || 'GET';

        const headers: Record<string, string> = {
            ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
            ...(options.headers || {})
        };

        const telegramInitData = resolveTelegramInitData();
        if (telegramInitData) {
            headers['X-Telegram-Init-Data'] = telegramInitData;
        }

        const response = await fetchImpl(url, {
            method,
            headers,
            signal: options.signal,
            body: options.body !== undefined ? JSON.stringify(options.body) : undefined
        });

        const payload = await parseResponsePayload(response);

        if (!response.ok) {
            const detail = (payload as any)?.detail;
            const message = typeof detail === 'string' ? detail : `HTTP_${response.status}`;
            throw new ApiHttpError(response.status, message, payload);
        }

        return payload as T;
    };

    return {
        request
    };
};
