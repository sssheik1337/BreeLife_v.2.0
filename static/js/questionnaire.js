// Questionnaire Logic for Health Bloom App

// Question definitions
const questions = [
    {
        id: 1,
        title: "Какой ваш пол?",
        type: "select",
        icon: "user",
        options: [
            { value: "male", label: "Мужской", emoji: "👨" },
            { value: "female", label: "Женский", emoji: "👩" },
            { value: "other", label: "Предпочитаю не указывать", emoji: "🤔" }
        ]
},
    {
        id: 2,
        title: "Когда вы родились?",
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
        title: "Какой ваш целевой вес?",
        type: "number",
        icon: "target",
        placeholder: "Введите желаемый вес в килограммах",
unit: "kg",
        min: 30,
        max: 200,
        step: 0.5
    }
];

let currentQuestionIndex = 0;

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
    // Get DOM elements
    questionTitle = document.getElementById('question-title');
    optionsContainer = document.getElementById('options-container');
    inputContainer = document.getElementById('input-container');
    nextButton = document.getElementById('next-btn');
    prevButton = document.getElementById('prev-btn');
    progressBar = document.getElementById('progress-bar');
    currentStep = document.getElementById('current-step');
    progressPercent = document.getElementById('progress-percent');
    
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
    const savedData = localStorage.getItem('health_bloom_user_data');
    if (savedData) {
        try {
            const data = JSON.parse(savedData);
            Object.assign(window.userData, data);
        } catch (e) {
            console.warn('Failed to parse saved data:', e);
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
    
    if (question.type === 'date') {
        inputContainer.innerHTML = `
            <input 
                type="date" 
                id="question-input"
                class="form-input"
                placeholder="${question.placeholder}"
                min="${question.min}"
                max="${question.max}"
                value="${currentValue || ''}"
            >
        `;
    } else if (question.type === 'number') {
        inputContainer.innerHTML = `
            <div class="relative">
                <input 
                    type="number" 
                    id="question-input"
                    class="form-input pr-12"
                    placeholder="${question.placeholder}"
                    min="${question.min}"
                    max="${question.max}"
                    step="${question.step}"
                    value="${currentValue || ''}"
                >
                <div class="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-500 font-medium">
                    ${question.unit}
                </div>
            </div>
        `;
    }
    
    // Add input event listener
    const input = document.getElementById('question-input');
    input.addEventListener('input', () => {
        const value = input.value;
        window.userData[getDataKey(currentQuestionIndex)] = value;
        saveUserData();
        updateButtonStates();
    });
    
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
        default: return `question_${question.id}`;
    }
}

// Update button states
function updateButtonStates() {
    const currentValue = window.userData[getDataKey(currentQuestionIndex)];
    const hasAnswer = currentValue !== null && currentValue !== '';
    
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

// Save user data to localStorage
function saveUserData() {
    localStorage.setItem('health_bloom_user_data', JSON.stringify(window.userData));
    localStorage.setItem('health_bloom_question_index', currentQuestionIndex.toString());
}

// Setup event listeners
function setupEventListeners() {
    // Next button
    nextButton.addEventListener('click', () => {
        if (currentQuestionIndex < questions.length - 1) {
            currentQuestionIndex++;
            displayQuestion();
        } else {
            // All questions answered, go to resume page
            window.location.href = 'resume.html';
        }
    });
    
    // Previous button
    prevButton.addEventListener('click', () => {
        if (currentQuestionIndex > 0) {
            currentQuestionIndex--;
            displayQuestion();
        }
    });
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initQuestionnaire);
