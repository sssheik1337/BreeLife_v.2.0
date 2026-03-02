<template>
  <section class="min-h-screen bg-gradient-to-br from-[#f8fafc] via-[#f0f9ff] to-[#f0fdf4]">
    <main class="flex-1 px-4 py-8">
      <div class="max-w-md mx-auto">
        <div class="text-center mb-10">
          <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-r from-purple-400 to-pink-400 mb-4 shadow-lg">
            <i data-feather="check-circle" class="w-7 h-7 text-white"></i>
          </div>
          <h1 class="text-2xl font-bold text-slate-800">Профиль</h1>
          <p class="text-slate-500 mt-2">Ваши персональные данные, статус и ориентиры</p>
        </div>

        <div id="data-cards" class="space-y-4 mb-8">
          <div v-for="(card, index) in dataCards" :key="`card-${index}`" class="card animate-slide-in" :style="{ animationDelay: `${index * 0.1}s` }">
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center space-x-3">
                <div class="w-10 h-10 rounded-xl flex items-center justify-center" :class="card.colorClass">
                  <i :data-feather="card.icon" class="w-5 h-5"></i>
                </div>
                <h3 class="font-semibold text-slate-800">{{ card.label }}</h3>
              </div>
            </div>
            <div class="text-xl font-semibold text-slate-800 mb-2">{{ card.value }}</div>
            <div v-if="card.details" class="text-xs text-slate-500">{{ card.details }}</div>
          </div>
        </div>

        <div class="bg-white rounded-2xl p-6 shadow-lg border border-slate-100 mb-8">
          <div class="space-y-3 text-slate-700">
            <div class="flex items-center justify-between gap-3"><span class="text-left">Возраст</span><span id="age-value" class="font-semibold text-right tabular-nums shrink-0">{{ metrics.age }}</span></div>
            <div class="flex items-center justify-between gap-3"><span class="text-left">BMR (базовый обмен, расход в покое)</span><span id="bmr-value" class="font-semibold text-right tabular-nums shrink-0">{{ metrics.bmr }}</span></div>
            <div class="flex items-center justify-between gap-3"><span class="text-left">TDEE (суточный расход с учётом активности)</span><span id="tdee-value" class="font-semibold text-right tabular-nums shrink-0">{{ metrics.tdee }}</span></div>
          </div>
        </div>

        <div class="bg-white rounded-2xl p-6 shadow-lg border border-slate-100 mb-8">
          <div class="space-y-3 text-slate-700">
            <div class="flex items-center justify-between gap-3"><span class="text-left">План калорий на день</span><span id="calories-value" class="font-semibold text-right tabular-nums shrink-0">{{ metrics.calories }}</span></div>
            <div class="flex items-center justify-between gap-3"><span class="text-left">Белки</span><span id="protein-value" class="font-semibold text-right tabular-nums shrink-0">{{ metrics.protein }}</span></div>
            <div class="flex items-center justify-between gap-3"><span class="text-left">Жиры</span><span id="fat-value" class="font-semibold text-right tabular-nums shrink-0">{{ metrics.fat }}</span></div>
            <div class="flex items-center justify-between gap-3"><span class="text-left">Углеводы</span><span id="carbs-value" class="font-semibold text-right tabular-nums shrink-0">{{ metrics.carbs }}</span></div>
            <div class="flex items-center justify-between gap-3"><span class="text-left">Клетчатка</span><span id="fiber-value" class="font-semibold text-right tabular-nums shrink-0">{{ metrics.fiber }}</span></div>
          </div>
        </div>

        <div class="bg-white rounded-2xl p-6 shadow-lg border border-slate-100 mb-8">
          <div class="space-y-3 text-slate-700">
            <div class="flex items-center justify-between gap-3"><span class="text-left">Темп изменения веса</span><span id="weight-rate-value" class="font-semibold text-right tabular-nums shrink-0">{{ metrics.weightRate }}</span></div>
            <div class="flex items-center justify-between gap-3"><span class="text-left">Примерная дата достижения</span><span id="weight-date-value" class="font-semibold text-right tabular-nums shrink-0">{{ metrics.weightDate }}</span></div>
          </div>
        </div>

        <div id="recommendations-section" class="bg-white rounded-2xl p-6 shadow-lg border border-slate-100 mb-8" :class="{ hidden: trial.isExpired }">
          <div class="mb-3">
            <span id="recommendations-state" class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium" :class="recommendationsState.className">{{ recommendationsState.text }}</span>
          </div>
          <ul id="recommendations-list" class="space-y-2 text-slate-700">
            <li v-for="(item, index) in recommendations" :key="`rec-${index}`" class="flex items-start space-x-2">
              <span class="text-cyan-600">•</span>
              <span>{{ item }}</span>
            </li>
          </ul>
          <div class="mt-4 space-y-2 text-sm text-slate-500">
            <p id="diary-explanation">{{ explanations.diary }}</p>
            <p id="calories-explanation">{{ explanations.calories }}</p>
            <p id="macros-explanation">{{ explanations.macros }}</p>
            <p id="deadline-motivation" :class="{ hidden: !explanations.deadline }">{{ explanations.deadline }}</p>
            <p id="deadline-warning" class="text-rose-600" :class="{ hidden: !deadlineWarning }">{{ deadlineWarning }}</p>
          </div>
        </div>

        <div class="bg-white rounded-2xl p-6 shadow-lg border border-slate-100 mb-8">
          <div class="text-center py-4">
            <div id="bmi-value" class="text-5xl font-bold text-slate-800 mb-2">{{ bmi.value }}</div>
            <div id="bmi-category" class="text-slate-500">{{ bmi.category }}</div>
          </div>
          <div class="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div id="bmi-progress" class="h-full rounded-full transition-all duration-1000" :style="{ width: `${bmi.progress}%`, background: bmi.color }"></div>
          </div>
        </div>

        <div id="trial-card" class="bg-white rounded-2xl p-6 shadow-lg border border-slate-100 mb-8 text-center">
          <div class="flex items-center justify-center space-x-3 mb-4">
            <div class="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <i data-feather="clock" class="w-5 h-5 text-emerald-600"></i>
            </div>
            <h3 class="font-semibold text-slate-800">Мы всё рассчитали для вас</h3>
          </div>
          <div class="bg-emerald-50 rounded-2xl p-4 border border-emerald-100 shadow-sm">
            <div class="text-slate-700 font-semibold">План, нормы и рекомендации доступны в максимальном тарифе</div>
            <div v-if="trial.datesText" id="trial-dates" class="text-sm text-slate-500 mt-1">{{ trial.datesText }}</div>
          </div>
          <div class="mt-4 flex justify-center">
            <span id="trial-badge" class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold" :class="trial.badgeClass">{{ trial.badgeText }}</span>
          </div>
          <p id="trial-warning" class="text-sm text-amber-600 mt-3" :class="{ hidden: !trial.warningText }">{{ trial.warningText }}</p>
          <div id="paywall" class="mt-4" :class="{ hidden: !trial.showPaywall }">
            <div class="bg-rose-50 rounded-2xl p-4 border border-rose-100 shadow-sm">
              <p class="text-sm text-rose-700">Пробный период завершён. Чтобы продолжить пользоваться сервисом, оформите подписку.</p>
              <p id="payment-motivation" class="text-sm text-rose-700 mt-2">{{ trial.paymentMotivation }}</p>
            </div>
            <button id="pay-button" class="btn-primary w-full mt-4 flex items-center justify-center space-x-3" :disabled="trial.payProcessing" @click="startPayment">
              <i data-feather="credit-card" class="w-5 h-5"></i>
              <span>{{ trial.payProcessing ? 'Оплата...' : 'Оплатить' }}</span>
            </button>
          </div>
        </div>

        <div class="space-y-4">
          <button id="resume-go-progress-button" class="btn-primary w-full flex items-center justify-center space-x-3" @click="goProgress"><span>Перейти в прогресс</span></button>
          <button class="btn-secondary w-full flex items-center justify-center space-x-3" @click="goQuestionnaire"><span>Редактировать информацию</span></button>
          <button id="resume-copy-diagnostics-button" type="button" class="btn-secondary w-full flex items-center justify-center space-x-3" :class="{ hidden: !appDebug }" @click="copyDiagnostics"><span>Скопировать диагностику</span></button>
        </div>
      </div>
    </main>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useStorageStore } from '../stores/storageStore';
import { calculateAge, calculateBMR, calculateMacros, calculateTDEE } from '../core/calculations';

const router = useRouter();
const storage = useStorageStore();
const appDebug = (window as { appDebug?: boolean }).appDebug === true;

const loadedProfile = ref<Record<string, unknown>>({});
const deadlineWarning = ref('');
const aiText = ref('');

const recommendationsState = reactive({ text: 'Состояние: частично', className: 'bg-slate-100 text-slate-600' });
const explanations = reactive({
  diary: 'Заполняйте дневник питания ежедневно, чтобы рекомендации уточнялись.',
  calories: 'Калорийность рассчитана с учётом цели и текущих параметров.',
  macros: 'Баланс БЖУ рассчитывается от цели и плановой калорийности.',
  deadline: ''
});
const trial = reactive({
  datesText: 'Проверяем даты...',
  badgeText: 'Пробный период до --',
  badgeClass: 'bg-emerald-100 text-emerald-700',
  warningText: '',
  showPaywall: false,
  paymentMotivation: '',
  isExpired: false,
  payProcessing: false
});

const profile = computed(() => {
  if (Object.keys(loadedProfile.value).length > 0) return loadedProfile.value;
  return (storage.profile || {}) as Record<string, unknown>;
});
const targets = computed(() => storage.computeTargetsForProfile(profile.value, new Date(), false) as Record<string, unknown>);
const toNumber = (value: unknown): number | null => {
  if (typeof value === 'string') {
    const normalized = value.replace(',', '.').match(/-?\d+(\.\d+)?/);
    if (normalized) {
      const parsedFromString = Number(normalized[0]);
      if (Number.isFinite(parsedFromString)) return parsedFromString;
    }
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const formatGoal = (value: unknown): string => {
  if (value === 'lose') return 'Снижение веса';
  if (value === 'gain') return 'Набор массы';
  if (value === 'maintain') return 'Поддержание веса';
  return 'Не указано';
};
const age = computed(() => {
  const value = calculateAge(profile.value.birth_date as string);
  return Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null;
});

const metrics = computed(() => {
  const weight = toNumber(profile.value.weight_kg);
  const height = toNumber(profile.value.height_cm);
  const activityFactor = toNumber(profile.value.activity_factor);
  const profileBmr = toNumber(profile.value.bmr);
  const computedBmr = toNumber(calculateBMR({
    sex: profile.value.sex,
    weight_kg: weight,
    height_cm: height,
    age: age.value
  }));
  const bmr = profileBmr ?? computedBmr;

  const tdee = toNumber(
    targets.value.tdee_calories
    ?? profile.value.tdee_calories
    ?? calculateTDEE(bmr, activityFactor)
  );
  const calories = toNumber(profile.value.calories_target ?? targets.value.calories_target);

  const profileMacros = (profile.value.macros && typeof profile.value.macros === 'object')
    ? (profile.value.macros as Record<string, unknown>)
    : {};
  const fallbackMacros = (calculateMacros({
    goal: profile.value.goal,
    weight_kg: weight,
    calories_target: calories
  }) || {}) as Record<string, unknown>;
  const macros = Object.keys(profileMacros).length > 0 ? profileMacros : fallbackMacros;

  const fiber = toNumber((window as { adminConfig?: { reminders?: { fiber_target_g?: number } } }).adminConfig?.reminders?.fiber_target_g);
  const fallbackFiber = calories && calories > 0 ? Math.round((calories / 1000) * 14) : null;
  const weightRate = toNumber(
    targets.value.weight_rate_kg_per_week
    ?? profile.value.weight_rate_kg_per_week
    ?? targets.value.required_rate_kg_per_week
    ?? profile.value.required_rate_kg_per_week
  );
  const goal = profile.value.goal;
  const goalDateRaw = targets.value.predicted_goal_date ?? profile.value.predicted_goal_date ?? profile.value.goal_deadline;
  const goalDate = goalDateRaw instanceof Date
    ? goalDateRaw.toISOString()
    : (goalDateRaw !== null && goalDateRaw !== undefined ? String(goalDateRaw) : '');
  const goalDateParsed = goalDate ? new Date(goalDate) : null;
  return {
    age: age.value ? `${age.value} лет` : 'Нет расчёта',
    bmr: bmr ? `${Math.round(bmr)} ккал` : 'Нет расчёта',
    tdee: tdee ? `${Math.round(tdee)} ккал` : 'Нет расчёта',
    calories: calories ? `${Math.round(calories)} ккал` : 'Нет расчёта',
    protein: toNumber(macros.protein_g) ? `${Math.round(Number(macros.protein_g))} г` : 'Нет расчёта',
    fat: toNumber(macros.fat_g) ? `${Math.round(Number(macros.fat_g))} г` : 'Нет расчёта',
    carbs: toNumber(macros.carbs_g) ? `${Math.round(Number(macros.carbs_g))} г` : 'Нет расчёта',
    fiber: (fiber ?? fallbackFiber) ? `${Math.round(Number(fiber ?? fallbackFiber))} г` : 'Нет расчёта',
    weightRate: weightRate ? `${weightRate.toFixed(2)} кг/нед` : (goal === 'maintain' ? '0.00 кг/нед' : 'Нет расчёта'),
    weightDate: goalDateParsed && !Number.isNaN(goalDateParsed.getTime()) ? goalDateParsed.toLocaleDateString('ru-RU') : (goalDate || (goal === 'maintain' ? 'Поддержание' : 'Нет расчёта'))
  };
});

const levels = computed(() => {
  const has = (value: unknown) => value !== null && value !== undefined && value !== '';
  const missingA = has(profile.value.birth_date) ? [] : ['дата рождения'];
  const missingB = [has(profile.value.sex), age.value && age.value > 0, toNumber(profile.value.weight_kg), toNumber(profile.value.height_cm)].every(Boolean) ? [] : ['пол/возраст/вес/рост'];
  const missingC = [toNumber(profile.value.bmr), toNumber(profile.value.activity_factor)].every((value) => Number(value) > 0) ? [] : ['BMR/активность'];
  const missingD = [toNumber(profile.value.calories_target ?? targets.value.calories_target), has(profile.value.goal), toNumber(profile.value.weight_kg)].every(Boolean) ? [] : ['калории/цель/вес'];
  const missingE = [has(profile.value.goal), toNumber(profile.value.weight_kg), toNumber(targets.value.tdee_calories ?? profile.value.tdee_calories)].every(Boolean) ? [] : ['цель/вес/TDEE'];
  return {
    a: missingA.length ? `Не хватает: ${missingA.join(', ')}` : 'Возраст рассчитан',
    b: missingB.length ? `Не хватает: ${missingB.join(', ')}` : 'BMR рассчитан',
    c: missingC.length ? `Не хватает: ${missingC.join(', ')}` : 'TDEE рассчитан',
    d: missingD.length ? `Не хватает: ${missingD.join(', ')}` : 'Макросы рассчитаны',
    e: missingE.length ? `Не хватает: ${missingE.join(', ')}` : 'Прогноз рассчитан'
  };
});

const formatDate = (value: unknown): string => {
  if (typeof value !== 'string' || !value) return 'Не указано';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('ru-RU');
};
const dataCards = computed(() => {
  const currentWeight = toNumber(profile.value.weight_kg);
  const targetWeight = toNumber(profile.value.target_weight_kg);
  const cards = [
    { label: 'Пол', value: profile.value.sex === 'male' ? 'Мужской' : profile.value.sex === 'female' ? 'Женский' : 'Не указано', icon: 'user', colorClass: 'bg-emerald-50 text-emerald-600 border border-emerald-100', details: null as string | null },
    { label: 'Дата рождения', value: formatDate(profile.value.birth_date), icon: 'calendar', colorClass: 'bg-purple-50 text-purple-600 border border-purple-100', details: age.value ? `Возраст: ${age.value} лет` : null },
    { label: 'Рост', value: toNumber(profile.value.height_cm) ? `${profile.value.height_cm} см` : 'Не указано', icon: 'maximize-2', colorClass: 'bg-blue-50 text-blue-600 border border-blue-100', details: null as string | null },
    { label: 'Текущий вес', value: currentWeight ? `${currentWeight} кг` : 'Не указано', icon: 'activity', colorClass: 'bg-amber-50 text-amber-600 border border-amber-100', details: null as string | null },
    { label: 'Цель 🎯', value: formatGoal(profile.value.goal), icon: 'target', colorClass: 'bg-cyan-50 text-cyan-600 border border-cyan-100', details: typeof profile.value.goal_deadline === 'string' && profile.value.goal_deadline ? `Срок: ${formatDate(profile.value.goal_deadline)}` : null }
  ];
  if (profile.value.goal !== 'maintain') cards.push({ label: 'Желаемый вес', value: targetWeight ? `${targetWeight} кг` : 'Не указано', icon: 'target', colorClass: 'bg-pink-50 text-pink-600 border border-pink-100', details: currentWeight && targetWeight ? `${(targetWeight - currentWeight).toFixed(1)} кг разница` : null });
  return cards;
});
const bmi = computed(() => {
  const weight = toNumber(profile.value.weight_kg);
  const height = toNumber(profile.value.height_cm);
  if (!(weight && height)) return { value: '—', category: 'Вычисление...', progress: 0, color: '#e2e8f0' };
  const meters = height / 100;
  const value = weight / (meters * meters);
  if (!Number.isFinite(value)) return { value: '—', category: 'Вычисление...', progress: 0, color: '#e2e8f0' };
  if (value < 18.5) return { value: value.toFixed(1), category: 'Недостаточный вес', progress: Math.min(100, (value / 40) * 100), color: '#38bdf8' };
  if (value < 25) return { value: value.toFixed(1), category: 'Нормальный вес', progress: Math.min(100, (value / 40) * 100), color: '#22c55e' };
  if (value < 30) return { value: value.toFixed(1), category: 'Избыточный вес', progress: Math.min(100, (value / 40) * 100), color: '#f59e0b' };
  return { value: value.toFixed(1), category: 'Ожирение', progress: Math.min(100, (value / 40) * 100), color: '#ef4444' };
});
const recommendations = computed(() => {
  const list = ['Пейте воду равномерно в течение дня.', 'Держите стабильный режим сна.', 'Регулярно заполняйте дневник питания.'];
  if (aiText.value) list.unshift(aiText.value);
  return list;
});
const setRecommendationState = (state: 'loading' | 'partial' | 'ready' | 'error', text: string) => {
  recommendationsState.text = text;
  recommendationsState.className = state === 'loading'
    ? 'bg-amber-100 text-amber-700'
    : state === 'ready'
      ? 'bg-emerald-100 text-emerald-700'
      : state === 'error'
        ? 'bg-rose-100 text-rose-700'
        : 'bg-slate-100 text-slate-600';
};

const loadAiRecommendation = async () => {
  setRecommendationState('loading', 'Состояние: загрузка - получаем AI-рекомендации...');
  try {
    const response = await storage.apiFetch('/api/ai/recommendation', { method: 'POST', body: JSON.stringify(profile.value) });
    if (!response.ok) {
      setRecommendationState('error', 'Состояние: ошибка - не удалось получить AI-рекомендации.');
      return;
    }
    const data = await response.json();
    const text = typeof data?.text === 'string' && data.text.trim() ? data.text.trim() : (typeof data?.recommendation === 'string' ? data.recommendation.trim() : '');
    if (!text) {
      setRecommendationState('partial', 'Состояние: частично - используем базовые рекомендации.');
      return;
    }
    aiText.value = text;
    const sentences = text.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/).map((item: string) => item.trim()).filter(Boolean);
    const findSentence = (patterns: RegExp[]) => sentences.find((sentence: string) => patterns.some((pattern) => pattern.test(sentence.toLowerCase()))) || '';
    const caloriesSentence = findSentence([/ккал/, /калор/]);
    const macrosSentence = findSentence([/белк/, /жир/, /углевод/, /бжу/]);
    const deadlineSentence = findSentence([/дата/, /срок/, /дедлайн/, /недел/]);
    if (caloriesSentence) explanations.calories = caloriesSentence;
    if (macrosSentence) explanations.macros = macrosSentence;
    if (deadlineSentence) explanations.deadline = deadlineSentence;
    setRecommendationState('ready', 'Состояние: готово - AI-рекомендации применены.');
  } catch {
    setRecommendationState('error', 'Состояние: ошибка - не удалось применить AI-рекомендации.');
  }
};

const loadTrialStatus = async () => {
  try {
    let response = await storage.apiFetch('/api/subscription/status');
    if (!response.ok) {
      trial.datesText = 'Попробуйте обновить страницу.';
      trial.badgeText = 'Пробный период до --';
      trial.badgeClass = 'bg-slate-100 text-slate-600';
      return;
    }
    let data = await response.json();
    if (data?.subscription_status === 'none') {
      const startResponse = await storage.apiFetch('/api/subscription/start_trial', { method: 'POST', body: JSON.stringify({}) });
      if (startResponse.ok) data = await startResponse.json();
    }
    const until = typeof data?.subscription_until === 'string' ? data.subscription_until : null;
    const untilDate = until ? new Date(until) : null;
    const untilText = untilDate && !Number.isNaN(untilDate.getTime()) ? untilDate.toLocaleDateString('ru-RU') : '--';
    trial.showPaywall = data?.subscription_status === 'expired';
    trial.isExpired = trial.showPaywall;
    if (trial.showPaywall) {
      trial.datesText = `Пробный период закончился ${untilText}.`;
      trial.badgeText = 'Пробный период завершён';
      trial.badgeClass = 'bg-rose-100 text-rose-700';
      trial.paymentMotivation = 'Оплата откроет персональные рекомендации и расширенную аналитику.';
      return;
    }
    trial.badgeText = until ? `Максимальный доступ до ${untilText}` : 'Доступ активен';
    trial.datesText = '';
    trial.badgeClass = 'bg-emerald-100 text-emerald-700';
    trial.warningText = '';
    if (data?.subscription_status === 'trial' && untilDate && !Number.isNaN(untilDate.getTime())) {
      const daysLeft = Math.ceil((untilDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysLeft <= 3 && daysLeft >= 0) trial.warningText = 'Пробный период скоро закончится. Можно заранее оформить подписку.';
    }
  } catch {
    trial.datesText = 'Попробуйте обновить страницу.';
    trial.badgeText = 'Пробный период до --';
    trial.badgeClass = 'bg-slate-100 text-slate-600';
  }
};

const startPayment = async () => {
  trial.payProcessing = true;
  try {
    const response = await storage.apiFetch('/api/payments/start', { method: 'POST', body: JSON.stringify({ days: 30 }) });
    if (response.ok) await loadTrialStatus();
  } finally {
    trial.payProcessing = false;
  }
};

const goProgress = async () => { await router.push('/profile'); };
const goQuestionnaire = async () => { await router.push('/questionnaire?edit=1'); };
const copyDiagnostics = async () => {
  if (!appDebug) return;
  const payload = JSON.stringify({ profile: profile.value, targets: targets.value, levels: levels.value, metrics: metrics.value }, null, 2);
  if (navigator?.clipboard?.writeText) await navigator.clipboard.writeText(payload);
};

onMounted(async () => {
  await storage.syncProfileWithBackend();
  loadedProfile.value = storage.profile as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  ['tdee_calories', 'calories_target', 'calorie_delta', 'weight_rate_kg_per_week', 'predicted_goal_date', 'safe_weeks_estimate', 'required_rate_kg_per_week', 'required_calorie_delta', 'required_calories_target', 'macros'].forEach((key) => {
    if (JSON.stringify(profile.value[key]) !== JSON.stringify(targets.value[key]) && targets.value[key] !== undefined) patch[key] = targets.value[key];
  });
  if (Object.keys(patch).length > 0) await storage.patchUserProfileWithBackend(patch);
  if (typeof profile.value.goal_deadline === 'string' && profile.value.goal_deadline) {
    const d = new Date(profile.value.goal_deadline);
    const t = new Date(); t.setHours(0, 0, 0, 0); d.setHours(0, 0, 0, 0);
    if (!Number.isNaN(d.getTime()) && d < t) deadlineWarning.value = 'Дедлайн уже прошёл. Можно выбрать новую дату.';
  }
  await loadAiRecommendation();
  await loadTrialStatus();
  if (typeof (window as { feather?: { replace?: () => void } }).feather?.replace === 'function') (window as { feather: { replace: () => void } }).feather.replace();
});
</script>
