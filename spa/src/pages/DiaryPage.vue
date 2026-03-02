<template>
  <section class="min-h-screen bg-gradient-to-br from-[#f8fafc] via-[#f0f9ff] to-[#f0fdf4]">
    <main class="flex-1 px-4 py-8">
      <div class="max-w-md mx-auto space-y-6">
        <div class="text-center">
          <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-400 mb-4 shadow-lg">
            <i data-feather="book-open" class="w-7 h-7 text-white"></i>
          </div>
          <h1 class="text-2xl font-bold text-slate-800">Дневник питания</h1>
          <p class="text-slate-500 mt-2">Добавляйте продукты по приёмам пищи и редактируйте записи через кнопку "+".</p>
        </div>

        <div id="diary-mode-day" class="bg-white rounded-2xl p-4 shadow-lg border border-slate-100">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 class="font-semibold text-slate-800">Приёмы пищи по дате</h3>
              <p class="text-sm text-slate-500">Выберите дату и добавляйте продукты в завтрак, обед, ужин или перекус.</p>
            </div>
            <input
              id="diary-day-date"
              v-model="selectedDate"
              type="date"
              class="form-input w-auto"
              required
              @change="onDateChanged"
            >
          </div>
          <p id="diary-day-hint" class="text-sm text-slate-500 mt-3">{{ dayHint }}</p>
        </div>

        <div id="diary-meals" class="space-y-3">
          <div
            v-for="card in mealCards"
            :key="card.key"
            class="bg-white rounded-2xl p-4 shadow-lg border border-slate-100"
          >
            <div class="flex items-center justify-between">
              <span class="font-semibold text-slate-800">{{ card.label }}</span>
              <span :id="`diary-meal-${card.key}-total`" class="text-xs text-slate-500">{{ card.totalText }}</span>
            </div>
            <div :id="`diary-meal-${card.key}-list`" class="mt-3 space-y-2 text-sm text-slate-600">
              <template v-if="card.entry && card.entry.items.length">
                <div
                  v-for="(item, index) in card.entry.items"
                  :key="`${card.key}-${index}-${item.name}`"
                  class="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"
                >
                  <span>{{ item.name }}</span>
                  <span class="text-xs text-slate-500">{{ Math.round(item.grams || 0) }} г</span>
                </div>
                <p class="text-xs text-slate-500">Б {{ Math.round(card.entry.totals.protein_g) }} • Ж {{ Math.round(card.entry.totals.fat_g) }} • У {{ Math.round(card.entry.totals.carbs_g) }}</p>
                <button type="button" class="text-emerald-600 font-semibold" @click="openProductsForm(card.key, 'meal', true)">Редактировать</button>
              </template>
              <template v-else>
                <p class="text-slate-400">Нет записи за эту дату.</p>
                <button type="button" class="text-emerald-600 font-semibold" @click="openProductsForm(card.key, 'meal', false)">Добавить</button>
              </template>
            </div>
          </div>
        </div>

        <div id="diary-products-panel" class="diary-panel" :class="{ hidden: !productsPanelOpen }">
          <div class="diary-panel__card">
            <div class="flex items-center justify-between">
              <h3 class="font-semibold text-slate-800">{{ panelTitle }}</h3>
              <button type="button" id="diary-products-close" class="btn-secondary" @click="closeProductsPanel">Закрыть</button>
            </div>

            <form id="diary-products-form" class="space-y-4 mt-4" @submit.prevent="submitProductsForm">
              <input id="diary-products-date" v-model="form.date" type="date" class="form-input" required>

              <div id="diary-products-meta" :class="{ hidden: productsFormContext !== 'water' }">
                <input id="diary-products-sleep" v-model="form.sleep_time" type="time" class="form-input" placeholder="Сон, время отхода">
                <input id="diary-products-water" v-model="form.water_l" type="number" class="form-input" placeholder="Вода, л" min="0" step="0.01">
                <div class="grid grid-cols-3 gap-2 mt-2">
                  <button type="button" class="btn-secondary text-xs" @click="applyQuickWater(0.25)">+250 мл</button>
                  <button type="button" class="btn-secondary text-xs" @click="applyQuickWater(0.5)">+500 мл</button>
                  <button type="button" class="btn-secondary text-xs" @click="applyQuickWater(1)">+1 л</button>
                </div>
                <label class="flex items-center gap-2 text-sm text-slate-600">
                  <input id="diary-products-activity" v-model="form.activity" type="checkbox" class="form-checkbox">
                  <span>Сегодня была активность</span>
                </label>
              </div>

              <select id="diary-products-meal" v-model="form.meal" class="form-input" required @change="onMealChanged">
                <option value="breakfast">Завтрак</option>
                <option value="lunch">Обед</option>
                <option value="dinner">Ужин</option>
                <option value="snack">Перекус</option>
                <option value="water">Вода</option>
              </select>

              <div id="diary-products-items" class="space-y-3" :class="{ hidden: productsFormContext === 'water' }">
                <div
                  v-for="row in productRows"
                  :key="row.id"
                  class="food-item-row grid grid-cols-1 gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3"
                >
                  <div class="relative">
                    <input
                      v-model="row.query"
                      type="text"
                      class="form-input"
                      placeholder="Название продукта"
                      required
                      @input="onProductQueryInput(row.id)"
                    >
                    <div
                      class="absolute left-0 right-0 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg"
                      :class="{ hidden: !row.suggestions.length }"
                    >
                      <button
                        v-for="item in row.suggestions"
                        :key="`${row.id}-${item.id}`"
                        type="button"
                        class="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
                        @click="selectProductSuggestion(row.id, item)"
                      >
                        <div class="font-medium text-slate-700">{{ item.name }}</div>
                        <div class="text-xs text-slate-500">{{ Math.round(item.calories || 0) }} ккал / 100 г</div>
                      </button>
                    </div>
                  </div>

                  <input
                    v-model.number="row.grams"
                    type="number"
                    class="form-input"
                    placeholder="Граммы"
                    min="1"
                    step="1"
                    required
                    @input="recalculateRow(row.id)"
                  >

                  <div class="rounded-xl border border-slate-100 bg-white/80 px-3 py-2 text-sm text-slate-600">
                    <div class="flex items-center justify-between">
                      <span>Белки</span>
                      <span class="font-medium text-slate-800">{{ Math.round(row.protein || 0) }} г</span>
                    </div>
                    <div class="flex items-center justify-between">
                      <span>Жиры</span>
                      <span class="font-medium text-slate-800">{{ Math.round(row.fat || 0) }} г</span>
                    </div>
                    <div class="flex items-center justify-between">
                      <span>Углеводы</span>
                      <span class="font-medium text-slate-800">{{ Math.round(row.carbs || 0) }} г</span>
                    </div>
                  </div>

                  <button type="button" class="self-end text-xs text-rose-500 font-semibold" @click="removeProductRow(row.id)">Удалить продукт</button>
                </div>
              </div>

              <button
                id="diary-add-item"
                type="button"
                class="btn-secondary w-full"
                :class="{ hidden: productsFormContext === 'water' }"
                @click="addProductRow"
              >
                Добавить продукт
              </button>

              <button type="submit" class="btn-primary w-full">{{ submitLabel }}</button>

              <button
                id="diary-products-delete"
                type="button"
                class="btn-secondary w-full"
                :class="{ hidden: productsFormContext === 'water' || !hasExistingMealEntry }"
                @click="deleteCurrentMeal"
              >
                Удалить приём пищи
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>

  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useStorageStore } from '../stores/storageStore';

type MealKey = 'breakfast' | 'lunch' | 'dinner' | 'snack';
type ModeKey = 'day' | 'products';

interface ProductSuggestion {
  id: string;
  product_id: number | null;
  name: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  carbs_simple: number;
  carbs_complex: number;
  fiber: number;
}

interface ProductRow {
  id: string;
  query: string;
  product_id: number | null;
  grams: number;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  carbs_simple: number;
  carbs_complex: number;
  fiber: number;
  per100_calories: number;
  per100_protein: number;
  per100_fat: number;
  per100_carbs: number;
  per100_carbs_simple: number;
  per100_carbs_complex: number;
  per100_fiber: number;
  searchToken: number;
  suggestions: ProductSuggestion[];
}

interface DiaryTotals {
  calories: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  carbs_simple_g: number;
  carbs_complex_g: number;
  fiber_g: number;
}

interface DiaryEntryItem {
  product_id: number | null;
  name: string;
  grams: number;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  carbs_simple: number;
  carbs_complex: number;
  fiber: number;
  per100_calories: number;
  per100_protein: number;
  per100_fat: number;
  per100_carbs: number;
  per100_carbs_simple: number;
  per100_carbs_complex: number;
  per100_fiber: number;
}

interface DiaryEntry {
  date: string;
  mode?: string;
  meal?: string | null;
  items?: DiaryEntryItem[];
  totals?: DiaryTotals;
  calories?: number;
  protein_g?: number;
  fat_g?: number;
  carbs_g?: number;
  carbs_simple_g?: number;
  carbs_complex_g?: number;
  fiber_g?: number;
  water_l?: number;
  sleep_time?: string | null;
  activity?: boolean;
}

const route = useRoute();
const router = useRouter();
const storage = useStorageStore();

const selectedDate = ref('');
const productsPanelOpen = ref(false);
const productsFormContext = ref<'meal' | 'water'>('meal');

const form = reactive({
  date: '',
  meal: 'breakfast' as MealKey | 'water',
  water_l: '',
  sleep_time: '',
  activity: false
});

const productRows = ref<ProductRow[]>([]);

const mealMeta: Array<{ key: MealKey; label: string }> = [
  { key: 'breakfast', label: '☀️ Завтрак' },
  { key: 'lunch', label: '🌤 Обед' },
  { key: 'dinner', label: '🌙 Ужин' },
  { key: 'snack', label: '🌗 Перекус' }
];

const dayHint = computed(() => {
  const entries = getEntriesByDate(selectedDate.value);
  if (!entries.length) {
    return 'За выбранную дату пока нет записей.';
  }
  const calories = entries.reduce((sum, entry) => sum + resolveTotals(entry).calories, 0);
  return `Записей за день: ${entries.length}, суммарно ${Math.round(calories)} ккал.`;
});

const submitLabel = computed(() => (productsFormContext.value === 'water' ? 'Сохранить воду' : 'Сохранить приём пищи'));
const panelTitle = computed(() => (productsFormContext.value === 'water' ? 'Добавить воду' : 'Добавить приём пищи'));

const diaryEntries = computed(() => {
  const entries = Array.isArray(storage.diaryEntries) ? storage.diaryEntries : [];
  return entries as DiaryEntry[];
});

const mealCards = computed(() => {
  return mealMeta.map(({ key, label }) => {
    const entry = pickProductsEntry(selectedDate.value, key);
    const totals = entry ? resolveTotals(entry) : emptyTotals();
    return {
      key,
      label,
      entry,
      totalText: entry ? `${Math.round(totals.calories)} ккал` : ''
    };
  });
});

const hasExistingMealEntry = computed(() => {
  if (productsFormContext.value === 'water') {
    return false;
  }
  return Boolean(findProductsEntry(form.date, form.meal as MealKey));
});

const normalizeDate = (value: unknown): string => {
  return storage.normalizeLocalDate(String(value ?? '')) || '';
};

const todayDate = (): string => normalizeDate(new Date().toISOString());

const emptyTotals = (): DiaryTotals => ({
  calories: 0,
  protein_g: 0,
  fat_g: 0,
  carbs_g: 0,
  carbs_simple_g: 0,
  carbs_complex_g: 0,
  fiber_g: 0
});

const resolveCarbTotals = (totalValue: unknown, simpleValue: unknown, complexValue: unknown) => {
  const total = Number(totalValue) || 0;
  let simple = Number(simpleValue) || 0;
  let complex = Number(complexValue) || 0;
  if (simple > 0 && complex === 0 && total > simple) {
    complex = total - simple;
  }
  if (complex > 0 && simple === 0 && total > complex) {
    simple = total - complex;
  }
  if (simple > 0 || complex > 0) {
    return { total: simple + complex, simple, complex };
  }
  if (total > 0) {
    return { total, simple: 0, complex: total };
  }
  return { total: 0, simple: 0, complex: 0 };
};

const resolveTotals = (entry: DiaryEntry): DiaryTotals => {
  if (entry.totals && typeof entry.totals === 'object') {
    const resolved = resolveCarbTotals(entry.totals.carbs_g, entry.totals.carbs_simple_g, entry.totals.carbs_complex_g);
    return {
      calories: Number(entry.totals.calories) || 0,
      protein_g: Number(entry.totals.protein_g) || 0,
      fat_g: Number(entry.totals.fat_g) || 0,
      carbs_g: resolved.total,
      carbs_simple_g: resolved.simple,
      carbs_complex_g: resolved.complex,
      fiber_g: Number(entry.totals.fiber_g) || 0
    };
  }
  const resolved = resolveCarbTotals(entry.carbs_g, entry.carbs_simple_g, entry.carbs_complex_g);
  return {
    calories: Number(entry.calories) || 0,
    protein_g: Number(entry.protein_g) || 0,
    fat_g: Number(entry.fat_g) || 0,
    carbs_g: resolved.total,
    carbs_simple_g: resolved.simple,
    carbs_complex_g: resolved.complex,
    fiber_g: Number(entry.fiber_g) || 0
  };
};

const getEntriesByDate = (dateKey: string): DiaryEntry[] => {
  if (!dateKey) {
    return [];
  }
  return diaryEntries.value.filter((entry) => normalizeDate(entry.date) === dateKey);
};

const findProductsEntry = (dateKey: string, meal: MealKey): DiaryEntry | null => {
  return getEntriesByDate(dateKey).find((entry) => entry.mode === 'products' && entry.meal === meal) || null;
};

const pickProductsEntry = (dateKey: string, meal: MealKey): (DiaryEntry & { totals: DiaryTotals; items: DiaryEntryItem[] }) | null => {
  const matches = getEntriesByDate(dateKey)
    .filter((entry) => entry.mode === 'products' && entry.meal === meal)
    .map((entry) => ({
      ...entry,
      totals: resolveTotals(entry),
      items: Array.isArray(entry.items) ? entry.items : []
    }));
  if (!matches.length) {
    return null;
  }
  return matches.reduce((best, current) => (current.totals.calories >= best.totals.calories ? current : best));
};

const createEmptyRow = (): ProductRow => {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    query: '',
    product_id: null,
    grams: 100,
    calories: 0,
    protein: 0,
    fat: 0,
    carbs: 0,
    carbs_simple: 0,
    carbs_complex: 0,
    fiber: 0,
    per100_calories: 0,
    per100_protein: 0,
    per100_fat: 0,
    per100_carbs: 0,
    per100_carbs_simple: 0,
    per100_carbs_complex: 0,
    per100_fiber: 0,
    searchToken: 0,
    suggestions: []
  };
};

const addProductRow = () => {
  productRows.value = [...productRows.value, createEmptyRow()];
};

const removeProductRow = (rowId: string) => {
  productRows.value = productRows.value.filter((row) => row.id !== rowId);
  if (!productRows.value.length && productsFormContext.value === 'meal') {
    addProductRow();
  }
};

const recalculateRow = (rowId: string) => {
  productRows.value = productRows.value.map((row) => {
    if (row.id !== rowId) {
      return row;
    }
    const grams = Number(row.grams) || 0;
    const factor = grams > 0 ? grams / 100 : 0;
    const carbs = (Number(row.per100_carbs) || 0) * factor;
    const simple = (Number(row.per100_carbs_simple) || 0) * factor;
    const complex = (Number(row.per100_carbs_complex) || 0) * factor;
    return {
      ...row,
      calories: (Number(row.per100_calories) || 0) * factor,
      protein: (Number(row.per100_protein) || 0) * factor,
      fat: (Number(row.per100_fat) || 0) * factor,
      carbs,
      carbs_simple: simple,
      carbs_complex: complex > 0 || simple > 0 ? complex : carbs,
      fiber: (Number(row.per100_fiber) || 0) * factor
    };
  });
};

const mapSuggestion = (raw: Record<string, unknown>): ProductSuggestion => {
  const carbs = Number(raw.carbs ?? raw.carbs_g) || 0;
  const simple = Number(raw.carbs_simple ?? raw.carbs_simple_g) || 0;
  const complex = Number(raw.carbs_complex ?? raw.carbs_complex_g) || 0;
  return {
    id: String(raw.id ?? raw.product_id ?? raw.name ?? Math.random()),
    product_id: Number.isFinite(Number(raw.product_id ?? raw.id)) ? Number(raw.product_id ?? raw.id) : null,
    name: String(raw.name ?? '').trim(),
    calories: Number(raw.calories ?? raw.kcal) || 0,
    protein: Number(raw.protein ?? raw.protein_g) || 0,
    fat: Number(raw.fat ?? raw.fat_g) || 0,
    carbs,
    carbs_simple: simple,
    carbs_complex: complex > 0 || simple > 0 ? complex : carbs,
    fiber: Number(raw.fiber ?? raw.fiber_g) || 0
  };
};

const requestProductSearch = async (query: string): Promise<ProductSuggestion[]> => {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return [];
  }
  const response = await storage.apiFetch(`/api/products/search?q=${encodeURIComponent(trimmed)}`);
  if (!response.ok) {
    return [];
  }
  const data = await response.json();
  const exact = Array.isArray(data?.exact) ? data.exact : [];
  const similar = Array.isArray(data?.similar) ? data.similar : [];
  const fallbackList = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
  const list = [...exact, ...similar, ...fallbackList];
  const seen = new Set<string>();
  return list
    .filter((item: unknown) => item && typeof item === 'object')
    .map((item: unknown) => mapSuggestion(item as Record<string, unknown>))
    .filter((item) => item.name.length > 0)
    .filter((item) => {
      const key = `${item.product_id ?? 'null'}::${item.name.toLowerCase()}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .slice(0, 20);
};

const onProductQueryInput = async (rowId: string) => {
  const row = productRows.value.find((item) => item.id === rowId);
  if (!row) {
    return;
  }
  const token = row.searchToken + 1;
  row.searchToken = token;
  const suggestions = await requestProductSearch(row.query);
  const latest = productRows.value.find((item) => item.id === rowId);
  if (!latest || latest.searchToken !== token) {
    return;
  }
  latest.suggestions = suggestions;
};

const selectProductSuggestion = (rowId: string, product: ProductSuggestion) => {
  productRows.value = productRows.value.map((row) => {
    if (row.id !== rowId) {
      return row;
    }
    const updated: ProductRow = {
      ...row,
      query: product.name,
      product_id: product.product_id,
      per100_calories: product.calories,
      per100_protein: product.protein,
      per100_fat: product.fat,
      per100_carbs: product.carbs,
      per100_carbs_simple: product.carbs_simple,
      per100_carbs_complex: product.carbs_complex,
      per100_fiber: product.fiber,
      suggestions: []
    };
    const grams = Number(updated.grams) || 0;
    const factor = grams > 0 ? grams / 100 : 0;
    updated.calories = updated.per100_calories * factor;
    updated.protein = updated.per100_protein * factor;
    updated.fat = updated.per100_fat * factor;
    updated.carbs = updated.per100_carbs * factor;
    updated.carbs_simple = updated.per100_carbs_simple * factor;
    const complexByFactor = updated.per100_carbs_complex * factor;
    updated.carbs_complex = complexByFactor > 0 || updated.carbs_simple > 0 ? complexByFactor : updated.carbs;
    updated.fiber = updated.per100_fiber * factor;
    return updated;
  });
};

const collectFoodItems = (): DiaryEntryItem[] => {
  return productRows.value
    .filter((row) => row.query.trim().length > 0 && (Number(row.grams) || 0) > 0)
    .map((row) => ({
      product_id: row.product_id,
      name: row.query.trim(),
      grams: Number(row.grams) || 0,
      calories: Number(row.calories) || 0,
      protein: Number(row.protein) || 0,
      fat: Number(row.fat) || 0,
      carbs: Number(row.carbs) || 0,
      carbs_simple: Number(row.carbs_simple) || 0,
      carbs_complex: Number(row.carbs_complex) || 0,
      fiber: Number(row.fiber) || 0,
      per100_calories: Number(row.per100_calories) || 0,
      per100_protein: Number(row.per100_protein) || 0,
      per100_fat: Number(row.per100_fat) || 0,
      per100_carbs: Number(row.per100_carbs) || 0,
      per100_carbs_simple: Number(row.per100_carbs_simple) || 0,
      per100_carbs_complex: Number(row.per100_carbs_complex) || 0,
      per100_fiber: Number(row.per100_fiber) || 0
    }));
};

const calculateTotals = (items: DiaryEntryItem[]): DiaryTotals => {
  return items.reduce(
    (acc, item) => {
      const carbs = resolveCarbTotals(item.carbs, item.carbs_simple, item.carbs_complex);
      acc.calories += Number(item.calories) || 0;
      acc.protein_g += Number(item.protein) || 0;
      acc.fat_g += Number(item.fat) || 0;
      acc.carbs_g += carbs.total;
      acc.carbs_simple_g += carbs.simple;
      acc.carbs_complex_g += carbs.complex;
      acc.fiber_g += Number(item.fiber) || 0;
      return acc;
    },
    emptyTotals()
  );
};

const updateDateQuery = async (mode: ModeKey, meal?: string) => {
  const query: Record<string, string> = {
    ...(typeof selectedDate.value === 'string' && selectedDate.value ? { date: selectedDate.value } : {}),
    mode
  };
  if (meal) {
    query.meal = meal;
  }
  await router.replace({ path: '/diary', query });
};

const onDateChanged = async () => {
  form.date = selectedDate.value;
  await updateDateQuery(productsPanelOpen.value ? 'products' : 'day', productsPanelOpen.value ? form.meal : undefined);
};

const applyQuickWater = (value: number) => {
  const current = Number(form.water_l) || 0;
  form.water_l = (current + value).toFixed(2);
};

const onMealChanged = () => {
  if (form.meal === 'water') {
    productsFormContext.value = 'water';
    return;
  }
  productsFormContext.value = 'meal';
  hydrateFormFromExistingMeal(form.date, form.meal as MealKey, true);
};

const openProductsForm = async (meal: MealKey, context: 'meal' | 'water', prefillExisting: boolean) => {
  productsPanelOpen.value = true;
  productsFormContext.value = context;
  form.date = selectedDate.value;
  form.meal = context === 'water' ? 'water' : meal;
  if (context === 'water') {
    hydrateFormMetaForDate(form.date);
  } else {
    hydrateFormFromExistingMeal(form.date, meal, prefillExisting);
  }
  await updateDateQuery('products', form.meal);
};

const closeProductsPanel = async () => {
  productsPanelOpen.value = false;
  productsFormContext.value = 'meal';
  await updateDateQuery('day');
};

const hydrateFormMetaForDate = (dateKey: string) => {
  const dateEntries = getEntriesByDate(dateKey);
  const maxWater = dateEntries.reduce((maxValue, entry) => Math.max(maxValue, Number(entry.water_l) || 0), 0);
  const firstSleep = dateEntries.map((entry) => String(entry.sleep_time || '')).find((value) => value.length > 0) || '';
  const hasActivity = dateEntries.some((entry) => entry.activity === true);
  form.water_l = maxWater > 0 ? maxWater.toFixed(2) : '';
  form.sleep_time = firstSleep;
  form.activity = hasActivity;
};

const hydrateFormFromExistingMeal = (dateKey: string, meal: MealKey, prefillExisting: boolean) => {
  const existing = findProductsEntry(dateKey, meal);
  hydrateFormMetaForDate(dateKey);
  if (!prefillExisting || !existing || !Array.isArray(existing.items) || !existing.items.length) {
    productRows.value = [createEmptyRow()];
    return;
  }
  productRows.value = existing.items.map((item) => {
    const row = createEmptyRow();
    row.query = String(item.name || '');
    row.product_id = item.product_id ?? null;
    row.grams = Number(item.grams) || 0;
    row.per100_calories = Number(item.per100_calories) || 0;
    row.per100_protein = Number(item.per100_protein) || 0;
    row.per100_fat = Number(item.per100_fat) || 0;
    row.per100_carbs = Number(item.per100_carbs) || 0;
    row.per100_carbs_simple = Number(item.per100_carbs_simple) || 0;
    row.per100_carbs_complex = Number(item.per100_carbs_complex) || 0;
    row.per100_fiber = Number(item.per100_fiber) || 0;
    row.calories = Number(item.calories) || 0;
    row.protein = Number(item.protein) || 0;
    row.fat = Number(item.fat) || 0;
    row.carbs = Number(item.carbs) || 0;
    row.carbs_simple = Number(item.carbs_simple) || 0;
    row.carbs_complex = Number(item.carbs_complex) || 0;
    row.fiber = Number(item.fiber) || 0;
    return row;
  });
};

const persistDayMeta = async (dateKey: string, waterValue: number, sleepValue: string, activityValue: boolean) => {
  if (!dateKey) {
    return;
  }
  const entries = [...diaryEntries.value];
  const hasEntries = entries.some((entry) => normalizeDate(entry.date) === dateKey);
  const normalizedSleep = sleepValue ? sleepValue : null;

  let updated: DiaryEntry[];
  if (!hasEntries) {
    updated = [
      ...entries,
      {
        date: dateKey,
        mode: 'summary',
        calories: 0,
        protein_g: 0,
        fat_g: 0,
        carbs_g: 0,
        carbs_simple_g: 0,
        carbs_complex_g: 0,
        fiber_g: 0,
        water_l: Number.isFinite(waterValue) ? waterValue : 0,
        sleep_time: normalizedSleep,
        activity: Boolean(activityValue)
      }
    ];
  } else {
    updated = entries.map((entry) => {
      if (normalizeDate(entry.date) !== dateKey) {
        return entry;
      }
      return {
        ...entry,
        water_l: Number.isFinite(waterValue) ? waterValue : Number(entry.water_l) || 0,
        sleep_time: normalizedSleep || entry.sleep_time || null,
        activity: typeof activityValue === 'boolean' ? activityValue : Boolean(entry.activity)
      };
    });
  }

  storage.setDiaryEntries(updated as never[]);
};

const submitProductsForm = async () => {
  const dateKey = normalizeDate(form.date);
  if (!dateKey) {
    return;
  }

  if (productsFormContext.value === 'water') {
    await persistDayMeta(dateKey, Number(form.water_l) || 0, form.sleep_time, form.activity);
    await closeProductsPanel();
    return;
  }

  const items = collectFoodItems();
  if (!items.length) {
    return;
  }

  const meal = form.meal as MealKey;
  const totals = calculateTotals(items);
  const water = Number(form.water_l) || 0;
  const sleep = form.sleep_time || null;
  const activity = Boolean(form.activity);

  const nextEntries = diaryEntries.value.filter((entry) => {
    return !(normalizeDate(entry.date) === dateKey && entry.mode === 'products' && entry.meal === meal);
  });

  nextEntries.push({
    date: dateKey,
    mode: 'products',
    meal,
    items,
    totals,
    water_l: water,
    sleep_time: sleep,
    activity
  });

  storage.setDiaryEntries(nextEntries as never[]);
  await closeProductsPanel();
};

const deleteCurrentMeal = async () => {
  const dateKey = normalizeDate(form.date);
  if (!dateKey || productsFormContext.value === 'water') {
    return;
  }
  const meal = form.meal as MealKey;
  const nextEntries = diaryEntries.value.filter((entry) => {
    return !(normalizeDate(entry.date) === dateKey && entry.mode === 'products' && entry.meal === meal);
  });
  storage.setDiaryEntries(nextEntries as never[]);
  await closeProductsPanel();
};

const handleFabAction = async (action: 'meal' | 'water', meal: MealKey = 'breakfast') => {
  if (action === 'water') {
    await openProductsForm('breakfast', 'water', false);
    return;
  }
  await openProductsForm(meal, 'meal', false);
};

watch(
  selectedDate,
  (value) => {
    form.date = value;
  },
  { immediate: true }
);

onMounted(async () => {
  await storage.syncProfileWithBackend();
  await storage.syncDiaryEntriesWithBackend();

  const routeDate = normalizeDate(route.query.date);
  selectedDate.value = routeDate || todayDate();
  form.date = selectedDate.value;

  const mode = typeof route.query.mode === 'string' ? route.query.mode : 'day';
  const meal = typeof route.query.meal === 'string' ? route.query.meal : 'breakfast';
  const action = typeof route.query.action === 'string' ? route.query.action : '';
  const fab = route.query.fab === '1';

  if (mode === 'products') {
    const mealKey = (['breakfast', 'lunch', 'dinner', 'snack'] as string[]).includes(meal) ? (meal as MealKey) : 'breakfast';
    await openProductsForm(mealKey, meal === 'water' ? 'water' : 'meal', true);
  } else {
    await updateDateQuery('day');
  }

  if (fab) {
    if (action === 'water') {
      await handleFabAction('water');
    } else {
      const mealKey = (['breakfast', 'lunch', 'dinner', 'snack'] as string[]).includes(meal) ? (meal as MealKey) : 'breakfast';
      await handleFabAction('meal', mealKey);
    }
  }

  if (typeof (window as { feather?: { replace?: () => void } }).feather?.replace === 'function') {
    (window as { feather: { replace: () => void } }).feather.replace();
  }
});
</script>
