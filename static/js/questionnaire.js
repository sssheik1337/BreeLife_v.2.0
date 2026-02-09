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

// DOM Elements
let questionTitle;
let optionsContainer;
let inputContainer;
let nextButton;
let prevButton;
let progressBar;
let currentStep;
let progressPercent;

// Initialize questionnaire
async function initQuestionnaire() {
    const urlParams = new URLSearchParams(window.location.search);
    isEditMode = urlParams.get('edit') === '1';

    if (!isEditMode && typeof getUserProfile === 'function') {
        const profile = getUserProfile();
        if (profile?.completed === true || hasProfileData(profile)) {
            window.location.replace('/profile');
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
    const totalSteps = document.getElementById('total-steps');
    if (totalSteps) {
        totalSteps.textContent = questions.length.toString();
    }
    
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
        Object.assign(window.userData, mapUserProfileToUserData(profile));
        return;
    }

    return null;
}
// Display current question
function displayQuestion() {
    const question = questions[currentQuestionIndex];
    
    // Update UI elements
    questionTitle.textContent = question.title;
    currentStep.textContent = question.id;
    
    // Update progress
    const progress = ((question.id) / questions.length) * 100;
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



function renderHeightRuler(currentValue, range = HEIGHT_RANGE) {
    const minHeight = range.min;
    const maxHeight = range.max;
    const stepCm = range.step;
    const pixelsPerStep = 12;
    const rangeSteps = Math.round((maxHeight - minHeight) / stepCm) + 1;
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

    track.style.height = `${rangeSteps * pixelsPerStep}px`;

    for (let index = 0; index < rangeSteps; index += 1) {
        const value = maxHeight - index * stepCm;
        const tick = document.createElement('div');
        const isMajor = value % 5 === 0;
        const isEdge = index === 0 || index === rangeSteps - 1;
        tick.className = isMajor ? 'ruler__tick ruler__tick--major' : 'ruler__tick';
        if (isEdge) {
            tick.classList.add('ruler__tick--edge');
        }
        tick.dataset.virtualIndex = String(index);
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
    const getEdgePadding = () => Math.max(0, getCenterOffset() - pixelsPerStep / 2);

    const getVirtualIndexFromScroll = () => {
        const centerOffset = getCenterOffset();
        const edgePadding = getEdgePadding();
        const rawIndex = Math.round(
            (ruler.scrollTop + centerOffset - edgePadding - pixelsPerStep / 2) / pixelsPerStep
        );
        return Math.min(rangeSteps - 1, Math.max(0, rawIndex));
    };

    const getScrollOffsetForIndex = (index) => {
        const edgePadding = getEdgePadding();
        return index * pixelsPerStep + pixelsPerStep / 2 + edgePadding - getCenterOffset();
    };

    const updateHeightMagnifier = (virtualIndex) => {
        const centerOffset = getCenterOffset();
        const edgePadding = getEdgePadding();
        const centerPosition = ruler.scrollTop + centerOffset;
        const visibleRadius = Math.ceil(centerOffset / pixelsPerStep) + 10;
        const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
        const rangeStart = clamp(virtualIndex - visibleRadius, 0, rangeSteps - 1);
        const rangeEnd = clamp(virtualIndex + visibleRadius, 0, rangeSteps - 1);

        for (let i = rangeStart; i <= rangeEnd; i += 1) {
            const tick = ticks[i];
            if (!tick) {
                continue;
            }
            const tickCenter = edgePadding + i * pixelsPerStep + pixelsPerStep / 2;
            const distance = Math.abs(tickCenter - centerPosition);
            const scale = clamp(1.4 - distance * 0.02, 1, 1.4);
            tick.style.transform = `translateZ(0) scale(${scale.toFixed(3)})`;
            tick.style.opacity = '1';
        }
    };

    const applyHeightValue = (virtualIndex) => {
        const clampedIndex = Math.min(rangeSteps - 1, Math.max(0, virtualIndex));
        const value = maxHeight - clampedIndex * stepCm;
        valueElement.textContent = `${value}`;
        ticks.forEach((tick) => {
            tick.classList.toggle('ruler__tick--active', Number(tick.dataset.virtualIndex) === clampedIndex);
        });
        window.userData[dataKey] = value;
        window.userData.height = value;
        saveUserData();
        updateButtonStates();
        updateHeightMagnifier(clampedIndex);
    };

    let rafId = null;
    const onScroll = () => {
        if (rafId !== null) {
            return;
        }
        rafId = requestAnimationFrame(() => {
            rafId = null;
            const rawIndex = getVirtualIndexFromScroll();
            applyHeightValue(rawIndex);
        });
    };

    requestAnimationFrame(() => {
        const startIndex = Math.round((maxHeight - startHeight) / stepCm);
        const edgePadding = getEdgePadding();
        track.style.paddingTop = `${edgePadding}px`;
        track.style.paddingBottom = `${edgePadding}px`;
        ruler.scrollTop = getScrollOffsetForIndex(startIndex);
        applyHeightValue(startIndex);
        ruler.addEventListener('scroll', onScroll, { passive: true });
    });
}

function renderWeightRuler(currentValue, range = WEIGHT_RANGE) {
    const minWeight = range.min;
    const maxWeight = range.max;
    const stepKg = range.step;
    const pixelsPerStep = 24;
    const rangeSteps = Math.round((maxWeight - minWeight) / stepKg) + 1;
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

    track.style.width = `${rangeSteps * pixelsPerStep}px`;

    for (let index = 0; index < rangeSteps; index += 1) {
        const value = minWeight + index * stepKg;
        const tick = document.createElement('div');
        const isMajor = Math.round(value * 10) % 50 === 0;
        const isEdge = index === 0 || index === rangeSteps - 1;
        tick.className = isMajor ? 'ruler__tick ruler__tick--major' : 'ruler__tick';
        if (isEdge) {
            tick.classList.add('ruler__tick--edge');
        }
        tick.dataset.virtualIndex = String(index);
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
    const getEdgePadding = () => Math.max(0, getCenterOffset() - pixelsPerStep / 2);

    const getVirtualIndexFromScroll = () => {
        const centerOffset = getCenterOffset();
        const edgePadding = getEdgePadding();
        const rawIndex = Math.round(
            (ruler.scrollLeft + centerOffset - edgePadding - pixelsPerStep / 2) / pixelsPerStep
        );
        return Math.min(rangeSteps - 1, Math.max(0, rawIndex));
    };

    const getScrollOffsetForIndex = (index) => {
        const edgePadding = getEdgePadding();
        return index * pixelsPerStep + pixelsPerStep / 2 + edgePadding - getCenterOffset();
    };

    const updateWeightMagnifier = (virtualIndex) => {
        const centerOffset = getCenterOffset();
        const edgePadding = getEdgePadding();
        const centerPosition = ruler.scrollLeft + centerOffset;
        const visibleRadius = Math.ceil(centerOffset / pixelsPerStep) + 10;
        const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
        const rangeStart = clamp(virtualIndex - visibleRadius, 0, rangeSteps - 1);
        const rangeEnd = clamp(virtualIndex + visibleRadius, 0, rangeSteps - 1);

        for (let i = rangeStart; i <= rangeEnd; i += 1) {
            const tick = ticks[i];
            if (!tick) {
                continue;
            }
            const tickCenter = edgePadding + i * pixelsPerStep + pixelsPerStep / 2;
            const distance = Math.abs(tickCenter - centerPosition);
            const scale = clamp(1.4 - distance * 0.02, 1, 1.4);
            tick.style.transform = `translateZ(0) scale(${scale.toFixed(3)})`;
            tick.style.opacity = '1';
        }
    };

    const applyWeightValue = (virtualIndex) => {
        const clampedIndex = Math.min(rangeSteps - 1, Math.max(0, virtualIndex));
        const value = minWeight + clampedIndex * stepKg;
        valueElement.textContent = value.toFixed(1).replace('.0', '');
        ticks.forEach((tick) => {
            tick.classList.toggle('ruler__tick--active', Number(tick.dataset.virtualIndex) === clampedIndex);
        });
        window.userData[dataKey] = value;
        window.userData.currentWeight = value;
        saveUserData();
        updateButtonStates();
        updateWeightMagnifier(clampedIndex);
    };

    let rafId = null;
    const onScroll = () => {
        if (rafId !== null) {
            return;
        }
        rafId = requestAnimationFrame(() => {
            rafId = null;
            const rawIndex = getVirtualIndexFromScroll();
            applyWeightValue(rawIndex);
        });
    };

    requestAnimationFrame(() => {
        const startIndex = Math.round((startWeight - minWeight) / stepKg);
        const edgePadding = getEdgePadding();
        track.style.paddingLeft = `${edgePadding}px`;
        track.style.paddingRight = `${edgePadding}px`;
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
                    window.userData[getDataKey(currentQuestionIndex)] = formatted;
                } else {
                    window.userData[getDataKey(currentQuestionIndex)] = '';
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
                        window.userData[getDataKey(currentQuestionIndex)] = defaultValue;
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
                    window.userData[getDataKey(currentQuestionIndex)] = formatted;
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
            window.userData[getDataKey(currentQuestionIndex)] = currentValue;
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
                window.userData[getDataKey(currentQuestionIndex)] = value;
                saveUserData();
                updateButtonStates();
                console.log('[QUESTIONNAIRE_TRACE] шаг обновлён (number input):', window.userData);
            });
            input.addEventListener('change', () => {
                const value = input.value;
                window.userData[getDataKey(currentQuestionIndex)] = value;
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
    window.userData[getDataKey(currentQuestionIndex)] = value;
    saveUserData();
    updateButtonStates();
    console.log('[QUESTIONNAIRE_TRACE] шаг обновлён (select option):', window.userData);
    
    // Update feather icons
    if (window.feather) {
        feather.replace();
    }
}

// Get data key for current question
function getDataKey(index) {
    const question = questions[index];
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
    const isOptional = questions[currentQuestionIndex]?.optional;
    const hasAnswer = isOptional ? true : currentValue !== null && currentValue !== '';
    
    // Enable/disable next button
    nextButton.disabled = !hasAnswer;
    
    // Enable/disable previous button
    prevButton.disabled = currentQuestionIndex === 0;
    // Update next button text for last question
    if (currentQuestionIndex === questions.length - 1) {
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

async function saveProfileToServer(profile) {
    if (!profile) {
        return false;
    }
    try {
        const apiFetch = window.apiFetch || fetch;
        const response = await apiFetch('/api/profile/save', {
            method: 'POST',
            body: JSON.stringify({
                user_profile: profile
            })
        });
        return response.ok;
    } catch (error) {
        return false;
    }
}

// Setup event listeners
function setupEventListeners() {
    // Next button
    nextButton.addEventListener('click', async () => {
        if (currentQuestionIndex < questions.length - 1) {
            currentQuestionIndex++;
            displayQuestion();
        } else {
            // Сохраняем профиль и отправляем на сервер (если доступен Telegram ID).
            let profile = null;
            if (typeof patchUserProfile === 'function' && typeof mapUserDataToUserProfile === 'function') {
                console.log('[QUESTIONNAIRE_TRACE] перед mapUserDataToUserProfile:', window.userData);
                const mappedProfile = mapUserDataToUserProfile(window.userData);
                console.log('[QUESTIONNAIRE_TRACE] результат mapUserDataToUserProfile:', mappedProfile);
                const criticalKeys = ['sex', 'birth_date', 'height_cm', 'weight_kg', 'target_weight_kg', 'activity_factor', 'goal'];
                if (window.appDebug) {
                    const nullFields = Object.keys(mappedProfile).filter((key) => mappedProfile[key] === null);
                    console.log('[QUESTIONNAIRE_DEBUG] payload перед /api/profile:', {
                        mappedProfile,
                        nullFields,
                        profile_completed: mappedProfile.profile_completed ?? mappedProfile.completed ?? null
                    });
                }
                const missingCritical = criticalKeys.filter((key) => mappedProfile[key] === null || mappedProfile[key] === undefined || mappedProfile[key] === '');
                if (missingCritical.length > 0) {
                    console.error('[QUESTIONNAIRE_TRACE] Ошибка сохранения профиля: отсутствуют критические поля', {
                        missingCritical,
                        userData: window.userData,
                        mappedProfile
                    });
                    return;
                }
                mappedProfile.completed = true;
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
            // Все вопросы заполнены, переходим на экран прогресса.
            window.location.href = '/profile';
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
