// Скрипты визуальных блоков профиля

function createProgressRing({ percent, size = 120, stroke = 10, color = '#10b981', label, value }) {
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const progress = Math.max(0, Math.min(percent, 100));

    const wrapper = document.createElement('div');
    wrapper.className = 'profile-ring';

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`);

    const backgroundCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    backgroundCircle.setAttribute('cx', size / 2);
    backgroundCircle.setAttribute('cy', size / 2);
    backgroundCircle.setAttribute('r', radius);
    backgroundCircle.setAttribute('stroke', '#e2e8f0');
    backgroundCircle.setAttribute('stroke-width', stroke);
    backgroundCircle.setAttribute('fill', 'none');

    const progressCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    progressCircle.setAttribute('cx', size / 2);
    progressCircle.setAttribute('cy', size / 2);
    progressCircle.setAttribute('r', radius);
    progressCircle.setAttribute('stroke', color);
    progressCircle.setAttribute('stroke-width', stroke);
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
    percentText.textContent = `${Math.round(progress)}%`;

    svg.appendChild(backgroundCircle);
    svg.appendChild(progressCircle);
    svg.appendChild(percentText);

    const labelNode = document.createElement('div');
    labelNode.className = 'text-sm font-semibold text-slate-700';
    labelNode.textContent = label;

    const valueNode = document.createElement('div');
    valueNode.className = 'text-xs text-slate-500';
    valueNode.textContent = value;

    wrapper.appendChild(svg);
    wrapper.appendChild(labelNode);
    wrapper.appendChild(valueNode);

    requestAnimationFrame(() => {
        progressCircle.style.transition = 'stroke-dashoffset 1.2s ease-out';
        progressCircle.setAttribute('stroke-dashoffset', `${circumference - (progress / 100) * circumference}`);
    });

    return wrapper;
}

function renderProfileRings() {
    const caloriesContainer = document.getElementById('profile-calories-ring');
    const macrosContainer = document.getElementById('profile-macros-rings');
    const waterContainer = document.getElementById('profile-water-ring');

    if (!caloriesContainer || !macrosContainer || !waterContainer) {
        return;
    }

    const profile = typeof getUserProfile === 'function' ? getUserProfile() : {};
    const tdee = Number(profile?.tdee_calories);
    const caloriesBase = Number.isFinite(tdee) ? tdee : 2000;
    const caloriesValue = Math.round(caloriesBase * 0.6);

    caloriesContainer.innerHTML = '';
    caloriesContainer.appendChild(
        createProgressRing({
            percent: 60,
            color: '#10b981',
            label: 'Калории',
            value: `${caloriesValue} / ${Math.round(caloriesBase)} ккал`
        })
    );

    const macros = profile?.macros || { protein_pct: 0.3, fat_pct: 0.25, carbs_pct: 0.45 };
    const macroItems = [
        {
            label: 'Белки',
            percent: Math.round((macros.protein_pct || 0.3) * 100),
            color: '#a855f7'
        },
        {
            label: 'Жиры',
            percent: Math.round((macros.fat_pct || 0.25) * 100),
            color: '#f59e0b'
        },
        {
            label: 'Углеводы',
            percent: Math.round((macros.carbs_pct || 0.45) * 100),
            color: '#06b6d4'
        }
    ];

    macrosContainer.innerHTML = '';
    macroItems.forEach((item) => {
        macrosContainer.appendChild(
            createProgressRing({
                percent: item.percent,
                color: item.color,
                label: item.label,
                value: `${item.percent}%`
            })
        );
    });

    const waterCurrent = 1.2;
    const waterTarget = 2.0;
    const waterPercent = Math.round((waterCurrent / waterTarget) * 100);

    waterContainer.innerHTML = '';
    waterContainer.appendChild(
        createProgressRing({
            percent: waterPercent,
            color: '#38bdf8',
            label: 'Вода',
            value: `${waterCurrent} / ${waterTarget} л`
        })
    );
}

function renderMonthGrid() {
    const container = document.getElementById('profile-month-grid');
    if (!container) {
        return;
    }

    container.innerHTML = '';
    const days = 30;
    for (let i = 1; i <= days; i += 1) {
        const day = document.createElement('div');
        day.className = 'month-day';
        if (i % 3 === 0 || i % 5 === 0) {
            day.classList.add('month-day--active');
        }
        day.textContent = i;
        container.appendChild(day);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    renderProfileRings();
    renderMonthGrid();
});
