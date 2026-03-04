const apiFetch = window.apiFetch || fetch;

const REMINDER_DEFAULTS = {
    water: { enabled: false, time: '10:00', frequency: 'daily' },
    sleep: { enabled: false, time: '22:30', frequency: 'daily' },
    activity: { enabled: false, time: '18:00', frequency: 'daily' }
};

const REMINDER_TYPES = {
    water: 'water',
    sleep: 'sleep_reminder',
    activity: 'activity'
};

function getReminderSettings() {
    const profile = typeof getUserProfile === 'function' ? getUserProfile() : {};
    const stored = profile?.reminder_settings && typeof profile.reminder_settings === 'object'
        ? profile.reminder_settings
        : {};
    return {
        water: { ...REMINDER_DEFAULTS.water, ...(stored.water || {}) },
        sleep: { ...REMINDER_DEFAULTS.sleep, ...(stored.sleep || {}) },
        activity: { ...REMINDER_DEFAULTS.activity, ...(stored.activity || {}) }
    };
}

function saveReminderSettings(nextSettings) {
    if (typeof patchUserProfile !== 'function') {
        return;
    }
    patchUserProfile({ reminder_settings: nextSettings });
}

function getReminderBaseDate(frequency) {
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
}

function buildReminderIso(timeValue, frequency) {
    if (!timeValue) {
        return null;
    }
    const [hours, minutes] = timeValue.split(':').map((value) => Number(value));
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
        return null;
    }
    const base = getReminderBaseDate(frequency);
    const scheduled = new Date(base);
    scheduled.setHours(hours, minutes, 0, 0);
    return scheduled.toISOString();
}

async function scheduleReminder(type, timeValue, frequency) {
    if (window.serverUser?.authorized !== true) {
        return;
    }
    const whenIso = buildReminderIso(timeValue, frequency);
    if (!whenIso) {
        return;
    }
    try {
        await apiFetch('/api/reminders/schedule', {
            method: 'POST',
            body: JSON.stringify({ type, when_iso: whenIso })
        });
    } catch (error) {
        return;
    }
}

function initReminderControls() {
    const container = document.getElementById('reminders-settings');
    if (!container) {
        return;
    }
    const settings = getReminderSettings();

    const toggleInputs = container.querySelectorAll('[data-reminder-toggle]');
    toggleInputs.forEach((input) => {
        const key = input.dataset.reminderToggle;
        if (!key || !settings[key]) {
            return;
        }
        input.checked = Boolean(settings[key].enabled);
        input.addEventListener('change', async () => {
            const nextSettings = {
                ...settings,
                [key]: { ...settings[key], enabled: input.checked }
            };
            settings[key] = nextSettings[key];
            saveReminderSettings(nextSettings);
            if (input.checked) {
                const timeInput = container.querySelector(`[data-reminder-time="${key}"]`);
                const frequencySelect = container.querySelector(`[data-reminder-frequency="${key}"]`);
                await scheduleReminder(
                    REMINDER_TYPES[key],
                    timeInput?.value || settings[key].time,
                    frequencySelect?.value || settings[key].frequency
                );
            }
            if (typeof showNotification === 'function') {
                showNotification('Настройки напоминаний обновлены.', 'success');
            }
        });
    });

    const timeInputs = container.querySelectorAll('[data-reminder-time]');
    timeInputs.forEach((input) => {
        const key = input.dataset.reminderTime;
        if (!key || !settings[key]) {
            return;
        }
        input.value = settings[key].time || '';
        input.addEventListener('change', async () => {
            const nextSettings = {
                ...settings,
                [key]: { ...settings[key], time: input.value }
            };
            settings[key] = nextSettings[key];
            saveReminderSettings(nextSettings);
            if (settings[key].enabled) {
                await scheduleReminder(REMINDER_TYPES[key], input.value, settings[key].frequency);
            }
        });
    });

    const frequencySelects = container.querySelectorAll('[data-reminder-frequency]');
    frequencySelects.forEach((select) => {
        const key = select.dataset.reminderFrequency;
        if (!key || !settings[key]) {
            return;
        }
        select.value = settings[key].frequency || 'daily';
        select.addEventListener('change', async () => {
            const nextSettings = {
                ...settings,
                [key]: { ...settings[key], frequency: select.value }
            };
            settings[key] = nextSettings[key];
            saveReminderSettings(nextSettings);
            if (settings[key].enabled) {
                const timeInput = container.querySelector(`[data-reminder-time="${key}"]`);
                await scheduleReminder(REMINDER_TYPES[key], timeInput?.value || settings[key].time, select.value);
            }
        });
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    if (typeof window.syncProfileWithBackend === 'function') {
        await window.syncProfileWithBackend();
    }
    initReminderControls();
});
