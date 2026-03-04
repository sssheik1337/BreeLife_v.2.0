// Отрисовка списка тарифов из JSON

const PLANS_ENDPOINT = '/api/plans';
let cachedPlans = [];
let activePlan = 'free';

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
      cachedPlans = Array.isArray(plans) ? plans : [];
      renderPlans(container, cachedPlans);
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
  card.dataset.plan = plan.id;

  const features = Array.isArray(plan.features) ? plan.features : [];
  const subtitle = plan.duration_days > 0 ? `Срок: ${plan.duration_days} дней` : 'Без ограничений по сроку';
  const currentPrice = plan.price_current || plan.price || '';
  const oldPrice = plan.price_old_enabled && plan.price_old ? plan.price_old : '';
  const isTrial = plan.id === 'trial';
  const isPremium = plan.id === 'premium';
  const isFree = plan.id === 'free';
  const statusText = isTrial
    ? 'Пробный период активируется автоматически'
    : isPremium
      ? 'Оплата подключается, тариф готовится'
      : 'Текущий бесплатный план';
  const isActive = activePlan === plan.id;
  const buttonText = isPremium
    ? 'Доступно в пробном периоде'
    : isActive
      ? 'Выбран'
      : 'Выбрать';

  card.innerHTML = `
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-lg font-semibold text-slate-800">${plan.title}</h2>
        <p class="text-sm text-slate-500">${subtitle}</p>
      </div>
      <div class="text-right">
        ${oldPrice ? `<div class="text-sm text-slate-400 line-through">${oldPrice}</div>` : ''}
        <div class="text-xl font-bold text-emerald-600">${currentPrice}</div>
      </div>
    </div>
    <ul class="space-y-2 text-sm text-slate-600">
      ${features.map((feature) => `<li class="flex items-start gap-2"><span class="text-emerald-500">•</span><span>${feature}</span></li>`).join('')}
    </ul>
    <button class="btn-primary w-full" type="button" data-plan="${plan.id}" ${isPremium ? 'disabled title="Оплата не подключена"' : ''}>
      ${buttonText}
    </button>
    <p class="text-xs text-slate-500">${statusText}</p>
  `;

  const button = card.querySelector('button[data-plan]');
  if (button) {
    button.addEventListener('click', () => {
      if (isPremium) {
        return;
      }
      activePlan = plan.id;
      const message = isTrial
        ? 'Пробный период 30 дней доступен. Оплата не требуется.'
        : 'Бесплатный план выбран.';
      if (typeof showNotification === 'function') {
        showNotification(message, 'success');
      } else {
        alert(message);
      }
      const container = document.getElementById('plans-container');
      if (container) {
        renderPlans(container, cachedPlans);
      }
    });
  }

  return card;
}
