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
        min: 100,
        max: 250,
        step: 1
    },
    {
        id: 4,
        title: "Какой у вас текущий вес?",
        type: "number",
        icon: "scale",
        placeholder: "Введите вес в килограммах",
unit: "kg",
        min: 30,
        max: 200,
        step: 0.5
    },
    {
        id: 5,
        title: "Желаемый вес",
        type: "number",
        icon: "target",
        placeholder: "Введите желаемый вес в килограммах",
        unit: "kg",
        min: 30,
        max: 200,
        step: 0.5
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

// Display input field for date/number questions
function displayInput(question) {
    const currentValue = window.userData[getDataKey(currentQuestionIndex)];

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
        const minYear = 1900;
        const maxYear = today.getFullYear();
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

            const setDayOptions = (year, month, preferredDay = '') => {
                const safeYear = Number(year) || maxYear;
                const safeMonth = Number(month) || 1;
                const daysInMonth = new Date(safeYear, safeMonth, 0).getDate();
                const numericPreferred = Number(preferredDay);
                const nextDay = Number.isFinite(numericPreferred) && numericPreferred > 0
                    ? Math.min(numericPreferred, daysInMonth)
                    : null;
                daySelect.innerHTML = `<option value="" class="wheel-placeholder">День</option>${Array.from({ length: daysInMonth }, (_, index) => {
                    const day = index + 1;
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
                    setDayOptions(null, null);
                    daySelect.value = '';
                    monthSelect.value = '';
                    yearSelect.value = '';
                    return;
                }
                const [yearStr, monthStr, dayStr] = currentValue.split('-');
                const year = Number(yearStr);
                const month = Number(monthStr);
                const day = Number(dayStr);
                if (year) {
                    yearSelect.value = String(year);
                }
                if (month) {
                    monthSelect.value = String(month);
                }
                setDayOptions(year || maxYear, month || 1, dayStr || '');
                if (day) {
                    daySelect.value = String(day);
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
        const options = buildNumberOptions(question, currentValue);
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

function buildNumberOptions(question, currentValue) {
    const options = [];
    const step = Number(question.step) || 1;
    const min = Number(question.min) || 0;
    const max = Number(question.max) || 0;
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
    prevButton.disabled = !isEditMode || currentQuestionIndex === 0;
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

// Сохраняем данные анкеты локально до завершения
function saveUserData() {
    return;
}

async function saveProfileToServer(profile) {
    if (!profile) {
        return;
    }
    try {
        const apiFetch = window.apiFetch || fetch;
        await apiFetch('/api/profile/save', {
            method: 'POST',
            body: JSON.stringify({
                user_profile: profile
            })
        });
    } catch (error) {
        return null;
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
            await saveProfileToServer(profile);
            // Все вопросы заполнены, переходим на страницу сводки.
            window.location.href = isEditMode ? '/profile' : '/resume';
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
