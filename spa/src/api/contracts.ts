/**
 * Общий nullable-тип для API-контрактов.
 */
export type Nullable<T> = T | null;

/**
 * Формат локальной даты в API (обычно `YYYY-MM-DD`).
 */
export type ApiLocalDateString = string;

/**
 * Формат времени в API (обычно `HH:MM`).
 */
export type ApiTimeString = string;

/**
 * Формат ISO datetime-строки.
 */
export type ApiIsoDateTimeString = string;

/**
 * Профиль пользователя.
 *
 * Важно: сохраняем совместимость со структурой backend/legacy,
 * поэтому поля с неизвестной схемой допускаются через индексную сигнатуру.
 */
export interface UserProfile {
    sex?: Nullable<string>;
    birth_date?: Nullable<ApiLocalDateString>;
    age?: Nullable<number>;
    height_cm?: Nullable<number>;
    weight_kg?: Nullable<number>;
    target_weight_kg?: Nullable<number>;
    activity_factor?: Nullable<number>;
    goal?: Nullable<string>;
    goal_deadline?: Nullable<ApiLocalDateString>;

    calories_target?: Nullable<number>;
    tdee_calories?: Nullable<number>;
    bmr?: Nullable<number>;

    is_completed?: Nullable<boolean>;
    preferences_onboarding_completed?: Nullable<boolean>;
    trial_welcome_seen?: Nullable<boolean>;
    trial_started_at?: Nullable<ApiIsoDateTimeString>;
    subscription_status?: Nullable<string>;

    favorite_product_ids?: number[];
    excluded_product_ids?: number[];

    [key: string]: unknown;
}

export interface DiaryEntry {
    date?: Nullable<ApiLocalDateString>;
    meals?: unknown[];
    water_l?: Nullable<number>;
    sleep_time?: Nullable<ApiTimeString>;
    activity?: Nullable<boolean>;
    [key: string]: unknown;
}

export interface HabitEntry {
    date?: Nullable<ApiLocalDateString>;
    [key: string]: unknown;
}

/**
 * В backend `habits` сейчас хранится как объект, а не как массив.
 */
export type HabitCollection = Record<string, unknown>;

export interface SessionStatus {
    authorized: boolean;
    telegram_user_id: Nullable<number>;
    profile_completed: boolean;
    first_name: Nullable<string>;
    last_name: Nullable<string>;
    username: Nullable<string>;
    photo_url: Nullable<string>;
}

export interface MealPlanDayResponse {
    date?: string;
    target_calories?: number;
    items?: unknown[];
    [key: string]: unknown;
}

export interface MealPlanWeekResponse {
    week_start?: string;
    days?: unknown[];
    [key: string]: unknown;
}

export interface SubscriptionStatusResponse {
    status: 'active' | 'inactive' | string;
    subscription_until: Nullable<ApiIsoDateTimeString>;
    subscription_started_at: Nullable<ApiIsoDateTimeString>;
}

export interface ReminderEntity {
    id?: string;
    type?: string;
    time?: string;
    enabled?: boolean;
    when_iso?: string;
    [key: string]: unknown;
}
