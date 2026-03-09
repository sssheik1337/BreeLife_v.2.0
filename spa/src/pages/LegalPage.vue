<template>
    <section class="min-h-screen bg-gradient-to-br from-[#f8fafc] via-[#f0f9ff] to-[#f0fdf4]">
        <main class="flex-1 px-4 py-8">
            <div class="max-w-3xl mx-auto space-y-6">
                <div class="text-center">
                    <h1 class="text-2xl font-bold text-slate-800">Юридическая информация</h1>
                    <p class="text-slate-500 mt-2">Актуальная редакция публичной оферты на повторные списания.</p>
                </div>

                <div class="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-4">
                    <p v-if="isLoading" class="text-slate-400 text-center">Загружаем документ...</p>
                    <p v-else-if="loadError" class="text-rose-600 text-center">{{ loadError }}</p>
                    <template v-else-if="offer">
                        <div class="space-y-2">
                            <h2 class="text-xl font-semibold text-slate-800">{{ offer.title }}</h2>
                            <p v-if="offer.summary" class="text-slate-500">{{ offer.summary }}</p>
                            <p class="text-sm text-slate-400">Версия v{{ offer.version }} · {{ publishedAtLabel }}</p>
                        </div>

                        <div class="legal-page__content" v-html="renderedBody"></div>
                    </template>
                    <p v-else class="text-slate-400 text-center">Оферта пока не опубликована.</p>
                </div>
            </div>
        </main>
    </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { legalApi } from '../api/legalApi';
import type { LegalOfferVersion } from '../api/contracts';
import { renderLegalMarkdown } from '../utils/legalMarkdown';

const offer = ref<LegalOfferVersion | null>(null);
const isLoading = ref(true);
const loadError = ref('');

const publishedAtLabel = computed(() => {
    const raw = offer.value?.published_at;
    if (typeof raw !== 'string' || !raw) {
        return 'дата не указана';
    }
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
        return raw;
    }
    return new Intl.DateTimeFormat('ru-RU', {
        timeZone: 'Europe/Moscow',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(parsed) + ' МСК';
});

const renderedBody = computed(() => renderLegalMarkdown(offer.value?.body_markdown) || '<p>Текст оферты отсутствует.</p>');

onMounted(async () => {
    isLoading.value = true;
    loadError.value = '';
    try {
        const payload = await legalApi.getCurrent();
        offer.value = payload.current_offer ?? null;
    } catch {
        loadError.value = 'Не удалось загрузить оферту.';
        offer.value = null;
    } finally {
        isLoading.value = false;
    }
});
</script>

<style scoped>
.legal-page__content {
  border: 1px solid #e2e8f0;
  border-radius: 18px;
  background: #ffffff;
  padding: 18px 16px;
  line-height: 1.7;
  color: #0f172a;
  min-width: 0;
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
  overflow-x: hidden;
}

.legal-page__content :deep(h1),
.legal-page__content :deep(h2),
.legal-page__content :deep(h3) {
  margin: 0 0 12px;
  line-height: 1.3;
}

.legal-page__content :deep(p),
.legal-page__content :deep(ul) {
  margin: 0 0 12px;
}

.legal-page__content :deep(ul) {
  padding-left: 20px;
}

.legal-page__content :deep(*) {
  max-width: 100%;
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
}
</style>
