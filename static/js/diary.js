const DIARY_STORAGE_KEY = 'health_bloom_food_entries';

function readDiaryEntries() {
    const raw = localStorage.getItem(DIARY_STORAGE_KEY);
    if (!raw) {
        return [];
    }
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        return [];
    }
}

function saveDiaryEntries(entries) {
    localStorage.setItem(DIARY_STORAGE_KEY, JSON.stringify(entries));
}

function sortEntries(entries) {
    return [...entries].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

function renderDiaryList(entries) {
    const list = document.getElementById('diary-list');
    if (!list) {
        return;
    }
    list.innerHTML = '';
    if (!entries.length) {
        list.innerHTML = '<p class="text-slate-400">Пока нет записей.</p>';
        return;
    }
    entries.forEach((entry) => {
        const item = document.createElement('div');
        item.className = 'bg-slate-50 rounded-xl p-3 border border-slate-100';
        item.innerHTML = `
            <div class="font-semibold text-slate-700">${entry.date}</div>
            <div class="text-slate-500">Калории: ${entry.calories} ккал</div>
            <div class="text-slate-500">Белки, жиры, углеводы: ${entry.protein_g} / ${entry.fat_g} / ${entry.carbs_g} г</div>
        `;
        list.appendChild(item);
    });
}

function setDiaryLoadingState(isLoading) {
    const list = document.getElementById('diary-list');
    const aiSection = document.getElementById('diary-ai-section');
    if (list) {
        list.classList.toggle('is-loading', isLoading);
        if (isLoading) {
            list.innerHTML = `
                <div class="skeleton-line"></div>
                <div class="skeleton-line mt-3"></div>
                <div class="skeleton-line mt-3"></div>
            `;
        }
    }
    if (aiSection) {
        aiSection.classList.toggle('is-loading', isLoading);
    }
}

function setAiComment(insights, advice) {
    const container = document.getElementById('diary-ai-comment');
    if (!container) {
        return;
    }
    container.innerHTML = '';
    if ((!insights || !insights.length) && !advice) {
        container.innerHTML = '<p class="text-slate-400">Добавьте несколько дней, чтобы получить комментарий.</p>';
        return;
    }
    if (Array.isArray(insights)) {
        insights.forEach((text) => {
            const p = document.createElement('p');
            p.textContent = text;
            container.appendChild(p);
        });
    }
    if (advice) {
        const p = document.createElement('p');
        p.className = 'font-semibold text-emerald-700';
        p.textContent = advice;
        container.appendChild(p);
    }
}

function renderDeviationRisk(risk, comment) {
    const indicator = document.getElementById('diary-risk-indicator');
    const label = document.getElementById('diary-risk-label');
    const text = document.getElementById('diary-risk-comment');
    if (!indicator || !label || !text) {
        return;
    }
    const riskMap = {
        low: { label: 'Риск низкий', color: 'bg-emerald-400' },
        medium: { label: 'Риск средний', color: 'bg-yellow-400' },
        high: { label: 'Риск высокий', color: 'bg-rose-500' }
    };
    const resolved = riskMap[risk] || riskMap.low;
    indicator.className = `inline-flex h-3 w-3 rounded-full ${resolved.color}`;
    label.textContent = resolved.label;
    text.textContent = comment || 'Добавьте данные, чтобы увидеть оценку риска.';
}

function updateProfileDeviation(risk, comment) {
    if (typeof patchUserProfile !== 'function') {
        return;
    }
    patchUserProfile({
        deviation_risk: risk || null,
        deviation_comment: comment || null
    });
}

async function toggleDiaryPaywall(isExpired, profile, entriesCount) {
    const paywall = document.getElementById('diary-paywall');
    const paywallText = document.getElementById('diary-paywall-text');
    const paywallButton = document.getElementById('diary-paywall-button');
    const paymentMotivation = document.getElementById('diary-payment-motivation');
    const riskSection = document.getElementById('diary-risk-section');
    const aiSection = document.getElementById('diary-ai-section');

    if (!paywall || !paywallText || !riskSection || !aiSection) {
        return;
    }

    paywall.classList.toggle('hidden', !isExpired);
    riskSection.classList.toggle('hidden', isExpired);
    aiSection.classList.toggle('hidden', isExpired);

    if (isExpired && typeof getPaywallMotivation === 'function') {
        paywallText.textContent = getPaywallMotivation(profile, entriesCount);
    }

    if (isExpired && paymentMotivation && typeof getPaymentMotivation === 'function') {
        const deviations = typeof getFoodDiaryDeviationStatus === 'function'
            ? getFoodDiaryDeviationStatus(profile)
            : null;
        paymentMotivation.textContent = await getPaymentMotivation(profile, deviations);
    }

    if (paywallButton && !paywallButton.dataset.bound) {
        paywallButton.dataset.bound = 'true';
        paywallButton.addEventListener('click', () => {
            showNotification('Оплата скоро будет доступна. Мы сообщим, когда всё готово.', 'success');
        });
    }
}

async function syncEntryWithBackend(entry) {
    const profile = typeof getUserProfile === 'function' ? getUserProfile() : null;
    if (!profile?.telegram_user_id) {
        return;
    }
    await fetch('/api/food-diary/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...entry, telegram_user_id: profile.telegram_user_id })
    });
}

async function loadEntriesFromBackend() {
    const profile = typeof getUserProfile === 'function' ? getUserProfile() : null;
    if (!profile?.telegram_user_id) {
        return [];
    }
    const response = await fetch(`/api/food-diary/list?telegram_user_id=${profile.telegram_user_id}`);
    if (!response.ok) {
        return [];
    }
    const data = await response.json();
    return Array.isArray(data) ? data : [];
}

async function requestAiAnalysis(entries) {
    const profile = typeof getUserProfile === 'function' ? getUserProfile() : null;
    if (!profile) {
        return { insights: [], advice: '' };
    }
    const response = await fetch('/api/food-diary/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            user_profile: profile,
            food_entries: entries
        })
    });
    if (!response.ok) {
        return { insights: [], advice: '' };
    }
    return response.json();
}

async function refreshDiary() {
    setDiaryLoadingState(true);
    const localEntries = readDiaryEntries();
    const backendEntries = await loadEntriesFromBackend();
    const merged = sortEntries([...localEntries, ...backendEntries]);
    const unique = [];
    const seen = new Set();
    merged.forEach((entry) => {
        const key = `${entry.date}-${entry.calories}-${entry.protein_g}-${entry.fat_g}-${entry.carbs_g}`;
        if (!seen.has(key)) {
            seen.add(key);
            unique.push(entry);
        }
    });
    saveDiaryEntries(unique);
    renderDiaryList(unique);
    const profile = typeof getUserProfile === 'function' ? getUserProfile() : null;
    const isExpired = profile?.subscription_status === 'expired';
    await toggleDiaryPaywall(isExpired, profile, unique.length);
    if (isExpired) {
        setDiaryLoadingState(false);
        return;
    }
    const analysis = await requestAiAnalysis(unique.slice(0, 7));
    if (analysis?.text) {
        setAiComment([analysis.text], '');
        renderDeviationRisk(analysis?.deviation_risk, analysis?.deviation_comment);
        updateProfileDeviation(analysis?.deviation_risk, analysis?.deviation_comment);
        setDiaryLoadingState(false);
        return;
    }
    setAiComment(analysis?.insights || [], analysis?.advice || '');
    renderDeviationRisk(analysis?.deviation_risk, analysis?.deviation_comment);
    updateProfileDeviation(analysis?.deviation_risk, analysis?.deviation_comment);
    setDiaryLoadingState(false);
}

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('diary-form');
    const fixButton = document.getElementById('diary-fix-button');
    if (form) {
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const entry = {
                date: document.getElementById('entry-date')?.value || '',
                calories: Number(document.getElementById('entry-calories')?.value || 0),
                protein_g: Number(document.getElementById('entry-protein')?.value || 0),
                fat_g: Number(document.getElementById('entry-fat')?.value || 0),
                carbs_g: Number(document.getElementById('entry-carbs')?.value || 0),
            };
            if (!entry.date) {
                return;
            }
            const entries = readDiaryEntries();
            entries.unshift(entry);
            saveDiaryEntries(entries);
            await syncEntryWithBackend(entry);
            await refreshDiary();
            if (typeof showNotification === 'function') {
                showNotification('Запись добавлена.', 'success');
            }
            form.reset();
        });
    }

    if (fixButton) {
        fixButton.addEventListener('click', () => {
            const commentBlock = document.getElementById('diary-ai-comment');
            if (commentBlock) {
                commentBlock.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    }

    refreshDiary();
});
