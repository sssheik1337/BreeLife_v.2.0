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

// Обновление расчётных показателей профиля
function updateCalculatedMetrics() {
    if (typeof getUserProfile !== 'function') {
        return;
    }

    const profile = getUserProfile();
    const age = typeof calculateAge === 'function' ? calculateAge(profile.birth_date) : null;
    const weight = Number(profile.weight_kg);
    const height = Number(profile.height_cm);
    const hasValidWeight = Number.isFinite(weight) && weight > 0;
    const hasValidHeight = Number.isFinite(height) && height > 0;
    const hasValidAge = age !== null && age > 0;
    const hasValidMetrics = hasValidWeight && hasValidHeight && hasValidAge;
    const bmr = hasValidMetrics && typeof calculateBMR === 'function'
        ? calculateBMR({
            sex: profile.sex,
            weight_kg: weight,
            height_cm: height,
            age
        })
        : null;
    const tdee = bmr !== null && typeof calculateTDEE === 'function'
        ? calculateTDEE(bmr, profile.activity_factor)
        : null;
    const macros = tdee !== null && typeof calculateMacros === 'function' ? calculateMacros(tdee) : null;
    const weightForecast = typeof calculateWeightGoalForecast === 'function'
        ? calculateWeightGoalForecast({
            goal: profile.goal,
            weight_kg: hasValidWeight ? weight : null,
            target_weight_kg: profile.target_weight_kg
        })
        : {
            weight_rate_kg_per_week: null,
            predicted_goal_date: null,
            label: null
        };

    if (hasValidMetrics && typeof patchUserProfile === 'function') {
        patchUserProfile({
            age,
            bmr,
            tdee_calories: tdee,
            macros,
            weight_rate_kg_per_week: weightForecast.weight_rate_kg_per_week,
            predicted_goal_date: weightForecast.predicted_goal_date
        });
    }

    const ageElement = document.getElementById('age-value');
    const bmrElement = document.getElementById('bmr-value');
    const tdeeElement = document.getElementById('tdee-value');
    const caloriesElement = document.getElementById('calories-value');
    const proteinElement = document.getElementById('protein-value');
    const fatElement = document.getElementById('fat-value');
    const carbsElement = document.getElementById('carbs-value');
    const weightRateElement = document.getElementById('weight-rate-value');
    const weightDateElement = document.getElementById('weight-date-value');

    if (ageElement) {
        if (age === null) {
            ageElement.textContent = '--';
        } else if (!hasValidAge) {
            ageElement.textContent = 'Проверьте дату рождения';
        } else {
            ageElement.textContent = `${age} лет`;
        }
    }
    if (bmrElement) {
        bmrElement.textContent = bmr === null ? '--' : `${Math.round(bmr)} ккал`;
    }
    if (tdeeElement) {
        tdeeElement.textContent = tdee === null ? '--' : `${Math.round(tdee)} ккал`;
    }
    if (caloriesElement) {
        caloriesElement.textContent = tdee === null ? '--' : `${Math.round(tdee)} ккал`;
    }
    if (proteinElement) {
        proteinElement.textContent = macros === null
            ? '--'
            : `${Math.round(macros.protein_g)} г • ${Math.round(macros.protein_pct * 100)}%`;
    }
    if (fatElement) {
        fatElement.textContent = macros === null
            ? '--'
            : `${Math.round(macros.fat_g)} г • ${Math.round(macros.fat_pct * 100)}%`;
    }
    if (carbsElement) {
        carbsElement.textContent = macros === null
            ? '--'
            : `${Math.round(macros.carbs_g)} г • ${Math.round(macros.carbs_pct * 100)}%`;
    }
    if (weightRateElement) {
        if (weightForecast.label) {
            weightRateElement.textContent = weightForecast.label;
        } else {
            weightRateElement.textContent = weightForecast.weight_rate_kg_per_week === null
                ? '--'
                : `${weightForecast.weight_rate_kg_per_week} кг в неделю`;
        }
    }
    if (weightDateElement) {
        if (weightForecast.predicted_goal_date === null) {
            weightDateElement.textContent = '--';
        } else {
            const date = new Date(weightForecast.predicted_goal_date);
            weightDateElement.textContent = Number.isNaN(date.getTime())
                ? weightForecast.predicted_goal_date
                : date.toLocaleDateString('ru-RU');
        }
    }
}

// Рендер персональных рекомендаций
function renderPersonalRecommendations() {
    if (typeof getUserProfile !== 'function') {
        return;
    }

    const profile = getUserProfile();
    const recommendations = typeof getRecommendations === 'function'
        ? getRecommendations(profile)
        : [];
    const diaryExplanation = typeof getDiaryExplanation === 'function'
        ? getDiaryExplanation(profile)
        : '';
    const caloriesExplanation = typeof getCaloriesExplanation === 'function'
        ? getCaloriesExplanation(profile)
        : '';
    const macrosExplanation = typeof getMacrosExplanation === 'function'
        ? getMacrosExplanation(profile)
        : '';
    const deadlineMotivation = typeof getDeadlineMotivation === 'function'
        ? getDeadlineMotivation(profile)
        : '';

    const listElement = document.getElementById('recommendations-list');
    const diaryElement = document.getElementById('diary-explanation');
    const caloriesElement = document.getElementById('calories-explanation');
    const macrosElement = document.getElementById('macros-explanation');
    const deadlineElement = document.getElementById('deadline-motivation');
    const deadlineWarning = document.getElementById('deadline-warning');

    if (listElement) {
        listElement.innerHTML = '';
        recommendations.forEach((item) => {
            const listItem = document.createElement('li');
            listItem.className = 'flex items-start space-x-2';
            listItem.innerHTML = '<span class=\"text-emerald-500\">•</span>';
            const textNode = document.createElement('span');
            textNode.textContent = item;
            listItem.appendChild(textNode);
            listElement.appendChild(listItem);
        });
    }

    if (diaryElement) {
        diaryElement.textContent = diaryExplanation;
    }
    if (caloriesElement) {
        caloriesElement.textContent = caloriesExplanation;
    }
    if (macrosElement) {
        macrosElement.textContent = macrosExplanation;
    }
    if (deadlineElement) {
        if (deadlineMotivation) {
            deadlineElement.textContent = deadlineMotivation;
            deadlineElement.classList.remove('hidden');
        } else {
            deadlineElement.textContent = '';
            deadlineElement.classList.add('hidden');
        }
    }
    if (deadlineWarning) {
        const deadlineRaw = profile.goal_deadline;
        if (deadlineRaw) {
            const deadlineDate = new Date(deadlineRaw);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            deadlineDate.setHours(0, 0, 0, 0);
            if (!Number.isNaN(deadlineDate.getTime()) && deadlineDate < today) {
                deadlineWarning.textContent = 'Дедлайн уже прошёл. Можно выбрать новую дату, чтобы план был актуальным.';
                deadlineWarning.classList.remove('hidden');
            } else {
                deadlineWarning.textContent = '';
                deadlineWarning.classList.add('hidden');
            }
        } else {
            deadlineWarning.textContent = '';
            deadlineWarning.classList.add('hidden');
        }
    }
}

// Получить AI-рекомендацию и обновить текстовые блоки
async function applyAiRecommendationToResume() {
    if (typeof getUserProfile !== 'function') {
        return;
    }

    const profile = getUserProfile();
    const caloriesElement = document.getElementById('calories-explanation');
    const macrosElement = document.getElementById('macros-explanation');
    const deadlineElement = document.getElementById('deadline-motivation');

    if (!caloriesElement && !macrosElement && !deadlineElement) {
        return;
    }

    try {
        const response = await fetch('/api/ai/recommendation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(profile)
        });
        if (!response.ok) {
            return;
        }
        const data = await response.json();
        const text = data?.text;
        if (!text) {
            return;
        }

        const sentences = text
            .split(/(?<=[.!?])\s+/)
            .map((part) => part.trim())
            .filter(Boolean);

        const caloriesSentence = sentences.find((item) => item.toLowerCase().includes('ккал'));
        const macrosSentence = sentences.find((item) => item.toLowerCase().includes('бжу'));
        const deadlineSentence = sentences.find((item) =>
            item.toLowerCase().includes('дата') || item.toLowerCase().includes('нед')
        );

        if (caloriesElement && caloriesSentence) {
            caloriesElement.textContent = caloriesSentence;
        }
        if (macrosElement && macrosSentence) {
            macrosElement.textContent = macrosSentence;
        }
        if (deadlineElement && deadlineSentence) {
            deadlineElement.textContent = deadlineSentence;
            deadlineElement.classList.remove('hidden');
        }
    } catch (error) {
        return;
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
    const readEntries = (storageKey) => {
        const raw = localStorage.getItem(storageKey);
        if (!raw) {
            return [];
        }
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            return [];
        }
    };

    const today = new Date().toISOString().split('T')[0];
    const manualEntries = readEntries('health_bloom_food_entries');
    const diaryEntries = readEntries('food_diary_entries');

    const sumManual = manualEntries.reduce(
        (acc, entry) => {
            if (entry?.date !== today) {
                return acc;
            }
            acc.calories += Number(entry.calories) || 0;
            acc.protein += Number(entry.protein_g) || 0;
            acc.fat += Number(entry.fat_g) || 0;
            acc.carbs += Number(entry.carbs_g) || 0;
            return acc;
        },
        { calories: 0, protein: 0, fat: 0, carbs: 0 }
    );

    const sumDiary = diaryEntries.reduce(
        (acc, entry) => {
            if (entry?.date !== today || !Array.isArray(entry.items)) {
                return acc;
            }
            entry.items.forEach((item) => {
                acc.calories += Number(item?.calories) || 0;
                acc.protein += Number(item?.protein) || 0;
                acc.fat += Number(item?.fat) || 0;
                acc.carbs += Number(item?.carbs) || 0;
            });
            return acc;
        },
        { calories: 0, protein: 0, fat: 0, carbs: 0 }
    );

    const totals = {
        calories: sumManual.calories + sumDiary.calories,
        protein: sumManual.protein + sumDiary.protein,
        fat: sumManual.fat + sumDiary.fat,
        carbs: sumManual.carbs + sumDiary.carbs,
    };

    const hasEntriesToday = totals.calories > 0 || totals.protein > 0 || totals.fat > 0 || totals.carbs > 0;

    const profile = typeof getUserProfile === 'function' ? getUserProfile() : {};
    const recommended = {
        calories: Number(profile?.tdee_calories) || null,
        protein: Number(profile?.macros?.protein_g) || null,
        fat: Number(profile?.macros?.fat_g) || null,
        carbs: Number(profile?.macros?.carbs_g) || null,
    };

    const buildValue = (consumed, target, unit) => {
        if (!hasEntriesToday) {
            return 'нет записей';
        }
        if (Number.isFinite(target) && target > 0) {
            return `${Math.round(consumed)} / ${Math.round(target)} ${unit}`;
        }
        return `${Math.round(consumed)} ${unit}`;
    };

    const calcPercent = (consumed, target) => {
        if (!hasEntriesToday) {
            return null;
        }
        if (!Number.isFinite(target) || target <= 0) {
            return null;
        }
        return (consumed / target) * 100;
    };

    const rings = [
        {
            id: 'calorie-ring',
            data: {
                percent: calcPercent(totals.calories, recommended.calories),
                value: buildValue(totals.calories, recommended.calories, 'ккал'),
                label: 'Калории сегодня',
                color: '#10b981',
            },
        },
        {
            id: 'water-ring',
            data: {
                percent: null,
                value: 'нет записей',
                label: 'Вода сегодня',
                color: '#38bdf8',
            },
        },
        {
            id: 'macro-protein-ring',
            data: {
                percent: calcPercent(totals.protein, recommended.protein),
                value: buildValue(totals.protein, recommended.protein, 'г'),
                label: 'Белки сегодня',
                color: '#a855f7',
            },
        },
        {
            id: 'macro-fat-ring',
            data: {
                percent: calcPercent(totals.fat, recommended.fat),
                value: buildValue(totals.fat, recommended.fat, 'г'),
                label: 'Жиры сегодня',
                color: '#f59e0b',
            },
        },
        {
            id: 'macro-carb-ring',
            data: {
                percent: calcPercent(totals.carbs, recommended.carbs),
                value: buildValue(totals.carbs, recommended.carbs, 'г'),
                label: 'Углеводы сегодня',
                color: '#06b6d4',
            },
        },
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
    const size = 120;
    const strokeWidth = 10;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const safePercent = Number.isFinite(percent) ? percent : 0;
    const progress = Math.max(0, Math.min(safePercent, 100));

    const wrapper = document.createElement('div');
    wrapper.className = 'flex flex-col items-center text-center gap-2';

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
    const percentText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    percentText.setAttribute('x', '50%');
    percentText.setAttribute('y', '50%');
    percentText.setAttribute('text-anchor', 'middle');
    percentText.setAttribute('dominant-baseline', 'middle');
    percentText.setAttribute('font-size', '16');
    percentText.setAttribute('font-weight', '700');
    percentText.setAttribute('fill', '#0f172a');
    percentText.textContent = Number.isFinite(percent) ? `${Math.round(progress)}%` : '—';

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
async function renderTrialStatus() {
    const statusElement = document.getElementById('trial-status');
    const datesElement = document.getElementById('trial-dates');
    const badgeElement = document.getElementById('trial-badge');
    const warningElement = document.getElementById('trial-warning');
    const paywallElement = document.getElementById('paywall');
    const payButton = document.getElementById('pay-button');
    const trialCard = document.getElementById('trial-card');
    const paymentMotivation = document.getElementById('payment-motivation');
    const recommendationsSection = document.getElementById('recommendations-section');
    const nutritionSection = document.getElementById('nutrition-rings-section');

    if (!statusElement || !datesElement || !badgeElement || !paywallElement || !payButton) {
        return;
    }

    if (typeof getUserProfile !== 'function') {
        statusElement.textContent = 'Не удалось загрузить профиль';
        datesElement.textContent = 'Повторите попытку позже.';
        return;
    }

    const profile = getUserProfile();
    const telegramUserId = profile.telegram_user_id;
    if (!telegramUserId) {
        statusElement.textContent = 'Telegram ID не найден';
        datesElement.textContent = 'Откройте приложение в Telegram, чтобы активировать пробный период.';
        badgeElement.textContent = 'Пробный период до --';
        if (warningElement) {
            warningElement.textContent = '';
            warningElement.classList.add('hidden');
        }
        paywallElement.classList.add('hidden');
        if (recommendationsSection) {
            recommendationsSection.classList.remove('hidden');
        }
        if (nutritionSection) {
            nutritionSection.classList.remove('hidden');
        }
        return;
    }

    const formatDateRu = (iso) => {
        if (!iso) {
            return null;
        }
        const date = new Date(iso);
        if (Number.isNaN(date.getTime())) {
            return null;
        }
        return date.toLocaleDateString('ru-RU');
    };

    const fetchSubscriptionStatus = async () => {
        const response = await fetch(`/api/subscription/status?telegram_user_id=${telegramUserId}`);
        if (!response.ok) {
            throw new Error('Не удалось получить статус подписки.');
        }
        return response.json();
    };

    const startTrial = async () => {
        const response = await fetch('/api/subscription/start_trial', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ telegram_user_id: telegramUserId })
        });
        if (!response.ok) {
            throw new Error('Не удалось запустить пробный период.');
        }
        return response.json();
    };

    const startPayment = async () => {
        const response = await fetch('/api/payments/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ telegram_user_id: telegramUserId, days: 30 })
        });
        if (!response.ok) {
            throw new Error('Не удалось выполнить оплату.');
        }
        return response.json();
    };

    let subscription;
    if (trialCard) {
        trialCard.classList.add('is-loading');
    }
    try {
        subscription = await fetchSubscriptionStatus();
    } catch (error) {
        statusElement.textContent = 'Не удалось загрузить статус подписки';
        datesElement.textContent = 'Попробуйте обновить страницу.';
        badgeElement.textContent = 'Пробный период до --';
        paywallElement.classList.add('hidden');
        if (trialCard) {
            trialCard.classList.remove('is-loading');
        }
        return;
    }

    if (subscription.subscription_status === 'none') {
        try {
            subscription = await startTrial();
        } catch (error) {
            statusElement.textContent = 'Не удалось активировать пробный период';
            datesElement.textContent = 'Попробуйте обновить страницу.';
            badgeElement.textContent = 'Пробный период до --';
            paywallElement.classList.add('hidden');
            if (trialCard) {
                trialCard.classList.remove('is-loading');
            }
            return;
        }
    }
    if (trialCard) {
        trialCard.classList.remove('is-loading');
    }

    const untilDate = formatDateRu(subscription.subscription_until);
    paywallElement.classList.add('hidden');
    badgeElement.textContent = untilDate ? `Пробный период до ${untilDate}` : 'Пробный период до --';
    if (warningElement) {
        warningElement.textContent = '';
        warningElement.classList.add('hidden');
    }

    const isExpired = subscription.subscription_status === 'expired';
    if (recommendationsSection) {
        recommendationsSection.classList.toggle('hidden', isExpired);
    }
    if (nutritionSection) {
        nutritionSection.classList.toggle('hidden', isExpired);
    }

    if (subscription.subscription_status === 'trial') {
        statusElement.textContent = 'Пробный период активен';
        datesElement.textContent = untilDate
            ? `Пробный период действует до ${untilDate}.`
            : 'Даты пробного периода уточняются.';
        if (warningElement && subscription.subscription_until) {
            const endDate = new Date(subscription.subscription_until);
            const now = new Date();
            const diffMs = endDate.getTime() - now.getTime();
            const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
            if (daysLeft <= 3 && daysLeft >= 0) {
                warningElement.textContent = 'Пробный период скоро закончится. Можно заранее оформить подписку.';
                warningElement.classList.remove('hidden');
            }
        }
    } else if (subscription.subscription_status === 'active') {
        statusElement.textContent = 'Подписка активна';
        datesElement.textContent = untilDate
            ? `Подписка действует до ${untilDate}.`
            : 'Даты подписки уточняются.';
        badgeElement.textContent = untilDate ? `Подписка до ${untilDate}` : 'Подписка активна';
    } else if (subscription.subscription_status === 'expired') {
        statusElement.textContent = 'Пробный период завершён';
        datesElement.textContent = untilDate
            ? `Пробный период закончился ${untilDate}.`
            : 'Пробный период завершён.';
        paywallElement.classList.remove('hidden');
        badgeElement.textContent = 'Пробный период завершён';
        if (paymentMotivation && typeof getPaymentMotivation === 'function') {
            const deviations = typeof getFoodDiaryDeviationStatus === 'function'
                ? getFoodDiaryDeviationStatus(profile)
                : null;
            paymentMotivation.textContent = await getPaymentMotivation(profile, deviations);
        }
    } else {
        statusElement.textContent = 'Статус подписки неизвестен';
        datesElement.textContent = 'Попробуйте обновить страницу.';
        badgeElement.textContent = 'Пробный период до --';
    }

    payButton.onclick = async () => {
        try {
            const result = await startPayment();
            if (result?.status === 'success') {
                if (typeof showNotification === 'function') {
                    showNotification('Оплата прошла успешно!', 'success');
                }
                payButton.classList.add('btn-confirmed');
                setTimeout(() => payButton.classList.remove('btn-confirmed'), 900);
                if (typeof patchUserProfile === 'function') {
                    patchUserProfile({
                        subscription_status: result.subscription_status ?? 'active',
                        subscription_until: result.subscription_until ?? subscription.subscription_until
                    });
                }
                await renderTrialStatus();
            }
        } catch (error) {
            if (typeof showNotification === 'function') {
                showNotification('Не удалось выполнить оплату.', 'error');
            }
        }
    };
}

// Рендер кнопок напоминаний для Telegram
function renderReminderActions() {
    const section = document.getElementById('reminders-section');
    const actionsContainer = document.getElementById('reminders-actions');
    const hintElement = document.getElementById('reminders-hint');

    if (!section || !actionsContainer || !hintElement) {
        return;
    }

    if (typeof getUserProfile !== 'function') {
        hintElement.textContent = 'Не удалось загрузить профиль для настройки напоминаний.';
        return;
    }

    const profile = getUserProfile();
    actionsContainer.innerHTML = '';
    hintElement.textContent = '';

    const telegramUserId = profile.telegram_user_id;
    const isTelegramAvailable = telegramUserId !== null && telegramUserId !== undefined;

    if (!isTelegramAvailable) {
        hintElement.textContent = 'Telegram ID не найден. Откройте приложение в Telegram, чтобы включить напоминания.';
    }

    const scheduleReminder = async (payload) => {
        try {
            const response = await fetch('/api/reminders/schedule', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                throw new Error('Ошибка сервера при сохранении напоминания.');
            }
            const data = await response.json();
            if (data?.status === 'scheduled') {
                if (typeof showNotification === 'function') {
                    showNotification('Напоминание сохранено!', 'success');
                }
            } else {
                throw new Error('Ответ сервера не подтверждает сохранение.');
            }
        } catch (error) {
            if (typeof showNotification === 'function') {
                showNotification('Не удалось сохранить напоминание.', 'error');
            }
        }
    };

    const typeLabels = {
        food_diary: 'Дневник питания',
        water: 'Вода',
        weekly_summary: 'Еженедельный обзор',
        goal_deadline: 'Дедлайн цели'
    };

    const renderPreview = (reminder) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'rounded-xl border border-slate-100 bg-slate-50 p-4';

        const title = document.createElement('div');
        title.className = 'text-sm font-semibold text-slate-700';
        title.textContent = typeLabels[reminder.type] || 'Напоминание';

        const text = document.createElement('p');
        text.className = 'text-sm text-slate-600 mt-2';
        text.textContent = reminder.text;

        const actions = document.createElement('div');
        actions.className = 'mt-3 grid grid-cols-2 gap-2';

        const enableButton = document.createElement('button');
        enableButton.type = 'button';
        enableButton.className = `btn-primary ${isTelegramAvailable ? '' : 'opacity-60 cursor-not-allowed'}`;
        enableButton.textContent = 'Включить';
        enableButton.disabled = !isTelegramAvailable;

        const skipButton = document.createElement('button');
        skipButton.type = 'button';
        skipButton.className = 'btn-secondary';
        skipButton.textContent = 'Пропустить';

        enableButton.addEventListener('click', async () => {
            if (!isTelegramAvailable) {
                return;
            }
            await scheduleReminder({
                telegram_user_id: telegramUserId,
                type: reminder.type,
                when_iso: reminder.suggested_time_iso
            });
            wrapper.remove();
        });

        skipButton.addEventListener('click', () => {
            wrapper.remove();
        });

        actions.appendChild(enableButton);
        actions.appendChild(skipButton);
        wrapper.appendChild(title);
        wrapper.appendChild(text);
        wrapper.appendChild(actions);
        actionsContainer.appendChild(wrapper);
    };

    const fetchReminders = async () => {
        try {
            const response = await fetch('/api/reminders/auto-generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    telegram_user_id: telegramUserId ?? 0,
                    user_profile: profile,
                    weekly_review: profile.weekly_review || {}
                })
            });
            if (!response.ok) {
                throw new Error('Не удалось получить список напоминаний.');
            }
            const data = await response.json();
            const reminders = Array.isArray(data?.reminders) ? data.reminders : [];
            if (!reminders.length) {
                hintElement.textContent = 'Пока нет рекомендаций по напоминаниям.';
                return;
            }
            reminders.forEach((reminder) => {
                if (!reminder?.type || !reminder?.text || !reminder?.suggested_time_iso) {
                    return;
                }
                renderPreview(reminder);
            });
        } catch (error) {
            hintElement.textContent = 'Не удалось загрузить превью напоминаний.';
        }
    };

    fetchReminders();
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
        window.location.href = '/profile';
    }, 1000);
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    generateSummary();
    calculateBMI();
    updateCalculatedMetrics();
    renderPersonalRecommendations();
    applyAiRecommendationToResume();
    renderNutritionRings();
    renderTrialStatus();
    renderReminderActions();
    
    // Добавляем обработчик для кнопки сохранения
    const saveButton = document.querySelector('a.btn-primary');
    if (saveButton) {
        saveButton.addEventListener('click', function(event) {
            event.preventDefault();
            saveAndContinue();
        });
    }
});
