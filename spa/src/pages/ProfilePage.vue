<template>
  <section class="min-h-screen bg-gradient-to-br from-[#f8fafc] via-[#f0f9ff] to-[#f0fdf4]">
    <main class="flex-1 px-4 py-8">
      <div class="max-w-md mx-auto">
        <div class="text-center mb-10">
          <div class="relative inline-block mb-6">
            <div class="absolute inset-0 w-24 h-24 bg-gradient-to-r from-emerald-300 to-cyan-300 rounded-full blur-2xl opacity-50 animate-pulse"></div>
            <div class="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-400 flex items-center justify-center shadow-lg animate-float">
              <i data-feather="check" class="w-10 h-10 text-white"></i>
            </div>
          </div>
          <h1 class="text-2xl font-bold text-slate-800">Прогресс</h1>
          <p class="text-slate-500 mt-2">Ваш прогресс и динамика по ключевым показателям</p>
        </div>

        <section id="profile-today-summary" class="mb-6">
          <div class="mb-3 px-1">
            <h2 class="text-lg font-bold text-slate-800">План на сегодня</h2>
          </div>
          <div class="profile-card p-5 mb-6" id="profile-today-kpi">
            <div class="flex flex-col items-center text-center mb-4">
              <h3 class="font-semibold text-slate-800">Факт / цель</h3>
              <p class="text-sm text-slate-500">Калории, БЖУ, клетчатка и вода за текущий день</p>
            </div>
            <div class="mx-auto w-full max-w-md rounded-2xl bg-slate-50 px-4 py-4 sm:px-6">
              <div class="grid grid-cols-1 gap-2 text-base leading-6 text-slate-700">
                <p id="today-fact-calories" class="text-center text-xl font-semibold">{{ todayFacts.calories }}</p>
                <p id="today-fact-protein" class="text-center">{{ todayFacts.protein }}</p>
                <p id="today-fact-fat" class="text-center">{{ todayFacts.fat }}</p>
                <p id="today-fact-carbs" class="text-center">{{ todayFacts.carbs }}</p>
                <p id="today-fact-fiber" class="text-center">{{ todayFacts.fiber }}</p>
                <p id="today-fact-water" class="text-center">{{ todayFacts.water }}</p>
              </div>
            </div>
            <div class="mt-6">
              <div class="flex flex-col items-center text-center gap-2 mb-4">
                <h4 class="font-semibold text-slate-800">Баланс белков, жиров и углеводов</h4>
                <p id="macro-balance-desc" class="text-sm text-slate-500">{{ macroBalance.desc }}</p>
                <p id="macro-balance-insight" class="text-sm text-slate-500">{{ macroBalance.insight }}</p>
                <div class="flex items-center justify-center gap-2 mt-1">
                  <button
                    type="button"
                    class="text-xs font-semibold px-3 py-1 rounded-full"
                    :class="macroRange === 'day' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'"
                    data-macro-range="day"
                    @click="macroRange = 'day'"
                  >Сегодня</button>
                  <button
                    type="button"
                    class="text-xs font-semibold px-3 py-1 rounded-full"
                    :class="macroRange === 'week' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'"
                    data-macro-range="week"
                    @click="macroRange = 'week'"
                  >Неделя</button>
                </div>
              </div>
              <div class="flex flex-col items-center justify-center gap-4 text-center sm:flex-row sm:items-center sm:justify-center">
                <div id="macro-balance-chart" class="relative w-36 h-36 min-w-[9rem] min-h-[9rem] shrink-0 rounded-full" :style="{ background: macroBalance.chartBackground }">
                  <div class="absolute inset-4 rounded-full bg-white/90"></div>
                  <div class="absolute inset-0 flex items-center justify-center text-sm font-semibold text-slate-700">БЖУ</div>
                </div>
                <div class="space-y-2 text-sm text-slate-600">
                  <div class="flex items-center justify-center gap-2">
                    <span class="h-2 w-2 rounded-full bg-emerald-500"></span>
                    <span id="macro-balance-protein">Белки — {{ macroBalance.proteinPct }}%</span>
                  </div>
                  <div class="flex items-center justify-center gap-2">
                    <span class="h-2 w-2 rounded-full bg-amber-400"></span>
                    <span id="macro-balance-fat">Жиры — {{ macroBalance.fatPct }}%</span>
                  </div>
                  <div class="flex items-center justify-center gap-2">
                    <span class="h-2 w-2 rounded-full bg-sky-400"></span>
                    <span id="macro-balance-carbs">Углеводы — {{ macroBalance.carbsPct }}%</span>
                  </div>
                </div>
              </div>
              <div class="mt-4 mx-auto w-full max-w-md rounded-xl bg-slate-50 p-4 text-sm">
                <div class="flex items-center justify-between">
                  <span class="font-semibold text-slate-700">Простые / сложные углеводы</span>
                  <span id="macro-carb-split-value" class="text-slate-600">{{ carbSplit.value }}</span>
                </div>
                <p id="macro-carb-split-desc" class="text-xs text-slate-500 mt-2">{{ carbSplit.desc }}</p>
              </div>
            </div>
          </div>
        </section>

        <section id="profile-weekly-review" class="profile-card profile-card--secondary p-4 mb-5">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h2 class="text-lg font-bold text-slate-800">Итоги недели</h2>
              <p id="weekly-review-status" class="text-sm text-slate-600">{{ weeklyReview.statusText }}</p>
            </div>
            <span id="weekly-review-indicator" class="inline-flex h-3 w-3 rounded-full" :class="weeklyReview.dotClass"></span>
          </div>
          <p id="weekly-review-message" class="text-sm text-slate-600 mt-2">{{ weeklyReview.message }}</p>
          <ul id="profile-weekly-adjustments-list" class="mt-3 space-y-2" :class="{ hidden: !weeklyAdjustments.length }">
            <li v-for="(item, index) in weeklyAdjustments" :key="`adj-${index}`" class="flex items-start gap-2">
              <span class="text-amber-500">•</span>
              <span class="weekly-review-clamp text-sm text-slate-600">{{ item }}</span>
            </li>
          </ul>
        </section>

        <section id="profile-weekly-ai" class="profile-card profile-card--secondary p-5 mb-4">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-lg font-bold text-slate-800">Прогресс недели</h2>
            <span id="weekly-progress-percent" class="text-sm font-semibold text-slate-700">{{ weeklyProgress.percentText }}</span>
          </div>
          <div id="weekly-progress-grid" class="grid grid-cols-7 gap-2">
            <RouterLink
              v-for="day in weeklyProgress.days"
              :key="day.date"
              class="weekly-day flex flex-col items-center gap-1 p-2 rounded-lg border border-slate-100 bg-white"
              :class="{ 'is-today': day.isToday }"
              :to="{ path: '/diary', query: { date: day.date, mode: 'day' } }"
            >
              <div class="w-full flex items-end justify-center" style="height: 64px;">
                <div class="w-full rounded-lg" :style="{ height: `${day.height}%`, background: day.color }"></div>
              </div>
              <div class="text-xs text-slate-500">{{ day.label }}</div>
              <div class="text-[10px] text-slate-400">{{ day.dateLabel }}</div>
            </RouterLink>
          </div>
          <p id="weekly-progress-desc" class="text-xs text-slate-500 mt-2 text-center">{{ weeklyProgress.desc }}</p>
          <p id="weekly-progress-insight" class="text-xs text-slate-500 mt-1 text-center">{{ weeklyProgress.insight }}</p>
        </section>

        <section id="profile-calorie-trend" class="profile-card profile-card--secondary p-5 mb-4">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-lg font-bold text-slate-800">Динамика калорий</h2>
            <div class="flex gap-2">
              <button
                type="button"
                class="text-xs font-semibold px-3 py-1 rounded-full"
                :class="calorieRange === 7 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'"
                data-calorie-range="7"
                @click="calorieRange = 7"
              >7 дней</button>
              <button
                type="button"
                class="text-xs font-semibold px-3 py-1 rounded-full"
                :class="calorieRange === 30 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'"
                data-calorie-range="30"
                @click="calorieRange = 30"
              >30 дней</button>
            </div>
          </div>
          <div id="calorie-trend-grid" class="grid gap-2" :class="calorieRange === 30 ? 'grid-cols-10' : 'grid-cols-7'">
            <div v-for="item in calorieTrend" :key="item.date" class="trend-day flex flex-col items-center gap-1" :class="{ 'is-today': item.isToday }">
              <div class="w-full flex items-end justify-center" :style="{ height: calorieRange === 30 ? '48px' : '62px' }">
                <div class="w-full rounded-lg" :style="{ height: `${item.height}%`, background: item.color }"></div>
              </div>
              <div v-if="calorieRange === 7" class="text-[10px] text-slate-400">{{ Math.round(item.calories) }}</div>
              <div class="text-[10px] text-slate-500">{{ item.dateLabel }}</div>
            </div>
          </div>
          <p id="calorie-trend-desc" class="text-xs text-slate-500 mt-2 text-center">{{ calorieTrendMeta.desc }}</p>
          <p id="calorie-trend-insight" class="text-xs text-slate-500 mt-1 text-center">{{ calorieTrendMeta.insight }}</p>
        </section>

        <section id="profile-water-history" class="profile-card profile-card--secondary p-5 mb-4">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-lg font-bold text-slate-800">Гидратация</h2>
            <div class="flex gap-2">
              <button
                type="button"
                class="text-xs font-semibold px-3 py-1 rounded-full"
                :class="waterRange === 7 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'"
                data-water-range="7"
                @click="waterRange = 7"
              >7 дней</button>
              <button
                type="button"
                class="text-xs font-semibold px-3 py-1 rounded-full"
                :class="waterRange === 30 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'"
                data-water-range="30"
                @click="waterRange = 30"
              >30 дней</button>
            </div>
          </div>
          <div id="water-history-grid" class="grid gap-2" :class="waterRange === 30 ? 'grid-cols-10' : 'grid-cols-7'">
            <div v-for="item in waterHistory" :key="item.date" class="trend-day flex flex-col items-center gap-1" :class="{ 'is-today': item.isToday }">
              <div class="w-full flex items-end justify-center" :style="{ height: waterRange === 30 ? '48px' : '62px' }">
                <div class="w-full rounded-lg" :style="{ height: `${item.height}%`, background: item.color }"></div>
              </div>
              <div v-if="waterRange === 7" class="text-[10px] text-slate-400">{{ item.water.toFixed(1) }}</div>
              <div class="text-[10px] text-slate-500">{{ item.dateLabel }}</div>
            </div>
          </div>
          <p id="water-history-desc" class="text-xs text-slate-500 mt-2 text-center">{{ waterHistoryMeta.desc }}</p>
          <p id="water-history-insight" class="text-xs text-slate-500 mt-1 text-center">{{ waterHistoryMeta.insight }}</p>
        </section>

        <div class="text-center mt-4">
          <RouterLink class="text-xs font-semibold text-emerald-600" :to="{ path: '/diary', query: { date: todayKey, mode: 'day' } }">Открыть дневник</RouterLink>
        </div>
      </div>
    </main>
  </section>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { useStorageStore } from '../stores/storageStore';
import { calculateMacros } from '../core/calculations';

interface DiaryEntry {
  date?: string;
  mode?: string;
  meal?: string;
  totals?: Record<string, unknown>;
  calories?: number;
  protein_g?: number;
  fat_g?: number;
  carbs_g?: number;
  carbs_simple_g?: number;
  carbs_complex_g?: number;
  fiber_g?: number;
  water_l?: number;
  activity?: boolean;
}

const storage = useStorageStore();

const calorieRange = ref<7 | 30>(7);
const waterRange = ref<7 | 30>(7);
const macroRange = ref<'day' | 'week'>('day');
const adminConfig = ref<Record<string, unknown>>({});

const profile = computed(() => storage.profile || {});
const diaryEntries = computed(() => (Array.isArray(storage.diaryEntries) ? storage.diaryEntries : []) as DiaryEntry[]);

const normalizeDate = (value: unknown): string => storage.normalizeLocalDate(String(value ?? '')) || '';
const todayKey = normalizeDate(new Date().toISOString());
const weekdayLabels = ['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ'];

const safeDivide = (a: number, b: number): number => {
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) {
    return 0;
  }
  return a / b;
};

const toNumber = (value: unknown): number => {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : 0;
};

const toPositiveOrNull = (value: unknown): number | null => {
  const normalized = Number(value);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    return null;
  }
  return normalized;
};

const toRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
);

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
const clamp01 = (value: number): number => clamp(value, 0, 1);

const normalizeGoal = (value: unknown): 'lose' | 'maintain' | 'gain' | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === 'lose' || normalized === 'loss') {
    return 'lose';
  }
  if (normalized === 'gain' || normalized === 'muscle') {
    return 'gain';
  }
  if (normalized === 'maintain') {
    return 'maintain';
  }
  return null;
};

const normalizeSex = (value: unknown): 'male' | 'female' | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (['male', 'man', 'm', 'м', 'мужской', 'муж'].includes(normalized)) {
    return 'male';
  }
  if (['female', 'woman', 'f', 'ж', 'женский', 'жен'].includes(normalized)) {
    return 'female';
  }
  return null;
};

const calculateWaterTargetFromProfile = (profileInput: Record<string, unknown>): number | null => {
  const weight = toPositiveOrNull(profileInput.weight_kg);
  if (weight === null) {
    return null;
  }

  const activityFactor = toNumber(profileInput.activity_factor);
  const goal = normalizeGoal(profileInput.goal);

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

const calculateFiberTargetFromProfile = (profileInput: Record<string, unknown>, tdeeKcal: number | null): number => {
  if (tdeeKcal !== null && tdeeKcal > 0) {
    return Math.round(clamp((tdeeKcal / 1000) * 14, 18, 45));
  }
  const sex = normalizeSex(profileInput.sex);
  return sex === 'male' ? 30 : 25;
};

const getReminderTarget = (key: 'water_min_l' | 'fiber_target_g'): number | null => {
  const currentConfig = toRecord(adminConfig.value);
  const reminders = toRecord(currentConfig.reminders);
  const currentValue = toPositiveOrNull(reminders[key]);
  if (currentValue !== null) {
    return currentValue;
  }
  const legacyConfig = toRecord((window as { adminConfig?: Record<string, unknown> }).adminConfig);
  const legacyReminders = toRecord(legacyConfig.reminders);
  return toPositiveOrNull(legacyReminders[key]);
};

const resolvedProfile = computed(() => {
  const source = toRecord(profile.value);
  const computedTargets = toRecord(storage.computeTargetsForProfile(source, new Date(), false));
  const tdee = toPositiveOrNull(source.tdee_calories) ?? toPositiveOrNull(computedTargets.tdee_calories);

  const caloriesTarget = toPositiveOrNull(source.calories_target)
    ?? toPositiveOrNull(computedTargets.calories_target);
  const weight = toPositiveOrNull(source.weight_kg);
  const goal = typeof source.goal === 'string' ? source.goal : null;

  const profileMacros = toRecord(source.macros);
  const hasMacroTargets = toPositiveOrNull(profileMacros.protein_g) !== null
    && toPositiveOrNull(profileMacros.fat_g) !== null
    && toPositiveOrNull(profileMacros.carbs_g) !== null;
  const fallbackMacros = !hasMacroTargets && caloriesTarget !== null && weight !== null && goal
    ? calculateMacros({ goal, weight_kg: weight, calories_target: caloriesTarget })
    : null;
  const macros = hasMacroTargets
    ? profileMacros
    : toRecord(fallbackMacros);

  const computedWaterTarget = calculateWaterTargetFromProfile(source);
  const computedFiberTarget = calculateFiberTargetFromProfile(source, tdee);
  const fallbackFiberTarget = getReminderTarget('fiber_target_g');

  return {
    caloriesTarget,
    macros,
    waterTarget: computedWaterTarget ?? null,
    fiberTarget: computedFiberTarget ?? fallbackFiberTarget
  };
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

const resolveEntryTotals = (entry: DiaryEntry) => {
  if (entry?.totals && typeof entry.totals === 'object') {
    const totals = entry.totals;
    const carbs = resolveCarbTotals(totals.carbs_g, totals.carbs_simple_g, totals.carbs_complex_g);
    return {
      calories: Number(totals.calories) || 0,
      protein_g: Number(totals.protein_g) || 0,
      fat_g: Number(totals.fat_g) || 0,
      carbs_g: carbs.total,
      carbs_simple_g: carbs.simple,
      carbs_complex_g: carbs.complex,
      fiber_g: Number(totals.fiber_g) || 0,
      water_l: Number(entry.water_l) || 0
    };
  }
  const carbs = resolveCarbTotals(entry?.carbs_g, entry?.carbs_simple_g, entry?.carbs_complex_g);
  return {
    calories: Number(entry?.calories) || 0,
    protein_g: Number(entry?.protein_g) || 0,
    fat_g: Number(entry?.fat_g) || 0,
    carbs_g: carbs.total,
    carbs_simple_g: carbs.simple,
    carbs_complex_g: carbs.complex,
    fiber_g: Number(entry?.fiber_g) || 0,
    water_l: Number(entry?.water_l) || 0
  };
};

const entriesByDate = computed(() => {
  const map = new Map<string, DiaryEntry[]>();
  diaryEntries.value.forEach((entry) => {
    const dateKey = normalizeDate(entry.date);
    if (!dateKey) {
      return;
    }
    const list = map.get(dateKey) || [];
    list.push(entry);
    map.set(dateKey, list);
  });
  return map;
});

const dayTotalsByDate = computed(() => {
  const totals = new Map<string, { calories: number; protein: number; fat: number; carbs: number; carbsSimple: number; carbsComplex: number; fiber: number; water: number }>();
  entriesByDate.value.forEach((items, dateKey) => {
    const day = { calories: 0, protein: 0, fat: 0, carbs: 0, carbsSimple: 0, carbsComplex: 0, fiber: 0, water: 0 };
    items.forEach((entry) => {
      const t = resolveEntryTotals(entry);
      day.calories += t.calories;
      day.protein += t.protein_g;
      day.fat += t.fat_g;
      day.carbs += t.carbs_g;
      day.carbsSimple += t.carbs_simple_g;
      day.carbsComplex += t.carbs_complex_g;
      day.fiber += t.fiber_g;
      day.water = Math.max(day.water, Number(entry.water_l) || 0);
    });
    totals.set(dateKey, day);
  });
  return totals;
});

const buildDateRange = (days: number) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const result: Array<{ date: Date; key: string; label: string }> = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    const key = normalizeDate(date.toISOString());
    const label = `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}`;
    result.push({ date, key, label });
  }
  return result;
};

const buildCenteredDateRange = (days: number) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const before = Math.floor((days - 1) / 2);
  const after = days - before - 1;
  const result: Array<{ date: Date; key: string; label: string; weekday: string; isToday: boolean }> = [];

  for (let offset = -before; offset <= after; offset += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() + offset);
    const key = normalizeDate(date.toISOString());
    const label = `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}`;
    result.push({
      date,
      key,
      label,
      weekday: weekdayLabels[date.getDay()],
      isToday: offset === 0
    });
  }
  return result;
};

const smoothStep = (value: number): number => {
  const clamped = clamp01(value);
  return clamped * clamped * (3 - 2 * clamped);
};

const lerp = (from: number, to: number, factor: number): number => from + ((to - from) * factor);
const getFabProgressColor = (ratio: number): string => {
  if (!Number.isFinite(ratio)) {
    return '#e2e8f0';
  }
  // One FAB-aligned hue; only saturation/lightness change with progress.
  const t = smoothStep(clamp01(ratio));
  const hue = 164;
  const saturation = lerp(18, 66, t);
  const lightness = lerp(90, 49, t);
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

const resolveWeeklyStatusTone = (status: string) => {
  const palette: Record<string, { dotClass: string }> = {
    overeat: { dotClass: 'bg-rose-500' },
    undereat: { dotClass: 'bg-amber-500' },
    low_protein: { dotClass: 'bg-cyan-500' },
    low_discipline: { dotClass: 'bg-orange-500' },
    ok: { dotClass: 'bg-emerald-500' }
  };
  return palette[status] || { dotClass: 'bg-slate-300' };
};

const todayFacts = computed(() => {
  const today = dayTotalsByDate.value.get(todayKey) || { calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, water: 0 };
  const targetCalories = resolvedProfile.value.caloriesTarget;
  const macros = resolvedProfile.value.macros;
  const targetWater = resolvedProfile.value.waterTarget;
  const targetFiber = resolvedProfile.value.fiberTarget;
  const targetProtein = toPositiveOrNull(macros.protein_g);
  const targetFat = toPositiveOrNull(macros.fat_g);
  const targetCarbs = toPositiveOrNull(macros.carbs_g);
  return {
    calories: targetCalories !== null
      ? `${Math.round(today.calories)} / ${Math.round(targetCalories)} ккал`
      : `${Math.round(today.calories)} / цель не рассчитана`,
    protein: targetProtein !== null
      ? `Б: ${Math.round(today.protein)} / ${Math.round(targetProtein)} г`
      : `Б: ${Math.round(today.protein)} г`,
    fat: targetFat !== null
      ? `Ж: ${Math.round(today.fat)} / ${Math.round(targetFat)} г`
      : `Ж: ${Math.round(today.fat)} г`,
    carbs: targetCarbs !== null
      ? `У: ${Math.round(today.carbs)} / ${Math.round(targetCarbs)} г`
      : `У: ${Math.round(today.carbs)} г`,
    fiber: targetFiber !== null
      ? `Клетчатка: ${Math.round(today.fiber)} / ${Math.round(targetFiber)} г`
      : `Клетчатка: ${Math.round(today.fiber)} г`,
    water: targetWater !== null
      ? `${today.water.toFixed(1)} / ${targetWater.toFixed(1)} л`
      : `${today.water.toFixed(1)} л`
  };
});

const weeklyProgress = computed(() => {
  const targetCalories = resolvedProfile.value.caloriesTarget;
  const hasTarget = targetCalories !== null;
  const range = buildCenteredDateRange(7);

  const days = [] as Array<{ date: string; dateLabel: string; label: string; height: number; color: string; isToday: boolean; calories: number; hasData: boolean }>;
  let totalPercent = 0;
  let trackedDays = 0;
  let loggedDays = 0;
  let totalCalories = 0;

  for (let index = 0; index < range.length; index += 1) {
    const item = range[index];
    const totals = dayTotalsByDate.value.get(item.key);
    const calories = totals?.calories || 0;
    const hasData = Boolean(totals);
    const ratio = hasTarget ? Math.max(0, Math.min(1, safeDivide(calories, targetCalories as number))) : 0;
    if (item.key <= todayKey) {
      totalPercent += ratio;
      trackedDays += 1;
    }
    if (hasData && item.key <= todayKey) {
      loggedDays += 1;
      totalCalories += calories;
    }
    days.push({
      date: item.key,
      dateLabel: item.label,
      label: item.weekday,
      height: hasData && hasTarget ? Math.max(4, Math.round(ratio * 100)) : 0,
      color: hasData && hasTarget ? getFabProgressColor(ratio) : '#e2e8f0',
      isToday: item.isToday,
      calories,
      hasData
    });
  }

  const percent = hasTarget && trackedDays > 0 ? Math.round(Math.min(Math.max((totalPercent / trackedDays) * 100, 0), 100)) : 0;
  let insight = 'Пока нет записей за неделю.';
  if (loggedDays > 0 && loggedDays < 3) {
    insight = 'Записей пока мало, вывод приблизительный.';
  } else if (!hasTarget) {
    insight = 'Есть данные, но целевые калории не рассчитаны.';
  } else if (loggedDays >= 3) {
    const avg = totalCalories / loggedDays;
      if (avg >= (targetCalories as number) * 1.1) {
        insight = 'В среднем за неделю калорий было выше цели.';
      } else if (avg <= (targetCalories as number) * 0.9) {
        insight = 'В среднем за неделю калорий было ниже цели.';
      } else {
        insight = 'Неделя выглядит ровно — хороший ритм.';
    }
  }

  return {
    days,
    percentText: hasTarget ? `${percent}%` : '—',
    desc: hasTarget ? 'Учитываются записи дневника питания.' : 'Цель по калориям не рассчитана.',
    insight
  };
});

const calorieTrend = computed(() => {
  const targetCalories = resolvedProfile.value.caloriesTarget;
  const hasTarget = targetCalories !== null;
  const range = buildCenteredDateRange(calorieRange.value);
  const maxValue = range.reduce((max, item) => Math.max(max, dayTotalsByDate.value.get(item.key)?.calories || 0), 0);
  const scale = Math.max(1, maxValue, hasTarget ? (targetCalories as number) : 0);
  return range.map((item) => {
    const calories = dayTotalsByDate.value.get(item.key)?.calories || 0;
    const ratio = hasTarget ? safeDivide(calories, targetCalories as number) : Number.NaN;
    return {
      date: item.key,
      calories,
      dateLabel: item.label,
      isToday: item.isToday,
      height: Math.max(4, Math.round(Math.min(1, safeDivide(calories, scale)) * 100)),
      color: getFabProgressColor(ratio)
    };
  });
});

const calorieTrendMeta = computed(() => {
  const targetCalories = resolvedProfile.value.caloriesTarget;
  const hasTarget = targetCalories !== null;
  if (!hasTarget) {
    return {
      desc: 'Целевые калории не рассчитаны.',
      insight: 'Заполните профиль, чтобы увидеть факт/цель.'
    };
  }
  const values = calorieTrend.value.map((item) => item.calories).filter((value) => value > 0);
  if (!values.length) {
    return {
      desc: 'Пока нет записей в дневнике.',
      insight: 'Добавьте приёмы пищи, чтобы увидеть тренд.'
    };
  }
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (avg >= (targetCalories as number) * 1.1) {
    return { desc: 'Среднее значение выше цели.', insight: 'Попробуйте уменьшить калорийность порций.' };
  }
  if (avg <= (targetCalories as number) * 0.9) {
    return { desc: 'Среднее значение ниже цели.', insight: 'Можно добавить небольшой перекус.' };
  }
  return { desc: 'Среднее значение близко к цели.', insight: 'Текущий ритм выглядит стабильным.' };
});

const waterHistory = computed(() => {
  const targetWater = resolvedProfile.value.waterTarget;
  const hasTarget = targetWater !== null;
  const range = buildCenteredDateRange(waterRange.value);
  const maxValue = range.reduce((max, item) => Math.max(max, dayTotalsByDate.value.get(item.key)?.water || 0), 0);
  const scale = Math.max(1, maxValue, hasTarget ? (targetWater as number) : 0);
  return range.map((item) => {
    const water = dayTotalsByDate.value.get(item.key)?.water || 0;
    const ratio = hasTarget ? safeDivide(water, targetWater as number) : Number.NaN;
    return {
      date: item.key,
      water,
      dateLabel: item.label,
      isToday: item.isToday,
      height: Math.max(4, Math.round(Math.min(1, safeDivide(water, scale)) * 100)),
      color: getFabProgressColor(ratio)
    };
  });
});

const waterHistoryMeta = computed(() => {
  const targetWater = resolvedProfile.value.waterTarget;
  const hasTarget = targetWater !== null;
  if (!hasTarget) {
    return { desc: 'Норматив воды не задан.', insight: 'Сейчас отображается только факт.' };
  }
  const values = waterHistory.value.map((item) => item.water).filter((value) => value > 0);
  if (!values.length) {
    return { desc: 'Пока нет записей воды.', insight: 'Добавьте воду в дневнике.' };
  }
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (avg < (targetWater as number) * 0.7) {
    return { desc: 'Среднее потребление воды ниже цели.', insight: 'Попробуйте равномерно пить в течение дня.' };
  }
  return { desc: 'История воды заполнена.', insight: 'Динамика по воде выглядит устойчиво.' };
});

const macroBalance = computed(() => {
  const macros = resolvedProfile.value.macros;
  const targetProtein = toNumber(macros.protein_g);
  const targetFat = toNumber(macros.fat_g);
  const targetCarbs = toNumber(macros.carbs_g);

  let protein = 0;
  let fat = 0;
  let carbs = 0;
  let desc = 'Фактический состав рациона.';

  if (macroRange.value === 'week') {
    const range = buildDateRange(7);
    let daysWithData = 0;
    range.forEach((item) => {
      const day = dayTotalsByDate.value.get(item.key);
      if (!day) {
        return;
      }
      if (day.protein || day.fat || day.carbs) {
        daysWithData += 1;
        protein += day.protein;
        fat += day.fat;
        carbs += day.carbs;
      }
    });
    if (daysWithData > 0) {
      protein /= daysWithData;
      fat /= daysWithData;
      carbs /= daysWithData;
    }
    desc = 'Средние значения за неделю.';
  } else {
    const day = dayTotalsByDate.value.get(todayKey);
    protein = day?.protein || 0;
    fat = day?.fat || 0;
    carbs = day?.carbs || 0;
    desc = 'Фактические значения за сегодня.';
  }

  let proteinPct = 0;
  let fatPct = 0;
  let carbsPct = 0;
  let chartBackground = '#e2e8f0';
  let insight = 'Пока нет записей для анализа.';

  if (macroRange.value === 'day' && targetProtein > 0 && targetFat > 0 && targetCarbs > 0) {
    const p = Math.round(Math.max(0, Math.min(1, safeDivide(protein, targetProtein))) * 100);
    const f = Math.round(Math.max(0, Math.min(1, safeDivide(fat, targetFat))) * 100);
    const c = Math.round(Math.max(0, Math.min(1, safeDivide(carbs, targetCarbs))) * 100);
    proteinPct = p;
    fatPct = f;
    carbsPct = c;

    const totalTarget = targetProtein + targetFat + targetCarbs;
    const pArc = (Math.min(protein, targetProtein) / totalTarget) * 100;
    const fArc = (Math.min(fat, targetFat) / totalTarget) * 100;
    const cArc = (Math.min(carbs, targetCarbs) / totalTarget) * 100;
    const usedArc = Math.max(0, Math.min(100, pArc + fArc + cArc));
    chartBackground = `conic-gradient(#10b981 0 ${pArc}%, #f59e0b ${pArc}% ${pArc + fArc}%, #38bdf8 ${pArc + fArc}% ${usedArc}%, #e2e8f0 ${usedArc}% 100%)`;
    desc = 'Процент выполнения целей БЖУ за сегодня.';
    insight = 'Круг показывает прогресс по целям белков, жиров и углеводов.';
    return { proteinPct, fatPct, carbsPct, chartBackground, desc, insight };
  }

  const total = protein + fat + carbs;
  if (total > 0) {
    proteinPct = Math.round((protein / total) * 100);
    fatPct = Math.round((fat / total) * 100);
    carbsPct = Math.max(0, 100 - proteinPct - fatPct);
    chartBackground = `conic-gradient(#10b981 0 ${proteinPct}%, #f59e0b ${proteinPct}% ${proteinPct + fatPct}%, #38bdf8 ${proteinPct + fatPct}% 100%)`;

    const maxPercent = Math.max(proteinPct, fatPct, carbsPct);
    if (maxPercent >= 55) {
      insight = 'Есть заметный перекос по одному из макронутриентов.';
    } else {
      insight = 'Распределение БЖУ выглядит достаточно ровным.';
    }
  }

  return { proteinPct, fatPct, carbsPct, chartBackground, desc, insight };
});

const carbSplit = computed(() => {
  let simple = 0;
  let complex = 0;
  if (macroRange.value === 'week') {
    buildDateRange(7).forEach((item) => {
      const day = dayTotalsByDate.value.get(item.key);
      simple += day?.carbsSimple || 0;
      complex += day?.carbsComplex || 0;
    });
  } else {
    const day = dayTotalsByDate.value.get(todayKey);
    simple = day?.carbsSimple || 0;
    complex = day?.carbsComplex || 0;
  }
  const total = simple + complex;
  if (total <= 0) {
    return {
      value: 'Нет данных',
      desc: 'Пока нет данных. Сложные углеводы дают более стабильную энергию.'
    };
  }
  const simplePct = Math.round((simple / total) * 100);
  const complexPct = Math.max(0, 100 - simplePct);
  return {
    value: `${simplePct}% / ${complexPct}%`,
    desc: macroRange.value === 'week'
      ? 'Средние значения за неделю. Сложные углеводы дают более стабильную энергию.'
      : 'Фактические значения за сегодня. Сложные углеводы дают более стабильную энергию.'
  };
});

const weeklyAdjustments = computed(() => {
  const raw = (profile.value as Record<string, unknown>).weekly_adjustments;
  if (Array.isArray(raw)) {
    return raw
      .map((item) => String(item || '').trim())
      .filter((item) => item.length >= 5)
      .slice(0, 3);
  }
  if (typeof raw === 'string') {
    return raw
      .split(/[\n.;]/)
      .map((item) => item.trim())
      .filter((item) => item.length >= 5)
      .slice(0, 3);
  }
  return [] as string[];
});

const weeklyReview = computed(() => {
  const review = ((profile.value as Record<string, unknown>).weekly_review || {}) as Record<string, unknown>;
  const status = String(review.status || 'ok');
  const tone = resolveWeeklyStatusTone(status);
  const statusLabels: Record<string, string> = {
    overeat: 'Еды было больше, чем нужно',
    undereat: 'Еды было меньше, чем нужно',
    low_protein: 'Белка не хватает',
    low_discipline: 'Записей мало',
    ok: 'Ритм стабильный'
  };
  return {
    statusText: statusLabels[status] || 'Статус недели',
    message: String(review.message || 'Продолжайте фиксировать питание, чтобы получить точный итог недели.'),
    dotClass: tone.dotClass
  };
});

onMounted(async () => {
  try {
    const configResponse = await storage.apiFetch('/api/admin/config');
    if (configResponse.ok) {
      const configPayload = await configResponse.json();
      adminConfig.value = toRecord(configPayload);
      (window as { adminConfig?: Record<string, unknown> }).adminConfig = adminConfig.value;
    } else {
      adminConfig.value = {};
    }
  } catch {
    adminConfig.value = {};
  }

  await storage.syncProfileWithBackend();
  await storage.syncDiaryEntriesWithBackend();
  await storage.syncHabitEntriesWithBackend();

  if (typeof (window as { feather?: { replace?: () => void } }).feather?.replace === 'function') {
    (window as { feather: { replace: () => void } }).feather.replace();
  }
});
</script>


<style scoped>
.profile-card {
  background: #ffffff;
  border-radius: 1.5rem;
  border: 1px solid #e2e8f0;
  box-shadow: 0 20px 40px rgba(15, 23, 42, 0.08);
  width: 100%;
  box-sizing: border-box;
}

.profile-card--secondary {
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.06);
}

.profile-card--compact {
  padding: 1.25rem;
}

.trend-day {
  border: 1px solid #f1f5f9;
  border-radius: 0.5rem;
  background: #ffffff;
  padding: 0.35rem 0.25rem;
}

.is-today {
  border-color: rgba(45, 212, 191, 0.95) !important;
  box-shadow: 0 0 0 2px rgba(45, 212, 191, 0.2);
}
</style>
