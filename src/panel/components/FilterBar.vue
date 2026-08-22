<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { Plus, X } from 'lucide-vue-next'
import type { FilterState } from '../../types/network'
import { createEmptyCondition, fieldOptions, operatorOptions } from '../constants'
import { t } from '../i18n'
import { applyFilterState, deletePreset, loadPresets, savePreset, type FilterPreset } from '../utils/persist'

const props = defineProps<{
  filter: FilterState
}>()

const workbench = ref<HTMLElement | null>(null)
const presets = ref<FilterPreset[]>(loadPresets())
const selectedPreset = ref('')
const presetName = ref('')

function applySelectedPreset(): void {
  const preset = presets.value.find((item) => item.name === selectedPreset.value)
  if (preset) applyFilterState(props.filter, preset.state)
}

function persistCurrentPreset(): void {
  if (!presetName.value.trim()) return
  presets.value = savePreset(presetName.value, props.filter)
  selectedPreset.value = presetName.value.trim()
  presetName.value = ''
}

function removeSelectedPreset(): void {
  if (!selectedPreset.value) return
  presets.value = deletePreset(selectedPreset.value)
  selectedPreset.value = ''
}

function addCondition(): void {
  props.filter.conditions.push(createEmptyCondition())
  void nextTick(() => {
    workbench.value?.querySelector<HTMLInputElement>('.condition-row:last-child input')?.focus()
  })
}

function removeCondition(id: string): void {
  const index = props.filter.conditions.findIndex((condition) => condition.id === id)
  if (index >= 0) props.filter.conditions.splice(index, 1)
}
</script>

<template>
  <section ref="workbench" class="filter-workbench" :aria-label="t('advancedSection')">
    <div class="advanced-panel">
      <div class="preset-row">
        <span class="preset-label">{{ t('presetLabel') }}</span>
        <select v-model="selectedPreset" aria-label="筛选预设" @change="applySelectedPreset">
          <option value="">{{ t('presetChoose') }}</option>
          <option v-for="preset in presets" :key="preset.name" :value="preset.name">{{ preset.name }}</option>
        </select>
        <button class="preset-action" type="button" :disabled="!selectedPreset" @click="removeSelectedPreset">{{ t('presetDelete') }}</button>
        <input v-model="presetName" type="text" :placeholder="t('presetNamePlaceholder')" aria-label="预设名称" @keydown.enter="persistCurrentPreset" />
        <button class="preset-action" type="button" :disabled="!presetName.trim()" @click="persistCurrentPreset">
          {{ t('presetSaveCurrent') }}
        </button>
      </div>

      <div class="condition-toolbar">
        <div class="condition-mode" :aria-label="t('conditionRelation')">
          <span>{{ t('matchMode') }}</span>
          <button type="button" :class="{ active: filter.conditionMode === 'all' }" @click="filter.conditionMode = 'all'">
            {{ t('matchAll') }}
          </button>
          <button type="button" :class="{ active: filter.conditionMode === 'any' }" @click="filter.conditionMode = 'any'">
            {{ t('matchAny') }}
          </button>
        </div>
        <button class="add-condition" type="button" @click="addCondition"><Plus :size="13" /> {{ t('addCondition') }}</button>
      </div>

      <div v-if="filter.conditions.length" class="condition-list">
        <div v-for="condition in filter.conditions" :key="condition.id" class="condition-row">
          <select v-model="condition.field" :aria-label="t('conditionField')">
            <option v-for="option in fieldOptions" :key="option.value" :value="option.value">{{ t(option.label) }}</option>
          </select>
          <select v-model="condition.operator" :aria-label="t('conditionOperator')">
            <option v-for="option in operatorOptions" :key="option.value" :value="option.value">{{ t(option.label) }}</option>
          </select>
          <input
            v-if="condition.operator !== 'exists'"
            v-model="condition.value"
            type="text"
            :placeholder="condition.field === 'paramKey' ? t('paramKeyExample') : t('valuePlaceholder')"
            :aria-label="t('conditionValue')"
          />
          <span v-else class="exists-placeholder">{{ t('existsPlaceholder') }}</span>
          <button
            class="remove-condition"
            type="button"
            :title="t('removeCondition')"
            :aria-label="t('removeCondition')"
            @click="removeCondition(condition.id)"
          >
            <X :size="14" />
          </button>
        </div>
      </div>
      <button v-else class="empty-condition" type="button" @click="addCondition"><Plus :size="14" /> {{ t('addFilterCondition') }}</button>
    </div>
  </section>
</template>

<style scoped>
.filter-workbench {
  position: relative;
  z-index: 5;
  border-bottom: 1px solid var(--line);
  background: var(--toolbar);
}

.add-condition,
.empty-condition {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 22px;
  padding: 0 7px;
  color: var(--muted);
  font-size: 12px;
  border: 0;
  border-radius: 3px;
  background: transparent;
  cursor: pointer;
}

.advanced-panel {
  display: grid;
  gap: 6px;
  padding: 6px 8px;
  background: var(--panel-muted);
}

.preset-row { display: flex; align-items: center; gap: 4px; }
.preset-label { color: var(--muted); font-size: 10px; }
.preset-row select { width: 130px; height: var(--control-h); padding: 0 4px; color: var(--ink); font-size: 12px; border: 1px solid var(--line-strong); border-radius: var(--radius); outline: 0; background: var(--panel); }
.preset-row input { flex: 1 1 auto; min-width: 0; height: var(--control-h); padding: 0 6px; color: var(--ink); font-size: 12px; border: 1px solid var(--line-strong); border-radius: var(--radius); outline: 0; background: var(--panel); }
.preset-row input:focus, .preset-row select:focus { border-color: var(--accent); }

.preset-action {
  height: var(--control-h);
  padding: 0 7px;
  color: var(--accent);
  font-size: 12px;
  border: 0;
  border-radius: 2px;
  background: transparent;
  cursor: pointer;
}

.preset-action:hover:not(:disabled) { background: var(--accent-soft); }
.preset-action:disabled { color: var(--faint); cursor: default; }

.condition-toolbar { display: flex; align-items: center; justify-content: space-between; }
.condition-mode { display: flex; align-items: center; gap: 4px; color: var(--muted); font-size: 10px; }

.condition-mode button {
  height: 22px;
  padding: 0 7px;
  color: var(--muted);
  border: 1px solid transparent;
  border-radius: 2px;
  cursor: pointer;
}

.condition-mode button:hover { background: var(--panel-hover); }
.condition-mode button.active { color: var(--accent); border-color: var(--line-strong); background: var(--panel); }
.add-condition { height: 23px; color: var(--accent); }
.add-condition:hover { background: var(--accent-soft); }
.condition-list { display: grid; gap: 4px; }

.condition-row {
  display: grid;
  grid-template-columns: minmax(120px, 0.7fr) minmax(100px, 0.6fr) minmax(150px, 1.8fr) 24px;
  gap: 4px;
}

.condition-row select,
.condition-row input {
  width: 100%;
  height: var(--control-h);
  padding: 0 6px;
  color: var(--ink);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius);
  outline: 0;
  background: var(--panel);
}

.condition-row select:focus, .condition-row input:focus { border-color: var(--accent); }
.condition-row input::placeholder { color: var(--faint); }

.exists-placeholder {
  display: flex;
  align-items: center;
  height: var(--control-h);
  padding: 0 7px;
  color: var(--faint);
  border: 1px dashed var(--line-strong);
}

.remove-condition {
  display: grid;
  width: 24px;
  height: var(--control-h);
  padding: 0;
  place-items: center;
  color: var(--muted);
  border: 0;
  border-radius: 2px;
  cursor: pointer;
}

.remove-condition:hover { color: var(--danger); background: var(--danger-soft); }
.empty-condition { width: 100%; height: 25px; border-style: dashed; background: transparent; }
.empty-condition:hover { color: var(--accent); border-color: var(--accent); }
</style>
