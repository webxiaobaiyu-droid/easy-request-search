<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { filterRequests, parseBatchKeywords } from '../core/filter'
import type { CapturedRequest, FilterState } from '../types/network'
import AppTopbar from './components/AppTopbar.vue'
import FilterBar from './components/FilterBar.vue'
import RequestDetail from './components/RequestDetail.vue'
import RequestList from './components/RequestList.vue'
import { useBridge } from './composables/useBridge'
import { defaultTypeOptions, type DetailTab } from './constants'
import { t } from './i18n'
import { createSampleRequests } from './sample-data'
import { applyFilterState, loadFilterState, saveFilterState } from './utils/persist'
import { buildExportPayload, buildHar, downloadJsonFile } from './utils/export'
import { formatResourceType } from './utils/format'
import { clampSplitRatio, DEFAULT_SPLIT_RATIO, splitRatioFromPointer } from './utils/split'

const requests = ref<CapturedRequest[]>([])
const selectedId = ref('')
const activeTab = ref<DetailTab>('overview')
const responseLoading = ref(false)
const workspace = ref<HTMLElement | null>(null)
const isResizing = ref(false)
const advancedOpen = ref(false)

const SPLIT_STORAGE_KEY = 'easy-request-search:split-ratio'

function readSplitRatio(): number {
  try {
    const stored = Number.parseFloat(localStorage.getItem(SPLIT_STORAGE_KEY) ?? '')
    return Number.isFinite(stored) ? stored : DEFAULT_SPLIT_RATIO
  } catch {
    return DEFAULT_SPLIT_RATIO
  }
}

const splitRatio = ref(readSplitRatio())
const workspaceStyle = computed(() => ({ '--request-pane-width': `${splitRatio.value}%` }))

const WATERFALL_KEY = 'easy-request-search:waterfall'
const waterfallVisible = ref(((): boolean => {
  try {
    return localStorage.getItem(WATERFALL_KEY) === '1'
  } catch {
    return false
  }
})())

function toggleWaterfall(): void {
  waterfallVisible.value = !waterfallVisible.value
  try {
    localStorage.setItem(WATERFALL_KEY, waterfallVisible.value ? '1' : '0')
  } catch {
    // Persistence is optional in restricted DevTools storage contexts.
  }
}

type Theme = 'light' | 'dark'
const THEME_KEY = 'easy-request-search:theme'
const systemDark = window.matchMedia('(prefers-color-scheme: dark)')
const storedTheme = ((): Theme | null => {
  try {
    const value = localStorage.getItem(THEME_KEY)
    return value === 'dark' || value === 'light' ? value : null
  } catch {
    return null
  }
})()
const theme = ref<Theme>(storedTheme ?? (systemDark.matches ? 'dark' : 'light'))

function applyTheme(next: Theme): void {
  document.documentElement.dataset.theme = next
}

applyTheme(theme.value)
// Without a stored preference the panel keeps following the OS setting.
systemDark.addEventListener('change', (event) => {
  if (storedTheme) return
  theme.value = event.matches ? 'dark' : 'light'
  applyTheme(theme.value)
})
watch(theme, applyTheme)

function toggleTheme(): void {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
  try {
    localStorage.setItem(THEME_KEY, theme.value)
  } catch {
    // Persistence is optional in restricted DevTools storage contexts.
  }
}

// Single source of truth for filtering; FilterBar mutates its fields and array
// in place — the object identity is the contract, never replace the prop.
const filter = reactive<FilterState>({
  search: '',
  batchSearch: '',
  methods: [],
  resourceTypes: [],
  statusGroup: 'all',
  conditions: [],
  conditionMode: 'all',
})

// Restore the last session's filter, then keep it persisted (debounced).
const savedFilter = loadFilterState()
if (savedFilter) applyFilterState(filter, savedFilter)

let persistTimer: number | undefined
watch(
  filter,
  () => {
    window.clearTimeout(persistTimer)
    persistTimer = window.setTimeout(() => saveFilterState(filter), 300)
  },
  { deep: true },
)

const {
  connect,
  toggleRecording,
  togglePreserveLog,
  clear,
  loadResponse,
  isRecording,
  preserveLog,
  bridgeConnected,
} = useBridge(requests, () => {
  selectedId.value = ''
})

// requests stays ascending by sequence (single capture producer); reverse the
// filtered copy for newest-first display without sorting.
const visibleRequests = computed(() => filterRequests(requests.value, filter).reverse())
const selectedRequest = computed(() => requests.value.find((request) => request.id === selectedId.value))
const batchKeywords = computed(() => parseBatchKeywords(filter.batchSearch ?? ''))

const typeOptions = computed(() => {
  const counts = new Map<string, number>()
  requests.value.forEach((request) => {
    const type = formatResourceType(request.resourceType, request.mimeType)
    counts.set(type, (counts.get(type) ?? 0) + 1)
  })
  const options = new Set(defaultTypeOptions)
  counts.forEach((_, type) => options.add(type))
  return [...options].map((value) => ({ value, count: counts.get(value) ?? 0 }))
})

const activeFilterCount = computed(
  () =>
    Number(Boolean(filter.search.trim())) +
    Number(Boolean((filter.batchSearch ?? '').trim())) +
    filter.methods.length +
    filter.resourceTypes.length +
    Number(filter.statusGroup !== 'all') +
    filter.conditions.length,
)

watch(visibleRequests, (current) => {
  if (!selectedId.value && current.length > 0) selectedId.value = current[0].id
  if (selectedId.value && !current.some((request) => request.id === selectedId.value)) {
    selectedId.value = current[0]?.id ?? ''
  }
})

function resetFilters(): void {
  filter.search = ''
  filter.batchSearch = ''
  filter.methods.splice(0)
  filter.resourceTypes.splice(0)
  filter.statusGroup = 'all'
  filter.conditions.splice(0)
  filter.conditionMode = 'all'
}

function selectRequest(request: CapturedRequest): void {
  selectedId.value = request.id
  if (activeTab.value === 'response') {
    void selectTab('response')
  }
}

function moveSelection(delta: number): void {
  const list = visibleRequests.value
  if (list.length === 0) return
  const index = list.findIndex((request) => request.id === selectedId.value)
  const next = index < 0 ? 0 : Math.min(list.length - 1, Math.max(0, index + delta))
  selectedId.value = list[next].id
}

function handleKeydown(event: KeyboardEvent): void {
  const target = event.target
  const isEditing = target instanceof Element && target.matches('input, textarea, select, [contenteditable="true"]')
  if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && !isEditing) {
    event.preventDefault()
    moveSelection(event.key === 'ArrowDown' ? 1 : -1)
  } else if (event.key === 'Escape' && !isEditing && (filter.search || filter.batchSearch)) {
    filter.search = ''
    filter.batchSearch = ''
  }
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', handleKeydown))

async function selectTab(tab: DetailTab): Promise<void> {
  activeTab.value = tab
  const request = selectedRequest.value
  if (tab !== 'response' || !request || request.responseBody || request.responseError) return
  responseLoading.value = true
  try {
    await loadResponse(request.id)
  } finally {
    responseLoading.value = false
  }
}

function exportResults(): void {
  downloadJsonFile(buildExportPayload(visibleRequests.value))
}

function exportHar(): void {
  downloadJsonFile(buildHar(visibleRequests.value), `easy-request-search-${new Date().toISOString().replace(/[:.]/g, '-')}.har`)
}

function updateSplitFromPointer(event: PointerEvent): void {
  const bounds = workspace.value?.getBoundingClientRect()
  if (!bounds) return
  splitRatio.value = splitRatioFromPointer(event.clientX, bounds.left, bounds.width)
}

function stopResize(): void {
  if (!isResizing.value) return
  isResizing.value = false
  document.body.classList.remove('easy-request-search-resizing')
  window.removeEventListener('pointermove', updateSplitFromPointer)
  window.removeEventListener('pointerup', stopResize)
  window.removeEventListener('pointercancel', stopResize)
  try {
    localStorage.setItem(SPLIT_STORAGE_KEY, splitRatio.value.toFixed(2))
  } catch {
    // Persistence is optional in restricted DevTools storage contexts.
  }
}

function startResize(event: PointerEvent): void {
  if (event.button !== 0) return
  event.preventDefault()
  isResizing.value = true
  document.body.classList.add('easy-request-search-resizing')
  updateSplitFromPointer(event)
  window.addEventListener('pointermove', updateSplitFromPointer)
  window.addEventListener('pointerup', stopResize)
  window.addEventListener('pointercancel', stopResize)
}

function resetSplit(): void {
  splitRatio.value = DEFAULT_SPLIT_RATIO
  try {
    localStorage.removeItem(SPLIT_STORAGE_KEY)
  } catch {
    // Persistence is optional in restricted DevTools storage contexts.
  }
}

function resizeWithKeyboard(event: KeyboardEvent): void {
  const bounds = workspace.value?.getBoundingClientRect()
  if (!bounds) return
  if (!['ArrowLeft', 'ArrowRight', 'Home'].includes(event.key)) return
  event.preventDefault()
  if (event.key === 'Home') {
    resetSplit()
    return
  }
  const direction = event.key === 'ArrowLeft' ? -1 : 1
  splitRatio.value = clampSplitRatio(splitRatio.value + direction * (event.shiftKey ? 10 : 2), bounds.width)
  try {
    localStorage.setItem(SPLIT_STORAGE_KEY, splitRatio.value.toFixed(2))
  } catch {
    // Persistence is optional in restricted DevTools storage contexts.
  }
}

onBeforeUnmount(() => {
  stopResize()
  window.clearTimeout(persistTimer)
})

connect()
const demoMode = new URLSearchParams(location.search).get('demo') === '1'
if (demoMode && !bridgeConnected.value) {
  // `repeat` clones the sample set to stress-test large-list rendering (virtual scroll, cap).
  const repeat = Math.min(600, Math.max(1, Number.parseInt(new URLSearchParams(location.search).get('repeat') ?? '1', 10) || 1))
  const samples = createSampleRequests()
  const expanded: CapturedRequest[] = []
  for (let round = 0; round < repeat; round++) {
    for (const request of samples) {
      expanded.push(round === 0 ? request : { ...request, id: `${request.id}-r${round}`, sequence: expanded.length + 1 })
    }
  }
  requests.value = expanded
  selectedId.value = expanded.at(-1)?.id ?? ''
}
</script>

<template>
  <main class="app-shell">
    <AppTopbar
      :is-recording="isRecording"
      :preserve-log="preserveLog"
      :request-count="requests.length"
      :can-export="visibleRequests.length > 0"
      :filter="filter"
      :type-options="typeOptions"
      :active-filter-count="activeFilterCount"
      :advanced-open="advancedOpen"
      :theme="theme"
      @toggle-recording="toggleRecording()"
      @toggle-preserve="togglePreserveLog()"
      @clear="clear()"
      @export-har="exportHar"
      @export-json="exportResults"
      @reset="resetFilters"
      @toggle-advanced="advancedOpen = !advancedOpen"
      @toggle-theme="toggleTheme"
    />

    <FilterBar v-if="advancedOpen" :filter="filter" />

    <section ref="workspace" class="workspace" :class="{ resizing: isResizing }" :style="workspaceStyle">
      <RequestList
        :requests="visibleRequests"
        :total-count="requests.length"
        :selected-id="selectedId"
        :is-preview="!bridgeConnected"
        :waterfall="waterfallVisible"
        :batch-keywords="batchKeywords ?? undefined"
        @select="selectRequest"
        @reset="resetFilters"
        @toggle-waterfall="toggleWaterfall"
      />
      <div
        class="pane-splitter"
        role="separator"
        :aria-label="t('splitterLabel')"
        aria-orientation="vertical"
        :aria-valuenow="Math.round(splitRatio)"
        aria-valuemin="28"
        aria-valuemax="72"
        tabindex="0"
        :title="t('splitterTitle')"
        @pointerdown="startResize"
        @dblclick="resetSplit"
        @keydown="resizeWithKeyboard"
      ></div>
      <RequestDetail
        v-if="selectedRequest"
        :request="selectedRequest"
        :active-tab="activeTab"
        :response-loading="responseLoading"
        :batch-keywords="batchKeywords ?? undefined"
        @update:active-tab="selectTab"
      />
      <div v-else class="inspector-empty">{{ t('inspectorEmpty') }}</div>
    </section>
  </main>
</template>

<style scoped>
.app-shell {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: var(--toolbar-h) auto minmax(0, 1fr);
  width: 100%;
  height: 100%;
  min-width: 560px;
  background: var(--canvas);
}

.workspace {
  display: grid;
  grid-template-columns: minmax(0, var(--request-pane-width)) 5px minmax(0, 1fr);
  min-height: 0;
  overflow: hidden;
}

.pane-splitter {
  position: relative;
  z-index: 4;
  min-width: 5px;
  cursor: col-resize;
  touch-action: none;
  background: transparent;
}

.pane-splitter::before {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 2px;
  width: 1px;
  content: "";
  background: var(--line);
}

.pane-splitter:hover::before,
.pane-splitter:focus-visible::before,
.workspace.resizing .pane-splitter::before {
  left: 1px;
  width: 3px;
  background: var(--accent);
}

.pane-splitter:focus-visible { outline: 0; }

:global(body.easy-request-search-resizing) {
  cursor: col-resize;
  user-select: none;
}

.inspector-empty {
  display: grid;
  min-width: 0;
  min-height: 0;
  place-content: center;
  color: var(--faint);
  font-size: 11px;
  background: var(--panel);
}

@media (max-width: 1000px) {
  .app-shell { min-width: 480px; }
}

@media (max-width: 780px) {
  .app-shell { min-width: 440px; }
  .workspace { grid-template-columns: 1fr; grid-template-rows: minmax(260px, 48%) minmax(260px, 1fr); overflow: auto; }
  .workspace > :first-child { border-bottom: 1px solid var(--line); }
  .pane-splitter { display: none; }
}

@media (max-width: 620px) {
  .app-shell { min-width: 420px; }
}
</style>
