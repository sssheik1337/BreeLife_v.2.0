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
          <div class="flex flex-col items-center justify-center gap-3 text-center">
            <div class="max-w-sm">
              <h3 class="font-semibold text-slate-800">Приёмы пищи по дате</h3>
              <p class="text-sm text-slate-500">Выберите дату и добавляйте продукты в завтрак, обед, ужин или перекус.</p>
            </div>
            <input
              id="diary-day-date"
              v-model="selectedDate"
              type="date"
              class="form-input w-full max-w-[220px]"
              required
              @change="onDateChanged"
            >
          </div>
          <p id="diary-day-hint" class="text-sm text-slate-500 mt-3 text-center">{{ dayHint }}</p>
        </div>

        <section id="diary-month-calendar" class="bg-white rounded-2xl p-4 shadow-lg border border-slate-100">
          <h3 class="font-semibold text-slate-800 mb-3">Календарь месяца</h3>
          <div class="grid grid-cols-7 gap-1 mb-2">
            <div
              v-for="label in weekDayLabels"
              :key="label"
              class="h-6 rounded bg-slate-50 text-[11px] font-semibold text-slate-500 flex items-center justify-center"
            >{{ label }}</div>
          </div>
          <div id="diary-month-grid" class="grid grid-cols-7 gap-1">
            <button
              v-for="cell in monthGrid"
              :key="cell.date"
              type="button"
              class="h-8 rounded text-[11px] flex items-center justify-center transition-colors"
              :class="cell.className"
              :style="cell.style"
              @click="selectCalendarDate(cell.date)"
            >{{ cell.text }}</button>
          </div>
          <div class="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span>Прошлый: {{ monthLabels.previous }}</span>
            <span>Текущий: {{ monthLabels.current }}</span>
          </div>
        </section>

        <div id="diary-meals" class="space-y-3">
          <div
            v-for="card in mealCards"
            :key="card.key"
            class="bg-white rounded-2xl p-4 shadow-lg border border-slate-100"
          >
            <template v-if="card.entry && card.entry.items.length">
              <div class="flex items-center justify-between">
                <span class="diary-section-title">
                  <img :src="mealIconUrls[card.key]" alt="" class="diary-section-title__icon" />
                  <span>{{ card.label }}</span>
                </span>
                <span :id="`diary-meal-${card.key}-total`" class="text-xs text-slate-500">{{ card.totalText }}</span>
              </div>
              <div :id="`diary-meal-${card.key}-list`" class="mt-3 space-y-2 text-slate-600">
                <div
                  v-for="(item, index) in card.entry.items"
                  :key="`${card.key}-${index}-${item.name}`"
                  class="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"
                >
                  <span>{{ item.name }}</span>
                  <span class="text-xs text-slate-500">{{ Math.round(item.grams || 0) }} г</span>
                </div>
                <p class="text-xs text-slate-500">Б {{ Math.round(card.entry.totals.protein_g) }} • Ж {{ Math.round(card.entry.totals.fat_g) }} • У {{ Math.round(card.entry.totals.carbs_g) }}</p>
                <button type="button" class="diary-action-btn" @click="openProductsForm(card.key, 'meal', true)">Редактировать</button>
              </div>
            </template>
            <template v-else>
              <div class="flex items-center justify-between gap-3">
                <div>
                  <h3 class="diary-section-title">
                    <img :src="mealIconUrls[card.key]" alt="" class="diary-section-title__icon" />
                    <span>{{ card.label }}</span>
                  </h3>
                  <p class="mt-1 text-sm text-slate-500">Нет записи за эту дату.</p>
                </div>
                <button type="button" class="diary-action-btn" @click="openProductsForm(card.key, 'meal', false)">Добавить</button>
              </div>
            </template>
          </div>
        </div>

        <div id="diary-health-cards" class="space-y-3">
          <div class="bg-white rounded-2xl p-4 shadow-lg border border-slate-100">
            <div class="flex items-center justify-between gap-3">
              <div>
                <h3 class="diary-section-title">
                  <img :src="waterIconUrl" alt="" class="diary-section-title__icon" />
                  <span>Вода</span>
                </h3>
                <p class="mt-1 text-sm text-slate-500">
                  Выпито сегодня: {{ todayWaterText }} / цель {{ waterGoalText }}
                </p>
              </div>
              <button type="button" class="diary-action-btn" @click="handleFabAction('water')">Добавить</button>
            </div>
          </div>

          <div class="bg-white rounded-2xl p-4 shadow-lg border border-slate-100">
            <div class="flex items-center justify-between gap-3">
              <div>
                <h3 class="diary-section-title">
                  <img :src="sleepIconUrl" alt="" class="diary-section-title__icon" />
                  <span>Сон</span>
                </h3>
                <p class="mt-1 text-sm text-slate-500">Отход ко сну: {{ sleepBedtimeText }}</p>
                <p class="text-sm text-slate-500">Пробуждение: {{ sleepWakeTimeText }}</p>
              </div>
              <button type="button" class="diary-action-btn" @click="openSleepMorningModal">Записать</button>
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
                <input
                  id="diary-products-water"
                  v-model="form.water_l"
                  type="number"
                  class="form-input"
                  placeholder="Добавить воды, л"
                  min="0"
                  step="0.01"
                >
                <div class="grid grid-cols-3 gap-2 mt-2">
                  <button type="button" class="btn-secondary text-xs" @click="applyQuickWater(0.25)">+250 мл</button>
                  <button type="button" class="btn-secondary text-xs" @click="applyQuickWater(0.5)">+500 мл</button>
                  <button type="button" class="btn-secondary text-xs" @click="applyQuickWater(1)">+1 л</button>
                </div>
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
                      :required="productsFormContext !== 'water'"
                      :disabled="productsFormContext === 'water'"
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
                    :required="productsFormContext !== 'water'"
                    :disabled="productsFormContext === 'water'"
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
                :class="{ hidden: !canDeleteCurrentMeal }"
                @click="deleteCurrentMeal"
              >
                Удалить приём пищи
              </button>
            </form>
          </div>
        </div>

        <div
          v-if="sleepMorningModalOpen"
          class="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/40 px-4 py-6 backdrop-blur-sm"
        >
          <div class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div class="flex items-start justify-between gap-3">
              <div>
                <h3 class="text-lg font-semibold text-slate-800">Утренний чек сна</h3>
                <p class="mt-1 text-sm text-slate-500">Во сколько вы сегодня проснулись и во сколько легли?</p>
              </div>
              <button
                type="button"
                class="btn-secondary whitespace-nowrap"
                :disabled="sleepMorningSaving"
                @click="closeSleepMorningModal"
              >
                Закрыть
              </button>
            </div>

            <form class="mt-4 space-y-4" @submit.prevent="saveSleepMorningLog">
              <label class="block text-sm text-slate-600">
                <span class="mb-1 block">Во сколько сегодня проснулись?</span>
                <input v-model="sleepMorningForm.wake_time" type="time" class="form-input" required>
              </label>

              <label class="block text-sm text-slate-600">
                <span class="mb-1 block">Во сколько легли спать?</span>
                <input v-model="sleepMorningForm.bed_time" type="time" class="form-input" required>
              </label>

              <label class="sleep-midnight-toggle-row">
                <span class="text-sm text-slate-700">После полуночи</span>
                <span class="sleep-midnight-switch">
                  <input
                    v-model="sleepMorningAfterMidnight"
                    type="checkbox"
                    class="sleep-midnight-switch__input"
                  >
                  <span class="sleep-midnight-switch__track">
                    <span class="sleep-midnight-switch__thumb" />
                  </span>
                </span>
              </label>

              <p class="text-xs text-slate-500">
                Если легли после 00:00, запись будет сохранена сегодняшней датой.
              </p>

              <button type="submit" class="btn-primary w-full" :disabled="sleepMorningSaving">
                {{ sleepMorningSaving ? 'Сохраняем...' : 'Сохранить' }}
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>

  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { diaryApi } from '../api/diaryApi';
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
  wake_time?: string | null;
  activity?: boolean;
}

const route = useRoute();
const router = useRouter();
const storage = useStorageStore();
const notify = (message: string, type: 'success' | 'error' = 'success'): void => {
  const showNotification = (window as { showNotification?: (text: string, tone?: string) => void }).showNotification;
  if (typeof showNotification === 'function') {
    showNotification(message, type);
    return;
  }
  let container = document.getElementById('notification-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'notification-container';
    (document.documentElement || document.body).appendChild(container);
  }

  const maxTop = Math.max(12, window.innerHeight - 96);
  const top = Math.min(Math.max(92, 12), maxTop);
  (container as HTMLDivElement).style.setProperty('position', 'fixed', 'important');
  (container as HTMLDivElement).style.setProperty('top', `${top}px`, 'important');
  (container as HTMLDivElement).style.setProperty('right', '12px', 'important');
  (container as HTMLDivElement).style.setProperty('left', 'auto', 'important');
  (container as HTMLDivElement).style.setProperty('bottom', 'auto', 'important');
  (container as HTMLDivElement).style.setProperty('z-index', '2147483647', 'important');
  (container as HTMLDivElement).style.setProperty('width', 'min(320px, calc(100vw - 24px))', 'important');
  (container as HTMLDivElement).style.setProperty('display', 'flex', 'important');
  (container as HTMLDivElement).style.setProperty('flex-direction', 'column', 'important');
  (container as HTMLDivElement).style.setProperty('align-items', 'flex-end', 'important');
  (container as HTMLDivElement).style.setProperty('pointer-events', 'none', 'important');
  (container as HTMLDivElement).style.setProperty('visibility', 'visible', 'important');
  (container as HTMLDivElement).style.setProperty('opacity', '1', 'important');

  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.background = type === 'error' ? '#ef4444' : '#10b981';
  toast.style.color = '#ffffff';
  toast.style.padding = '14px 16px';
  toast.style.borderRadius = '14px';
  toast.style.marginBottom = '10px';
  toast.style.maxWidth = '100%';
  toast.style.boxShadow = '0 10px 26px rgba(15, 23, 42, 0.28)';
  toast.style.wordBreak = 'break-word';
  toast.style.opacity = '0';
  toast.style.transform = 'translateY(-8px)';
  toast.style.transition = 'transform 180ms ease, opacity 180ms ease';
  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-6px)';
    setTimeout(() => toast.remove(), 180);
  }, 3000);
};

const selectedDate = ref('');
const productsPanelOpen = ref(false);
const productsFormContext = ref<'meal' | 'water'>('meal');
const productsSubmitMode = ref<'append' | 'replace'>('replace');
const sleepMorningModalOpen = ref(false);
const sleepMorningSaving = ref(false);
const sleepMorningAfterMidnight = ref(false);

const sleepMorningForm = reactive({
  wake_time: '',
  bed_time: ''
});

const form = reactive({
  date: '',
  meal: 'breakfast' as MealKey | 'water',
  water_l: '',
  sleep_time: '',
  activity: false
});

const productRows = ref<ProductRow[]>([]);

const mealMeta: Array<{ key: MealKey; label: string }> = [
  { key: 'breakfast', label: 'Завтрак' },
  { key: 'lunch', label: 'Обед' },
  { key: 'dinner', label: 'Ужин' },
  { key: 'snack', label: 'Перекус' }
];

const mealIconUrls: Record<MealKey, string> = {
  breakfast: '/ico/cooking-svgrepo-com.svg',
  lunch: '/ico/pot-of-food-svgrepo-com.svg',
  dinner: '/ico/fork-and-knife-with-plate-svgrepo-com.svg',
  snack: '/ico/red-apple-svgrepo-com.svg'
};

const waterIconUrl = '/ico/droplet-svgrepo-com.svg';
const sleepIconUrl = '/ico/crescent-moon-svgrepo-com.svg';

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

const profile = computed(() => {
  const value = storage.profile;
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
});

const toNumber = (value: unknown): number => {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : 0;
};

const toPositiveOrNull = (value: unknown): number | null => {
  const normalized = Number(value);
  return Number.isFinite(normalized) && normalized > 0 ? normalized : null;
};

const safeDivide = (left: number, right: number): number => {
  if (!Number.isFinite(left) || !Number.isFinite(right) || right === 0) {
    return 0;
  }
  return left / right;
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
const clamp01 = (value: number): number => clamp(value, 0, 1);
const smoothStep = (value: number): number => {
  const normalized = clamp01(value);
  return normalized * normalized * (3 - 2 * normalized);
};
const lerp = (start: number, end: number, factor: number): number => start + ((end - start) * factor);
const getFabProgressColor = (ratio: number): string => {
  if (!Number.isFinite(ratio)) {
    return 'hsl(164, 14%, 94%)';
  }
  const t = smoothStep(clamp01(ratio));
  const hue = 164;
  const saturation = lerp(18, 66, t);
  const lightness = lerp(90, 49, t);
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

const normalizeGoalValue = (value: unknown): 'lose' | 'maintain' | 'gain' | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === 'lose' || normalized === 'maintain' || normalized === 'gain') {
    return normalized;
  }
  if (normalized === 'loss' || normalized === 'weight_loss') {
    return 'lose';
  }
  if (normalized === 'maintenance' || normalized === 'keep') {
    return 'maintain';
  }
  if (normalized === 'muscle' || normalized === 'mass') {
    return 'gain';
  }
  return null;
};

const calculateWaterTargetFromProfile = (profileInput: Record<string, unknown>): number | null => {
  const weight = toPositiveOrNull(profileInput.weight_kg);
  if (weight === null) {
    return null;
  }
  const activityFactor = toNumber(profileInput.activity_factor);
  const goal = normalizeGoalValue(profileInput.goal);

  const base = weight * 0.033;
  let activityBonus = 0;
  if (activityFactor >= 1.725) {
    activityBonus = 0.5;
  } else if (activityFactor >= 1.55) {
    activityBonus = 0.3;
  }

  let goalBonus = 0;
  if (goal === 'gain') {
    goalBonus = 0.2;
  } else if (goal === 'lose') {
    goalBonus = 0.1;
  }

  const target = clamp(base + activityBonus + goalBonus, 1.5, 4.5);
  return Math.round(target * 10) / 10;
};

const getWaterTargetFromAdminConfig = (): number | null => {
  const config = (window as { adminConfig?: Record<string, unknown> }).adminConfig;
  if (!config || typeof config !== 'object') {
    return null;
  }
  const reminders = config.reminders;
  if (!reminders || typeof reminders !== 'object') {
    return null;
  }
  return toPositiveOrNull((reminders as Record<string, unknown>).water_min_l);
};

const waterGoalL = computed(() => {
  return calculateWaterTargetFromProfile(profile.value) ?? getWaterTargetFromAdminConfig();
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
  return findProductsEntries(form.date, form.meal as MealKey).length > 0;
});

const canDeleteCurrentMeal = computed(() => {
  if (productsFormContext.value === 'water') {
    return false;
  }
  return productsSubmitMode.value === 'replace' && hasExistingMealEntry.value;
});

const normalizeDate = (value: unknown): string => {
  return storage.normalizeLocalDate(String(value ?? '')) || '';
};

const todayDate = (): string => normalizeDate(new Date().toISOString());
const parseTimeToMinutes = (value: string): number | null => {
  if (!/^\d{2}:\d{2}$/.test(value)) {
    return null;
  }
  const [hoursRaw, minutesRaw] = value.split(':');
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }
  return (hours * 60) + minutes;
};

const shiftDateKey = (dateKey: string, daysDelta: number): string => {
  const parsed = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return dateKey;
  }
  parsed.setDate(parsed.getDate() + daysDelta);
  return normalizeDate(parsed.toISOString()) || dateKey;
};

const extractWakeTimeForDate = (dateKey: string): string => {
  return getEntriesByDate(dateKey)
    .map((entry) => (typeof entry.wake_time === 'string' ? entry.wake_time : ''))
    .find((value) => value.length > 0) || '';
};

const extractSleepTimeForDate = (dateKey: string): string => {
  return getEntriesByDate(dateKey)
    .map((entry) => (typeof entry.sleep_time === 'string' ? entry.sleep_time : ''))
    .find((value) => value.length > 0) || '';
};

const getMaxWaterForDate = (dateKey: string): number => {
  return getEntriesByDate(dateKey).reduce((maxValue, entry) => {
    return Math.max(maxValue, Number(entry.water_l) || 0);
  }, 0);
};

const formatLiters = (value: number, precision = 2): string => {
  return `${value.toFixed(precision).replace('.', ',')} л`;
};

const formatTimeOrDash = (value: string): string => {
  return /^\d{2}:\d{2}$/.test(value) ? value : '—';
};

const todayWaterL = computed(() => getMaxWaterForDate(todayDate()));

const todayWaterText = computed(() => formatLiters(todayWaterL.value, 2));

const waterGoalText = computed(() => {
  if (waterGoalL.value === null) {
    return '—';
  }
  return formatLiters(waterGoalL.value, 1);
});

const sleepSummary = computed(() => {
  const todayDateKey = todayDate();
  const yesterdayDateKey = shiftDateKey(todayDateKey, -1);
  const wakeToday = extractWakeTimeForDate(todayDateKey);
  const bedYesterday = extractSleepTimeForDate(yesterdayDateKey);
  const bedToday = extractSleepTimeForDate(todayDateKey);
  return {
    wakeTime: wakeToday,
    bedTime: bedYesterday || bedToday
  };
});

const sleepBedtimeText = computed(() => formatTimeOrDash(sleepSummary.value.bedTime));
const sleepWakeTimeText = computed(() => formatTimeOrDash(sleepSummary.value.wakeTime));

const upsertSummaryEntry = (
  entries: DiaryEntry[],
  dateKey: string,
  patch: Partial<DiaryEntry>
): DiaryEntry[] => {
  const nextEntries = [...entries];
  const existingIndex = nextEntries.findIndex((entry) => (
    normalizeDate(entry.date) === dateKey && entry.mode === 'summary'
  ));

  if (existingIndex >= 0) {
    nextEntries[existingIndex] = {
      ...nextEntries[existingIndex],
      ...patch,
      date: dateKey,
      mode: 'summary'
    };
    return nextEntries;
  }

  nextEntries.push({
    date: dateKey,
    mode: 'summary',
    calories: 0,
    protein_g: 0,
    fat_g: 0,
    carbs_g: 0,
    carbs_simple_g: 0,
    carbs_complex_g: 0,
    fiber_g: 0,
    water_l: 0,
    sleep_time: null,
    wake_time: null,
    activity: false,
    ...patch
  });
  return nextEntries;
};

const persistDiaryEntriesWithRoundtrip = async (entries: DiaryEntry[]): Promise<void> => {
  storage.setDiaryEntries(entries as never[], { skipBackend: true });
  try {
    const saved = await diaryApi.saveDiaryEntries(entries as any);
    storage.setDiaryEntries(saved as never[], { skipBackend: true });
  } catch {
    storage.setDiaryEntries(entries as never[]);
  }
};

const closeSleepMorningModal = (): void => {
  if (sleepMorningSaving.value) {
    return;
  }
  sleepMorningModalOpen.value = false;
};

const openSleepMorningModal = (): void => {
  const todayDateKey = todayDate();
  const yesterdayDateKey = shiftDateKey(todayDateKey, -1);
  const todayBedTime = extractSleepTimeForDate(todayDateKey);
  const yesterdayBedTime = extractSleepTimeForDate(yesterdayDateKey);
  sleepMorningForm.wake_time = extractWakeTimeForDate(todayDateKey);
  sleepMorningForm.bed_time = yesterdayBedTime || todayBedTime;
  sleepMorningAfterMidnight.value = Boolean(todayBedTime && !yesterdayBedTime);
  sleepMorningModalOpen.value = true;
};

const clearSleepMorningTriggerFromQuery = async (): Promise<void> => {
  const nextQuery: Record<string, unknown> = { ...(route.query as Record<string, unknown>) };
  delete nextQuery.sleep_morning;
  if (nextQuery.intent === 'sleep_morning_log') {
    delete nextQuery.intent;
  }
  await router.replace({ path: '/diary', query: nextQuery });
};

const saveSleepMorningLog = async (): Promise<void> => {
  if (sleepMorningSaving.value) {
    return;
  }
  const wakeTime = sleepMorningForm.wake_time;
  const bedTime = sleepMorningForm.bed_time;
  if (!wakeTime || !bedTime) {
    notify('Заполните время пробуждения и отхода ко сну.', 'error');
    return;
  }

  const wakeMinutes = parseTimeToMinutes(wakeTime);
  const bedMinutes = parseTimeToMinutes(bedTime);
  if (wakeMinutes === null || bedMinutes === null) {
    notify('Некорректный формат времени.', 'error');
    return;
  }

  const todayDateKey = todayDate();
  const bedDateKey = sleepMorningAfterMidnight.value
    ? todayDateKey
    : (bedMinutes > wakeMinutes ? shiftDateKey(todayDateKey, -1) : todayDateKey);

  sleepMorningSaving.value = true;
  try {
    let nextEntries = [...diaryEntries.value];
    nextEntries = upsertSummaryEntry(nextEntries, todayDateKey, { wake_time: wakeTime });
    nextEntries = upsertSummaryEntry(nextEntries, bedDateKey, { sleep_time: bedTime });
    await persistDiaryEntriesWithRoundtrip(nextEntries);
    sleepMorningModalOpen.value = false;
    notify('Сон сохранён.', 'success');
  } finally {
    sleepMorningSaving.value = false;
  }
};
const weekDayLabels = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];

const calendarAnchorDate = computed(() => {
  const parsed = selectedDate.value ? new Date(`${selectedDate.value}T00:00:00`) : new Date();
  if (Number.isNaN(parsed.getTime())) {
    return new Date();
  }
  parsed.setHours(0, 0, 0, 0);
  return parsed;
});

const monthFormatter = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' });
const formatMonthLabel = (date: Date): string => {
  const raw = monthFormatter.format(date);
  return raw.charAt(0).toUpperCase() + raw.slice(1);
};

const monthLabels = computed(() => {
  const current = new Date(calendarAnchorDate.value);
  const previous = new Date(current);
  previous.setMonth(previous.getMonth() - 1);
  return {
    previous: formatMonthLabel(previous),
    current: formatMonthLabel(current)
  };
});

const caloriesTarget = computed(() => {
  const value = toNumber(profile.value.calories_target);
  return value > 0 ? value : null;
});

const dayTotalsByDate = computed(() => {
  const totals = new Map<string, { calories: number }>();
  diaryEntries.value.forEach((entry) => {
    const key = normalizeDate(entry.date);
    if (!key) {
      return;
    }
    const current = totals.get(key) || { calories: 0 };
    const resolved = resolveTotals(entry);
    current.calories += resolved.calories;
    totals.set(key, current);
  });
  return totals;
});

const monthGrid = computed(() => {
  const base = calendarAnchorDate.value;
  const currentYear = base.getFullYear();
  const currentMonth = base.getMonth();
  const monthStart = new Date(currentYear, currentMonth, 1);
  const monthEnd = new Date(currentYear, currentMonth + 1, 0);
  const leadingDays = (monthStart.getDay() + 6) % 7;
  const totalDays = monthEnd.getDate();
  const totalCells = Math.ceil((leadingDays + totalDays) / 7) * 7;
  const todayKey = todayDate();
  const selectedKey = normalizeDate(selectedDate.value);
  const target = caloriesTarget.value;

  let monthMaxCalories = 0;
  for (let index = 0; index < totalCells; index += 1) {
    const cellDate = new Date(monthStart);
    cellDate.setDate(1 - leadingDays + index);
    const isCurrentMonth = cellDate.getMonth() === currentMonth && cellDate.getFullYear() === currentYear;
    if (!isCurrentMonth) {
      continue;
    }
    const key = normalizeDate(cellDate.toISOString());
    const calories = dayTotalsByDate.value.get(key)?.calories || 0;
    monthMaxCalories = Math.max(monthMaxCalories, calories);
  }

  const cells: Array<{ date: string; text: string; className: string; style: Record<string, string> }> = [];
  for (let index = 0; index < totalCells; index += 1) {
    const cellDate = new Date(monthStart);
    cellDate.setDate(1 - leadingDays + index);
    const key = normalizeDate(cellDate.toISOString());
    const isCurrentMonth = cellDate.getMonth() === currentMonth && cellDate.getFullYear() === currentYear;
    const calories = dayTotalsByDate.value.get(key)?.calories || 0;
    const hasData = calories > 0;
    const ratio = hasData
      ? (target ? safeDivide(calories, target) : safeDivide(calories, monthMaxCalories || 1))
      : Number.NaN;
    const normalized = clamp01(ratio);

    const backgroundColor = hasData
      ? getFabProgressColor(normalized)
      : (isCurrentMonth ? 'hsl(164, 14%, 94%)' : 'hsl(164, 12%, 96%)');
    const textColor = hasData
      ? (normalized >= 0.45 ? '#ffffff' : '#334155')
      : (isCurrentMonth ? '#64748b' : '#94a3b8');
    const opacity = isCurrentMonth ? '1' : '0.78';

    let className = '';

    if (key === selectedKey) {
      className += ' ring-2 ring-emerald-500';
    } else if (key === todayKey) {
      className += ' ring-2 ring-emerald-300';
    }

    cells.push({
      date: key,
      text: String(cellDate.getDate()),
      className,
      style: {
        backgroundColor,
        color: textColor,
        opacity
      }
    });
  }

  return cells;
});

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

const findProductsEntries = (dateKey: string, meal: MealKey): DiaryEntry[] => {
  return getEntriesByDate(dateKey).filter((entry) => entry.mode === 'products' && entry.meal === meal);
};

const pickProductsEntry = (dateKey: string, meal: MealKey): (DiaryEntry & { totals: DiaryTotals; items: DiaryEntryItem[] }) | null => {
  const matches = findProductsEntries(dateKey, meal)
    .map((entry) => ({
      ...entry,
      totals: resolveTotals(entry),
      items: Array.isArray(entry.items) ? entry.items : []
    }));
  if (!matches.length) {
    return null;
  }
  const mergedItems = matches.flatMap((entry) => entry.items);
  const mergedTotals = calculateTotals(mergedItems);
  const water = matches.reduce((maxWater, entry) => Math.max(maxWater, Number(entry.water_l) || 0), 0);
  const sleepTime = matches.map((entry) => String(entry.sleep_time || '')).find((value) => value.length > 0) || null;
  const activity = matches.some((entry) => entry.activity === true);
  return {
    date: dateKey,
    mode: 'products',
    meal,
    items: mergedItems,
    totals: mergedTotals,
    water_l: water,
    sleep_time: sleepTime,
    activity
  };
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

const selectCalendarDate = async (dateKey: string) => {
  selectedDate.value = dateKey;
  await onDateChanged();
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
  productsSubmitMode.value = context === 'meal' && prefillExisting ? 'replace' : 'append';
  form.date = selectedDate.value;
  form.meal = context === 'water' ? 'water' : meal;
  if (context === 'water') {
    form.water_l = '';
    form.sleep_time = '';
    form.activity = false;
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
  const existing = pickProductsEntry(dateKey, meal);
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

const persistWaterIntake = async (dateKey: string, addedWaterValue: number) => {
  if (!dateKey) {
    return;
  }
  if (!Number.isFinite(addedWaterValue) || addedWaterValue <= 0) {
    return;
  }

  const entries = [...diaryEntries.value];
  const hasEntries = entries.some((entry) => normalizeDate(entry.date) === dateKey);
  const currentWater = getMaxWaterForDate(dateKey);
  const nextWater = Number((currentWater + addedWaterValue).toFixed(2));

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
        water_l: nextWater,
        sleep_time: null,
        wake_time: null,
        activity: false
      }
    ];
  } else {
    updated = entries.map((entry) => {
      if (normalizeDate(entry.date) !== dateKey) {
        return entry;
      }
      return {
        ...entry,
        water_l: nextWater
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
    const addedWater = Number(form.water_l);
    if (!Number.isFinite(addedWater) || addedWater <= 0) {
      notify('Введите объём воды больше 0.', 'error');
      return;
    }
    await persistWaterIntake(dateKey, addedWater);
    notify('Вода сохранена.', 'success');
    await closeProductsPanel();
    return;
  }

  const items = collectFoodItems();
  if (!items.length) {
    notify('Добавьте хотя бы один продукт.', 'error');
    return;
  }

  const meal = form.meal as MealKey;
  const existing = pickProductsEntry(dateKey, meal);
  const finalItems = productsSubmitMode.value === 'append' && existing?.items?.length
    ? [...existing.items, ...items]
    : items;
  const totals = calculateTotals(finalItems);
  const water = Number(form.water_l) || Number(existing?.water_l) || 0;
  const sleep = form.sleep_time || existing?.sleep_time || null;
  const activity = Boolean(form.activity) || Boolean(existing?.activity);

  const nextEntries = diaryEntries.value.filter((entry) => {
    return !(normalizeDate(entry.date) === dateKey && entry.mode === 'products' && entry.meal === meal);
  });

  nextEntries.push({
    date: dateKey,
    mode: 'products',
    meal,
    items: finalItems,
    totals,
    water_l: water,
    sleep_time: sleep,
    activity
  });

  storage.setDiaryEntries(nextEntries as never[]);
  notify('Приём пищи сохранён.', 'success');
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

const handleFabAction = async (action: 'meal' | 'water' | 'sleep', meal: MealKey = 'breakfast') => {
  if (action === 'water') {
    await openProductsForm('breakfast', 'water', false);
    return;
  }
  if (action === 'sleep') {
    openSleepMorningModal();
    return;
  }
  await openProductsForm(meal, 'meal', false);
};

const onDiaryFabAction = async (event: Event) => {
  const customEvent = event as CustomEvent<{ action?: 'meal' | 'water' | 'sleep'; meal?: string }>;
  const rawAction = customEvent.detail?.action;
  const action = rawAction === 'water' || rawAction === 'sleep' ? rawAction : 'meal';
  const mealValue = customEvent.detail?.meal || 'breakfast';
  const meal = (['breakfast', 'lunch', 'dinner', 'snack'] as string[]).includes(mealValue)
    ? (mealValue as MealKey)
    : 'breakfast';
  await handleFabAction(action, meal);
};

watch(
  selectedDate,
  (value) => {
    form.date = value;
  },
  { immediate: true }
);

onMounted(async () => {
  window.addEventListener('diary-fab-action', onDiaryFabAction as EventListener);
  await storage.syncProfileWithBackend();
  await storage.syncDiaryEntriesWithBackend();

  const routeDate = normalizeDate(route.query.date);
  selectedDate.value = routeDate || todayDate();
  form.date = selectedDate.value;

  const mode = typeof route.query.mode === 'string' ? route.query.mode : 'day';
  const meal = typeof route.query.meal === 'string' ? route.query.meal : 'breakfast';
  const action = typeof route.query.action === 'string' ? route.query.action : '';
  const fab = route.query.fab === '1';
  const hasSleepMorningTrigger = (
    route.query.sleep_morning === '1'
    || route.query.intent === 'sleep_morning_log'
  );

  if (mode === 'products') {
    const mealKey = (['breakfast', 'lunch', 'dinner', 'snack'] as string[]).includes(meal) ? (meal as MealKey) : 'breakfast';
    await openProductsForm(mealKey, meal === 'water' ? 'water' : 'meal', true);
  } else {
    await updateDateQuery('day');
  }

  if (fab) {
    if (action === 'water') {
      await handleFabAction('water');
    } else if (action === 'sleep') {
      await handleFabAction('sleep');
    } else {
      const mealKey = (['breakfast', 'lunch', 'dinner', 'snack'] as string[]).includes(meal) ? (meal as MealKey) : 'breakfast';
      await handleFabAction('meal', mealKey);
    }
  }

  if (hasSleepMorningTrigger) {
    openSleepMorningModal();
    await clearSleepMorningTriggerFromQuery();
  }

  if (typeof (window as { feather?: { replace?: () => void } }).feather?.replace === 'function') {
    (window as { feather: { replace: () => void } }).feather.replace();
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('diary-fab-action', onDiaryFabAction as EventListener);
});
</script>

<style scoped>
.diary-section-title {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-weight: 600;
  color: #1e293b;
}

.diary-section-title__icon {
  width: 20px;
  height: 20px;
  object-fit: contain;
  flex: 0 0 20px;
}

.diary-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: max-content;
  margin-left: auto;
  min-width: 124px;
  min-height: 38px;
  padding: 8px 14px;
  border-radius: 9999px;
  border: 1px solid rgba(16, 185, 129, 0.28);
  background: linear-gradient(135deg, #34d399 0%, #3b82f6 100%);
  color: #ffffff;
  opacity: 1;
  font-size: 14px;
  font-weight: 600;
  line-height: 1;
  transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease;
  box-shadow: 0 8px 16px rgba(52, 211, 153, 0.24);
}

.diary-action-btn:hover {
  filter: brightness(1.03);
}

.diary-action-btn:active {
  transform: scale(0.98);
}

.sleep-midnight-toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  background: #f8fafc;
  padding: 0.5rem 0.75rem;
}

.sleep-midnight-switch {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  cursor: pointer;
  user-select: none;
  min-height: 28px;
}

.sleep-midnight-switch__input {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.sleep-midnight-switch__track {
  position: relative;
  display: inline-flex;
  align-items: center;
  width: 46px;
  height: 28px;
  border-radius: 9999px;
  background-color: #e2e8f0;
  border: 1px solid #cbd5e1;
  transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}

.sleep-midnight-switch__thumb {
  position: absolute;
  top: 50%;
  left: 1px;
  width: 24px;
  height: 24px;
  border-radius: 9999px;
  background: #ffffff;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.18);
  transform: translateY(-50%);
  transition: transform 0.2s ease, width 0.2s ease;
}

.sleep-midnight-switch__input:checked + .sleep-midnight-switch__track {
  background: linear-gradient(135deg, #34d399 0%, #3b82f6 100%);
  border-color: transparent;
  box-shadow: 0 8px 16px rgba(52, 211, 153, 0.24);
}

.sleep-midnight-switch__input:checked + .sleep-midnight-switch__track .sleep-midnight-switch__thumb {
  transform: translate(18px, -50%);
}

.sleep-midnight-switch:active .sleep-midnight-switch__thumb {
  width: 27px;
}

.sleep-midnight-switch__input:focus-visible + .sleep-midnight-switch__track {
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.28);
}
</style>
