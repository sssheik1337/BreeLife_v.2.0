<template>
    <section class="min-h-screen bg-gradient-to-br from-[#f8fafc] via-[#f0f9ff] to-[#f0fdf4]">
        <main class="flex-1 px-4 py-8">
            <div class="max-w-md mx-auto">
                <div class="text-center mb-8">
                    <h1 class="text-2xl font-bold text-slate-800">Настройки напоминаний</h1>
                    <p class="text-slate-500 mt-2">Управляйте напоминаниями о воде, сне и активности.</p>
                </div>

                <div class="profile-card profile-card--secondary p-5 bg-white rounded-2xl border border-slate-100 shadow-sm" id="reminders-settings">
                    <div class="space-y-4">
                        <div class="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-3">
                            <div class="flex flex-col items-center text-center gap-3">
                                <div class="space-y-1">
                                    <p class="font-semibold text-slate-800">🔔 Push-уведомления Telegram</p>
                                    <p class="text-sm text-slate-500">{{ writeAccessStatusText }}</p>
                                </div>
                                <button
                                    type="button"
                                    class="btn-primary reminders-consent-button"
                                    :disabled="writeAccessState.requestInFlight || !canRequestWriteAccess"
                                    @click="requestWriteAccessConsent"
                                >
                                    {{ writeAccessButtonText }}
                                </button>
                            </div>
                            <p v-if="!canRequestWriteAccess && writeAccessCooldownSeconds > 0" class="text-xs text-slate-500 text-center">
                                Повторный запрос будет доступен через {{ writeAccessCooldownSeconds }} сек.
                            </p>
                        </div>

                        <div class="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-3">
                            <div class="flex items-start justify-between gap-3">
                                <div>
                                    <p class="font-semibold text-slate-800">💧 Напоминать пить воду</p>
                                    <p class="text-sm text-slate-500">Помогает поддерживать водный баланс в течение дня.</p>
                                </div>
                                <label class="ios-switch" aria-label="Включить напоминание о воде">
                                    <input
                                        v-model="settings.water.enabled"
                                        type="checkbox"
                                        class="ios-switch__input"
                                        data-reminder-toggle="water"
                                        @change="onToggleChanged('water')"
                                    >
                                    <span class="ios-switch__track">
                                        <span class="ios-switch__thumb" />
                                    </span>
                                </label>
                            </div>
                            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <label class="reminder-field text-sm text-slate-500">Время
                                    <input
                                        v-model="settings.water.time"
                                        type="time"
                                        class="form-input mt-1"
                                        data-reminder-time="water"
                                        @change="onTimeChanged('water')"
                                    >
                                </label>
                                <label class="reminder-field text-sm text-slate-500">Периодичность
                                    <select
                                        v-model="settings.water.frequency"
                                        class="form-input mt-1"
                                        data-reminder-frequency="water"
                                        @change="onFrequencyChanged('water')"
                                    >
                                        <option value="daily">Каждый день</option>
                                        <option value="weekdays">По будням</option>
                                    </select>
                                </label>
                            </div>
                        </div>

                        <div class="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-3">
                            <div class="flex items-start justify-between gap-3">
                                <div>
                                    <p class="font-semibold text-slate-800">🌙 Напоминать о сне</p>
                                    <p class="text-sm text-slate-500">Помогает ложиться вовремя и удерживать ритм.</p>
                                </div>
                                <label class="ios-switch" aria-label="Включить напоминание о сне">
                                    <input
                                        v-model="settings.sleep.enabled"
                                        type="checkbox"
                                        class="ios-switch__input"
                                        data-reminder-toggle="sleep"
                                        @change="onToggleChanged('sleep')"
                                    >
                                    <span class="ios-switch__track">
                                        <span class="ios-switch__thumb" />
                                    </span>
                                </label>
                            </div>
                            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <label class="reminder-field text-sm text-slate-500">Время
                                    <input
                                        v-model="settings.sleep.time"
                                        type="time"
                                        class="form-input mt-1"
                                        data-reminder-time="sleep"
                                        @change="onTimeChanged('sleep')"
                                    >
                                </label>
                                <label class="reminder-field text-sm text-slate-500">Периодичность
                                    <select
                                        v-model="settings.sleep.frequency"
                                        class="form-input mt-1"
                                        data-reminder-frequency="sleep"
                                        @change="onFrequencyChanged('sleep')"
                                    >
                                        <option value="daily">Каждый день</option>
                                        <option value="weekdays">По будням</option>
                                    </select>
                                </label>
                            </div>
                        </div>

                        <div class="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-3">
                            <div class="flex items-start justify-between gap-3">
                                <div>
                                    <p class="font-semibold text-slate-800">🚶 Напоминать про активность</p>
                                    <p class="text-sm text-slate-500">Поддерживает бодрость: маленькая активность лучше, чем пауза.</p>
                                </div>
                                <label class="ios-switch" aria-label="Включить напоминание об активности">
                                    <input
                                        v-model="settings.activity.enabled"
                                        type="checkbox"
                                        class="ios-switch__input"
                                        data-reminder-toggle="activity"
                                        @change="onToggleChanged('activity')"
                                    >
                                    <span class="ios-switch__track">
                                        <span class="ios-switch__thumb" />
                                    </span>
                                </label>
                            </div>
                            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <label class="reminder-field text-sm text-slate-500">Время
                                    <input
                                        v-model="settings.activity.time"
                                        type="time"
                                        class="form-input mt-1"
                                        data-reminder-time="activity"
                                        @change="onTimeChanged('activity')"
                                    >
                                </label>
                                <label class="reminder-field text-sm text-slate-500">Периодичность
                                    <select
                                        v-model="settings.activity.frequency"
                                        class="form-input mt-1"
                                        data-reminder-frequency="activity"
                                        @change="onFrequencyChanged('activity')"
                                    >
                                        <option value="daily">Каждый день</option>
                                        <option value="weekdays">По будням</option>
                                    </select>
                                </label>
                            </div>
                        </div>

                        <div class="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-3">
                            <div class="flex items-start justify-between gap-3">
                                <div>
                                    <p class="font-semibold text-slate-800">🌅 Утренний вопрос про сон</p>
                                    <p class="text-sm text-slate-500">Утром спросим, во сколько вы проснулись и легли спать.</p>
                                </div>
                                <label class="ios-switch" aria-label="Включить утренний вопрос про сон">
                                    <input
                                        v-model="settings.sleepMorning.enabled"
                                        type="checkbox"
                                        class="ios-switch__input"
                                        data-reminder-toggle="sleep-morning"
                                        @change="onToggleChanged('sleepMorning')"
                                    >
                                    <span class="ios-switch__track">
                                        <span class="ios-switch__thumb" />
                                    </span>
                                </label>
                            </div>
                            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <label class="reminder-field text-sm text-slate-500">Время
                                    <input
                                        v-model="settings.sleepMorning.time"
                                        type="time"
                                        class="form-input mt-1"
                                        data-reminder-time="sleep-morning"
                                        @change="onTimeChanged('sleepMorning')"
                                    >
                                </label>
                                <label class="reminder-field text-sm text-slate-500">Периодичность
                                    <select
                                        v-model="settings.sleepMorning.frequency"
                                        class="form-input mt-1"
                                        data-reminder-frequency="sleep-morning"
                                        @change="onFrequencyChanged('sleepMorning')"
                                    >
                                        <option value="daily">Каждый день</option>
                                        <option value="weekdays">По будням</option>
                                    </select>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, reactive } from 'vue';
import { useAppStateStore } from '../stores/appStateStore';
import { useStorageStore } from '../stores/storageStore';

interface ReminderSettingsItem {
    enabled: boolean;
    time: string;
    frequency: 'daily' | 'weekdays';
}

interface ReminderSettings {
    water: ReminderSettingsItem;
    sleep: ReminderSettingsItem;
    sleepMorning: ReminderSettingsItem;
    activity: ReminderSettingsItem;
}

const REMINDER_DEFAULTS: ReminderSettings = {
    water: { enabled: false, time: '10:00', frequency: 'daily' },
    sleep: { enabled: false, time: '22:30', frequency: 'daily' },
    sleepMorning: { enabled: false, time: '08:30', frequency: 'daily' },
    activity: { enabled: false, time: '18:00', frequency: 'daily' }
};

const REMINDER_TYPES: Record<keyof ReminderSettings, string> = {
    water: 'water',
    sleep: 'sleep_reminder',
    sleepMorning: 'sleep_morning_log',
    activity: 'activity'
};

const storageStore = useStorageStore();
const appStateStore = useAppStateStore();
const CANCEL_REQUEST_COOLDOWN_MS = 30_000;

const settings = reactive<ReminderSettings>({
    water: { ...REMINDER_DEFAULTS.water },
    sleep: { ...REMINDER_DEFAULTS.sleep },
    sleepMorning: { ...REMINDER_DEFAULTS.sleepMorning },
    activity: { ...REMINDER_DEFAULTS.activity }
});

const writeAccessState = reactive<{
    allowed: boolean | null;
    updatedAt: string | null;
    requestInFlight: boolean;
    lastCancelledAt: number;
}>({
    allowed: null,
    updatedAt: null,
    requestInFlight: false,
    lastCancelledAt: 0
});

const showReminderNotification = (message: string, tone: 'success' | 'warning' | 'error' = 'success'): void => {
    const showNotification = (window as any).showNotification;
    if (typeof showNotification === 'function') {
        showNotification(message, tone);
    }
};

const notifyToggleSaved = (): void => {
    showReminderNotification('Настройки напоминаний обновлены.', 'success');
};

const writeAccessCooldownSeconds = computed(() => {
    if (writeAccessState.lastCancelledAt <= 0) {
        return 0;
    }
    const remainingMs = (writeAccessState.lastCancelledAt + CANCEL_REQUEST_COOLDOWN_MS) - Date.now();
    return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
});

const canRequestWriteAccess = computed(() => writeAccessCooldownSeconds.value <= 0);

const writeAccessStatusText = computed(() => {
    if (writeAccessState.allowed === true) {
        return 'Разрешение получено. Push-напоминания могут доставляться в Telegram.';
    }
    if (writeAccessState.allowed === false) {
        return 'Разрешение пока не выдано. Можно включить в любой момент.';
    }
    return 'Разрешение ещё не запрошено.';
});

const writeAccessButtonText = computed(() => {
    if (writeAccessState.requestInFlight) {
        return 'Запрашиваем...';
    }
    if (writeAccessState.allowed === true) {
        return 'Разрешено';
    }
    return 'Разрешить уведомления';
});

const persistConsent = async (allowed: boolean): Promise<void> => {
    const response = await storageStore.apiFetch('/api/user/notifications/consent', {
        method: 'POST',
        body: JSON.stringify({ allowed })
    });
    if (!response.ok) {
        throw new Error('consent_save_failed');
    }
    const data = await response.json();
    writeAccessState.allowed = data?.allowed === true ? true : (data?.allowed === false ? false : null);
    writeAccessState.updatedAt = typeof data?.updated_at === 'string' ? data.updated_at : null;
};

const loadConsent = async (): Promise<void> => {
    try {
        const response = await storageStore.apiFetch('/api/user/notifications/consent');
        if (!response.ok) {
            return;
        }
        const data = await response.json();
        writeAccessState.allowed = data?.allowed === true ? true : (data?.allowed === false ? false : null);
        writeAccessState.updatedAt = typeof data?.updated_at === 'string' ? data.updated_at : null;
    } catch {
        // Keep unknown state if consent endpoint is temporarily unavailable.
    }
};

const requestWriteAccessFromTelegram = async (): Promise<boolean> => {
    const telegramWebApp = (window as any).Telegram?.WebApp;
    if (!telegramWebApp || typeof telegramWebApp.requestWriteAccess !== 'function') {
        throw new Error('write_access_unavailable');
    }

    return await new Promise<boolean>((resolve) => {
        let settled = false;
        const settle = (value: boolean): void => {
            if (settled) {
                return;
            }
            settled = true;
            try {
                if (typeof telegramWebApp.offEvent === 'function') {
                    telegramWebApp.offEvent('writeAccessRequested', onWriteAccessRequested);
                }
            } catch {
                // Event API may be unavailable in some Telegram clients.
            }
            resolve(value);
        };

        const onWriteAccessRequested = (payload?: Record<string, unknown>): void => {
            const status = String(payload?.status || '').toLowerCase();
            if (status === 'allowed') {
                settle(true);
                return;
            }
            if (status === 'cancelled' || status === 'denied') {
                settle(false);
            }
        };

        try {
            if (typeof telegramWebApp.onEvent === 'function') {
                telegramWebApp.onEvent('writeAccessRequested', onWriteAccessRequested);
            }
        } catch {
            // Ignore event binding errors and rely on callback/promise fallback.
        }

        try {
            if (telegramWebApp.requestWriteAccess.length > 0) {
                telegramWebApp.requestWriteAccess((allowed: unknown) => settle(allowed === true));
            } else {
                const maybePromise = telegramWebApp.requestWriteAccess();
                if (maybePromise && typeof maybePromise.then === 'function') {
                    maybePromise.then((allowed: unknown) => settle(allowed === true)).catch(() => settle(false));
                }
            }
        } catch {
            settle(false);
        }

        window.setTimeout(() => settle(false), 7000);
    });
};

const requestWriteAccessConsent = async (): Promise<void> => {
    if (writeAccessState.requestInFlight) {
        return;
    }
    if (!canRequestWriteAccess.value) {
        showReminderNotification('Вы недавно отклонили запрос. Попробуйте чуть позже.', 'warning');
        return;
    }
    if (writeAccessState.allowed === true) {
        showReminderNotification('Разрешение уже выдано.', 'success');
        return;
    }

    writeAccessState.requestInFlight = true;
    try {
        const allowed = await requestWriteAccessFromTelegram();
        await persistConsent(allowed);
        if (allowed) {
            showReminderNotification('Разрешение на уведомления получено.', 'success');
            return;
        }
        writeAccessState.lastCancelledAt = Date.now();
        showReminderNotification('Без проблем. Можно включить уведомления позже в настройках.', 'warning');
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message === 'write_access_unavailable') {
            showReminderNotification('Функция доступна только внутри Telegram Mini App.', 'warning');
            return;
        }
        showReminderNotification('Не удалось запросить разрешение. Попробуйте позже.', 'error');
    } finally {
        writeAccessState.requestInFlight = false;
    }
};

const REMINDER_KEY_BY_TYPE: Record<string, keyof ReminderSettings> = {
    water: 'water',
    sleep_reminder: 'sleep',
    sleep_morning_log: 'sleepMorning',
    activity: 'activity'
};

const buildTimezonePayload = (): { tz_name: string | null; tz_offset_minutes: number } => {
    const tzNameRaw = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const tzName = typeof tzNameRaw === 'string' && tzNameRaw.trim().length > 0 ? tzNameRaw.trim() : null;
    return {
        tz_name: tzName,
        tz_offset_minutes: new Date().getTimezoneOffset()
    };
};

const syncUserTimezone = async (): Promise<void> => {
    try {
        await storageStore.apiFetch('/api/user/timezone', {
            method: 'POST',
            body: JSON.stringify(buildTimezonePayload())
        });
    } catch {
        // Ignore timezone sync errors; backend has UTC fallback.
    }
};

const scheduleReminder = async (key: keyof ReminderSettings): Promise<void> => {
    if (appStateStore.serverUser.authorized !== true) {
        return;
    }

    const current = settings[key];
    const fallbackTime = REMINDER_DEFAULTS[key].time;
    const normalizedTime = current.time || fallbackTime;
    if (!normalizedTime) {
        return;
    }
    if (!current.time) {
        current.time = normalizedTime;
    }

    try {
        const timezonePayload = buildTimezonePayload();
        await storageStore.apiFetch('/api/reminders/schedule', {
            method: 'POST',
            body: JSON.stringify({
                type: REMINDER_TYPES[key],
                enabled: current.enabled,
                time_local: normalizedTime,
                frequency: current.frequency,
                timezone: timezonePayload.tz_name,
                tz_offset_minutes: timezonePayload.tz_offset_minutes
            })
        });
    } catch {
        // Ignore scheduling errors to preserve legacy flow.
    }
};

const applyRemindersFromBackend = (rows: unknown): void => {
    if (!Array.isArray(rows)) {
        return;
    }

    rows.forEach((row) => {
        if (!row || typeof row !== 'object') {
            return;
        }
        const reminder = row as Record<string, unknown>;
        const reminderType = typeof reminder.type === 'string' ? reminder.type : '';
        const key = REMINDER_KEY_BY_TYPE[reminderType];
        if (!key) {
            return;
        }

        const enabledRaw = reminder.enabled;
        const enabled = enabledRaw === true || enabledRaw === 1 || enabledRaw === '1';
        const timeLocal = typeof reminder.time_local === 'string' && /^\d{2}:\d{2}$/.test(reminder.time_local)
            ? reminder.time_local
            : REMINDER_DEFAULTS[key].time;
        const frequency = reminder.frequency === 'weekdays' ? 'weekdays' : 'daily';

        settings[key] = {
            ...settings[key],
            enabled,
            time: timeLocal,
            frequency
        };
    });
};

const loadReminderSettingsFromBackend = async (): Promise<void> => {
    if (appStateStore.serverUser.authorized !== true) {
        return;
    }
    try {
        const response = await storageStore.apiFetch('/api/reminders/list');
        if (!response.ok) {
            return;
        }
        const data = await response.json();
        applyRemindersFromBackend(data?.reminders);
    } catch {
        // Keep local/default values when reminders list is unavailable.
    }
};

const onToggleChanged = async (key: keyof ReminderSettings): Promise<void> => {
    await scheduleReminder(key);
    notifyToggleSaved();
};

const onTimeChanged = async (key: keyof ReminderSettings): Promise<void> => {
    if (settings[key].enabled) {
        await scheduleReminder(key);
    }
};

const onFrequencyChanged = async (key: keyof ReminderSettings): Promise<void> => {
    if (settings[key].enabled) {
        await scheduleReminder(key);
    }
};

const hydrateFromProfile = (): void => {
    const profile = storageStore.getUserProfile() as Record<string, unknown>;
    const stored = profile?.reminder_settings && typeof profile.reminder_settings === 'object'
        ? profile.reminder_settings as Partial<ReminderSettings>
        : {};

    settings.water = { ...REMINDER_DEFAULTS.water, ...(stored.water || {}) };
    settings.sleep = { ...REMINDER_DEFAULTS.sleep, ...(stored.sleep || {}) };
    const storedSleepMorning = stored.sleepMorning || (stored as Record<string, unknown>).sleep_morning;
    settings.sleepMorning = { ...REMINDER_DEFAULTS.sleepMorning, ...(storedSleepMorning || {}) };
    settings.activity = { ...REMINDER_DEFAULTS.activity, ...(stored.activity || {}) };
};

const refreshIcons = async (): Promise<void> => {
    await nextTick();
    const feather = (window as any).feather;
    if (typeof feather?.replace === 'function') {
        feather.replace();
    }
};

onMounted(async () => {
    document.body.dataset.preservePageTheme = 'true';
    await syncUserTimezone();

    try {
        await storageStore.syncProfileWithBackend();
    } catch {
        // Keep local profile as fallback.
    }

    hydrateFromProfile();
    await loadReminderSettingsFromBackend();
    await loadConsent();
    await refreshIcons();
});
</script>

<style scoped>
.ios-switch {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    cursor: pointer;
    user-select: none;
    min-height: 28px;
}

.ios-switch__input {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
}

.ios-switch__track {
    position: relative;
    display: inline-flex;
    align-items: center;
    width: 46px;
    height: 28px;
    border-radius: 9999px;
    background-color: #e2e8f0;
    border: 1px solid #cbd5e1;
    transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}

.ios-switch__thumb {
    position: absolute;
    top: 1px;
    left: 1px;
    width: 24px;
    height: 24px;
    border-radius: 9999px;
    background: #ffffff;
    box-shadow: 0 2px 8px rgba(15, 23, 42, 0.18);
    transition: transform 0.2s ease, width 0.2s ease;
}

.ios-switch__input:checked + .ios-switch__track {
    background: linear-gradient(135deg, #34d399 0%, #3b82f6 100%);
    border-color: transparent;
    box-shadow: 0 8px 16px rgba(52, 211, 153, 0.24);
}

.ios-switch__input:checked + .ios-switch__track .ios-switch__thumb {
    transform: translateX(18px);
}

.ios-switch:active .ios-switch__thumb {
    width: 27px;
}

.ios-switch__input:focus-visible + .ios-switch__track {
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.28);
}

.reminders-consent-button {
    padding: 10px 18px;
    font-size: 14px;
    min-height: 0;
    line-height: 1.2;
    box-shadow: 0 3px 14px rgba(52, 211, 153, 0.28);
}

.reminder-field {
    width: 100%;
}
</style>
