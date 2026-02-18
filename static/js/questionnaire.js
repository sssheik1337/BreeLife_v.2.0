// Логика анкеты для Health Bloom App

function buildActivityOptions() {
    const adminConfig = window.adminConfig || {};
    const coefficients = adminConfig.activity_coefficients;
    if (!Array.isArray(coefficients) || coefficients.length === 0) {
        return [
            {
                value: "1.2",
                label: "Тренировок мало либо они отсутствуют",
                emoji: "🛋️",
                tooltip: "Низкая активность",
            },
            {
                value: "1.375",
                label: "Немного движения: прогулки или 1–3 тренировки",
                emoji: "🚶",
                tooltip: "Низкая активность",
            },
            {
                value: "1.55",
                label: "Регулярные тренировки 3–5 раз в неделю",
                emoji: "🏃",
                tooltip: "Умеренная активность",
            },
            {
                value: "1.725",
                label: "Высокая активность почти каждый день",
                emoji: "🏋️",
                tooltip: "Высокая активность",
            },
            {
                value: "1.9",
                label: "Физическая активность + очень интенсивные тренировки",
                emoji: "🔥",
                tooltip: "Высокая активность",
            }
        ];
    }
    return coefficients.map((item) => ({
        value: String(item.value),
        label: item.label,
        emoji: item.emoji || "✨",
        tooltip: item.label || "Уровень активности",
    }));
}

const HEIGHT_RANGE = {
    min: 120,
    max: 220,
    step: 1
};

const WEIGHT_RANGE = {
    min: 30,
    max: 200,
    step: 0.5
};

const TARGET_WEIGHT_RANGE = {
    min: 40,
    max: 200,
    step: 0.5
};

// Описание вопросов
const questions = [
    {
        id: 1,
        title: "Какой ваш пол?",
        type: "select",
        icon: "user",
        options: [
            { value: "male", label: "Мужской", emoji: "👨" },
            { value: "female", label: "Женский", emoji: "👩" }
        ]
},
    {
        id: 2,
        title: "Дата рождения",
        type: "date",
        icon: "calendar",
        placeholder: "Выберите дату рождения",
        min: "1900-01-01",
        max: new Date().toISOString().split('T')[0]
    },
    {
        id: 3,
        title: "Какой у вас рост?",
        type: "number",
        icon: "maximize-2",
        placeholder: "Введите рост в сантиметрах",
        unit: "cm",
        min: HEIGHT_RANGE.min,
        max: HEIGHT_RANGE.max,
        step: HEIGHT_RANGE.step
    },
    {
        id: 4,
        title: "Какой у вас текущий вес?",
        type: "number",
        icon: "scale",
        placeholder: "Введите вес в килограммах",
        unit: "kg",
        min: WEIGHT_RANGE.min,
        max: WEIGHT_RANGE.max,
        step: WEIGHT_RANGE.step
    },
    {
        id: 5,
        title: "Желаемый вес",
        type: "number",
        icon: "target",
        placeholder: "Введите желаемый вес в килограммах",
        unit: "kg",
        min: TARGET_WEIGHT_RANGE.min,
        max: TARGET_WEIGHT_RANGE.max,
        step: TARGET_WEIGHT_RANGE.step
    },
    {
        id: 6,
        title: "Какой у вас уровень физической активности?",
        type: "select",
        icon: "activity",
        options: buildActivityOptions()
    },
    {
        id: 7,
        title: "Какова ваша цель?",
        type: "select",
        icon: "flag",
        options: [
            { value: "lose", label: "Снижение веса", emoji: "📉" },
            { value: "gain", label: "Набор веса", emoji: "📈" },
            { value: "maintain", label: "Поддержание формы", emoji: "⚖️" }
        ]
    },
    {
        id: 8,
        title: "Когда вы хотите достичь цели?",
        type: "date",
        icon: "calendar",
        placeholder: "Выберите дату дедлайна",
        min: new Date().toISOString().split('T')[0],
        max: "2100-12-31",
        optional: true
    }
];

let currentQuestionIndex = 0;
let isEditMode = false;

// Проверка: есть ли уже заполненные данные профиля.
function hasProfileData(profile) {
    if (!profile || typeof profile !== 'object') {
        return false;
    }
    const fields = [
        profile.sex,
        profile.birth_date,
        profile.height_cm,
        profile.weight_kg,
        profile.target_weight_kg,
        profile.goal,
        profile.activity_factor
    ];
    return fields.some((value) => value !== null && value !== undefined && value !== '');
}



// Определяем целевой экран после анкеты с учётом шага предпочтений.
function resolvePostQuestionnaireRoute(profile) {
    if (profile?.preferences_onboarding_completed === true) {
        return '/trial-start';
    }
    return '/preferences-onboarding';
}

// DOM Elements
let questionTitle;
let optionsContainer;
let inputContainer;
let nextButton;
let prevButton;
let progressBar;
let currentStep;
let progressPercent;
let totalStepsElement;

function getGoalValueFromUserData() {
    return window.userData?.goalType ?? window.userData?.goal ?? null;
}

function getActiveQuestions() {
    const byId = new Map(questions.map((question) => [question.id, question]));
    const goalValue = getGoalValueFromUserData();
    const orderedIds = [1, 2, 3, 4, 7];

    if (goalValue === 'lose' || goalValue === 'gain') {
        orderedIds.push(5, 8);
    }

    orderedIds.push(6);
    return orderedIds
        .map((id) => byId.get(id))
        .filter(Boolean);
}

function getQuestionByIndex(index) {
    const activeQuestions = getActiveQuestions();
    return activeQuestions[index] || null;
}

// Initialize questionnaire
async function initQuestionnaire() {
    const urlParams = new URLSearchParams(window.location.search);
    isEditMode = urlParams.get('edit') === '1';

    if (!isEditMode && typeof getUserProfile === 'function') {
        if (typeof window.syncProfileWithBackend === 'function') {
            try {
                // Сначала подтягиваем профиль с сервера, чтобы не опираться на устаревший локальный кеш.
                await window.syncProfileWithBackend();
            } catch (error) {
                // При ошибке синхронизации оставляем текущий сценарий без аварийного редиректа.
            }
        }

        const profile = getUserProfile();
        if (profile?.is_completed === true) {
            window.location.replace(resolvePostQuestionnaireRoute(profile));
            return;
        }
    }

    // Get DOM elements
    questionTitle = document.getElementById('question-title');
    optionsContainer = document.getElementById('options-container');
    inputContainer = document.getElementById('input-container');
    nextButton = document.getElementById('next-btn');
    prevButton = document.getElementById('prev-btn');
    progressBar = document.getElementById('progress-bar');
    currentStep = document.getElementById('current-step');
    progressPercent = document.getElementById('progress-percent');
    totalStepsElement = document.getElementById('total-steps');
    
    // Загружаем сохранённые ответы перед отображением первого шага.
    await loadSavedAnswers();

    // Display first question
    displayQuestion();

    // Setup event listeners
    setupEventListeners();
}

// Загружаем сохранённые ответы из профиля
async function loadSavedAnswers() {
    if (typeof window.syncProfileWithBackend === 'function') {
        // Сначала синхронизируем профиль с сервером, чтобы анкета заполнялась актуальными данными.
        try {
            await window.syncProfileWithBackend();
        } catch (error) {
            // Ошибки синхронизации игнорируем, продолжим с локальными данными.
        }
    }

    if (typeof getUserProfile === 'function' && typeof mapUserProfileToUserData === 'function') {
        const profile = getUserProfile();
        const mapped = mapUserProfileToUserData(profile);
        if (typeof mergeUserDataWithoutLosingAnswers === 'function') {
            mergeUserDataWithoutLosingAnswers(window.userData, mapped, { source: 'server' });
        }
        return;
    }

    return null;
}
// Display current question
function displayQuestion() {
    const activeQuestions = getActiveQuestions();
    if (!activeQuestions.length) {
        return;
    }
    if (currentQuestionIndex > activeQuestions.length - 1) {
        currentQuestionIndex = activeQuestions.length - 1;
    }

    const question = activeQuestions[currentQuestionIndex];
    
    // Update UI elements
    questionTitle.textContent = question.title;
    currentStep.textContent = String(currentQuestionIndex + 1);
    if (totalStepsElement) {
        totalStepsElement.textContent = String(activeQuestions.length);
    }
    
    // Update progress
    const progress = ((currentQuestionIndex + 1) / activeQuestions.length) * 100;
    progressBar.style.width = `${progress}%`;
    progressPercent.textContent = `${Math.round(progress)}%`;
    
    // Set icon (assuming feather.js is loaded)
    const iconContainer = questionTitle.previousElementSibling;
    if (iconContainer) {
        const iconElement = iconContainer.querySelector('i');
        if (iconElement && question.icon) {
            iconElement.setAttribute('data-feather', question.icon);
            if (window.feather) {
                feather.replace();
            }
        }
    }
    
    // Clear containers
    optionsContainer.innerHTML = '';
    inputContainer.innerHTML = '';
    inputContainer.style.display = 'none';
    optionsContainer.style.display = 'none';
    
    // Display based on question type
    if (question.type === 'select') {
        optionsContainer.style.display = 'block';
        displayOptions(question.options);
    } else if (question.type === 'date' || question.type === 'number') {
        inputContainer.style.display = 'block';
        displayInput(question);
    }
    
    // Update button states
    updateButtonStates();
    
    // Animate card
    const card = document.getElementById('question-card');
    card.style.opacity = '0';
    card.style.transform = 'translateY(10px)';
    
    setTimeout(() => {
        card.style.transition = 'all 0.3s ease-out';
        card.style.opacity = '1';
        card.style.transform = 'translateY(0)';
    }, 50);
}
// Display options for select questions
function displayOptions(options) {
    options.forEach(option => {
        const optionElement = document.createElement('div');
        optionElement.className = 'option-card';
        optionElement.dataset.value = option.value;
        if (option.tooltip) {
            optionElement.title = option.tooltip;
        }
        
        optionElement.innerHTML = `
            <div class="flex items-center space-x-3">
                <span class="text-2xl">${option.emoji}</span>
                <span class="font-medium text-slate-800">${option.label}</span>
            </div>
            <div class="checkmark hidden">
                <i data-feather="check" class="w-5 h-5 text-emerald-600"></i>
            </div>
        `;
        
        // Check if this option is already selected
        const currentValue = window.userData[getDataKey(currentQuestionIndex)];
        if (currentValue === option.value) {
            optionElement.classList.add('selected');
            optionElement.querySelector('.checkmark').style.display = 'block';
        }
        
        optionElement.addEventListener('click', () => selectOption(optionElement, option.value));
        optionsContainer.appendChild(optionElement);
    });
    
    if (window.feather) {
        feather.replace();
    }
}



function renderHeightRuler(currentValue) {
    const minHeight = 120;
    const maxHeight = 220;
    const stepCm = 1;
    const pixelsPerStep = 12;
    const loopCount = 7;
    const rangeSteps = Math.round((maxHeight - minHeight) / stepCm) + 1;
    const totalVirtualSteps = rangeSteps * loopCount;
    const dataKey = getDataKey(currentQuestionIndex);
    const parsedCurrent = parseNumberValue(currentValue);
    const defaultHeight = Number.isFinite(parsedCurrent)
        ? Math.round(parsedCurrent)
        : Number.isFinite(parseNumberValue(window.userData.height))
            ? Math.round(parseNumberValue(window.userData.height))
            : 160;
    const startHeight = Math.min(maxHeight, Math.max(minHeight, defaultHeight));

    inputContainer.innerHTML = `
        <div class="picker-panel picker-panel--inline" data-role="picker-panel">
            <div class="ruler-value">
                <span id="height-ruler-value" class="ruler-value__number">${startHeight}</span>
                <span class="ruler-value__unit">см</span>
            </div>
            <div class="ruler ruler--vertical" id="height-ruler" aria-label="Выбор роста">
                <div class="ruler__fade ruler__fade--start" aria-hidden="true"></div>
                <div class="ruler__fade ruler__fade--end" aria-hidden="true"></div>
                <div class="ruler__indicator" aria-hidden="true"></div>
                <div class="ruler__track" id="height-ruler-track"></div>
            </div>
        </div>
    `;

    const ruler = document.getElementById('height-ruler');
    const track = document.getElementById('height-ruler-track');
    const valueElement = document.getElementById('height-ruler-value');
    if (!ruler || !track || !valueElement) {
        return;
    }

    track.style.height = `${totalVirtualSteps * pixelsPerStep}px`;

    for (let virtualIndex = 0; virtualIndex < totalVirtualSteps; virtualIndex += 1) {
        const value = maxHeight - (virtualIndex % rangeSteps) * stepCm;
        const tick = document.createElement('div');
        const isMajor = value % 5 === 0;
        tick.className = isMajor ? 'ruler__tick ruler__tick--major' : 'ruler__tick';
        tick.dataset.virtualIndex = String(virtualIndex);
        tick.style.height = `${pixelsPerStep}px`;
        if (isMajor) {
            const label = document.createElement('span');
            label.className = 'ruler__tick-label';
            label.textContent = `${value}`;
            tick.appendChild(label);
        }
        track.appendChild(tick);
    }

    const ticks = Array.from(track.querySelectorAll('.ruler__tick'));

    const getCenterOffset = () => ruler.clientHeight / 2;

    const getVirtualIndexFromScroll = () => {
        const centerOffset = getCenterOffset();
        return Math.round((ruler.scrollTop + centerOffset - pixelsPerStep / 2) / pixelsPerStep);
    };

    const getScrollOffsetForIndex = (index) => index * pixelsPerStep + pixelsPerStep / 2 - getCenterOffset();

    const normalizeVirtualScroll = (rawIndex) => {
        const minSafe = rangeSteps;
        const maxSafe = rangeSteps * (loopCount - 1);
        if (rawIndex < minSafe || rawIndex > maxSafe) {
            const normalized = ((rawIndex % rangeSteps) + rangeSteps) % rangeSteps;
            return normalized + rangeSteps * Math.floor(loopCount / 2);
        }
        return rawIndex;
    };

    const updateHeightMagnifier = (virtualIndex) => {
        const centerOffset = getCenterOffset();
        const centerPosition = ruler.scrollTop + centerOffset;
        const visibleRadius = Math.ceil(centerOffset / pixelsPerStep) + 10;
        const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
        const rangeStart = clamp(virtualIndex - visibleRadius, 0, totalVirtualSteps - 1);
        const rangeEnd = clamp(virtualIndex + visibleRadius, 0, totalVirtualSteps - 1);

        for (let i = rangeStart; i <= rangeEnd; i += 1) {
            const tick = ticks[i];
            if (!tick) {
                continue;
            }
            const tickCenter = i * pixelsPerStep + pixelsPerStep / 2;
            const distance = Math.abs(tickCenter - centerPosition);
            const scale = clamp(1.4 - distance * 0.02, 1, 1.4);
            const opacity = clamp(1 - distance * 0.015, 0.3, 1);
            tick.style.transform = `translateZ(0) scale(${scale.toFixed(3)})`;
            tick.style.opacity = opacity.toFixed(3);
        }
    };

    const applyHeightValue = (virtualIndex) => {
        const normalized = ((virtualIndex % rangeSteps) + rangeSteps) % rangeSteps;
        const value = maxHeight - normalized * stepCm;
        valueElement.textContent = `${value}`;
        ticks.forEach((tick) => {
            tick.classList.toggle('ruler__tick--active', Number(tick.dataset.virtualIndex) === virtualIndex);
        });
        setUserDataField(dataKey, value, { source: 'form', markDirty: true });
        setUserDataField('height', value, { source: 'form', markDirty: true });
        saveUserData();
        updateButtonStates();
        updateHeightMagnifier(virtualIndex);
    };

    let rafId = null;
    const onScroll = () => {
        if (rafId !== null) {
            return;
        }
        rafId = requestAnimationFrame(() => {
            rafId = null;
            const rawIndex = getVirtualIndexFromScroll();
            const normalizedIndex = normalizeVirtualScroll(rawIndex);
            if (normalizedIndex !== rawIndex) {
                ruler.scrollTop = getScrollOffsetForIndex(normalizedIndex);
            }
            applyHeightValue(normalizedIndex);
        });
    };

    requestAnimationFrame(() => {
        const startIndex = Math.round((maxHeight - startHeight) / stepCm) + rangeSteps * Math.floor(loopCount / 2);
        ruler.scrollTop = getScrollOffsetForIndex(startIndex);
        applyHeightValue(startIndex);
        ruler.addEventListener('scroll', onScroll, { passive: true });
    });
}

function renderWeightRuler(currentValue) {
    const minWeight = 30;
    const maxWeight = 200;
    const stepKg = 0.5;
    const pixelsPerStep = 24;
    const loopCount = 7;
    const rangeSteps = Math.round((maxWeight - minWeight) / stepKg) + 1;
    const totalVirtualSteps = rangeSteps * loopCount;
    const dataKey = getDataKey(currentQuestionIndex);
    const parsedCurrent = parseNumberValue(currentValue);
    const defaultWeight = Number.isFinite(parsedCurrent)
        ? parsedCurrent
        : Number.isFinite(parseNumberValue(window.userData.currentWeight))
            ? parseNumberValue(window.userData.currentWeight)
            : 70;
    const startWeight = Math.min(maxWeight, Math.max(minWeight, defaultWeight));

    inputContainer.innerHTML = `
        <div class="picker-panel picker-panel--inline" data-role="picker-panel">
            <div class="ruler-value">
                <span id="weight-ruler-value" class="ruler-value__number">${startWeight.toFixed(1).replace('.0', '')}</span>
                <span class="ruler-value__unit">кг</span>
            </div>
            <div class="ruler ruler--horizontal" id="weight-ruler" aria-label="Выбор текущего веса">
                <div class="ruler__fade ruler__fade--start" aria-hidden="true"></div>
                <div class="ruler__fade ruler__fade--end" aria-hidden="true"></div>
                <div class="ruler__indicator" aria-hidden="true"></div>
                <div class="ruler__track" id="weight-ruler-track"></div>
            </div>
        </div>
    `;

    const ruler = document.getElementById('weight-ruler');
    const track = document.getElementById('weight-ruler-track');
    const valueElement = document.getElementById('weight-ruler-value');
    if (!ruler || !track || !valueElement) {
        return;
    }

    track.style.width = `${totalVirtualSteps * pixelsPerStep}px`;

    for (let virtualIndex = 0; virtualIndex < totalVirtualSteps; virtualIndex += 1) {
        const value = minWeight + (virtualIndex % rangeSteps) * stepKg;
        const tick = document.createElement('div');
        const isMajor = Math.round(value * 10) % 50 === 0;
        tick.className = isMajor ? 'ruler__tick ruler__tick--major' : 'ruler__tick';
        tick.dataset.virtualIndex = String(virtualIndex);
        tick.style.width = `${pixelsPerStep}px`;
        if (isMajor) {
            const label = document.createElement('span');
            label.className = 'ruler__tick-label';
            label.textContent = `${Math.round(value)}`;
            tick.appendChild(label);
        }
        track.appendChild(tick);
    }

    const ticks = Array.from(track.querySelectorAll('.ruler__tick'));

    const getCenterOffset = () => ruler.clientWidth / 2;

    const getVirtualIndexFromScroll = () => {
        const centerOffset = getCenterOffset();
        return Math.round((ruler.scrollLeft + centerOffset - pixelsPerStep / 2) / pixelsPerStep);
    };

    const getScrollOffsetForIndex = (index) => index * pixelsPerStep + pixelsPerStep / 2 - getCenterOffset();

    const normalizeVirtualScroll = (rawIndex) => {
        const minSafe = rangeSteps;
        const maxSafe = rangeSteps * (loopCount - 1);
        if (rawIndex < minSafe || rawIndex > maxSafe) {
            const normalized = ((rawIndex % rangeSteps) + rangeSteps) % rangeSteps;
            return normalized + rangeSteps * Math.floor(loopCount / 2);
        }
        return rawIndex;
    };

    const updateWeightMagnifier = (virtualIndex) => {
        const centerOffset = getCenterOffset();
        const centerPosition = ruler.scrollLeft + centerOffset;
        const visibleRadius = Math.ceil(centerOffset / pixelsPerStep) + 10;
        const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
        const rangeStart = clamp(virtualIndex - visibleRadius, 0, totalVirtualSteps - 1);
        const rangeEnd = clamp(virtualIndex + visibleRadius, 0, totalVirtualSteps - 1);

        for (let i = rangeStart; i <= rangeEnd; i += 1) {
            const tick = ticks[i];
            if (!tick) {
                continue;
            }
            const tickCenter = i * pixelsPerStep + pixelsPerStep / 2;
            const distance = Math.abs(tickCenter - centerPosition);
            const scale = clamp(1.4 - distance * 0.02, 1, 1.4);
            const opacity = clamp(1 - distance * 0.015, 0.3, 1);
            tick.style.transform = `translateZ(0) scale(${scale.toFixed(3)})`;
            tick.style.opacity = opacity.toFixed(3);
        }
    };

    const applyWeightValue = (virtualIndex) => {
        const normalized = ((virtualIndex % rangeSteps) + rangeSteps) % rangeSteps;
        const value = minWeight + normalized * stepKg;
        valueElement.textContent = value.toFixed(1).replace('.0', '');
        ticks.forEach((tick) => {
            tick.classList.toggle('ruler__tick--active', Number(tick.dataset.virtualIndex) === virtualIndex);
        });
        setUserDataField(dataKey, value, { source: 'form', markDirty: true });
        // Не затираем текущий вес на шаге "Желаемый вес".
        // Синхронизируем currentWeight только когда пользователь редактирует именно текущий вес.
        if (dataKey === 'currentWeight') {
            setUserDataField('currentWeight', value, { source: 'form', markDirty: true });
        }
        saveUserData();
        updateButtonStates();
        updateWeightMagnifier(virtualIndex);
    };

    let rafId = null;
    const onScroll = () => {
        if (rafId !== null) {
            return;
        }
        rafId = requestAnimationFrame(() => {
            rafId = null;
            const rawIndex = getVirtualIndexFromScroll();
            const normalizedIndex = normalizeVirtualScroll(rawIndex);
            if (normalizedIndex !== rawIndex) {
                ruler.scrollLeft = getScrollOffsetForIndex(normalizedIndex);
            }
            applyWeightValue(normalizedIndex);
        });
    };

    requestAnimationFrame(() => {
        const startIndex = Math.round((startWeight - minWeight) / stepKg) + rangeSteps * Math.floor(loopCount / 2);
        ruler.scrollLeft = getScrollOffsetForIndex(startIndex);
        applyWeightValue(startIndex);
        ruler.addEventListener('scroll', onScroll, { passive: true });
    });
}


// Display input field for date/number questions
function displayInput(question) {
    let currentValue = window.userData[getDataKey(currentQuestionIndex)];

    const unitLabels = {
        cm: 'см',
        kg: 'кг'
    };

    const formatDateDisplay = (value) => {
        if (!value) {
            return null;
        }
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return null;
        }
        return date.toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    };

    const renderPickerWrapper = (content) => `
        <div class="picker-panel picker-panel--inline" data-role="picker-panel">
            ${content}
        </div>
    `;

    if (question.type === 'date') {
        const today = new Date();
        const isDeadlinePicker = question.id === 8;
        const deadlineMinDate = new Date(today);
        const deadlineMaxDate = new Date(today);
        deadlineMaxDate.setFullYear(deadlineMaxDate.getFullYear() + 2);
        const minYear = isDeadlinePicker ? deadlineMinDate.getFullYear() : 1900;
        const maxYear = isDeadlinePicker ? deadlineMaxDate.getFullYear() : today.getFullYear();
        const months = [
            'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
            'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
        ];
        inputContainer.innerHTML = renderPickerWrapper(`
            <div class="wheel-picker" data-role="birth-picker">
                <div class="wheel-column">
                    <select id="birth-day" class="wheel-select" aria-label="День рождения"></select>
                </div>
                <div class="wheel-column">
                    <select id="birth-month" class="wheel-select" aria-label="Месяц рождения">
                        ${months.map((label, index) => `<option value="${index + 1}">${label}</option>`).join('')}
                    </select>
                </div>
                <div class="wheel-column">
                    <select id="birth-year" class="wheel-select" aria-label="Год рождения"></select>
                </div>
            </div>
        `);
        const daySelect = document.getElementById('birth-day');
        const monthSelect = document.getElementById('birth-month');
        const yearSelect = document.getElementById('birth-year');
        if (daySelect && monthSelect && yearSelect) {
            const years = [];
            for (let year = maxYear; year >= minYear; year -= 1) {
                years.push(`<option value="${year}">${year}</option>`);
            }
            yearSelect.innerHTML = `<option value="" class="wheel-placeholder">Год</option>${years.join('')}`;
            monthSelect.innerHTML = `<option value="" class="wheel-placeholder">Месяц</option>${months.map((label, index) => `<option value="${index + 1}">${label}</option>`).join('')}`;

            const formatDateValue = (value) => {
                if (!value) {
                    return '';
                }
                const date = new Date(value);
                if (Number.isNaN(date.getTime())) {
                    return '';
                }
                const yearValue = date.getFullYear();
                const monthValue = String(date.getMonth() + 1).padStart(2, '0');
                const dayValue = String(date.getDate()).padStart(2, '0');
                return `${yearValue}-${monthValue}-${dayValue}`;
            };

            const clampDeadlineDate = (year, month, day) => {
                if (!isDeadlinePicker) {
                    return { year, month, day };
                }
                const target = new Date(year, month - 1, day);
                if (target < deadlineMinDate) {
                    return {
                        year: deadlineMinDate.getFullYear(),
                        month: deadlineMinDate.getMonth() + 1,
                        day: deadlineMinDate.getDate()
                    };
                }
                if (target > deadlineMaxDate) {
                    return {
                        year: deadlineMaxDate.getFullYear(),
                        month: deadlineMaxDate.getMonth() + 1,
                        day: deadlineMaxDate.getDate()
                    };
                }
                return { year, month, day };
            };

            const setDayOptions = (year, month, preferredDay = '') => {
                const safeYear = Number(year) || maxYear;
                const safeMonth = Number(month) || 1;
                const daysInMonth = new Date(safeYear, safeMonth, 0).getDate();
                const numericPreferred = Number(preferredDay);
                const nextDay = Number.isFinite(numericPreferred) && numericPreferred > 0
                    ? Math.min(numericPreferred, daysInMonth)
                    : null;
                let startDay = 1;
                let endDay = daysInMonth;
                if (isDeadlinePicker) {
                    const isMinMonth = safeYear === deadlineMinDate.getFullYear()
                        && safeMonth === deadlineMinDate.getMonth() + 1;
                    const isMaxMonth = safeYear === deadlineMaxDate.getFullYear()
                        && safeMonth === deadlineMaxDate.getMonth() + 1;
                    if (isMinMonth) {
                        startDay = deadlineMinDate.getDate();
                    }
                    if (isMaxMonth) {
                        endDay = deadlineMaxDate.getDate();
                    }
                }
                daySelect.innerHTML = `<option value="" class="wheel-placeholder">День</option>${Array.from({ length: daysInMonth }, (_, index) => {
                    const day = index + 1;
                    if (day < startDay || day > endDay) {
                        return '';
                    }
                    return `<option value="${day}">${day}</option>`;
                }).join('')}`;
                if (nextDay) {
                    daySelect.value = String(nextDay);
                }
            };

            const applyBirthDate = () => {
                const year = Number(yearSelect.value);
                const month = Number(monthSelect.value);
                const day = Number(daySelect.value);
                const hasAllFields = Boolean(year && month && day);
                if (hasAllFields) {
                    const formatted = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    setUserDataField(getDataKey(currentQuestionIndex), formatted, { source: 'form', markDirty: true });
                } else {
                    setUserDataField(getDataKey(currentQuestionIndex), '', { source: 'form', markDirty: true });
                }
                saveUserData();
                updateButtonStates();
                console.log('[QUESTIONNAIRE_TRACE] шаг обновлён (birthDate):', window.userData);
                return;
            };

            const syncFromStored = () => {
                if (!currentValue) {
                    if (isDeadlinePicker) {
                        const defaultDeadline = new Date(today);
                        defaultDeadline.setMonth(defaultDeadline.getMonth() + 3);
                        const defaultValue = formatDateValue(defaultDeadline);
                        currentValue = defaultValue;
                        setUserDataField(getDataKey(currentQuestionIndex), defaultValue, { source: 'form', markDirty: true });
                        saveUserData();
                    }
                    if (!currentValue) {
                        setDayOptions(null, null);
                        daySelect.value = '';
                        monthSelect.value = '';
                        yearSelect.value = '';
                        return;
                    }
                }
                const [yearStr, monthStr, dayStr] = currentValue.split('-');
                const year = Number(yearStr);
                const month = Number(monthStr);
                const day = Number(dayStr);
                const clamped = clampDeadlineDate(year || maxYear, month || 1, day || 1);
                if (clamped.year) {
                    yearSelect.value = String(clamped.year);
                }
                if (clamped.month) {
                    monthSelect.value = String(clamped.month);
                }
                setDayOptions(clamped.year || maxYear, clamped.month || 1, String(clamped.day));
                if (clamped.day) {
                    daySelect.value = String(clamped.day);
                }
                if (isDeadlinePicker) {
                    const formatted = `${clamped.year}-${String(clamped.month).padStart(2, '0')}-${String(clamped.day).padStart(2, '0')}`;
                    setUserDataField(getDataKey(currentQuestionIndex), formatted, { source: 'form', markDirty: true });
                    saveUserData();
                }
            };

            syncFromStored();
            applyBirthDate();
            monthSelect.addEventListener('change', () => {
                setDayOptions(yearSelect.value, monthSelect.value, daySelect.value);
                applyBirthDate();
            });
            yearSelect.addEventListener('change', () => {
                setDayOptions(yearSelect.value, monthSelect.value, daySelect.value);
                applyBirthDate();
            });
            daySelect.addEventListener('change', applyBirthDate);
        }
    } else if (question.type === 'number') {
        if (question.id === 3) {
            renderHeightRuler(currentValue, HEIGHT_RANGE);
            return;
        }
        if (question.id === 4 || question.id === 5) {
            const range = question.id === 4 ? WEIGHT_RANGE : TARGET_WEIGHT_RANGE;
            renderWeightRuler(currentValue, range);
            return;
        }
        const resolved = resolveNumberPickerState(question, currentValue);
        currentValue = resolved.value;
        if (resolved.shouldPersist) {
            setUserDataField(getDataKey(currentQuestionIndex), currentValue, { source: 'form', markDirty: true });
            saveUserData();
        }
        const options = buildNumberOptions(question, currentValue, resolved.range);
        const labelText = question.unit ? `${question.unit}` : 'значение';
        inputContainer.innerHTML = renderPickerWrapper(`
            <div class="number-picker">
                <span class="number-picker__label">${labelText}</span>
                <select id="question-input" class="form-input">
                    <option value="">${question.placeholder}</option>
                    ${options}
                </select>
            </div>
        `);
        const input = document.getElementById('question-input');
        if (input) {
            input.value = currentValue || '';
            input.addEventListener('input', () => {
                const value = input.value;
                setUserDataField(getDataKey(currentQuestionIndex), value, { source: 'form', markDirty: true });
                saveUserData();
                updateButtonStates();
                console.log('[QUESTIONNAIRE_TRACE] шаг обновлён (number input):', window.userData);
            });
            input.addEventListener('change', () => {
                const value = input.value;
                setUserDataField(getDataKey(currentQuestionIndex), value, { source: 'form', markDirty: true });
                saveUserData();
                updateButtonStates();
                console.log('[QUESTIONNAIRE_TRACE] шаг обновлён (number change):', window.userData);
            });
        }
    }
    
    // Update button state immediately if there's already a value
    if (currentValue) {
        updateButtonStates();
    }
}

// Select an option
function selectOption(optionElement, value) {
    // Remove selection from all options
    document.querySelectorAll('.option-card').forEach(card => {
        card.classList.remove('selected');
        card.querySelector('.checkmark').style.display = 'none';
    });
    
    // Mark this option as selected
    optionElement.classList.add('selected');
    optionElement.querySelector('.checkmark').style.display = 'block';
    
    // Update user data
    setUserDataField(getDataKey(currentQuestionIndex), value, { source: 'form', markDirty: true });
    saveUserData();
    const currentQuestion = getQuestionByIndex(currentQuestionIndex);
    if (currentQuestion?.id === 7) {
        // Для шага выбора цели динамически перестраиваем ветку вопросов.
        displayQuestion();
    } else {
        updateButtonStates();
    }
    console.log('[QUESTIONNAIRE_TRACE] шаг обновлён (select option):', window.userData);
    
    // Update feather icons
    if (window.feather) {
        feather.replace();
    }
}

// Get data key for current question
function getDataKey(index) {
    const question = getQuestionByIndex(index);
    if (!question) {
        return `question_${index}`;
    }
    switch (question.id) {
        case 1: return 'gender';
        case 2: return 'birthDate';
        case 3: return 'height';
        case 4: return 'currentWeight';
        case 5: return 'targetWeight';
        case 6: return 'activityLevel';
        case 7: return 'goalType';
        case 8: return 'deadline';
        default: return `question_${question.id}`;
    }
}

function formatNumberValue(value, step) {
    if (!Number.isFinite(value)) {
        return '';
    }
    return Number.isInteger(step) ? Math.round(value).toString() : value.toFixed(1);
}

function parseNumberValue(value) {
    if (value === null || value === undefined || value === '') {
        return null;
    }
    const normalized = String(value).replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
}

function getNumberRangeForQuestion(question) {
    if (question.id === 3) {
        return HEIGHT_RANGE;
    }
    if (question.id === 4) {
        return WEIGHT_RANGE;
    }
    if (question.id === 5) {
        return TARGET_WEIGHT_RANGE;
    }
    return {
        min: Number(question.min) || 0,
        max: Number(question.max) || 0,
        step: Number(question.step) || 1
    };
}

function resolveNumberPickerState(question, currentValue) {
    const range = getNumberRangeForQuestion(question);
    const parsedValue = parseNumberValue(currentValue);
    if (Number.isFinite(parsedValue)) {
        return {
            value: formatNumberValue(parsedValue, range.step),
            range,
            shouldPersist: false
        };
    }
    let anchor = null;
    if (question.id === 3) {
        anchor = 165;
    } else if (question.id === 4) {
        anchor = 70;
    } else if (question.id === 5) {
        const currentWeight = parseNumberValue(window.userData?.currentWeight);
        if (Number.isFinite(currentWeight)) {
            const lowerAnchor = currentWeight - 5;
            const upperAnchor = currentWeight + 5;
            anchor = lowerAnchor >= range.min ? lowerAnchor : upperAnchor;
        } else {
            anchor = 65;
        }
    }
    if (!Number.isFinite(anchor)) {
        anchor = range.min;
    }
    if (anchor < range.min) {
        anchor = range.min;
    }
    if (anchor > range.max) {
        anchor = range.max;
    }
    return {
        value: formatNumberValue(anchor, range.step),
        range,
        shouldPersist: true
    };
}

function buildNumberOptions(question, currentValue, rangeOverride) {
    const options = [];
    const range = rangeOverride || getNumberRangeForQuestion(question);
    const step = Number(range.step) || 1;
    const min = Number(range.min) || 0;
    const max = Number(range.max) || 0;
    for (let value = min; value <= max + step / 2; value += step) {
        const formatted = Number.isInteger(step) ? Math.round(value).toString() : value.toFixed(1);
        const label = question.unit ? `${formatted} ${question.unit}` : formatted;
        const isSelected = String(currentValue ?? '') === formatted;
        options.push(`<option value="${formatted}" ${isSelected ? 'selected' : ''}>${label}</option>`);
    }
    return options.join('');
}

// Update button states
function updateButtonStates() {
    const currentValue = window.userData[getDataKey(currentQuestionIndex)];
    const currentQuestion = getQuestionByIndex(currentQuestionIndex);
    const isOptional = currentQuestion?.optional;
    const hasAnswer = isOptional ? true : currentValue !== null && currentValue !== '';
    
    // Enable/disable next button
    nextButton.disabled = !hasAnswer;
    
    // Enable/disable previous button
    prevButton.disabled = currentQuestionIndex === 0;
    // Update next button text for last question
    const isLastStep = currentQuestionIndex >= getActiveQuestions().length - 1;
    if (isLastStep) {
        nextButton.innerHTML = `<span>Завершить</span><i data-feather="check" class="w-5 h-5"></i>`;
    } else {
        nextButton.innerHTML = `<span>Далее</span><i data-feather="arrow-right" class="w-5 h-5"></i>`;
    }
if (window.feather) {
        feather.replace();
    }
}

function persistUserData() {
    try {
        localStorage.setItem('userData', JSON.stringify(window.userData));
    } catch (error) {
        console.warn('Не удалось сохранить userData', error);
    }
}

// Сохраняем данные анкеты локально до завершения
function saveUserData() {
    persistUserData();
}

function validateGoalWeightConsistencyForQuestionnaire(data) {
    const profile = typeof mapUserDataToUserProfile === 'function'
        ? mapUserDataToUserProfile(data)
        : null;
    if (!profile) {
        return {
            ok: true,
            warning: null,
            error: null
        };
    }

    const goal = profile.goal;
    if (goal === 'maintain') {
        // Для режима поддержания целевой вес и дедлайн всегда очищаются автоматически.
        data.targetWeight = null;
        data.target_weight_kg = null;
        data.deadline = null;
        data.goal_deadline = null;
        return {
            ok: true,
            warning: null,
            error: null
        };
    }

    const current = Number(profile.weight_kg);
    const target = Number(profile.target_weight_kg);
    if (!goal || !Number.isFinite(current) || !Number.isFinite(target)) {
        return {
            ok: true,
            warning: null,
            error: null
        };
    }

    const fallbackConsistency = {
        valid: true,
        blocking: false,
        warning: false,
        message: null
    };
    if (goal === 'lose' && target >= current) {
        fallbackConsistency.valid = false;
        fallbackConsistency.blocking = true;
        fallbackConsistency.message = 'Цель снижения веса противоречит выбранному желаемому весу';
    }
    if (goal === 'gain' && target <= current) {
        fallbackConsistency.valid = false;
        fallbackConsistency.blocking = true;
        fallbackConsistency.message = 'Цель набора массы противоречит выбранному желаемому весу';
    }

    const consistency = typeof window.validateGoalWeightConsistency === 'function'
        ? window.validateGoalWeightConsistency(goal, current, target)
        : fallbackConsistency;

    if (consistency.blocking) {
        return {
            ok: false,
            warning: null,
            error: consistency.message || 'Проверьте цель и желаемый вес.'
        };
    }

    return {
        ok: true,
        warning: null,
        error: null
    };
}

async function saveProfileToServer(profile) {
    if (!profile) {
        return false;
    }

    const sendProfile = async () => {
        const apiFetch = window.apiFetch || fetch;
        return apiFetch('/api/profile/save', {
            method: 'POST',
            body: JSON.stringify(profile)
        });
    };

    const tryInitTelegramAuth = async () => {
        if (typeof initTelegramAuth !== 'function') {
            return false;
        }
        try {
            const configResponse = await fetch('/api/app/config');
            const appConfig = configResponse.ok ? await configResponse.json() : {};
            return await initTelegramAuth(appConfig || {});
        } catch (error) {
            return false;
        }
    };

    try {
        let response = await sendProfile();
        if (response.status === 401) {
            const reAuthorized = await tryInitTelegramAuth();
            if (!reAuthorized) {
                return false;
            }
            response = await sendProfile();
        }
        return response.ok;
    } catch (error) {
        return false;
    }
}

// Setup event listeners
function setupEventListeners() {
    // Next button
    nextButton.addEventListener('click', async () => {
        const activeQuestions = getActiveQuestions();
        if (currentQuestionIndex < activeQuestions.length - 1) {
            currentQuestionIndex++;
            displayQuestion();
        } else {
            // Сохраняем профиль и отправляем на сервер (если доступен Telegram ID).
            let profile = null;
            const consistency = validateGoalWeightConsistencyForQuestionnaire(window.userData);
            if (!consistency.ok) {
                if (typeof showNotification === 'function' && consistency.error) {
                    showNotification(consistency.error, 'error');
                }
                return;
            }
            if (consistency.warning && typeof showNotification === 'function') {
                showNotification(consistency.warning, 'warning');
            }
            if (typeof patchUserProfile === 'function' && typeof mapUserDataToUserProfile === 'function') {
                console.log('[QUESTIONNAIRE_TRACE] перед mapUserDataToUserProfile:', window.userData);
                const mappedProfile = mapUserDataToUserProfile(window.userData);
                console.log('[QUESTIONNAIRE_TRACE] результат mapUserDataToUserProfile:', mappedProfile);

                // Защита от редкого рассинхрона ключей: если map не вернул пол, пробуем восстановить напрямую из userData.
                const rawGender = window.userData?.gender ?? window.userData?.sex ?? null;
                if (!mappedProfile.sex && (rawGender === 'male' || rawGender === 'female')) {
                    mappedProfile.sex = rawGender;
                }

                const criticalKeys = ['sex', 'birth_date', 'height_cm', 'weight_kg', 'activity_factor', 'goal'];
                if (mappedProfile.goal !== 'maintain') {
                    criticalKeys.push('target_weight_kg');
                }
                if (window.appDebug) {
                    const nullFields = Object.keys(mappedProfile).filter((key) => mappedProfile[key] === null);
                    console.log('[QUESTIONNAIRE_DEBUG] payload перед /api/profile:', {
                        mappedProfile,
                        nullFields,
                        is_completed: mappedProfile.is_completed ?? null
                    });
                }
                const missingCritical = criticalKeys.filter((key) => mappedProfile[key] === null || mappedProfile[key] === undefined || mappedProfile[key] === '');
                if (missingCritical.length > 0) {
                    console.error('[QUESTIONNAIRE_TRACE] Блокирующая неполнота профиля', {
                        missingCritical,
                        userData: window.userData,
                        mappedProfile
                    });
                    if (typeof showNotification === 'function') {
                        showNotification('Не удалось сохранить профиль: заполните обязательные поля и повторите.', 'error');
                    }
                    return;
                }
                mappedProfile.is_completed = true;
                profile = patchUserProfile(mappedProfile);
            }
            if (!profile && typeof getUserProfile === 'function') {
                profile = getUserProfile();
            }
            persistUserData();
            const saved = await saveProfileToServer(profile);
            if (!saved) {
                if (typeof showNotification === 'function') {
                    showNotification('Не удалось сохранить профиль. Проверьте подключение и повторите попытку.', 'error');
                }
                return;
            }
            if (typeof resetUserDataDirtyMap === 'function') {
                resetUserDataDirtyMap('profile_saved');
            }
            // Все вопросы заполнены, переходим на следующий экран с учётом шага предпочтений.
            window.location.href = resolvePostQuestionnaireRoute(profile);
        }
    });
    
    // Кнопка назад
    prevButton.addEventListener('click', () => {
        if (currentQuestionIndex > 0) {
            currentQuestionIndex--;
            displayQuestion();
        }
    });
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initQuestionnaire);
