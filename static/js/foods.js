// Отрисовка списка продуктов из админской SQLite-базы через API.

const PRODUCTS_ENDPOINT = '/api/products';
const DEFAULT_OPEN_GROUPS = 2;

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('foods-container');
  if (!container) {
    return;
  }

  container.textContent = 'Загрузка списка продуктов...';

  fetch(PRODUCTS_ENDPOINT)
    .then((response) => {
      if (!response.ok) {
        throw new Error('Не удалось загрузить данные');
      }
      return response.json();
    })
    .then((products) => {
      renderProducts(container, products);
    })
    .catch(() => {
      container.textContent = 'Не удалось загрузить список продуктов.';
    });
});

function renderProducts(container, products) {
  const groups = groupBy(products, 'group');
  const groupEntries = Object.entries(groups);

  container.innerHTML = '';

  groupEntries.forEach(([groupName, groupProducts], index) => {
    const groupId = `foods-group-${index}`;
    const isInitiallyOpen = index < DEFAULT_OPEN_GROUPS;

    const groupSection = document.createElement('section');
    groupSection.className = 'space-y-3 rounded-2xl border border-slate-100 bg-white/70 p-3 shadow-sm';

    const headerButton = document.createElement('button');
    headerButton.type = 'button';
    headerButton.dataset.action = 'toggle-group';
    headerButton.setAttribute('aria-controls', groupId);
    headerButton.className = 'w-full flex items-center justify-between rounded-xl px-2 py-2 transition-colors duration-200 hover:bg-slate-50';

    const chevron = `
      <svg class="h-4 w-4 text-slate-400 transition-transform duration-300 ease-out" data-group-chevron viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.51a.75.75 0 01-1.08 0l-4.25-4.51a.75.75 0 01.02-1.06z" clip-rule="evenodd"/>
      </svg>
    `;

    headerButton.innerHTML = `
      <span class="flex items-center gap-3">
        <span class="text-lg font-semibold text-slate-800">${groupName}</span>
        <span class="text-sm text-slate-400">${groupProducts.length} поз.</span>
      </span>
      ${chevron}
    `;

    const groupBody = document.createElement('div');
    groupBody.id = groupId;
    groupBody.className = 'overflow-hidden transition-all duration-300 ease-out';

    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-1 gap-4 pt-2';

    groupProducts.forEach((product) => {
      grid.appendChild(createProductCard(product));
    });

    groupBody.appendChild(grid);
    groupSection.appendChild(headerButton);
    groupSection.appendChild(groupBody);
    container.appendChild(groupSection);

    setGroupExpanded(groupBody, headerButton, isInitiallyOpen);

    headerButton.addEventListener('click', () => {
      const expanded = headerButton.getAttribute('aria-expanded') === 'true';
      setGroupExpanded(groupBody, headerButton, !expanded);
    });
  });
}

function setGroupExpanded(groupBody, headerButton, expanded) {
  const chevron = headerButton.querySelector('[data-group-chevron]');
  headerButton.setAttribute('aria-expanded', expanded ? 'true' : 'false');

  if (expanded) {
    groupBody.style.maxHeight = `${groupBody.scrollHeight}px`;
    groupBody.style.opacity = '1';
    groupBody.style.transform = 'translateY(0px)';
  } else {
    groupBody.style.maxHeight = '0px';
    groupBody.style.opacity = '0';
    groupBody.style.transform = 'translateY(-4px)';
  }

  if (chevron) {
    chevron.classList.toggle('rotate-180', expanded);
  }
}

function groupBy(items, key) {
  return items.reduce((result, item) => {
    const group = item[key] || 'Без группы';
    if (!result[group]) {
      result[group] = [];
    }
    result[group].push(item);
    return result;
  }, {});
}

function createProductCard(product) {
  const card = document.createElement('div');
  card.className = 'bg-white rounded-2xl p-5 border border-slate-100 shadow-sm';

  const indicatorClass = getHealthIndicatorClass(product.health_level);
  const hasFiber = Array.isArray(product.tags) && product.tags.includes('клетчатка');

  card.innerHTML = `
    <div class="flex items-center justify-between">
      <div>
        <div class="text-base font-semibold text-slate-800">${product.name}</div>
        <div class="text-sm text-slate-500">${product.group}</div>
      </div>
      <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${indicatorClass}"></span>
    </div>
    <div class="flex flex-wrap gap-2 mt-4">
      ${hasFiber ? '<span class="px-2 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-600">клетчатка</span>' : ''}
      ${renderTags(product.tags)}
    </div>
  `;

  return card;
}

function getHealthIndicatorClass(level) {
  switch (level) {
    case 'good':
      return 'bg-emerald-100 text-emerald-700';
    case 'medium':
      return 'bg-amber-100 text-amber-700';
    case 'bad':
      return 'bg-rose-100 text-rose-700';
    default:
      return 'bg-slate-100 text-slate-600';
  }
}

function renderTags(tags) {
  if (!Array.isArray(tags)) {
    return '';
  }

  return tags
    .filter((tag) => tag !== 'клетчатка')
    .map((tag) => `<span class="px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">${tag}</span>`)
    .join('');
}
