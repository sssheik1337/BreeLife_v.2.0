// Resume/Summary Page Logic for Health Bloom App

// Initialize summary page
function generateSummary() {
    const cardsContainer = document.getElementById('data-cards');
    
    // Clear container
    cardsContainer.innerHTML = '';
    
    // Get user data
    const data = window.userData || {};
    
    // Create cards for each data point
    const dataPoints = [
        {
            label: 'Пол',
            value: formatGender(data.gender),
            icon: 'user',
            color: 'emerald',
            details: null
        },
        {
            label: 'Дата рождения',
            value: formatDate(data.birthDate),
            icon: 'calendar',
            color: 'purple',
            details: data.birthDate ? `Возраст: ${calculateAge(data.birthDate)} лет` : null
        },
        {
            label: 'Рост',
            value: data.height ? `${data.height} см` : 'Не указано',
            icon: 'maximize-2',
            color: 'blue',
            details: data.height ? `Примерно ${cmToFeetInches(data.height)}` : null
        },
        {
            label: 'Текущий вес',
            value: data.currentWeight ? `${data.currentWeight} кг` : 'Не указано',
            icon: 'scale',
            color: 'amber',
            details: data.currentWeight ? `${kgToLbs(data.currentWeight)} фунтов` : null
        },
        {
            label: 'Целевой вес',
            value: data.targetWeight ? `${data.targetWeight} кг` : 'Не указано',
            icon: 'target',
            color: 'pink',
            details: data.currentWeight && data.targetWeight ? 
                `${calculateWeightDifference(data.currentWeight, data.targetWeight)}` : null
        }
];
    
    // Create and append cards
    dataPoints.forEach((point, index) => {
        const card = createDataCard(point, index);
        cardsContainer.appendChild(card);
    });
    
    // Update feather icons
    if (window.feather) {
        feather.replace();
    }
}

// Create a data card element
function createDataCard(point, index) {
    const colorClasses = {
        emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
        purple: 'bg-purple-50 text-purple-600 border-purple-100',
        blue: 'bg-blue-50 text-blue-600 border-blue-100',
        amber: 'bg-amber-50 text-amber-600 border-amber-100',
        pink: 'bg-pink-50 text-pink-600 border-pink-100'
    };
    
    const card = document.createElement('div');
    card.className = 'card animate-slide-in';
    card.style.animationDelay = `${index * 0.1}s`;
    
    card.innerHTML = `
        <div class="flex items-center justify-between mb-4">
            <div class="flex items-center space-x-3">
                <div class="w-10 h-10 rounded-xl ${colorClasses[point.color]} flex items-center justify-center">
                    <i data-feather="${point.icon}" class="w-5 h-5"></i>
                </div>
                <h3 class="font-semibold text-slate-800">${point.label}</h3>
            </div>
        </div>
        <div class="text-3xl font-bold text-slate-800 mb-2">${point.value}</div>
        ${point.details ? `<div class="text-sm text-slate-500">${point.details}</div>` : ''}
    `;
    
    return card;
}

// Format gender for display
function formatGender(gender) {
    const genderMap = {
        'male': 'Мужской',
        'female': 'Женский',
        'other': 'Предпочитаю не указывать'
    };
    return genderMap[gender] || 'Не указано';
}

// Convert cm to feet and inches
function cmToFeetInches(cm) {
    if (!cm) return '';
    const inches = cm / 2.54;
    const feet = Math.floor(inches / 12);
    const remainingInches = Math.round(inches % 12);
    return `${feet}'${remainingInches}"`;
}

// Convert kg to lbs
function kgToLbs(kg) {
    if (!kg) return '';
    return Math.round(kg * 2.20462);
}

// Calculate weight difference
function calculateWeightDifference(current, target) {
    if (!current || !target) return '';
    const diff = current - target;
    if (diff > 0) {
        return `Сбросить ${diff.toFixed(1)} кг (${kgToLbs(diff)} фунтов)`;
    } else if (diff < 0) {
        return `Набрать ${Math.abs(diff).toFixed(1)} кг (${kgToLbs(Math.abs(diff))} фунтов)`;
    } else {
        return 'Идеальный вес!';
    }
}

// Calculate and display BMI
function calculateBMI() {
    const data = window.userData || {};
    const height = parseFloat(data.height);
    const weight = parseFloat(data.currentWeight);
    
    if (!height || !weight || height <= 0 || weight <= 0) {
        document.getElementById('bmi-value').textContent = '--';
        document.getElementById('bmi-category').textContent = 'Введите рост и вес';
return;
    }
    
    // Calculate BMI: weight (kg) / height (m)²
    const heightInMeters = height / 100;
    const bmi = weight / (heightInMeters * heightInMeters);
    const bmiRounded = bmi.toFixed(1);
    
    // Determine BMI category and color
    const { category, color } = getBMICategory(bmi);
    
    // Update display
    document.getElementById('bmi-value').textContent = bmiRounded;
    document.getElementById('bmi-category').textContent = category;
    document.getElementById('bmi-category').className = `text-${color}-600 font-medium`;
    
    // Update progress bar
    updateBMIProgress(bmi);
}

// Get BMI category
function getBMICategory(bmi) {
    if (bmi < 18.5) {
        return { category: 'Недостаточный вес', color: 'blue', progress: (bmi / 18.5) * 25 };
    } else if (bmi < 25) {
        return { category: 'Нормальный вес', color: 'emerald', progress: 25 + ((bmi - 18.5) / (25 - 18.5)) * 25 };
    } else if (bmi < 30) {
        return { category: 'Избыточный вес', color: 'amber', progress: 50 + ((bmi - 25) / (30 - 25)) * 25 };
    } else {
        return { category: 'Ожирение', color: 'red', progress: 75 + ((bmi - 30) / (40 - 30)) * 25 };
    }
}

// Update BMI progress visualization
function updateBMIProgress(bmi) {
    const progressBar = document.getElementById('bmi-progress');
    const { color, progress } = getBMICategory(bmi);
    
    // Set color based on category
    const colorMap = {
        'blue': '#3b82f6',
        'emerald': '#10b981',
        'amber': '#f59e0b',
        'red': '#ef4444'
    };
    
    progressBar.style.width = `${Math.min(progress, 100)}%`;
    progressBar.style.backgroundColor = colorMap[color] || colorMap.emerald;
    
    // Animate the progress
    progressBar.style.transition = 'width 1s ease-out, background-color 1s ease-out';
}

// Рендер круговых индикаторов питания
function renderNutritionRings() {
    const mockData = {
        calories: { percent: 72, value: '1540 / 2150 ккал', label: 'Калории', color: '#10b981' },
        water: { percent: 55, value: '1.4 / 2.5 л', label: 'Вода', color: '#38bdf8' },
        protein: { percent: 68, value: '82 / 120 г', label: 'Белки', color: '#a855f7' },
        fat: { percent: 43, value: '38 / 90 г', label: 'Жиры', color: '#f59e0b' },
        carbs: { percent: 61, value: '190 / 310 г', label: 'Углеводы', color: '#06b6d4' }
    };

    const rings = [
        { id: 'calorie-ring', data: mockData.calories },
        { id: 'water-ring', data: mockData.water },
        { id: 'macro-protein-ring', data: mockData.protein },
        { id: 'macro-fat-ring', data: mockData.fat },
        { id: 'macro-carb-ring', data: mockData.carbs }
    ];

    rings.forEach(({ id, data }) => {
        const container = document.getElementById(id);
        if (!container) {
            return;
        }
        container.innerHTML = '';
        container.appendChild(createProgressRing(data));
    });
}

// Создание SVG-круга с анимацией заполнения
function createProgressRing({ percent, value, label, color }) {
    const size = 140;
    const strokeWidth = 10;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const progress = Math.max(0, Math.min(percent, 100));

    const wrapper = document.createElement('div');
    wrapper.className = 'flex flex-col items-center text-center space-y-3';

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`);

    const backgroundCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    backgroundCircle.setAttribute('cx', size / 2);
    backgroundCircle.setAttribute('cy', size / 2);
    backgroundCircle.setAttribute('r', radius);
    backgroundCircle.setAttribute('stroke', '#e2e8f0');
    backgroundCircle.setAttribute('stroke-width', strokeWidth);
    backgroundCircle.setAttribute('fill', 'none');

    const progressCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    progressCircle.setAttribute('cx', size / 2);
    progressCircle.setAttribute('cy', size / 2);
    progressCircle.setAttribute('r', radius);
    progressCircle.setAttribute('stroke', color);
    progressCircle.setAttribute('stroke-width', strokeWidth);
    progressCircle.setAttribute('fill', 'none');
    progressCircle.setAttribute('stroke-linecap', 'round');
    progressCircle.setAttribute('stroke-dasharray', circumference);
    progressCircle.setAttribute('stroke-dashoffset', circumference);
    progressCircle.style.filter = 'drop-shadow(0 6px 12px rgba(15, 23, 42, 0.12))';

    const percentText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    percentText.setAttribute('x', '50%');
    percentText.setAttribute('y', '50%');
    percentText.setAttribute('text-anchor', 'middle');
    percentText.setAttribute('dominant-baseline', 'middle');
    percentText.setAttribute('font-size', '20');
    percentText.setAttribute('font-weight', '700');
    percentText.setAttribute('fill', '#0f172a');
    percentText.textContent = `${Math.round(progress)}%`;

    svg.appendChild(backgroundCircle);
    svg.appendChild(progressCircle);
    svg.appendChild(percentText);

    const labelText = document.createElement('div');
    labelText.className = 'text-sm font-semibold text-slate-700';
    labelText.textContent = label;

    const valueText = document.createElement('div');
    valueText.className = 'text-xs text-slate-500';
    valueText.textContent = value;

    wrapper.appendChild(svg);
    wrapper.appendChild(labelText);
    wrapper.appendChild(valueText);

    requestAnimationFrame(() => {
        progressCircle.style.transition = 'stroke-dashoffset 1.2s ease-out';
        progressCircle.setAttribute(
            'stroke-dashoffset',
            `${circumference - (progress / 100) * circumference}`
        );
    });

    return wrapper;
}

// Рендер статуса пробного периода
function renderTrialStatus() {
    const statusElement = document.getElementById('trial-status');
    const datesElement = document.getElementById('trial-dates');

    if (!statusElement || !datesElement) {
        return;
    }

    const storedDate = localStorage.getItem('health_bloom_registration_date') || window.userData?.registrationDate;
    if (!storedDate) {
        statusElement.textContent = 'Регистрация не найдена';
        datesElement.textContent = 'Добавьте данные профиля, чтобы активировать пробный период.';
        return;
    }

    const registrationDate = new Date(storedDate);
    if (Number.isNaN(registrationDate.getTime())) {
        statusElement.textContent = 'Некорректная дата регистрации';
        datesElement.textContent = 'Проверьте данные профиля.';
        return;
    }

    const trialEnd = new Date(registrationDate);
    trialEnd.setDate(trialEnd.getDate() + 30);
    const now = new Date();
    const isTrial = now <= trialEnd;

    statusElement.textContent = isTrial ? 'Пробный период активен' : 'Пробный период завершён';

    const remainingMs = trialEnd.getTime() - now.getTime();
    const remainingDays = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));
    const startDate = registrationDate.toLocaleDateString('ru-RU');
    const endDate = trialEnd.toLocaleDateString('ru-RU');

    if (isTrial) {
        datesElement.textContent = `С ${startDate} до ${endDate}. Осталось дней: ${remainingDays}`;
    } else {
        datesElement.textContent = `Период длился с ${startDate} до ${endDate}.`;
    }
}

// Save all data and redirect to profile
function saveAndContinue() {
    // Save data to localStorage
    localStorage.setItem('health_bloom_user_data_final', JSON.stringify(window.userData));
    
    // Show success notification
    if (typeof showNotification === 'function') {
        showNotification('Профиль успешно сохранен!', 'success');
}
    
    // Redirect after a short delay
    setTimeout(() => {
        window.location.href = 'profile.html';
    }, 1000);
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    generateSummary();
    calculateBMI();
    renderNutritionRings();
    renderTrialStatus();
    
    // Добавляем обработчик для кнопки сохранения
    const saveButton = document.querySelector('a.btn-primary');
    if (saveButton) {
        saveButton.addEventListener('click', function(event) {
            event.preventDefault();
            saveAndContinue();
        });
    }
});
