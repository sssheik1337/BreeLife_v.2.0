<template>
    <section class="bg-gradient-to-br from-[#f8fafc] via-[#f0f9ff] to-[#f0fdf4]" data-spa-questionnaire>
        <main class="flex-1 px-4 py-8">
            <div class="max-w-[420px] mx-auto">
                <div class="text-center mb-10">
                    <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-400 mb-4 shadow-lg">
                        <i data-feather="edit-3" class="w-7 h-7 text-white"></i>
                    </div>
                    <h1 class="text-2xl font-bold text-slate-800">Заполните личные данные</h1>
                    <p class="text-slate-500 mt-2">Для расчета суточной нормы калорий и рациона</p>
                </div>

                <div class="mb-8">
                    <div class="flex items-center justify-between text-sm text-slate-500 mb-2">
                        <span class="inline-flex items-center gap-2">
                            <span class="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold">
                                Шаг <span id="current-step">{{ currentStep }}</span> из <span id="total-steps">{{ totalSteps }}</span>
                            </span>
                        </span>
                        <span id="progress-percent">{{ progressLabel }}</span>
                    </div>
                    <div class="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                            id="progress-bar"
                            class="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full transition-all duration-500 ease-out"
                            :style="{ width: `${progressPercent}%` }"
                        ></div>
                    </div>
                </div>

                <div id="question-card" class="bg-white rounded-3xl p-6 shadow-xl border border-slate-100 mb-8 transform transition-all duration-300 ease-out">
                    <div class="flex items-center space-x-3 mb-6">
                        <div class="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                            <i :data-feather="currentQuestion?.icon || 'user'" class="w-5 h-5"></i>
                        </div>
                        <h2 id="question-title" class="text-xl font-semibold text-slate-800">{{ currentQuestion?.title || '' }}</h2>
                    </div>

                    <div id="options-container" class="space-y-3" :class="{ hidden: currentQuestion?.type !== 'select' }">
                        <div
                            v-for="option in (currentQuestion?.options || [])"
                            :key="`${currentQuestion?.id}-${option.value}`"
                            class="option-card"
                            :class="{ selected: isSelectedOption(option.value) }"
                            :title="option.tooltip || ''"
                            @click="selectOption(option.value)"
                        >
                            <div class="flex items-center space-x-3">
                                <span class="text-2xl">{{ option.emoji }}</span>
                                <span class="font-medium text-slate-800">{{ option.label }}</span>
                            </div>
                            <div class="checkmark" :class="{ hidden: !isSelectedOption(option.value) }">
                                <i data-feather="check" class="w-5 h-5 text-emerald-600"></i>
                            </div>
                        </div>
                    </div>

                    <div id="input-container" :class="{ hidden: currentQuestion?.type === 'select' }">
                        <template v-if="currentQuestion?.type === 'date'">
                            <div class="picker-panel picker-panel--inline">
                                <div class="wheel-picker" data-role="birth-picker">
                                    <div class="wheel-column">
                                        <select id="birth-day" v-model="birthDay" class="wheel-select" aria-label="День рождения" @change="onBirthDatePartChange('day')">
                                            <option value="" class="wheel-placeholder">День</option>
                                            <option v-for="day in birthDayOptions" :key="`birth-day-${day}`" :value="String(day)">
                                                {{ day }}
                                            </option>
                                        </select>
                                    </div>
                                    <div class="wheel-column">
                                        <select id="birth-month" v-model="birthMonth" class="wheel-select" aria-label="Месяц рождения" @change="onBirthDatePartChange('month')">
                                            <option value="" class="wheel-placeholder">Месяц</option>
                                            <option v-for="(label, index) in monthLabels" :key="`birth-month-${index + 1}`" :value="String(index + 1)">
                                                {{ label }}
                                            </option>
                                        </select>
                                    </div>
                                    <div class="wheel-column">
                                        <select id="birth-year" v-model="birthYear" class="wheel-select" aria-label="Год рождения" @change="onBirthDatePartChange('year')">
                                            <option value="" class="wheel-placeholder">Год</option>
                                            <option v-for="year in birthYearOptions" :key="`birth-year-${year}`" :value="String(year)">
                                                {{ year }}
                                            </option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </template>
                        <template v-else-if="currentQuestion?.type === 'number' && currentQuestion?.id === 3">
                            <div class="picker-panel picker-panel--inline" data-role="picker-panel">
                                <div class="ruler-value">
                                    <span id="height-ruler-value" class="ruler-value__number">{{ heightValueLabel }}</span>
                                    <span class="ruler-value__unit">см</span>
                                </div>
                                <div ref="heightRulerRef" class="ruler ruler--vertical" id="height-ruler" aria-label="Выбор роста">
                                    <div class="ruler__fade ruler__fade--start" aria-hidden="true"></div>
                                    <div class="ruler__fade ruler__fade--end" aria-hidden="true"></div>
                                    <div class="ruler__indicator" aria-hidden="true"></div>
                                    <div id="height-ruler-track" class="ruler__track" :style="{ height: `${heightTotalVirtualSteps * HEIGHT_RULER_PIXELS_PER_STEP}px` }">
                                        <div
                                            v-for="tick in heightRulerTicks"
                                            :key="`height-tick-${tick.virtualIndex}`"
                                            class="ruler__tick"
                                            :class="{
                                                'ruler__tick--major': tick.isMajor,
                                                'ruler__tick--active': tick.virtualIndex === heightVirtualIndex
                                            }"
                                            :style="{
                                                height: `${HEIGHT_RULER_PIXELS_PER_STEP}px`,
                                                ...getHeightTickStyle(tick.virtualIndex)
                                            }"
                                        >
                                            <span v-if="tick.isMajor" class="ruler__tick-label">{{ tick.label }}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </template>
                        <template v-else-if="currentQuestion?.type === 'number' && (currentQuestion?.id === 4 || currentQuestion?.id === 5)">
                            <div class="picker-panel picker-panel--inline" data-role="picker-panel">
                                <div class="ruler-value">
                                    <span id="weight-ruler-value" class="ruler-value__number">{{ weightValueLabel }}</span>
                                    <span class="ruler-value__unit">кг</span>
                                </div>
                                <div ref="weightRulerRef" class="ruler ruler--horizontal" id="weight-ruler" aria-label="Выбор веса">
                                    <div class="ruler__fade ruler__fade--start" aria-hidden="true"></div>
                                    <div class="ruler__fade ruler__fade--end" aria-hidden="true"></div>
                                    <div class="ruler__indicator" aria-hidden="true"></div>
                                    <div id="weight-ruler-track" class="ruler__track" :style="{ width: `${weightTotalVirtualSteps * WEIGHT_RULER_PIXELS_PER_STEP}px` }">
                                        <div
                                            v-for="tick in weightRulerTicks"
                                            :key="`weight-tick-${tick.virtualIndex}`"
                                            class="ruler__tick"
                                            :class="{
                                                'ruler__tick--major': tick.isMajor,
                                                'ruler__tick--active': tick.virtualIndex === weightVirtualIndex
                                            }"
                                            :style="{
                                                width: `${WEIGHT_RULER_PIXELS_PER_STEP}px`,
                                                ...getWeightTickStyle(tick.virtualIndex)
                                            }"
                                        >
                                            <span v-if="tick.isMajor" class="ruler__tick-label">{{ tick.label }}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </template>
                        <template v-else-if="currentQuestion?.type === 'number'">
                            <div class="space-y-3">
                                <label for="question-input" class="text-sm font-medium text-slate-600">{{ currentQuestion.placeholder }}</label>
                                <input
                                    id="question-input"
                                    type="number"
                                    class="form-input"
                                    :min="currentQuestion.min"
                                    :max="currentQuestion.max"
                                    :step="currentQuestion.step"
                                    :value="currentAnswerText"
                                    @input="setCurrentAnswer(($event.target as HTMLInputElement).value)"
                                >
                                <p v-if="currentQuestion.unit" class="text-xs text-slate-500">Единица измерения: {{ currentQuestion.unit }}</p>
                            </div>
                        </template>
                    </div>
                </div>

                <div class="flex space-x-4">
                    <button id="prev-btn" class="btn-secondary flex-1" :disabled="isFirstStep || isSubmitting" @click="goToPrevQuestion">
                        <i data-feather="arrow-left" class="w-5 h-5"></i>
                        <span>Назад</span>
                    </button>
                    <button id="next-btn" class="btn-primary flex-1" :disabled="isNextDisabled || isSubmitting" @click="goToNextQuestion">
                        <span>{{ isLastStep ? 'Завершить' : 'Далее' }}</span>
                        <i :data-feather="isLastStep ? 'check' : 'arrow-right'" class="w-5 h-5"></i>
                    </button>
                </div>

                <p class="text-center text-sm text-slate-400 mt-8">
                    Ваши данные остаются на устройстве • Защищено и приватно
                </p>
            </div>
        </main>
    </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAppStateStore } from '../stores/appStateStore';
import { useStorageStore } from '../stores/storageStore';
import { resolvePostQuestionnaireRoute } from '../domain/onboarding';

interface ActivityOption {
    value: string;
    label: string;
    emoji: string;
    tooltip?: string;
}

interface QuestionnaireQuestion {
    id: number;
    title: string;
    type: 'select' | 'date' | 'number';
    icon: string;
    optional?: boolean;
    placeholder?: string;
    min?: string | number;
    max?: string | number;
    step?: number;
    unit?: string;
    options?: ActivityOption[];
}

interface UserDataState {
    gender: string | null;
    birthDate: string | null;
    height: string | null;
    currentWeight: string | null;
    targetWeight: string | null;
    activityLevel: string | null;
    goalType: string | null;
    deadline: string | null;
    foodDiary: boolean | null;
    registrationDate: string | null;
}

const HEIGHT_RANGE = { min: 120, max: 220, step: 1 };
const WEIGHT_RANGE = { min: 30, max: 200, step: 0.5 };
const TARGET_WEIGHT_RANGE = { min: 40, max: 200, step: 0.5 };
const HEIGHT_RULER_PIXELS_PER_STEP = 12;
const HEIGHT_RULER_LOOP_COUNT = 7;
const WEIGHT_RULER_PIXELS_PER_STEP = 24;
const WEIGHT_RULER_LOOP_COUNT = 7;
const monthLabels = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];
const USER_DATA_DIRTY_KEYS: Array<keyof UserDataState> = ['gender', 'birthDate', 'height', 'currentWeight', 'activityLevel', 'goalType'];

const router = useRouter();
const route = useRoute();
const appStateStore = useAppStateStore();
const storageStore = useStorageStore();

const userData = reactive<UserDataState>({
    gender: null,
    birthDate: null,
    height: null,
    currentWeight: null,
    targetWeight: null,
    activityLevel: null,
    goalType: null,
    deadline: null,
    foodDiary: null,
    registrationDate: null
});
const userDataDirtyMap = reactive<Record<keyof UserDataState, boolean>>({
    gender: false,
    birthDate: false,
    height: false,
    currentWeight: false,
    targetWeight: false,
    activityLevel: false,
    goalType: false,
    deadline: false,
    foodDiary: false,
    registrationDate: false
});
const adminConfig = ref<Record<string, unknown>>({});
const currentQuestionIndex = ref(0);
const isSubmitting = ref(false);
const serverProfileCompleted = ref(false);
const birthDay = ref('');
const birthMonth = ref('');
const birthYear = ref('');
const birthDayOptions = ref<number[]>([]);
const birthYearOptions = ref<number[]>([]);
const heightRulerRef = ref<HTMLElement | null>(null);
const weightRulerRef = ref<HTMLElement | null>(null);
const heightVirtualIndex = ref(0);
const weightVirtualIndex = ref(0);
const heightValueLabel = ref('160');
const weightValueLabel = ref('70');
let heightRafId: number | null = null;
let weightRafId: number | null = null;
let detachHeightRulerScroll: (() => void) | null = null;
let detachWeightRulerScroll: (() => void) | null = null;

const activityOptionsFallback = (): ActivityOption[] => [
    { value: '1.2', label: 'Тренировок мало либо они отсутствуют', emoji: '🛋️', tooltip: 'Низкая активность' },
    { value: '1.375', label: 'Немного движения: прогулки или 1–3 тренировки', emoji: '🚶', tooltip: 'Низкая активность' },
    { value: '1.55', label: 'Регулярные тренировки 3–5 раз в неделю', emoji: '🏃', tooltip: 'Умеренная активность' },
    { value: '1.725', label: 'Высокая активность почти каждый день', emoji: '🏋️', tooltip: 'Высокая активность' },
    { value: '1.9', label: 'Физическая активность + очень интенсивные тренировки', emoji: '🔥', tooltip: 'Высокая активность' }
];

const buildActivityOptions = (): ActivityOption[] => {
    const coefficients = (adminConfig.value.activity_coefficients as Array<Record<string, unknown>> | undefined) || [];
    if (!Array.isArray(coefficients) || coefficients.length === 0) {
        return activityOptionsFallback();
    }
    return coefficients.map((item) => ({
        value: String(item.value ?? ''),
        label: String(item.label ?? ''),
        emoji: typeof item.emoji === 'string' && item.emoji ? item.emoji : '✨',
        tooltip: typeof item.label === 'string' ? item.label : 'Уровень активности'
    }));
};

const questions = computed<QuestionnaireQuestion[]>(() => [
    {
        id: 1,
        title: 'Какой ваш пол?',
        type: 'select',
        icon: 'user',
        options: [
            { value: 'male', label: 'Мужской', emoji: '👨' },
            { value: 'female', label: 'Женский', emoji: '👩' }
        ]
    },
    {
        id: 2,
        title: 'Дата рождения',
        type: 'date',
        icon: 'calendar',
        placeholder: 'Выберите дату рождения',
        min: '1900-01-01',
        max: new Date().toISOString().split('T')[0]
    },
    {
        id: 3,
        title: 'Какой у вас рост?',
        type: 'number',
        icon: 'maximize-2',
        placeholder: 'Введите рост в сантиметрах',
        unit: 'cm',
        min: HEIGHT_RANGE.min,
        max: HEIGHT_RANGE.max,
        step: HEIGHT_RANGE.step
    },
    {
        id: 4,
        title: 'Какой у вас текущий вес?',
        type: 'number',
        icon: 'scale',
        placeholder: 'Введите вес в килограммах',
        unit: 'kg',
        min: WEIGHT_RANGE.min,
        max: WEIGHT_RANGE.max,
        step: WEIGHT_RANGE.step
    },
    {
        id: 5,
        title: 'Желаемый вес',
        type: 'number',
        icon: 'target',
        placeholder: 'Введите желаемый вес в килограммах',
        unit: 'kg',
        min: TARGET_WEIGHT_RANGE.min,
        max: TARGET_WEIGHT_RANGE.max,
        step: TARGET_WEIGHT_RANGE.step
    },
    {
        id: 6,
        title: 'Какой у вас уровень физической активности?',
        type: 'select',
        icon: 'activity',
        options: buildActivityOptions()
    },
    {
        id: 7,
        title: 'Какова ваша цель?',
        type: 'select',
        icon: 'flag',
        options: [
            { value: 'lose', label: 'Снижение веса', emoji: '📉' },
            { value: 'gain', label: 'Набор веса', emoji: '📈' },
            { value: 'maintain', label: 'Поддержание формы', emoji: '⚖️' }
        ]
    },
    {
        id: 8,
        title: 'Когда вы хотите достичь цели?',
        type: 'date',
        icon: 'calendar',
        placeholder: 'Выберите дату дедлайна',
        min: new Date().toISOString().split('T')[0],
        max: '2100-12-31',
        optional: true
    }
]);

const isEditMode = computed<boolean>(() => String(route.query.edit || '') === '1');

const activeQuestions = computed<QuestionnaireQuestion[]>(() => {
    const byId = new Map(questions.value.map((question) => [question.id, question]));
    const orderedIds = [1, 2, 3, 4, 7];
    if (userData.goalType === 'lose' || userData.goalType === 'gain') {
        orderedIds.push(5, 8);
    }
    orderedIds.push(6);
    return orderedIds
        .map((id) => byId.get(id))
        .filter((question): question is QuestionnaireQuestion => Boolean(question));
});

const currentQuestion = computed<QuestionnaireQuestion | null>(() => activeQuestions.value[currentQuestionIndex.value] || null);
const totalSteps = computed<number>(() => activeQuestions.value.length || 1);
const currentStep = computed<number>(() => Math.min(currentQuestionIndex.value + 1, totalSteps.value));
const progressPercent = computed<number>(() => Math.round((currentStep.value / totalSteps.value) * 100));
const progressLabel = computed<string>(() => `${progressPercent.value}%`);
const isFirstStep = computed<boolean>(() => currentQuestionIndex.value === 0);
const isLastStep = computed<boolean>(() => currentQuestionIndex.value >= activeQuestions.value.length - 1);

const notify = (message: string, type: 'success' | 'error' | 'warning' = 'success'): void => {
    const notifier = (window as any).showNotification;
    if (typeof notifier === 'function') {
        notifier(message, type);
        return;
    }
    if (type === 'error') {
        console.error(message);
        return;
    }
    console.log(message);
};

const shouldTrackDirtyKey = (key: keyof UserDataState): boolean => USER_DATA_DIRTY_KEYS.includes(key);

const setUserDataField = (
    key: keyof UserDataState,
    value: string | boolean | null,
    options: { source?: 'form' | 'server'; markDirty?: boolean; ignoreDirty?: boolean } = {}
): boolean => {
    const source = options.source || 'server';
    const markDirty = options.markDirty === true;
    const ignoreDirty = options.ignoreDirty === true;
    if (shouldTrackDirtyKey(key) && userDataDirtyMap[key] && !ignoreDirty && source !== 'form') {
        return false;
    }
    userData[key] = value as never;
    if (markDirty && source === 'form' && shouldTrackDirtyKey(key)) {
        userDataDirtyMap[key] = true;
    }
    return true;
};

const resetUserDataDirtyMap = (): void => {
    Object.keys(userDataDirtyMap).forEach((key) => {
        userDataDirtyMap[key as keyof UserDataState] = false;
    });
};

const mapUserProfileToUserData = (profile: Record<string, unknown>): Partial<UserDataState> => ({
    gender: profile?.sex ?? null,
    birthDate: profile?.birth_date ?? null,
    height: profile?.height_cm ?? null,
    currentWeight: profile?.weight_kg ?? null,
    targetWeight: profile?.target_weight_kg ?? null,
    activityLevel: profile?.activity_factor ?? null,
    goalType: profile?.goal ?? null,
    deadline: profile?.goal_deadline ?? null,
    foodDiary: profile?.food_diary ?? null
});

const mapUserDataToUserProfile = (data: Partial<UserDataState>): Record<string, unknown> => {
    const parseNumber = (value: unknown): number | null => {
        if (value === null || value === undefined || value === '') {
            return null;
        }
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    };
    const normalizeSex = (value: unknown): 'male' | 'female' | null => {
        if (!value) {
            return null;
        }
        const normalized = String(value).trim().toLowerCase();
        if (normalized === 'male' || normalized === 'man') {
            return 'male';
        }
        if (normalized === 'female' || normalized === 'woman') {
            return 'female';
        }
        return null;
    };
    const normalizeGoal = (value: unknown): 'lose' | 'maintain' | 'gain' | null => {
        if (!value) {
            return null;
        }
        const normalized = String(value).trim().toLowerCase();
        if (['lose', 'loss', 'weight_loss', 'slim'].includes(normalized)) {
            return 'lose';
        }
        if (['maintain', 'keep', 'maintenance', 'balance'].includes(normalized)) {
            return 'maintain';
        }
        if (['gain', 'bulk', 'mass', 'muscle', 'build'].includes(normalized)) {
            return 'gain';
        }
        return null;
    };
    const calculateAge = (birthDate: unknown): number | null => {
        const normalized = storageStore.normalizeLocalDate(String(birthDate || ''));
        if (!normalized) {
            return null;
        }
        const today = new Date();
        const birth = new Date(`${normalized}T00:00:00`);
        if (Number.isNaN(birth.getTime())) {
            return null;
        }
        let age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
            age -= 1;
        }
        return Number.isFinite(age) && age >= 0 ? age : null;
    };

    const rawGender = data.gender ?? null;
    const birthDate = data.birthDate ?? null;
    const heightValue = data.height ?? null;
    const weightValue = data.currentWeight ?? null;
    const targetWeightValue = data.targetWeight ?? null;
    const activityValue = data.activityLevel ?? null;
    const goalValue = data.goalType ?? null;
    const deadlineValue = data.deadline ?? null;
    const foodDiaryValue = data.foodDiary ?? null;
    const normalizedGoal = normalizeGoal(goalValue);

    return {
        sex: normalizeSex(rawGender),
        birth_date: birthDate,
        age: calculateAge(birthDate),
        height_cm: parseNumber(heightValue),
        weight_kg: parseNumber(weightValue),
        target_weight_kg: normalizedGoal === 'maintain' ? null : parseNumber(targetWeightValue),
        goal: normalizedGoal,
        activity_factor: parseNumber(activityValue),
        goal_deadline: normalizedGoal === 'maintain' ? null : (deadlineValue || null),
        food_diary: foodDiaryValue === true || foodDiaryValue === false
            ? foodDiaryValue
            : null
    };
};

const mergeUserDataWithoutLosingAnswers = (
    target: UserDataState,
    source: Partial<UserDataState>,
    options: { source?: string } = {}
): void => {
    const sourceName = (options.source || 'server') as 'server' | 'form';
    Object.entries(source).forEach(([key, value]) => {
        const hasIncomingValue = value !== null && value !== undefined && value !== '';
        if (!hasIncomingValue) {
            return;
        }
        const typedKey = key as keyof UserDataState;
        if (shouldTrackDirtyKey(typedKey) && userDataDirtyMap[typedKey]) {
            return;
        }
        const current = target[typedKey];
        const hasCurrentValue = current !== null && current !== undefined && current !== '';
        if (!hasCurrentValue) {
            setUserDataField(typedKey, value as never, { source: sourceName });
        }
    });
};

const getDataKeyByQuestionId = (id?: number): keyof UserDataState => {
    switch (id) {
        case 1:
            return 'gender';
        case 2:
            return 'birthDate';
        case 3:
            return 'height';
        case 4:
            return 'currentWeight';
        case 5:
            return 'targetWeight';
        case 6:
            return 'activityLevel';
        case 7:
            return 'goalType';
        case 8:
            return 'deadline';
        default:
            return 'gender';
    }
};

const currentAnswerKey = computed<keyof UserDataState>(() => getDataKeyByQuestionId(currentQuestion.value?.id));
const currentAnswerValue = computed(() => userData[currentAnswerKey.value]);
const currentAnswerText = computed<string>(() => {
    const value = currentAnswerValue.value;
    if (value === null || value === undefined) {
        return '';
    }
    return String(value);
});

const clampNumber = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const parseNumberValue = (value: unknown): number | null => {
    if (value === null || value === undefined || value === '') {
        return null;
    }
    const normalized = String(value).replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
};

const formatWeightLabel = (value: number): string => value.toFixed(1).replace('.0', '');

const heightRangeSteps = computed<number>(() => Math.round((HEIGHT_RANGE.max - HEIGHT_RANGE.min) / HEIGHT_RANGE.step) + 1);
const heightTotalVirtualSteps = computed<number>(() => heightRangeSteps.value * HEIGHT_RULER_LOOP_COUNT);
const weightRangeSteps = computed<number>(() => Math.round((WEIGHT_RANGE.max - WEIGHT_RANGE.min) / WEIGHT_RANGE.step) + 1);
const weightTotalVirtualSteps = computed<number>(() => weightRangeSteps.value * WEIGHT_RULER_LOOP_COUNT);

const heightRulerTicks = computed<Array<{ virtualIndex: number; label: string; isMajor: boolean }>>(() => {
    return Array.from({ length: heightTotalVirtualSteps.value }, (_, virtualIndex) => {
        const value = HEIGHT_RANGE.max - (virtualIndex % heightRangeSteps.value) * HEIGHT_RANGE.step;
        return {
            virtualIndex,
            label: `${value}`,
            isMajor: value % 5 === 0
        };
    });
});

const weightRulerTicks = computed<Array<{ virtualIndex: number; label: string; isMajor: boolean }>>(() => {
    return Array.from({ length: weightTotalVirtualSteps.value }, (_, virtualIndex) => {
        const value = WEIGHT_RANGE.min + (virtualIndex % weightRangeSteps.value) * WEIGHT_RANGE.step;
        const isMajor = Math.round(value * 10) % 50 === 0;
        return {
            virtualIndex,
            label: `${Math.round(value)}`,
            isMajor
        };
    });
});

const getHeightTickStyle = (virtualIndex: number): Record<string, string> => {
    const distancePx = Math.abs(virtualIndex - heightVirtualIndex.value) * HEIGHT_RULER_PIXELS_PER_STEP;
    const scale = clampNumber(1.4 - distancePx * 0.02, 1, 1.4);
    const opacity = clampNumber(1 - distancePx * 0.015, 0.3, 1);
    return {
        transform: `translateZ(0) scale(${scale.toFixed(3)})`,
        opacity: opacity.toFixed(3)
    };
};

const getWeightTickStyle = (virtualIndex: number): Record<string, string> => {
    const distancePx = Math.abs(virtualIndex - weightVirtualIndex.value) * WEIGHT_RULER_PIXELS_PER_STEP;
    const scale = clampNumber(1.4 - distancePx * 0.02, 1, 1.4);
    const opacity = clampNumber(1 - distancePx * 0.015, 0.3, 1);
    return {
        transform: `translateZ(0) scale(${scale.toFixed(3)})`,
        opacity: opacity.toFixed(3)
    };
};

const getDateRangeMeta = (): {
    isDeadlinePicker: boolean;
    minDate: Date;
    maxDate: Date;
    minYear: number;
    maxYear: number;
} => {
    const today = new Date();
    const isDeadlinePicker = currentQuestion.value?.id === 8;
    const minDate = isDeadlinePicker ? new Date(today) : new Date(1900, 0, 1);
    const maxDate = isDeadlinePicker ? new Date(today.getFullYear() + 2, today.getMonth(), today.getDate()) : new Date(today);
    return {
        isDeadlinePicker,
        minDate,
        maxDate,
        minYear: isDeadlinePicker ? minDate.getFullYear() : 1900,
        maxYear: maxDate.getFullYear()
    };
};

const clampDateToRange = (year: number, month: number, day: number): { year: number; month: number; day: number } => {
    const { isDeadlinePicker, minDate, maxDate } = getDateRangeMeta();
    if (!isDeadlinePicker) {
        return { year, month, day };
    }
    const candidate = new Date(year, month - 1, day);
    if (candidate < minDate) {
        return {
            year: minDate.getFullYear(),
            month: minDate.getMonth() + 1,
            day: minDate.getDate()
        };
    }
    if (candidate > maxDate) {
        return {
            year: maxDate.getFullYear(),
            month: maxDate.getMonth() + 1,
            day: maxDate.getDate()
        };
    }
    return { year, month, day };
};

const updateBirthDayOptions = (preferredDay?: number): void => {
    const { isDeadlinePicker, minDate, maxDate, maxYear } = getDateRangeMeta();
    const safeYear = Number(birthYear.value) || maxYear;
    const safeMonth = Number(birthMonth.value) || 1;
    const daysInMonth = new Date(safeYear, safeMonth, 0).getDate();
    let startDay = 1;
    let endDay = daysInMonth;

    if (isDeadlinePicker) {
        const isMinMonth = safeYear === minDate.getFullYear() && safeMonth === minDate.getMonth() + 1;
        const isMaxMonth = safeYear === maxDate.getFullYear() && safeMonth === maxDate.getMonth() + 1;
        if (isMinMonth) {
            startDay = minDate.getDate();
        }
        if (isMaxMonth) {
            endDay = maxDate.getDate();
        }
    }

    const nextOptions: number[] = [];
    for (let day = startDay; day <= endDay; day += 1) {
        nextOptions.push(day);
    }
    birthDayOptions.value = nextOptions;

    const preferred = Number.isFinite(preferredDay as number) && Number(preferredDay) > 0
        ? Number(preferredDay)
        : Number(birthDay.value);
    if (!Number.isFinite(preferred) || preferred <= 0) {
        if (!nextOptions.includes(Number(birthDay.value))) {
            birthDay.value = '';
        }
        return;
    }
    const clampedPreferred = clampNumber(preferred, startDay, endDay);
    if (nextOptions.includes(clampedPreferred)) {
        birthDay.value = String(clampedPreferred);
    } else if (!nextOptions.includes(Number(birthDay.value))) {
        birthDay.value = '';
    }
};

const syncBirthDateAnswer = (): void => {
    const year = Number(birthYear.value);
    const month = Number(birthMonth.value);
    const day = Number(birthDay.value);
    if (!year || !month || !day) {
        setUserDataField(currentAnswerKey.value, null, { source: 'form', markDirty: true });
        return;
    }
    const clamped = clampDateToRange(year, month, day);
    if (clamped.year !== year) {
        birthYear.value = String(clamped.year);
    }
    if (clamped.month !== month) {
        birthMonth.value = String(clamped.month);
    }
    if (clamped.day !== day) {
        birthDay.value = String(clamped.day);
    }
    const formatted = `${clamped.year}-${String(clamped.month).padStart(2, '0')}-${String(clamped.day).padStart(2, '0')}`;
    setUserDataField(currentAnswerKey.value, formatted, { source: 'form', markDirty: true });
};

const initializeBirthPicker = (): void => {
    if (currentQuestion.value?.type !== 'date') {
        return;
    }

    const { isDeadlinePicker, minYear, maxYear } = getDateRangeMeta();
    const years: number[] = [];
    for (let year = maxYear; year >= minYear; year -= 1) {
        years.push(year);
    }
    birthYearOptions.value = years;

    let sourceDate = String(currentAnswerValue.value || '');
    if (!sourceDate && isDeadlinePicker) {
        const defaultDeadline = new Date();
        defaultDeadline.setMonth(defaultDeadline.getMonth() + 3);
        sourceDate = `${defaultDeadline.getFullYear()}-${String(defaultDeadline.getMonth() + 1).padStart(2, '0')}-${String(defaultDeadline.getDate()).padStart(2, '0')}`;
    }

    if (!sourceDate) {
        birthYear.value = '';
        birthMonth.value = '';
        birthDay.value = '';
        updateBirthDayOptions();
        syncBirthDateAnswer();
        return;
    }

    const [yearRaw, monthRaw, dayRaw] = sourceDate.split('-').map((item) => Number(item));
    const clamped = clampDateToRange(yearRaw || maxYear, monthRaw || 1, dayRaw || 1);
    birthYear.value = String(clamped.year);
    birthMonth.value = String(clamped.month);
    updateBirthDayOptions(clamped.day);
    birthDay.value = String(clamped.day);
    syncBirthDateAnswer();
};

const onBirthDatePartChange = (_part: 'day' | 'month' | 'year'): void => {
    updateBirthDayOptions(Number(birthDay.value));
    syncBirthDateAnswer();
};

const getHeightStartValue = (): number => {
    const parsedCurrent = parseNumberValue(currentAnswerValue.value);
    const parsedFallback = parseNumberValue(userData.height);
    const defaultHeight = Number.isFinite(parsedCurrent as number)
        ? Math.round(parsedCurrent as number)
        : Number.isFinite(parsedFallback as number)
            ? Math.round(parsedFallback as number)
            : 160;
    return clampNumber(defaultHeight, HEIGHT_RANGE.min, HEIGHT_RANGE.max);
};

const getWeightStartValue = (): number => {
    const parsedCurrent = parseNumberValue(currentAnswerValue.value);
    const parsedFallback = parseNumberValue(userData.currentWeight);
    const defaultWeight = Number.isFinite(parsedCurrent as number)
        ? (parsedCurrent as number)
        : Number.isFinite(parsedFallback as number)
            ? (parsedFallback as number)
            : 70;
    return clampNumber(defaultWeight, WEIGHT_RANGE.min, WEIGHT_RANGE.max);
};

const clearHeightRulerHandlers = (): void => {
    if (detachHeightRulerScroll) {
        detachHeightRulerScroll();
        detachHeightRulerScroll = null;
    }
    if (heightRafId !== null) {
        cancelAnimationFrame(heightRafId);
        heightRafId = null;
    }
};

const clearWeightRulerHandlers = (): void => {
    if (detachWeightRulerScroll) {
        detachWeightRulerScroll();
        detachWeightRulerScroll = null;
    }
    if (weightRafId !== null) {
        cancelAnimationFrame(weightRafId);
        weightRafId = null;
    }
};

const applyHeightValue = (virtualIndex: number): void => {
    const normalized = ((virtualIndex % heightRangeSteps.value) + heightRangeSteps.value) % heightRangeSteps.value;
    const value = HEIGHT_RANGE.max - normalized * HEIGHT_RANGE.step;
    heightVirtualIndex.value = virtualIndex;
    heightValueLabel.value = `${value}`;
    setUserDataField(currentAnswerKey.value, String(value), { source: 'form', markDirty: true });
    setUserDataField('height', String(value), { source: 'form', markDirty: true });
};

const applyWeightValue = (virtualIndex: number): void => {
    const normalized = ((virtualIndex % weightRangeSteps.value) + weightRangeSteps.value) % weightRangeSteps.value;
    const value = WEIGHT_RANGE.min + normalized * WEIGHT_RANGE.step;
    const formatted = formatWeightLabel(value);
    weightVirtualIndex.value = virtualIndex;
    weightValueLabel.value = formatted;
    setUserDataField(currentAnswerKey.value, formatted, { source: 'form', markDirty: true });
    if (currentAnswerKey.value === 'currentWeight') {
        setUserDataField('currentWeight', formatted, { source: 'form', markDirty: true });
    }
};

const initializeHeightRuler = async (): Promise<void> => {
    clearHeightRulerHandlers();
    await nextTick();
    const ruler = heightRulerRef.value;
    if (!ruler || currentQuestion.value?.id !== 3) {
        return;
    }

    const getCenterOffset = (): number => ruler.clientHeight / 2;
    const getVirtualIndexFromScroll = (): number => {
        const centerOffset = getCenterOffset();
        return Math.round((ruler.scrollTop + centerOffset - HEIGHT_RULER_PIXELS_PER_STEP / 2) / HEIGHT_RULER_PIXELS_PER_STEP);
    };
    const getScrollOffsetForIndex = (index: number): number => index * HEIGHT_RULER_PIXELS_PER_STEP + HEIGHT_RULER_PIXELS_PER_STEP / 2 - getCenterOffset();
    const normalizeVirtualScroll = (rawIndex: number): number => {
        const minSafe = heightRangeSteps.value;
        const maxSafe = heightRangeSteps.value * (HEIGHT_RULER_LOOP_COUNT - 1);
        if (rawIndex < minSafe || rawIndex > maxSafe) {
            const normalized = ((rawIndex % heightRangeSteps.value) + heightRangeSteps.value) % heightRangeSteps.value;
            return normalized + heightRangeSteps.value * Math.floor(HEIGHT_RULER_LOOP_COUNT / 2);
        }
        return rawIndex;
    };

    const startHeight = getHeightStartValue();
    const startIndex = Math.round((HEIGHT_RANGE.max - startHeight) / HEIGHT_RANGE.step) + heightRangeSteps.value * Math.floor(HEIGHT_RULER_LOOP_COUNT / 2);
    ruler.scrollTop = getScrollOffsetForIndex(startIndex);
    applyHeightValue(startIndex);

    const onScroll = (): void => {
        if (heightRafId !== null) {
            return;
        }
        heightRafId = requestAnimationFrame(() => {
            heightRafId = null;
            const rawIndex = getVirtualIndexFromScroll();
            const normalizedIndex = normalizeVirtualScroll(rawIndex);
            if (normalizedIndex !== rawIndex) {
                ruler.scrollTop = getScrollOffsetForIndex(normalizedIndex);
            }
            applyHeightValue(normalizedIndex);
        });
    };

    ruler.addEventListener('scroll', onScroll, { passive: true });
    detachHeightRulerScroll = () => {
        ruler.removeEventListener('scroll', onScroll);
    };
};

const initializeWeightRuler = async (): Promise<void> => {
    clearWeightRulerHandlers();
    await nextTick();
    const ruler = weightRulerRef.value;
    if (!ruler || (currentQuestion.value?.id !== 4 && currentQuestion.value?.id !== 5)) {
        return;
    }

    const getCenterOffset = (): number => ruler.clientWidth / 2;
    const getVirtualIndexFromScroll = (): number => {
        const centerOffset = getCenterOffset();
        return Math.round((ruler.scrollLeft + centerOffset - WEIGHT_RULER_PIXELS_PER_STEP / 2) / WEIGHT_RULER_PIXELS_PER_STEP);
    };
    const getScrollOffsetForIndex = (index: number): number => index * WEIGHT_RULER_PIXELS_PER_STEP + WEIGHT_RULER_PIXELS_PER_STEP / 2 - getCenterOffset();
    const normalizeVirtualScroll = (rawIndex: number): number => {
        const minSafe = weightRangeSteps.value;
        const maxSafe = weightRangeSteps.value * (WEIGHT_RULER_LOOP_COUNT - 1);
        if (rawIndex < minSafe || rawIndex > maxSafe) {
            const normalized = ((rawIndex % weightRangeSteps.value) + weightRangeSteps.value) % weightRangeSteps.value;
            return normalized + weightRangeSteps.value * Math.floor(WEIGHT_RULER_LOOP_COUNT / 2);
        }
        return rawIndex;
    };

    const startWeight = getWeightStartValue();
    const startIndex = Math.round((startWeight - WEIGHT_RANGE.min) / WEIGHT_RANGE.step) + weightRangeSteps.value * Math.floor(WEIGHT_RULER_LOOP_COUNT / 2);
    ruler.scrollLeft = getScrollOffsetForIndex(startIndex);
    applyWeightValue(startIndex);

    const onScroll = (): void => {
        if (weightRafId !== null) {
            return;
        }
        weightRafId = requestAnimationFrame(() => {
            weightRafId = null;
            const rawIndex = getVirtualIndexFromScroll();
            const normalizedIndex = normalizeVirtualScroll(rawIndex);
            if (normalizedIndex !== rawIndex) {
                ruler.scrollLeft = getScrollOffsetForIndex(normalizedIndex);
            }
            applyWeightValue(normalizedIndex);
        });
    };

    ruler.addEventListener('scroll', onScroll, { passive: true });
    detachWeightRulerScroll = () => {
        ruler.removeEventListener('scroll', onScroll);
    };
};

const isQuestionAnswered = (question: QuestionnaireQuestion | null): boolean => {
    if (!question) {
        return false;
    }
    if (question.optional) {
        return true;
    }
    const key = getDataKeyByQuestionId(question.id);
    const value = userData[key];
    return value !== null && value !== undefined && value !== '';
};

const isNextDisabled = computed<boolean>(() => isSubmitting.value || !isQuestionAnswered(currentQuestion.value));

const isSelectedOption = (value: string): boolean => {
    if (!currentQuestion.value) {
        return false;
    }
    return String(currentAnswerValue.value || '') === String(value);
};

const refreshFeatherIcons = async (): Promise<void> => {
    await nextTick();
    const feather = (window as any).feather;
    if (typeof feather?.replace === 'function') {
        feather.replace();
    }
};

const resetQuestionnaireScroll = (): void => {
    if (typeof window.scrollTo === 'function') {
        window.scrollTo(0, 0);
    }
    const scroller = document.querySelector('.app-content') as HTMLElement | null;
    if (scroller) {
        scroller.scrollTop = 0;
    }
};

const setCurrentAnswer = (value: string): void => {
    setUserDataField(currentAnswerKey.value, value || null, {
        source: 'form',
        markDirty: true
    });
};

const selectOption = async (value: string): Promise<void> => {
    const questionId = currentQuestion.value?.id || 0;
    const scroller = document.querySelector('.app-content') as HTMLElement | null;
    const previousScrollTop = scroller?.scrollTop ?? window.scrollY ?? 0;
    setUserDataField(currentAnswerKey.value, value, {
        source: 'form',
        markDirty: true
    });

    // Goal selection should not reset scroll position.
    if (questionId === 7) {
        await nextTick();
        if (scroller) {
            scroller.scrollTop = previousScrollTop;
        } else {
            window.scrollTo(0, previousScrollTop);
        }
    }

    await refreshFeatherIcons();
};

const loadAdminConfig = async (): Promise<void> => {
    try {
        const response = await storageStore.apiFetch('/api/admin/config');
        if (response.ok) {
            adminConfig.value = (await response.json()) as Record<string, unknown>;
            return;
        }
    } catch {
        // Ignore config loading errors.
    }
    adminConfig.value = {};
};

const loadServerStatus = async (): Promise<void> => {
    try {
        const response = await storageStore.apiFetch('/api/me/status');
        if (!response.ok) {
            return;
        }
        const status = await response.json();
        const serverUser = {
            authorized: status?.authorized === true,
            telegram_user_id: typeof status?.telegram_user_id === 'number' ? status.telegram_user_id : null,
            profile_completed: status?.profile_completed === true,
            first_name: typeof status?.first_name === 'string' ? status.first_name : null,
            last_name: typeof status?.last_name === 'string' ? status.last_name : null,
            username: typeof status?.username === 'string' ? status.username : null,
            photo_url: typeof status?.photo_url === 'string' ? status.photo_url : null
        };
        serverProfileCompleted.value = serverUser.profile_completed;
        appStateStore.setServerUser(serverUser);
        appStateStore.setProfileCompleted(serverUser.profile_completed);
    } catch {
        // Ignore status loading errors.
    }
};

const validateGoalWeightConsistencyForQuestionnaire = (): { ok: boolean; warning: string | null; error: string | null } => {
    const profile = mapUserDataToUserProfile(userData);
    const goal = profile.goal;
    if (goal === 'maintain') {
        setUserDataField('targetWeight', null, { source: 'server', ignoreDirty: true });
        setUserDataField('deadline', null, { source: 'server', ignoreDirty: true });
        return { ok: true, warning: null, error: null };
    }
    const current = Number(profile.weight_kg);
    const target = Number(profile.target_weight_kg);
    if (!goal || !Number.isFinite(current) || !Number.isFinite(target)) {
        return { ok: true, warning: null, error: null };
    }
    const consistency = storageStore.validateGoalWeightConsistency(goal as string, current, target);
    if (consistency?.blocking) {
        return { ok: false, warning: null, error: consistency.message || 'Проверьте цель и желаемый вес.' };
    }
    return { ok: true, warning: null, error: null };
};

const saveQuestionnaireProfile = async (): Promise<boolean> => {
    const consistency = validateGoalWeightConsistencyForQuestionnaire();
    if (!consistency.ok) {
        if (consistency.error) {
            notify(consistency.error, 'error');
        }
        return false;
    }

    const mappedProfile = mapUserDataToUserProfile(userData);
    const rawGender = userData.gender;
    if (!mappedProfile.sex && (rawGender === 'male' || rawGender === 'female')) {
        mappedProfile.sex = rawGender;
    }

    const criticalKeys = ['sex', 'birth_date', 'height_cm', 'weight_kg', 'activity_factor', 'goal'];
    if (mappedProfile.goal !== 'maintain') {
        criticalKeys.push('target_weight_kg');
    }
    const missingCritical = criticalKeys.filter((key) => {
        const value = (mappedProfile as Record<string, unknown>)[key];
        return value === null || value === undefined || value === '';
    });
    if (missingCritical.length > 0) {
        notify('Не удалось сохранить профиль: заполните обязательные поля и повторите.', 'error');
        return false;
    }

    mappedProfile.is_completed = true;
    const savedProfile = await storageStore.patchUserProfileWithBackend(mappedProfile);
    if (!savedProfile) {
        notify('Не удалось сохранить профиль. Проверьте подключение и повторите попытку.', 'error');
        return false;
    }

    resetUserDataDirtyMap();
    appStateStore.setProfileCompleted(true);
    const nextServerUser = { ...appStateStore.serverUser, profile_completed: true };
    appStateStore.setServerUser(nextServerUser);
    await router.push(resolvePostQuestionnaireRoute(savedProfile as Record<string, unknown>));
    return true;
};

const goToPrevQuestion = async (): Promise<void> => {
    if (isFirstStep.value || isSubmitting.value) {
        return;
    }
    currentQuestionIndex.value -= 1;
    resetQuestionnaireScroll();
    await refreshFeatherIcons();
};

const goToNextQuestion = async (): Promise<void> => {
    if (isNextDisabled.value) {
        return;
    }
    if (!isLastStep.value) {
        currentQuestionIndex.value += 1;
        resetQuestionnaireScroll();
        await refreshFeatherIcons();
        return;
    }
    isSubmitting.value = true;
    try {
        await saveQuestionnaireProfile();
    } finally {
        isSubmitting.value = false;
    }
};

watch(activeQuestions, (nextQuestions) => {
    if (currentQuestionIndex.value > nextQuestions.length - 1) {
        currentQuestionIndex.value = Math.max(0, nextQuestions.length - 1);
    }
});

watch(
    () => [currentQuestion.value?.id, currentQuestion.value?.type],
    () => {
        clearHeightRulerHandlers();
        clearWeightRulerHandlers();
        if (currentQuestion.value?.type === 'date') {
            initializeBirthPicker();
            return;
        }
        if (currentQuestion.value?.id === 3) {
            void initializeHeightRuler();
            return;
        }
        if (currentQuestion.value?.id === 4 || currentQuestion.value?.id === 5) {
            void initializeWeightRuler();
        }
    },
    { immediate: true }
);

watch(
    () => [currentQuestion.value?.id, isLastStep.value, progressPercent.value, currentAnswerValue.value],
    () => {
        void refreshFeatherIcons();
    }
);

onMounted(() => {
    void (async () => {
        document.body.dataset.preservePageTheme = 'true';
        await loadAdminConfig();
        await loadServerStatus();
        try {
            await storageStore.syncProfileWithBackend();
        } catch {
            // Keep local snapshot if sync fails.
        }

        const profile = storageStore.getUserProfile() as Record<string, unknown>;
        mergeUserDataWithoutLosingAnswers(userData, mapUserProfileToUserData(profile), { source: 'server' });

        if (!isEditMode.value && serverProfileCompleted.value && profile?.is_completed === true) {
            await router.replace(resolvePostQuestionnaireRoute(profile));
            return;
        }

        await refreshFeatherIcons();
    })();
});

onBeforeUnmount(() => {
    clearHeightRulerHandlers();
    clearWeightRulerHandlers();
    delete document.body.dataset.preservePageTheme;
});
</script>
<style>
#question-card {
    min-height: 0;
}

#next-btn:disabled,
#prev-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
    box-shadow: none;
}

.wheel-picker {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    padding: 12px;
    border-radius: 16px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
}

.wheel-column {
    position: relative;
}

.wheel-column::before,
.wheel-column::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    height: 24px;
    pointer-events: none;
    z-index: 4;
}

.wheel-column::before {
    top: 0;
    background: linear-gradient(180deg, rgba(248, 250, 252, 0.98), rgba(248, 250, 252, 0));
}

.wheel-column::after {
    bottom: 0;
    background: linear-gradient(0deg, rgba(248, 250, 252, 0.98), rgba(248, 250, 252, 0));
}

.wheel-select {
    width: 100%;
    height: 48px;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    background: #ffffff;
    font-size: 15px;
    font-weight: 600;
    color: #0f172a;
    overflow: hidden;
    text-align: center;
    appearance: none;
    -webkit-appearance: none;
    padding: 0 12px;
    background-clip: padding-box;
    transition: border-color 0.28s ease;
}

.wheel-select:focus {
    outline: none;
    border-color: #34d399;
}

.wheel-select option {
    padding: 6px 0;
}

.wheel-select option.wheel-placeholder {
    color: #94a3b8;
    font-weight: 600;
}

.picker-panel {
    margin-top: 12px;
}

.picker-panel.hidden {
    display: none;
}

.picker-panel--inline {
    margin-top: 0;
}

.number-picker {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    border-radius: 16px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
}

.number-picker__label {
    font-size: 12px;
    font-weight: 600;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.04em;
}

.ruler-value {
    font-size: 26px;
    font-weight: 700;
    color: #0f766e;
    margin-bottom: 16px;
    text-align: center;
    width: 100%;
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 6px;
}

.ruler {
    position: relative;
    overflow: auto;
    background: transparent;
    border: 0;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
}

.ruler::-webkit-scrollbar {
    display: none;
}

.ruler--vertical {
    height: 280px;
    overflow-x: hidden;
    scroll-snap-type: y mandatory;
    -webkit-mask-image: linear-gradient(to bottom, transparent 0%, #000 18%, #000 82%, transparent 100%);
    mask-image: linear-gradient(to bottom, transparent 0%, #000 18%, #000 82%, transparent 100%);
}

.ruler--horizontal {
    height: 176px;
    overflow-y: hidden;
    scroll-snap-type: x mandatory;
    -webkit-mask-image: linear-gradient(to right, transparent 0%, #000 16%, #000 84%, transparent 100%);
    mask-image: linear-gradient(to right, transparent 0%, #000 16%, #000 84%, transparent 100%);
}

.ruler__track {
    position: relative;
    background: transparent;
}

.ruler--vertical .ruler__track {
    width: max-content;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
}

.ruler--horizontal .ruler__track {
    height: 100%;
    display: flex;
    align-items: center;
}

.ruler__tick {
    color: #64748b;
    font-size: 12px;
    opacity: 0.72;
    transform: translateZ(0) scale(1);
    filter: none;
    scroll-snap-align: center;
    transition: color 0.12s ease-out, opacity 0.12s ease-out, transform 0.12s ease-out, filter 0.12s ease-out;
}

.ruler--vertical .ruler__tick {
    height: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.ruler--horizontal .ruler__tick {
    position: relative;
    width: 16px;
    height: 18px;
    display: inline-flex;
    align-items: flex-end;
    justify-content: center;
    vertical-align: bottom;
}

.ruler__tick::before {
    content: '';
    display: block;
    background: #cbd5e1;
}

.ruler--vertical .ruler__tick::before {
    width: 24px;
    height: 1px;
}

.ruler--horizontal .ruler__tick::before {
    width: 1px;
    height: 24px;
}

.ruler__tick--major {
    color: #475569;
    font-weight: 600;
    opacity: 0.9;
}

.ruler--vertical .ruler__tick--major::before {
    width: 44px;
    background: #94a3b8;
}

.ruler--horizontal .ruler__tick--major::before {
    height: 52px;
    background: #94a3b8;
}

.ruler__tick--active {
    color: #020617;
    font-weight: 700;
    opacity: 1;
    transform: translateZ(0) scale(1.1);
    filter: drop-shadow(0 2px 8px rgba(15, 23, 42, 0.24));
}

.ruler--vertical .ruler__tick--active::before {
    background: #0f172a;
    height: 2px;
}

.ruler--horizontal .ruler__tick--active::before {
    background: #0f172a;
    width: 2px;
}

.ruler__tick--active .ruler__tick-label {
    font-size: 16px;
    font-weight: 700;
    letter-spacing: 0.01em;
    text-shadow: 0 2px 8px rgba(15, 23, 42, 0.2);
}

.ruler__tick-label {
    transition: font-size 0.12s ease-out, transform 0.12s ease-out;
}

.ruler--vertical .ruler__tick-label {
    margin-left: 10px;
}

.ruler--horizontal .ruler__tick-label {
    position: absolute;
    left: 50%;
    transform: translate(-50%, 26px);
    white-space: nowrap;
}

.ruler__indicator {
    position: absolute;
    background: #ef4444;
    border-radius: 999px;
    pointer-events: none;
    z-index: 5;
}

.ruler--vertical .ruler__indicator {
    left: 0;
    right: 0;
    top: 50%;
    height: 2px;
    transform: translateY(-1px);
}

.ruler--horizontal .ruler__indicator {
    left: 50%;
    top: 0;
    bottom: 0;
    width: 2px;
    transform: translateX(-1px);
}

.ruler__fade {
    position: absolute;
    pointer-events: none;
    z-index: 3;
    opacity: 0.75;
}

.ruler--vertical .ruler__fade {
    left: 0;
    right: 0;
    height: 56px;
}

.ruler--vertical .ruler__fade--start {
    top: 0;
    background: linear-gradient(to bottom, #f0f9ff 0%, rgba(240, 249, 255, 0) 100%);
}

.ruler--vertical .ruler__fade--end {
    bottom: 0;
    background: linear-gradient(to top, #f0f9ff 0%, rgba(240, 249, 255, 0) 100%);
}

.ruler--horizontal .ruler__fade {
    top: 0;
    bottom: 0;
    width: 64px;
}

.ruler--horizontal .ruler__fade--start {
    left: 0;
    background: linear-gradient(to right, #f0f9ff 0%, rgba(240, 249, 255, 0) 100%);
}

.ruler--horizontal .ruler__fade--end {
    right: 0;
    background: linear-gradient(to left, #f0f9ff 0%, rgba(240, 249, 255, 0) 100%);
}
</style>


