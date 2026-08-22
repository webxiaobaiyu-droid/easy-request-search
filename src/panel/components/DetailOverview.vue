<script setup lang="ts">
import type { CapturedRequest } from '../../types/network'
import { t } from '../i18n'
import { formatClock, formatDuration, formatSize } from '../utils/format'
import HighlightText from './HighlightText.vue'

defineProps<{ request: CapturedRequest; keywords?: string[] }>()

defineEmits<{ 'goto-tab': [tab: 'params'] }>()
</script>

<template>
  <div class="overview-view">
    <dl class="overview-grid">
      <div><dt>{{ t('overviewStatus') }}</dt><dd>{{ request.status }} {{ request.statusText }}</dd></div>
      <div><dt>{{ t('overviewType') }}</dt><dd>{{ request.resourceType }}</dd></div>
      <div><dt>{{ t('overviewDuration') }}</dt><dd>{{ formatDuration(request.duration) }}</dd></div>
      <div><dt>{{ t('overviewSize') }}</dt><dd>{{ formatSize(request.size) }}</dd></div>
      <div><dt>{{ t('overviewStart') }}</dt><dd>{{ formatClock(request.startedAt) }}</dd></div>
      <div><dt>{{ t('overviewMime') }}</dt><dd>{{ request.mimeType || '—' }}</dd></div>
    </dl>

    <section class="url-section">
      <h3>{{ t('fullUrl') }}</h3>
      <code><HighlightText :text="request.url" :keywords="keywords" /></code>
    </section>

    <section v-if="request.parameters.length" class="preview-section">
      <div class="section-heading">
        <h3>{{ t('paramPreview') }}</h3>
        <button type="button" @click="$emit('goto-tab', 'params')">{{ t('viewAllItems', { n: request.parameters.length }) }}</button>
      </div>
      <div class="preview-rows">
        <div
          v-for="parameter in request.parameters.slice(0, 12)"
          :key="`${parameter.source}-${parameter.path}`"
          class="preview-row"
        >
          <i :class="parameter.source" aria-hidden="true"></i>
          <code><HighlightText :text="parameter.path" :keywords="keywords" /></code>
          <span><HighlightText :text="parameter.value" :keywords="keywords" /></span>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.overview-view { padding: 0 0 12px; }

.overview-grid {
  display: grid;
  margin: 0;
}

.overview-grid > div {
  display: grid;
  grid-template-columns: minmax(110px, 0.55fr) minmax(0, 1.7fr);
  gap: 10px;
  align-items: baseline;
  min-width: 0;
  min-height: 20px;
  padding: 2px 10px;
}

.overview-grid > div:hover { background: var(--panel-hover); }
.overview-grid dt { color: var(--faint); font-size: 12px; }
.overview-grid dd { overflow: hidden; margin: 0; color: var(--ink); font-family: var(--mono); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }

.url-section, .preview-section { margin-top: 4px; }

.url-section h3, .section-heading h3 { margin: 0; color: var(--ink); font-size: 12px; font-weight: 600; }

.section-heading {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 22px;
  padding: 0 10px;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  background: var(--panel-muted);
}

.url-section .section-heading { border-top: 0; }

.section-heading button { padding: 0; color: var(--accent); font-size: 11px; border: 0; cursor: pointer; }
.section-heading button:hover { text-decoration: underline; }

.url-section code {
  display: block;
  padding: 6px 10px;
  overflow-wrap: anywhere;
  color: var(--ink);
  font-family: var(--mono);
  font-size: 11px;
  line-height: 1.5;
}

.preview-rows { display: grid; }

.preview-row {
  display: grid;
  grid-template-columns: 6px minmax(90px, 0.8fr) minmax(0, 1.4fr);
  align-items: baseline;
  gap: 8px;
  min-height: 20px;
  padding: 2px 10px;
}

.preview-row:hover { background: var(--panel-hover); }
.preview-row i { align-self: center; width: 5px; height: 5px; border-radius: 50%; background: var(--accent); }
.preview-row i.body { background: var(--warning); }
.preview-row code { overflow: hidden; color: var(--accent); font-family: var(--mono); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.preview-row span { overflow: hidden; color: var(--ink); font-family: var(--mono); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
</style>
