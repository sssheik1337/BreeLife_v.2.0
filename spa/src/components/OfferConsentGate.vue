<template>
    <div v-if="visible" class="offer-gate" role="dialog" aria-modal="true" aria-label="Подтверждение оферты">
        <div class="offer-gate__backdrop"></div>

        <div class="offer-gate__shell">
            <div class="offer-gate__card">
                <p class="offer-gate__eyebrow">Юридическая информация</p>
                <h2 class="offer-gate__title">{{ offerTitle }}</h2>
                <p class="offer-gate__subtitle">
                    Опубликована новая версия оферты. Чтобы продолжить пользоваться приложением и повторными списаниями, подтвердите условия.
                </p>

                <div v-if="offerSummary" class="offer-gate__summary">{{ offerSummary }}</div>
                <div class="offer-gate__content" v-html="renderedBody"></div>

                <div class="offer-gate__actions">
                    <button type="button" class="btn-primary" :disabled="submitting" @click="acceptOffer">
                        {{ submitting ? 'Сохраняем...' : 'Принимаю условия' }}
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { legalApi } from '../api/legalApi';
import { renderLegalMarkdown } from '../utils/legalMarkdown';

const route = useRoute();
const router = useRouter();

const visible = ref(false);
const submitting = ref(false);
const offer = ref<Record<string, unknown> | null>(null);

const offerTitle = computed(() => String(offer.value?.title || 'Публичная оферта'));
const offerSummary = computed(() => String(offer.value?.summary || '').trim());
const renderedBody = computed(() => renderLegalMarkdown(offer.value?.body_markdown) || '<p>Текст оферты отсутствует.</p>');

const loadStatus = async (): Promise<void> => {
    try {
        const payload = await legalApi.getStatus();
        if (payload?.needs_acceptance === true && payload.current_offer && typeof payload.current_offer === 'object') {
            offer.value = payload.current_offer as Record<string, unknown>;
            visible.value = true;
            return;
        }
    } catch {
        // Ignore unauthorized/temporary failures. Gate will retry on next page load.
    }
    visible.value = false;
};

const acceptOffer = async (): Promise<void> => {
    if (submitting.value) {
        return;
    }
    submitting.value = true;
    try {
        await legalApi.acceptCurrent();
        visible.value = false;
        if (route.path === '/legal') {
            await router.replace('/resume');
        }
    } catch {
        const notify = (window as Window & { showNotification?: (message: string, tone?: string) => void }).showNotification;
        if (typeof notify === 'function') {
            notify('Не удалось подтвердить новую редакцию оферты.', 'error');
        }
    } finally {
        submitting.value = false;
    }
};

onMounted(() => {
    void loadStatus();
});
</script>

<style scoped>
.offer-gate {
  position: fixed;
  inset: 0;
  z-index: 2147483450;
}

.offer-gate__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.68);
  backdrop-filter: blur(8px);
}

.offer-gate__shell {
  position: relative;
  z-index: 1;
  min-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.offer-gate__card {
  width: min(100%, 760px);
  max-height: calc(100vh - 40px);
  overflow: auto;
  border-radius: 28px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.99) 0%, #f8fafc 100%);
  border: 1px solid rgba(148, 163, 184, 0.22);
  box-shadow: 0 28px 70px rgba(15, 23, 42, 0.24);
  padding: 24px 22px;
}

.offer-gate__eyebrow {
  margin: 0 0 8px;
  color: #0f766e;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.offer-gate__title {
  margin: 0;
  font-size: 28px;
  line-height: 1.2;
  color: #0f172a;
  text-align: center;
}

.offer-gate__subtitle {
  margin: 12px auto 0;
  max-width: 60ch;
  color: #475569;
  line-height: 1.6;
  text-align: center;
}

.offer-gate__summary {
  margin-top: 18px;
  padding: 12px 14px;
  border-radius: 16px;
  background: #eef2ff;
  color: #334155;
}

.offer-gate__content {
  margin-top: 18px;
  border: 1px solid #e2e8f0;
  border-radius: 18px;
  padding: 18px 16px;
  background: #ffffff;
  color: #0f172a;
  line-height: 1.65;
}

.offer-gate__content :deep(h1),
.offer-gate__content :deep(h2),
.offer-gate__content :deep(h3) {
  margin: 0 0 12px;
  line-height: 1.3;
}

.offer-gate__content :deep(p),
.offer-gate__content :deep(ul) {
  margin: 0 0 12px;
}

.offer-gate__content :deep(ul) {
  padding-left: 20px;
}

.offer-gate__actions {
  margin-top: 20px;
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

@media (max-width: 768px) {
  .offer-gate__shell {
    padding: 12px;
  }

  .offer-gate__card {
    max-height: calc(100vh - 24px);
    padding: 18px 16px;
    border-radius: 24px;
  }

  .offer-gate__title {
    font-size: 24px;
  }
}
</style>
