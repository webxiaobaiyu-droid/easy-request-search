<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ChevronDown, Download, Moon, ScanSearch, Search, SlidersHorizontal, Sun, X, XCircle } from 'lucide-vue-next'
import type { FilterState } from '../../types/network'
import { methodOptions, statusOptions } from '../constants'
import { t, toggleLocale, locale } from '../i18n'

const props = defineProps<{
  isRecording: boolean
  preserveLog: boolean
  requestCount: number
  canExport: boolean
  filter: FilterState
  typeOptions: { value: string; count: number }[]
  activeFilterCount: number
  advancedOpen: boolean
  theme: 'light' | 'dark'
}>()

defineEmits<{
  'toggle-recording': []
  'toggle-preserve': []
  clear: []
  'export-har': []
  'export-json': []
  reset: []
  'toggle-advanced': []
  'toggle-theme': []
}>()

const searchInput = ref<HTMLInputElement | null>(null)

const statusLabel = computed(
  () => t(statusOptions.find((option) => option.value === props.filter.statusGroup)?.label ?? 'statusAll'),
)

const batchKeywords = computed(() =>
  (props.filter.batchSearch ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean),
)

/** A single-line input cannot hold newlines; divert multi-line pastes to batch mode. */
function divertMultilinePaste(event: ClipboardEvent): void {
  const text = event.clipboardData?.getData('text') ?? ''
  if (!text.includes('\n')) return
  event.preventDefault()
  props.filter.batchSearch = text
}

function toggleMethod(method: string): void {
  const index = props.filter.methods.indexOf(method)
  if (index >= 0) props.filter.methods.splice(index, 1)
  else props.filter.methods.push(method)
}

function toggleType(type: string): void {
  const index = props.filter.resourceTypes.indexOf(type)
  if (index >= 0) props.filter.resourceTypes.splice(index, 1)
  else props.filter.resourceTypes.push(type)
}

function handleKeyboard(event: KeyboardEvent): void {
  const target = event.target
  const isEditing = target instanceof Element && target.matches('input, textarea, select, [contenteditable="true"]')
  if (event.key === '/' && !isEditing) {
    event.preventDefault()
    searchInput.value?.focus()
  }
  if (event.key === 'Escape' && document.activeElement === searchInput.value && props.filter.search) {
    props.filter.search = ''
  }
}

onMounted(() => window.addEventListener('keydown', handleKeyboard))
onBeforeUnmount(() => window.removeEventListener('keydown', handleKeyboard))
</script>

<template>
  <header class="app-toolbar">
    <button
      class="toolbar-button record-button"
      :class="{ recording: isRecording }"
      type="button"
      :title="isRecording ? t('recordStop') : t('recordStart')"
      :aria-label="isRecording ? t('recordStop') : t('recordStart')"
      @click="$emit('toggle-recording')"
    >
      <span class="record-dot" aria-hidden="true"></span>
    </button>
    <button class="toolbar-button" type="button" :title="t('clearLog')" :aria-label="t('clearLog')" @click="$emit('clear')">
      <XCircle :size="15" :stroke-width="1.6" />
    </button>

    <label class="search-control">
      <Search :size="13" :stroke-width="1.8" aria-hidden="true" />
      <input
        ref="searchInput"
        v-model="filter.search"
        type="search"
        :placeholder="t('searchPlaceholder')"
        autocomplete="off"
        @paste="divertMultilinePaste"
      />
      <span
        v-if="batchKeywords.length"
        class="batch-badge"
        :title="batchKeywords.join('\n')"
        :aria-label="t('batchActive', { n: batchKeywords.length })"
      >{{ batchKeywords.length }}</span>
      <button
        v-if="filter.search"
        class="clear-search"
        type="button"
        :title="t('clearSearch')"
        :aria-label="t('clearSearch')"
        @click="filter.search = ''"
      >
        <X :size="12" />
      </button>
    </label>

    <details class="batch-menu">
      <summary
        class="toolbar-button batch-trigger"
        :class="{ active: batchKeywords.length > 0 }"
        :title="t('batchOpen')"
        :aria-label="t('batchOpen')"
      >
        <ScanSearch :size="15" :stroke-width="1.6" />
      </summary>
      <div class="batch-popover">
        <p class="batch-hint">{{ t('batchHint') }}</p>
        <textarea
          v-model="filter.batchSearch"
          rows="7"
          spellcheck="false"
          :placeholder="t('batchTextareaPlaceholder')"
          :aria-label="t('batchAria')"
        ></textarea>
        <div class="batch-actions">
          <button v-if="batchKeywords.length" type="button" class="batch-clear" @click="filter.batchSearch = ''">
            {{ t('batchClear') }}
          </button>
        </div>
      </div>
    </details>

    <div class="method-segment" :aria-label="t('methodGroup')">
      <button
        v-for="method in methodOptions"
        :key="method"
        type="button"
        :class="{ active: filter.methods.includes(method) }"
        :aria-pressed="filter.methods.includes(method)"
        @click="toggleMethod(method)"
      >
        {{ method }}
      </button>
    </div>

    <div class="type-chips" role="group" :aria-label="t('resourceTypeGroup')">
      <button
        class="chip"
        :class="{ active: filter.resourceTypes.length === 0 }"
        type="button"
        @click="filter.resourceTypes.splice(0)"
      >
        {{ t('allTypes') }}
      </button>
      <button
        v-for="type in typeOptions"
        :key="type.value"
        class="chip"
        :class="{ active: filter.resourceTypes.includes(type.value) }"
        type="button"
        @click="toggleType(type.value)"
      >
        {{ type.value }}
      </button>
    </div>

    <div class="toolbar-actions">
      <details class="filter-menu status-menu">
        <summary class="status-summary">
          {{ statusLabel }}
          <ChevronDown :size="12" />
        </summary>
        <div class="filter-menu-popover">
          <label v-for="option in statusOptions" :key="option.value" class="radio-option">
            <input v-model="filter.statusGroup" type="radio" :value="option.value" />
            <span>{{ t(option.label) }}</span>
          </label>
        </div>
      </details>

      <button
        class="advanced-trigger"
        :class="{ active: advancedOpen || filter.conditions.length > 0 }"
        type="button"
        :aria-expanded="advancedOpen"
        @click="$emit('toggle-advanced')"
      >
        <SlidersHorizontal :size="14" />
        {{ t('advancedFilter') }}
        <span v-if="filter.conditions.length" class="count-badge">{{ filter.conditions.length }}</span>
      </button>

      <button v-if="activeFilterCount" class="reset-button" type="button" @click="$emit('reset')">{{ t('reset') }}</button>

      <label class="preserve-checkbox" :title="t('preserveLogTitle')">
        <input type="checkbox" :checked="preserveLog" @change="$emit('toggle-preserve')" />
        {{ t('preserveLog') }}
      </label>
      <button
        class="toolbar-button locale-toggle"
        type="button"
        :title="t('switchLanguage')"
        :aria-label="t('switchLanguage')"
        @click="toggleLocale()"
      >
        {{ locale === 'zh-CN' ? 'EN' : '中文' }}
      </button>
      <button
        class="toolbar-button theme-toggle"
        type="button"
        :title="theme === 'dark' ? t('themeToLight') : t('themeToDark')"
        :aria-label="theme === 'dark' ? t('themeToLight') : t('themeToDark')"
        @click="$emit('toggle-theme')"
      >
        <Sun v-if="theme === 'dark'" :size="15" :stroke-width="1.6" />
        <Moon v-else :size="15" :stroke-width="1.6" />
      </button>
      <details class="export-menu">
        <summary
          class="toolbar-button"
          :title="t('exportTitle')"
          :aria-label="t('exportTitle')"
          :aria-disabled="!canExport"
          :data-disabled="!canExport ? '' : undefined"
        >
          <Download :size="15" :stroke-width="1.6" />
        </summary>
        <div class="export-menu-popover">
          <button type="button" :disabled="!canExport" @click="$emit('export-har')">{{ t('exportHar') }}</button>
          <button type="button" :disabled="!canExport" @click="$emit('export-json')">{{ t('exportJson') }}</button>
        </div>
      </details>
    </div>
  </header>
</template>

<style scoped>
.app-toolbar {
  display: flex;
  align-items: center;
  gap: 2px;
  height: var(--toolbar-h);
  padding: 0 4px;
  background: var(--toolbar);
  border-bottom: 1px solid var(--line);
}

.toolbar-button {
  display: inline-grid;
  width: 26px;
  height: 26px;
  padding: 0;
  place-items: center;
  color: var(--muted);
  border: 0;
  border-radius: 3px;
  cursor: pointer;
}

.toolbar-button:hover { color: var(--ink); background: var(--panel-hover); }
.toolbar-button:disabled { opacity: 0.38; cursor: default; }

.locale-toggle {
  width: auto;
  padding: 0 6px;
  font-size: 11px;
  font-weight: 600;
}

.batch-badge {
  display: inline-grid;
  min-width: 15px;
  height: 15px;
  padding: 0 3px;
  place-items: center;
  color: var(--accent);
  font-family: var(--mono);
  font-size: 9px;
  border: 1px solid var(--accent);
  border-radius: 8px;
  background: var(--panel);
}

.batch-menu { position: relative; flex: 0 0 auto; }
.batch-menu summary { list-style: none; }
.batch-menu summary::-webkit-details-marker { display: none; }
.batch-menu summary.active { color: var(--accent); background: var(--accent-soft); }

.batch-popover {
  position: absolute;
  top: calc(100% + 3px);
  left: 0;
  z-index: 30;
  display: grid;
  gap: 6px;
  width: 280px;
  padding: 8px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-pop);
  background: var(--panel);
  box-shadow: var(--shadow);
}

.batch-hint { margin: 0; color: var(--faint); font-size: 11px; }

.batch-popover textarea {
  width: 100%;
  min-height: 120px;
  padding: 6px;
  color: var(--ink);
  font-family: var(--mono);
  font-size: 11px;
  line-height: 1.5;
  resize: vertical;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius);
  outline: 0;
  background: var(--panel);
}

.batch-popover textarea:focus { border-color: var(--accent); }

.batch-actions { display: flex; justify-content: flex-end; }

.batch-clear {
  height: 22px;
  padding: 0 8px;
  color: var(--accent);
  font-size: 12px;
  border: 0;
  border-radius: 3px;
  background: transparent;
  cursor: pointer;
}

.batch-clear:hover { background: var(--accent-soft); }

.export-menu { position: relative; flex: 0 0 auto; }
.export-menu summary { list-style: none; }
.export-menu summary::-webkit-details-marker { display: none; }
.export-menu summary[data-disabled] { opacity: 0.38; pointer-events: none; }

.export-menu-popover {
  position: absolute;
  top: calc(100% + 3px);
  right: 0;
  z-index: 20;
  display: grid;
  min-width: 110px;
  padding: 4px 0;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-pop);
  background: var(--panel);
  box-shadow: var(--shadow);
}

.export-menu-popover button {
  height: 24px;
  padding: 0 10px;
  color: var(--muted);
  font-size: 12px;
  text-align: left;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.export-menu-popover button:hover:not(:disabled) { color: var(--ink); background: var(--panel-hover); }
.export-menu-popover button:disabled { opacity: 0.38; cursor: default; }

.record-dot {
  width: 11px;
  height: 11px;
  border: 1.5px solid var(--danger);
  border-radius: 50%;
  background: transparent;
}

.record-button.recording .record-dot { background: var(--danger); }

.search-control {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 0 1 240px;
  min-width: clamp(120px, 22vw, 200px);
  height: 22px;
  margin: 0 4px 0 6px;
  padding: 0 8px;
  color: var(--faint);
  border: 1px solid var(--line-strong);
  border-radius: 11px;
  background: var(--panel);
}

.search-control:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
}

.search-control input {
  width: 100%;
  min-width: 0;
  padding: 0;
  color: var(--ink);
  font-size: 12px;
  border: 0;
  outline: 0;
  background: transparent;
}

.search-control input::placeholder { color: var(--faint); }
.search-control input::-webkit-search-cancel-button { display: none; }

.clear-search {
  display: inline-grid;
  width: 16px;
  height: 16px;
  padding: 0;
  place-items: center;
  color: var(--faint);
  border: 0;
  border-radius: 2px;
  cursor: pointer;
}

.clear-search:hover { color: var(--ink); }

.toolbar-actions { display: flex; flex: 0 0 auto; align-items: center; gap: 4px; margin-left: auto; }

.method-segment { display: flex; flex: 0 0 auto; }

.method-segment button {
  min-width: 36px;
  height: 22px;
  padding: 0 6px;
  color: var(--muted);
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 600;
  border: 0;
  border-radius: 3px;
  cursor: pointer;
}

.method-segment button:hover { color: var(--ink); background: var(--panel-hover); }
.method-segment button.active { color: var(--accent); background: var(--accent-soft); }

.type-chips {
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  gap: 4px;
  overflow-x: auto;
  scrollbar-width: none;
}

.type-chips::-webkit-scrollbar { display: none; }

.chip {
  flex: 0 0 auto;
  height: 20px;
  padding: 0 9px;
  color: var(--muted);
  font-size: 12px;
  border: 1px solid var(--line-strong);
  border-radius: 10px;
  background: var(--panel);
  cursor: pointer;
  white-space: nowrap;
}

.chip:hover { border-color: var(--accent); color: var(--accent); }
.chip.active { color: #fff; border-color: var(--accent-bright); background: var(--accent-bright); }

.filter-menu { position: relative; flex: 0 0 auto; }

.filter-menu summary {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 22px;
  padding: 0 7px;
  color: var(--muted);
  font-size: 12px;
  border: 0;
  border-radius: 3px;
  background: transparent;
  cursor: pointer;
  list-style: none;
  user-select: none;
}

.filter-menu summary::-webkit-details-marker { display: none; }
.filter-menu summary:hover { color: var(--ink); background: var(--panel-hover); }
.filter-menu[open] summary { color: var(--accent); background: var(--accent-soft); }

.filter-menu-popover {
  position: absolute;
  top: calc(100% + 3px);
  right: 0;
  z-index: 20;
  display: grid;
  gap: 1px;
  min-width: 150px;
  max-height: 300px;
  padding: 4px 0;
  overflow: auto;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-pop);
  background: var(--panel);
  box-shadow: var(--shadow);
}

.filter-menu-popover label {
  display: flex;
  align-items: center;
  gap: 7px;
  min-height: 26px;
  padding: 0 8px;
  color: var(--muted);
  font-size: 12px;
  cursor: pointer;
}

.filter-menu-popover label:hover { color: var(--ink); background: var(--panel-hover); }
.filter-menu-popover input { accent-color: var(--accent); }

.advanced-trigger,
.reset-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  flex: 0 0 auto;
  height: 22px;
  padding: 0 7px;
  color: var(--muted);
  font-size: 12px;
  border: 0;
  border-radius: 3px;
  background: transparent;
  cursor: pointer;
}

.advanced-trigger:hover { color: var(--ink); background: var(--panel-hover); }
.advanced-trigger.active { color: var(--accent); background: var(--accent-soft); }

.count-badge {
  min-width: 15px;
  padding: 0 3px;
  line-height: 14px;
  color: var(--accent);
  font-family: var(--mono);
  font-size: 10px;
  border: 1px solid var(--accent);
  border-radius: 8px;
  background: var(--panel);
}

.reset-button { color: var(--accent); }
.reset-button:hover { background: var(--panel-hover); }

.preserve-checkbox {
  display: flex;
  align-items: center;
  gap: 5px;
  min-height: 24px;
  padding: 0 4px;
  color: var(--muted);
  font-size: 12px;
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
}

.preserve-checkbox input { width: 13px; height: 13px; margin: 0; accent-color: var(--accent); }

@media (max-width: 1000px) {
  .method-segment button { min-width: 32px; padding: 0 4px; }
}

@media (max-width: 620px) {
  .preserve-checkbox { display: none; }
}
</style>
