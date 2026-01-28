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
function initQuestionnaire() {
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
    
    // Load saved progress
    const savedIndex = localStorage.getItem('health_bloom_question_index');
    if (savedIndex && savedIndex !== "0") {
        currentQuestionIndex = parseInt(savedIndex);
    }
    
    // Load saved answers
    loadSavedAnswers();
    
    // Display first question
    displayQuestion();
    
    // Setup event listeners
    setupEventListeners();
}

// Load saved answers from localStorage
function loadSavedAnswers() {
    if (typeof getUserProfile === 'function' && typeof mapUserProfileToUserData === 'function') {
        const profile = getUserProfile();
        Object.assign(window.userData, mapUserProfileToUserData(profile));
        return;
    }

    const savedData = localStorage.getItem('health_bloom_user_data');
    if (savedData) {
        try {
            const data = JSON.parse(savedData);
            Object.assign(window.userData, data);
        } catch (e) {
            return null;
        }
    }
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

    const formatNumberDisplay = (value) => {
        if (!value) {
            return null;
        }
        const unit = unitLabels[question.unit] || question.unit || '';
        const formatted = Number.isFinite(Number(value))
            ? Number(value).toLocaleString('ru-RU')
            : value;
        return unit ? `${formatted} ${unit}` : formatted;
    };

    const renderPickerWrapper = (displayValue, icon) => `
        <div class="picker-display" data-role="picker-display">
            <span class="picker-display-text${displayValue ? '' : ' picker-display-placeholder'}">
                ${displayValue || question.placeholder}
            </span>
            <span class="picker-display-icon">${icon}</span>
        </div>
        <div class="picker-panel hidden" data-role="picker-panel"></div>
    `;

    if (question.type === 'date') {
        const today = new Date();
        const minYear = 1900;
        const maxYear = today.getFullYear();
        const months = [
            'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
            'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
        ];
        const displayValue = formatDateDisplay(currentValue);
        inputContainer.innerHTML = renderPickerWrapper(displayValue, '📅');
        const panel = inputContainer.querySelector('[data-role="picker-panel"]');
        if (panel) {
            panel.innerHTML = `
                <div class="wheel-picker" data-role="birth-picker">
                    <div class="wheel-column">
                        <select id="birth-day" class="wheel-select" size="7" aria-label="День рождения"></select>
                    </div>
                    <div class="wheel-column">
                        <select id="birth-month" class="wheel-select" size="7" aria-label="Месяц рождения">
                            ${months.map((label, index) => `<option value="${index + 1}">${label}</option>`).join('')}
                        </select>
                    </div>
                    <div class="wheel-column">
                        <select id="birth-year" class="wheel-select" size="7" aria-label="Год рождения"></select>
                    </div>
                </div>
                <button type="button" class="picker-done" data-role="picker-done">Готово</button>
            `;
        }
        const daySelect = document.getElementById('birth-day');
        const monthSelect = document.getElementById('birth-month');
        const yearSelect = document.getElementById('birth-year');
        const display = inputContainer.querySelector('[data-role="picker-display"]');
        const displayText = inputContainer.querySelector('.picker-display-text');
        const doneButton = inputContainer.querySelector('[data-role="picker-done"]');
        const panelElement = inputContainer.querySelector('[data-role="picker-panel"]');

        const togglePicker = (isOpen) => {
            if (!panelElement || !display) {
                return;
            }
            panelElement.classList.toggle('hidden', !isOpen);
            display.style.display = isOpen ? 'none' : 'flex';
        };

        if (display) {
            display.addEventListener('click', () => togglePicker(true));
        }
        if (doneButton) {
            doneButton.addEventListener('click', () => togglePicker(false));
        }
        if (daySelect && monthSelect && yearSelect) {
            const years = [];
            for (let year = maxYear; year >= minYear; year -= 1) {
                years.push(`<option value="${year}">${year}</option>`);
            }
            yearSelect.innerHTML = years.join('');

            const setDayOptions = (year, month) => {
                const safeYear = Number(year) || maxYear;
                const safeMonth = Number(month) || 1;
                const daysInMonth = new Date(safeYear, safeMonth, 0).getDate();
                const currentDay = Number(daySelect.value) || 1;
                daySelect.innerHTML = Array.from({ length: daysInMonth }, (_, index) => {
                    const day = index + 1;
                    return `<option value="${day}">${day}</option>`;
                }).join('');
                daySelect.value = String(Math.min(currentDay, daysInMonth));
            };

            const applyBirthDate = () => {
                const year = Number(yearSelect.value);
                const month = Number(monthSelect.value);
                const day = Number(daySelect.value);
                if (!year || !month || !day) {
                    window.userData[getDataKey(currentQuestionIndex)] = '';
                } else {
                    const formatted = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    window.userData[getDataKey(currentQuestionIndex)] = formatted;
                }
                saveUserData();
                updateButtonStates();
                if (displayText) {
                    const displayValueText = formatDateDisplay(window.userData[getDataKey(currentQuestionIndex)]);
                    displayText.textContent = displayValueText || question.placeholder;
                    displayText.classList.toggle('picker-display-placeholder', !displayValueText);
                }
            };

            const syncFromStored = () => {
                if (!currentValue) {
                    setDayOptions(maxYear, 1);
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
                setDayOptions(year || maxYear, month || 1);
                if (day) {
                    daySelect.value = String(day);
                }
            };

            syncFromStored();
            applyBirthDate();
            monthSelect.addEventListener('change', () => {
                setDayOptions(yearSelect.value, monthSelect.value);
                applyBirthDate();
            });
            yearSelect.addEventListener('change', () => {
                setDayOptions(yearSelect.value, monthSelect.value);
                applyBirthDate();
            });
            daySelect.addEventListener('change', applyBirthDate);
        }
    } else if (question.type === 'number') {
        const options = buildNumberOptions(question, currentValue);
        const displayValue = formatNumberDisplay(currentValue);
        inputContainer.innerHTML = renderPickerWrapper(displayValue, '⌄');
        const panel = inputContainer.querySelector('[data-role="picker-panel"]');
        if (panel) {
            panel.innerHTML = `
                <select id="question-input" class="form-input">
                    <option value="">${question.placeholder}</option>
                    ${options}
                </select>
                <button type="button" class="picker-done" data-role="picker-done">Готово</button>
            `;
        }
        const display = inputContainer.querySelector('[data-role="picker-display"]');
        const panelElement = inputContainer.querySelector('[data-role="picker-panel"]');
        const doneButton = inputContainer.querySelector('[data-role="picker-done"]');
        const displayText = inputContainer.querySelector('.picker-display-text');

        const togglePicker = (isOpen) => {
            if (!panelElement || !display) {
                return;
            }
            panelElement.classList.toggle('hidden', !isOpen);
            display.style.display = isOpen ? 'none' : 'flex';
        };

        if (display) {
            display.addEventListener('click', () => togglePicker(true));
        }
        if (doneButton) {
            doneButton.addEventListener('click', () => togglePicker(false));
        }
    }
    
    // Add input event listener
    const input = document.getElementById('question-input');
    if (input) {
        input.value = currentValue || '';
        input.addEventListener('input', () => {
            const value = input.value;
            window.userData[getDataKey(currentQuestionIndex)] = value;
            saveUserData();
            updateButtonStates();
            const displayText = inputContainer.querySelector('.picker-display-text');
            if (displayText) {
                const displayValue = formatNumberDisplay(value);
                displayText.textContent = displayValue || question.placeholder;
                displayText.classList.toggle('picker-display-placeholder', !displayValue);
            }
        });
        input.addEventListener('change', () => {
            const value = input.value;
            window.userData[getDataKey(currentQuestionIndex)] = value;
            saveUserData();
            updateButtonStates();
            const displayText = inputContainer.querySelector('.picker-display-text');
            if (displayText) {
                const displayValue = formatNumberDisplay(value);
                displayText.textContent = displayValue || question.placeholder;
                displayText.classList.toggle('picker-display-placeholder', !displayValue);
            }
        });
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

// Save user data to localStorage
function saveUserData() {
    localStorage.setItem('health_bloom_user_data', JSON.stringify(window.userData));
    localStorage.setItem('health_bloom_question_index', currentQuestionIndex.toString());
    if (typeof patchUserProfile === 'function' && typeof mapUserDataToUserProfile === 'function') {
        patchUserProfile(mapUserDataToUserProfile(window.userData));
    }
}

async function saveProfileToServer(profile) {
    if (!profile || !profile.telegram_user_id) {
        return;
    }
    try {
        await fetch('/api/profile/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                telegram_user_id: profile.telegram_user_id,
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
                const mappedProfile = mapUserDataToUserProfile(window.userData);
                mappedProfile.completed = true;
                profile = patchUserProfile(mappedProfile);
            }
            localStorage.setItem('hasCompletedQuiz', 'true');
            localStorage.setItem('profile_completed', 'true');
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
