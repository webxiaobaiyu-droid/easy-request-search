<script setup lang="ts">
import type { CapturedRequest } from '../../types/network'
import { t } from '../i18n'
import { statusDetail } from '../utils/format'
import HighlightText from './HighlightText.vue'

defineProps<{ request: CapturedRequest; keywords?: string[] }>()
</script>

<template>
  <div class="headers-view">
    <section class="data-section">
      <div class="section-heading"><h3>{{ t('headersGeneral') }}</h3></div>
      <div class="header-table">
        <div class="header-row"><code>Request URL</code><span><HighlightText :text="request.url" :keywords="keywords" /></span></div>
        <div class="header-row"><code>Request Method</code><span>{{ request.method }}</span></div>
        <div class="header-row"><code>Status Code</code><span>{{ statusDetail(request) }}</span></div>
        <div v-if="request.mimeType" class="header-row"><code>MIME Type</code><span>{{ request.mimeType }}</span></div>
      </div>
    </section>

    <section class="data-section">
      <div class="section-heading"><h3>{{ t('headersRequest') }}</h3><span>{{ request.requestHeaders.length }}</span></div>
      <div class="header-table">
        <div v-for="header in request.requestHeaders" :key="header.name" class="header-row">
          <code>{{ header.name }}</code><span><HighlightText :text="header.value" :keywords="keywords" /></span>
        </div>
      </div>
    </section>

    <section class="data-section">
      <div class="section-heading"><h3>{{ t('headersResponse') }}</h3><span>{{ request.responseHeaders.length }}</span></div>
      <div class="header-table">
        <div v-for="header in request.responseHeaders" :key="header.name" class="header-row">
          <code>{{ header.name }}</code><span><HighlightText :text="header.value" :keywords="keywords" /></span>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.headers-view { padding: 0 0 12px; }

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

.header-table { display: grid; }

.header-row {
  display: grid;
  grid-template-columns: minmax(110px, 0.55fr) minmax(0, 1.7fr);
  gap: 10px;
  align-items: baseline;
  min-height: 20px;
  padding: 2px 10px;
  font-size: 12px;
}

.header-row:hover { background: var(--panel-hover); }
.header-row code { overflow: hidden; color: var(--faint); font-family: var(--mono); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.header-row span { overflow-wrap: anywhere; color: var(--ink); font-family: var(--mono); font-size: 11px; line-height: 1.45; }
</style>
