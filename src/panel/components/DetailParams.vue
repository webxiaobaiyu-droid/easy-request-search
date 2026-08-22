<script setup lang="ts">
import { computed } from 'vue'
import type { CapturedRequest } from '../../types/network'
import { t } from '../i18n'
import HighlightText from './HighlightText.vue'

const props = defineProps<{ request: CapturedRequest; keywords?: string[] }>()

const queryParameters = computed(() => props.request.queryParameters)
const bodyParameters = computed(() => props.request.bodyParameters)
</script>

<template>
  <div class="params-view">
    <section class="data-section">
      <div class="section-heading"><h3>{{ t('queryParams') }}</h3><span>{{ queryParameters.length }}</span></div>
      <div v-if="queryParameters.length" class="parameter-table">
        <div v-for="parameter in queryParameters" :key="parameter.path" class="parameter-row">
          <code><HighlightText :text="parameter.path" :keywords="keywords" /></code>
          <span><HighlightText :text="parameter.value" :keywords="keywords" /></span>
        </div>
      </div>
      <div v-else class="inline-empty">{{ t('noQueryParams') }}</div>
    </section>

    <section class="data-section">
      <div class="section-heading"><h3>{{ t('bodyParams') }}</h3><span>{{ bodyParameters.length }}</span></div>
      <div v-if="bodyParameters.length" class="parameter-table">
        <div v-for="parameter in bodyParameters" :key="parameter.path" class="parameter-row">
          <code><HighlightText :text="parameter.path" :keywords="keywords" /></code>
          <span><HighlightText :text="parameter.value" :keywords="keywords" /></span>
        </div>
      </div>
      <div v-else class="inline-empty">{{ t('noBodyParams') }}</div>
    </section>
  </div>
</template>

<style scoped>
.params-view { padding: 0 0 12px; }

.data-section + .data-section { margin-top: 4px; }

.section-heading {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 22px;
  margin: 0;
  padding: 0 10px;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  background: var(--panel-muted);
}

.data-section:first-child .section-heading { border-top: 0; }

.section-heading h3 { margin: 0; color: var(--ink); font-size: 12px; font-weight: 600; }
.section-heading > span { color: var(--faint); font-family: var(--mono); font-size: 10px; }

.parameter-table { display: grid; }

.parameter-row {
  display: grid;
  grid-template-columns: minmax(120px, 0.6fr) minmax(0, 1.6fr);
  gap: 10px;
  align-items: baseline;
  min-height: 20px;
  padding: 2px 10px;
}

.parameter-row:hover { background: var(--panel-hover); }
.parameter-row code { overflow: hidden; color: var(--accent); font-family: var(--mono); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.parameter-row span { overflow-wrap: anywhere; color: var(--ink); font-family: var(--mono); font-size: 11px; line-height: 1.45; }

.inline-empty { padding: 8px 10px; color: var(--faint); }
</style>
