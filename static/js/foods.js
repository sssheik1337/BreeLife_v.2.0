// Отрисовка списка продуктов из JSON

const PRODUCTS_ENDPOINT = '/static/data/products.json';

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
  container.innerHTML = '';

  Object.keys(groups).forEach((groupName) => {
    const groupSection = document.createElement('section');
    groupSection.className = 'space-y-4';

    const header = document.createElement('div');
    header.className = 'flex items-center justify-between';
    header.innerHTML = `
      <h2 class="text-lg font-semibold text-slate-800">${groupName}</h2>
      <span class="text-sm text-slate-400">${groups[groupName].length} поз.</span>
    `;

    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-1 gap-4';

    groups[groupName].forEach((product) => {
      grid.appendChild(createProductCard(product));
    });

    groupSection.appendChild(header);
    groupSection.appendChild(grid);
    container.appendChild(groupSection);
  });
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
