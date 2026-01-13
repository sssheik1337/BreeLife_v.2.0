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
    
    // Add event listener to save button
    const saveButton =