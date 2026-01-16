// Отрисовка списка тарифов из JSON

const PLANS_ENDPOINT = '/static/data/plans.json';

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('plans-container');
  if (!container) {
    return;
  }

  container.textContent = 'Загрузка тарифов...';

  fetch(PLANS_ENDPOINT)
    .then((response) => {
      if (!response.ok) {
        throw new Error('Не удалось загрузить тарифы');
      }
      return response.json();
    })
    .then((plans) => {
      renderPlans(container, plans);
    })
    .catch(() => {
      container.textContent = 'Не удалось загрузить тарифы.';
    });
});

function renderPlans(container, plans) {
  container.innerHTML = '';

  plans.forEach((plan) => {
    container.appendChild(createPlanCard(plan));
  });
}

function createPlanCard(plan) {
  const card = document.createElement('div');
  card.className = 'bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4';

  const features = Array.isArray(plan.features) ? plan.features : [];

  card.innerHTML = `
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-lg font-semibold text-slate-800">${plan.title}</h2>
        <p class="text-sm text-slate-500">Срок: ${plan.duration_days} дней</p>
      </div>
      <div class="text-xl font-bold text-emerald-600">${plan.price}</div>
    </div>
    <ul class="space-y-2 text-sm text-slate-600">
      ${features.map((feature) => `<li class="flex items-start gap-2"><span class="text-emerald-500">•</span><span>${feature}</span></li>`).join('')}
    </ul>
    <button class="btn-primary w-full" type="button" disabled title="Оплата подключается">
      Оплата подключается
    </button>
  `;

  return card;
}
