<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  File,
  FileCode2,
  FileJson2,
  FileText,
  Globe,
  Image,
  Type,
  Waves,
} from 'lucide-vue-next'
import type { CapturedRequest } from '../../types/network'
import { matchBatchKeywords } from '../../core/filter'
import { t } from '../i18n'
import { batchColor } from '../utils/batch'
import {
  formatDuration,
  formatResourceType,
  formatSize,
  methodClass,
  requestName,
  statusClass,
  statusLabel,
  waterfallBar,
  waterfallWindow,
} from '../utils/format'

const props = defineProps<{
  requests: CapturedRequest[]
  totalCount: number
  selectedId: string
  isPreview: boolean
  waterfall: boolean
  batchKeywords?: string[]
}>()

defineEmits<{
  select: [request: CapturedRequest]
  reset: []
  'toggle-waterfall': []
}>()

type IconKind = 'json' | 'document' | 'script' | 'stylesheet' | 'image' | 'font' | 'websocket' | 'file'

const TYPE_ICONS: Record<IconKind, typeof File> = {
  json: FileJson2,
  document: FileText,
  script: FileCode2,
  stylesheet: FileText,
  image: Image,
  font: Type,
  websocket: Globe,
  file: File,
}

function iconKind(resourceType: string, mimeType: string): IconKind {
  const type = formatResourceType(resourceType, mimeType)
  if (['fetch', 'xhr', 'preflight', 'json'].includes(type) || mimeType.includes('json')) return 'json'
  if (type === 'document' || type === 'html') return 'document'
  if (type === 'script') return 'script'
  if (type === 'stylesheet') return 'stylesheet'
  if (['png', 'jpeg', 'gif', 'webp', 'svg'].some((ext) => type.includes(ext))) return 'image'
  if (type === 'font' || mimeType.startsWith('font/')) return 'font'
  if (type === 'websocket') return 'websocket'
  return 'file'
}

const ICON_CLASSES: Record<IconKind, string> = {
  json: 'icon-json',
  document: 'icon-document',
  script: 'icon-script',
  stylesheet: 'icon-stylesheet',
  image: 'icon-image',
  font: 'icon-font',
  websocket: 'icon-websocket',
  file: 'icon-file',
}

const transferred = computed(() => props.requests.reduce((sum, request) => sum + request.size, 0))

// Virtual window: rows are a fixed --row-h tall, so a slice plus padding covers the scroll range.
const ROW_HEIGHT = 21
const OVERSCAN = 12
const scrollContainer = ref<HTMLElement | null>(null)
const scrollTop = ref(0)
const viewportHeight = ref(400)
let resizeObserver: ResizeObserver | undefined

const visibleRange = computed(() => {
  const total = props.requests.length
  const first = Math.max(0, Math.floor(scrollTop.value / ROW_HEIGHT) - OVERSCAN)
  const rowsInView = Math.ceil(viewportHeight.value / ROW_HEIGHT) + OVERSCAN * 2
  const last = Math.min(total, first + rowsInView)
  return { first, last, padTop: first * ROW_HEIGHT, padBottom: Math.max(0, (total - last) * ROW_HEIGHT) }
})

const visibleRequests = computed(() => props.requests.slice(visibleRange.value.first, visibleRange.value.last))

function readScroll(): void {
  const el = scrollContainer.value
  if (!el) return
  scrollTop.value = el.scrollTop
  viewportHeight.value = el.clientHeight
}

// Keyboard navigation changes the selection from outside; keep that row on screen.
const HEADER_HEIGHT = 21
watch(
  () => props.selectedId,
  (id) => {
    const el = scrollContainer.value
    if (!el) return
    const index = props.requests.findIndex((request) => request.id === id)
    if (index < 0) return
    const top = HEADER_HEIGHT + index * ROW_HEIGHT
    if (top < el.scrollTop) el.scrollTop = top
    else if (top + ROW_HEIGHT > el.scrollTop + el.clientHeight) el.scrollTop = top + ROW_HEIGHT - el.clientHeight
    readScroll()
  },
)

onMounted(() => {
  const el = scrollContainer.value
  if (!el) return
  el.addEventListener('scroll', readScroll, { passive: true })
  resizeObserver = new ResizeObserver(readScroll)
  resizeObserver.observe(el)
  readScroll()
})

onBeforeUnmount(() => {
  scrollContainer.value?.removeEventListener('scroll', readScroll)
  resizeObserver?.disconnect()
})

const timeWindow = computed(() => waterfallWindow(props.requests))

function barStyle(request: CapturedRequest): Record<string, string> {
  const { left, width } = waterfallBar(request, timeWindow.value)
  return { left: `${left}%`, width: `${width}%` }
}

function rowKeywordIndexes(request: CapturedRequest): number[] {
  if (!props.batchKeywords?.length) return []
  return matchBatchKeywords(request, props.batchKeywords)
}

function truncateKeyword(keyword: string): string {
  return keyword.length > 14 ? `${keyword.slice(0, 13)}…` : keyword
}

/** Legend entries: per-keyword hit counts over the visible list. */
const batchLegend = computed(() => {
  const keywords = props.batchKeywords ?? []
  if (keywords.length === 0) return null
  const counts = new Array<number>(keywords.length).fill(0)
  for (const request of props.requests) {
    for (const index of matchBatchKeywords(request, keywords)) counts[index] += 1
  }
  return keywords.map((keyword, index) => ({ keyword, index, count: counts[index] }))
})
</script>

<template>
  <div class="request-ledger" :class="{ 'has-batch': !!batchLegend }">
    <div v-if="batchLegend" class="batch-summary" role="status">
      <span class="batch-summary-label">{{ t('batchSummaryLabel') }}</span>
      <span
        v-for="entry in batchLegend"
        :key="entry.index"
        class="batch-legend-chip"
        :class="{ unmatched: entry.count === 0 }"
        :style="entry.count > 0 ? { color: batchColor(entry.index), borderColor: batchColor(entry.index) } : undefined"
        :title="entry.keyword"
      >
        {{ truncateKeyword(entry.keyword) }} ×{{ entry.count }}
      </span>
    </div>
    <div ref="scrollContainer" class="request-table" role="table" :aria-label="t('requestList')">
      <div :class="['request-row', 'table-header', { 'with-waterfall': waterfall }]" role="row">
        <span role="columnheader">{{ t('colMethod') }}</span>
        <span role="columnheader">{{ t('colName') }}</span>
        <span role="columnheader">{{ t('colStatus') }}</span>
        <span role="columnheader">{{ t('colType') }}</span>
        <span role="columnheader">{{ t('colSize') }}</span>
        <span role="columnheader">{{ t('colTime') }}</span>
        <span v-if="waterfall" role="columnheader">{{ t('colWaterfall') }}</span>
      </div>
      <div
        v-if="requests.length"
        class="request-rows"
        :style="{ paddingTop: `${visibleRange.padTop}px`, paddingBottom: `${visibleRange.padBottom}px` }"
      >
        <button
          v-for="request in visibleRequests"
          :key="request.id"
          class="request-row data-row"
          :class="[{ selected: selectedId === request.id, 'with-waterfall': waterfall }, statusClass(request.status)]"
          type="button"
          role="row"
          @click="$emit('select', request)"
        >
          <i
            v-if="rowKeywordIndexes(request).length"
            class="row-keyword-marker"
            :style="{ background: batchColor(rowKeywordIndexes(request)[0]) }"
            aria-hidden="true"
          ></i>
          <span class="method-cell" :class="methodClass(request.method)" role="cell">{{ request.method }}</span>
          <span class="name-cell" role="cell" :title="request.url">
            <component
              :is="TYPE_ICONS[iconKind(request.resourceType, request.mimeType)]"
              :size="14"
              :stroke-width="1.6"
              class="type-icon"
              :class="ICON_CLASSES[iconKind(request.resourceType, request.mimeType)]"
              aria-hidden="true"
            />
            <strong>{{ requestName(request) }}</strong>
            <template v-if="batchKeywords?.length">
              <span
                v-for="index in rowKeywordIndexes(request).slice(0, 2)"
                :key="index"
                class="row-keyword-tag"
                :style="{ color: batchColor(index), borderColor: batchColor(index) }"
              >{{ truncateKeyword(batchKeywords[index]) }}</span>
              <span
                v-if="rowKeywordIndexes(request).length > 2"
                class="row-keyword-tag row-keyword-more"
              >+{{ rowKeywordIndexes(request).length - 2 }}</span>
            </template>
          </span>
          <span class="status-cell" role="cell" :title="request.status <= 0 ? request.statusText : ''">{{ statusLabel(request) }}</span>
          <span class="type-cell" role="cell" :title="request.mimeType">
            {{ formatResourceType(request.resourceType, request.mimeType) }}
          </span>
          <span class="size-cell" role="cell">{{ formatSize(request.size) }}</span>
          <span class="time-cell" role="cell">
            <i :style="{ '--duration': `${Math.min(100, Math.max(4, request.duration / 8))}%` }"></i>
            {{ formatDuration(request.duration) }}
          </span>
          <span v-if="waterfall" class="waterfall-cell" role="cell">
            <i :style="barStyle(request)"></i>
          </span>
        </button>
      </div>
      <div v-else class="empty-state">
        <FileJson2 :size="26" :stroke-width="1.2" aria-hidden="true" />
        <strong>{{ totalCount ? t('noMatch') : t('waiting') }}</strong>
        <button v-if="totalCount" type="button" @click="$emit('reset')">{{ t('clearAllFilters') }}</button>
      </div>
    </div>

    <footer class="ledger-status">
      <span>{{ t('requestCount', { n: requests.length }) }}</span>
      <span v-if="isPreview" class="preview-label">{{ t('previewData') }}</span>
      <button
        class="waterfall-toggle"
        :class="{ active: waterfall }"
        type="button"
        :title="waterfall ? t('hideWaterfall') : t('showWaterfall')"
        :aria-pressed="waterfall"
        @click="$emit('toggle-waterfall')"
      >
        <Waves :size="13" :stroke-width="1.8" aria-hidden="true" />
        {{ t('colWaterfall') }}
      </button>
      <span class="transferred">{{ t('transferred') }} {{ formatSize(transferred) }}</span>
    </footer>
  </div>
</template>

<style scoped>
.request-ledger {
  display: grid;
  grid-template-rows: minmax(0, 1fr) 27px;
  min-width: 0;
  min-height: 0;
  background: var(--panel);
}

.request-ledger.has-batch { grid-template-rows: auto minmax(0, 1fr) 27px; }

.batch-summary {
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 22px;
  padding: 0 6px;
  overflow-x: auto;
  white-space: nowrap;
  border-bottom: 1px solid var(--line);
  background: var(--panel-muted);
  scrollbar-width: none;
}

.batch-summary::-webkit-scrollbar { display: none; }
.batch-summary-label { flex: 0 0 auto; color: var(--faint); font-size: 11px; }

.batch-legend-chip {
  flex: 0 0 auto;
  height: 16px;
  line-height: 14px;
  padding: 0 5px;
  font-family: var(--mono);
  font-size: 10px;
  border: 1px solid var(--line-strong);
  border-radius: 8px;
}

.batch-legend-chip.unmatched { color: var(--faint); opacity: 0.7; }

.row-keyword-marker {
  position: absolute;
  top: 2px;
  bottom: 2px;
  left: 0;
  z-index: 1;
  width: 3px;
  border-radius: 0 2px 2px 0;
  pointer-events: none;
}

.row-keyword-tag {
  flex: 0 0 auto;
  height: 15px;
  line-height: 13px;
  padding: 0 4px;
  font-family: var(--mono);
  font-size: 10px;
  border: 1px solid;
  border-radius: 7px;
}

.row-keyword-tag.row-keyword-more { color: var(--muted); border-color: var(--line-strong); }

.request-table { min-width: 0; min-height: 0; overflow: auto; }

.request-row {
  display: grid;
  grid-template-columns: 62px minmax(150px, 1fr) 50px 62px 56px 74px;
  align-items: center;
  width: 100%;
  min-width: 540px;
  min-height: var(--row-h);
  padding: 0;
  text-align: left;
  border: 0;
}

.request-row.with-waterfall { grid-template-columns: 62px minmax(150px, 1fr) 50px 62px 56px 74px minmax(90px, 1fr); min-width: 640px; }

.table-header {
  position: sticky;
  top: 0;
  z-index: 2;
  min-height: 21px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 400;
  border-bottom: 1px solid var(--line-strong);
  background: var(--toolbar);
}

.request-row > span {
  display: flex;
  align-items: center;
  min-width: 0;
  height: 100%;
  padding: 0 5px;
}

.request-row > span + span { border-left: 1px solid var(--grid-line); }
.table-header > span + span { border-left-color: var(--line-soft); }

.table-header span:first-child { padding-left: 5px; text-align: left; }
.table-header span:not(:nth-child(2)):not(:first-child) { justify-content: flex-end; text-align: right; }

.data-row {
  position: relative;
  color: var(--muted);
  cursor: default;
  user-select: none;
}

.data-row:hover { background: var(--panel-hover); }
.data-row.selected { background: var(--selected); }
.data-row.selected > span { border-left-color: transparent; }
.data-row > span:not(.name-cell):not(.method-cell) { justify-content: flex-end; text-align: right; }

.method-cell {
  display: flex;
  align-items: center;
  min-width: 0;
  padding: 0 5px;
  overflow: hidden;
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 700;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.method-get { color: var(--method-get); }
.method-post { color: var(--method-post); }
.method-put, .method-patch { color: var(--method-put); }
.method-delete { color: var(--method-delete); }

.name-cell { gap: 6px; }

.name-cell strong {
  overflow: hidden;
  color: var(--ink);
  font-size: 12px;
  font-weight: 400;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.type-icon { flex: 0 0 auto; }
.icon-json { color: #e96725; }
.icon-document { color: #0b57d0; }
.icon-script { color: #6b5db0; }
.icon-stylesheet { color: #7b5bb5; }
.icon-image { color: #146c2e; }
.icon-font { color: #3f6f8f; }
.icon-websocket { color: #7b5bb5; }
.icon-file { color: var(--faint); }

.status-cell { justify-content: flex-end; font-size: 12px; }
.status-success .status-cell { color: var(--status-2xx); }
.status-client-error .status-cell { color: var(--status-4xx); }
.status-server-error .status-cell { color: var(--status-5xx); }
.status-redirect .status-cell { color: var(--status-3xx); }
.status-pending .status-cell { color: var(--faint); }
.status-failed .status-cell { color: var(--danger); }

.type-cell, .size-cell, .time-cell {
  overflow: hidden;
  color: var(--muted);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.time-cell i { display: inline-block; width: var(--duration); max-width: 32px; height: 3px; margin: 0 5px 0 0; background: var(--waterfall); border-radius: 1px; }

.waterfall-cell { position: relative; justify-content: flex-start; }
.waterfall-cell i {
  position: absolute;
  top: 50%;
  height: 4px;
  transform: translateY(-50%);
  min-width: 1px;
  background: var(--waterfall);
  border-radius: 1px;
}

.ledger-status {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 0 10px;
  color: var(--muted);
  font-size: 12px;
  border-top: 1px solid var(--line);
  background: var(--panel);
  user-select: none;
}

.ledger-status .transferred { color: var(--faint); }

.waterfall-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 20px;
  padding: 0 6px;
  color: var(--muted);
  border: 0;
  border-radius: 3px;
  background: transparent;
  cursor: pointer;
}

.waterfall-toggle:hover { color: var(--ink); background: var(--panel-hover); }
.waterfall-toggle.active { color: var(--accent); background: var(--accent-soft); }

.preview-label { padding: 1px 6px; color: var(--warning); font-size: 11px; border-radius: 8px; background: var(--warning-soft); }

.empty-state {
  display: grid;
  height: 100%;
  min-height: 200px;
  place-content: center;
  justify-items: center;
  gap: 10px;
  color: var(--faint);
}

.empty-state strong { color: var(--muted); font-size: 12px; font-weight: 600; }
.empty-state button { padding: 0; color: var(--accent); border: 0; cursor: pointer; }
.empty-state button:hover { text-decoration: underline; }

@media (max-width: 1000px) {
  .request-row { grid-template-columns: 56px minmax(110px, 1fr) 46px 56px 50px 66px; }
  .request-row.with-waterfall { grid-template-columns: 56px minmax(110px, 1fr) 46px 56px 50px 66px minmax(80px, 1fr); }
}

@media (max-width: 620px) {
  .request-row { grid-template-columns: 54px minmax(100px, 1fr) 46px 52px; }
  .request-row.with-waterfall { grid-template-columns: 54px minmax(100px, 1fr) 46px 52px; }
  .request-row > :nth-child(5), .request-row > :nth-child(6), .request-row > :nth-child(7) { display: none; }
  .table-header > :nth-child(5), .table-header > :nth-child(6), .table-header > :nth-child(7) { display: none; }
}
</style>
