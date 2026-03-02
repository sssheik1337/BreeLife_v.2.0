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
                            <div class="flex items-start gap-3">
                                <label class="reminder-toggle">
                                    <input
                                        v-model="settings.water.enabled"
                                        type="checkbox"
                                        class="form-checkbox"
                                        data-reminder-toggle="water"
                                        @change="onToggleChanged('water')"
                                    >
                                    <span>Включено</span>
                                </label>
                                <div>
                                    <p class="font-semibold text-slate-800">💧 Напоминать пить воду</p>
                                    <p class="text-sm text-slate-500">Помогает поддерживать водный баланс в течение дня.</p>
                                </div>
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
                            <div class="flex items-start gap-3">
                                <label class="reminder-toggle">
                                    <input
                                        v-model="settings.sleep.enabled"
                                        type="checkbox"
                                        class="form-checkbox"
                                        data-reminder-toggle="sleep"
                                        @change="onToggleChanged('sleep')"
                                    >
                                    <span>Включено</span>
                                </label>
                                <div>
                                    <p class="font-semibold text-slate-800">🌙 Напоминать о сне</p>
                                    <p class="text-sm text-slate-500">Помогает ложиться вовремя и удерживать ритм.</p>
                                </div>
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
                            <div class="flex items-start gap-3">
                                <label class="reminder-toggle">
                                    <input
                                        v-model="settings.activity.enabled"
                                        type="checkbox"
                                        class="form-checkbox"
                                        data-reminder-toggle="activity"
                                        @change="onToggleChanged('activity')"
                                    >
                                    <span>Включено</span>
                                </label>
                                <div>
                                    <p class="font-semibold text-slate-800">🚶 Напоминать про активность</p>
                                    <p class="text-sm text-slate-500">Поддерживает бодрость: маленькая активность лучше, чем пауза.</p>
                                </div>
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
                    </div>
                </div>
            </div>
        </main>
    </section>
</template>

<script setup lang="ts">
import { nextTick, onMounted, reactive } from 'vue';
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
    activity: ReminderSettingsItem;
}

const REMINDER_DEFAULTS: ReminderSettings = {
    water: { enabled: false, time: '10:00', frequency: 'daily' },
    sleep: { enabled: false, time: '22:30', frequency: 'daily' },
    activity: { enabled: false, time: '18:00', frequency: 'daily' }
};

const REMINDER_TYPES: Record<keyof ReminderSettings, string> = {
    water: 'water',
    sleep: 'sleep_reminder',
    activity: 'activity'
};

const storageStore = useStorageStore();
const appStateStore = useAppStateStore();

const settings = reactive<ReminderSettings>({
    water: { ...REMINDER_DEFAULTS.water },
    sleep: { ...REMINDER_DEFAULTS.sleep },
    activity: { ...REMINDER_DEFAULTS.activity }
});

const notifyToggleSaved = (): void => {
    const showNotification = (window as any).showNotification;
    if (typeof showNotification === 'function') {
        showNotification('Настройки напоминаний обновлены.', 'success');
    }
};

const toPlainSettings = (): ReminderSettings => ({
    water: { ...settings.water },
    sleep: { ...settings.sleep },
    activity: { ...settings.activity }
});

const saveReminderSettings = (): void => {
    storageStore.patchUserProfile({
        reminder_settings: toPlainSettings()
    });
};

const getReminderBaseDate = (frequency: 'daily' | 'weekdays'): Date => {
    const now = new Date();
    if (frequency !== 'weekdays') {
        return now;
    }
    const day = now.getDay();
    if (day >= 1 && day <= 5) {
        return now;
    }
    const daysUntilMonday = day === 6 ? 2 : 1;
    const next = new Date(now);
    next.setDate(now.getDate() + daysUntilMonday);
    return next;
};

const buildReminderIso = (timeValue: string, frequency: 'daily' | 'weekdays'): string | null => {
    if (!timeValue) {
        return null;
    }
    const [hoursRaw, minutesRaw] = timeValue.split(':');
    const hours = Number(hoursRaw);
    const minutes = Number(minutesRaw);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
        return null;
    }
    const base = getReminderBaseDate(frequency);
    const scheduled = new Date(base);
    scheduled.setHours(hours, minutes, 0, 0);
    return scheduled.toISOString();
};

const scheduleReminder = async (key: keyof ReminderSettings): Promise<void> => {
    if (appStateStore.serverUser.authorized !== true) {
        return;
    }

    const current = settings[key];
    const whenIso = buildReminderIso(current.time, current.frequency);
    if (!whenIso) {
        return;
    }

    try {
        await storageStore.apiFetch('/api/reminders/schedule', {
            method: 'POST',
            body: JSON.stringify({ type: REMINDER_TYPES[key], when_iso: whenIso })
        });
    } catch {
        // Ignore scheduling errors to preserve legacy flow.
    }
};

const onToggleChanged = async (key: keyof ReminderSettings): Promise<void> => {
    saveReminderSettings();
    if (settings[key].enabled) {
        await scheduleReminder(key);
    }
    notifyToggleSaved();
};

const onTimeChanged = async (key: keyof ReminderSettings): Promise<void> => {
    saveReminderSettings();
    if (settings[key].enabled) {
        await scheduleReminder(key);
    }
};

const onFrequencyChanged = async (key: keyof ReminderSettings): Promise<void> => {
    saveReminderSettings();
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

    try {
        await storageStore.syncProfileWithBackend();
    } catch {
        // Keep local profile as fallback.
    }

    hydrateFromProfile();
    await refreshIcons();
});
</script>

<style scoped>
.reminder-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: #475569;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 9999px;
    padding: 0.35rem 0.75rem;
}

.reminder-toggle span {
    white-space: nowrap;
}

.reminder-field {
    width: 100%;
}
</style>
