import type { FilterCondition, FilterState } from '../../types/network'

const FILTER_KEY = 'easy-request-search:filter'
const PRESETS_KEY = 'easy-request-search:presets'

export interface FilterPreset {
  name: string
  savedAt: number
  state: FilterState
}

const OPERATORS = ['contains', 'equals', 'notEquals', 'exists', 'regex', 'gt', 'gte', 'lt', 'lte']

function readStorage(key: string): unknown {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeStorage(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Persistence is optional in restricted DevTools storage contexts.
  }
}

function isCondition(value: unknown): value is FilterCondition {
  if (typeof value !== 'object' || value === null) return false
  const condition = value as Record<string, unknown>
  return typeof condition.id === 'string' && typeof condition.value === 'string' && OPERATORS.includes(String(condition.operator))
}

/** Validates an untrusted parsed value before letting it near the reactive filter. */
export function sanitizeFilterState(value: unknown): FilterState | null {
  if (typeof value !== 'object' || value === null) return null
  const raw = value as Record<string, unknown>
  const str = (v: unknown): string => (typeof v === 'string' ? v : '')
  const strList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((item): item is string => typeof item === 'string') : [])

  let conditions: FilterCondition[] = []
  if (Array.isArray(raw.conditions)) {
    conditions = raw.conditions
      .filter(isCondition)
      .map((condition) => ({ ...condition, field: str(condition.field) }) as FilterCondition)
      .filter((condition) => (condition.field as string) in FIELD_ALLOWLIST)
  }

  const rawGroup = str(raw.statusGroup)
  // 'pending' was merged into 'failed': a captured request is never in flight.
  return {
    search: str(raw.search),
    batchSearch: str(raw.batchSearch),
    methods: strList(raw.methods),
    resourceTypes: strList(raw.resourceTypes),
    statusGroup: rawGroup === 'pending' ? 'failed' : STATUS_GROUPS.has(rawGroup) ? rawGroup : 'all',
    conditions,
    conditionMode: raw.conditionMode === 'any' ? 'any' : 'all',
  }
}

const FIELD_ALLOWLIST: Record<string, string> = {
  any: 'any',
  url: 'url',
  method: 'method',
  type: 'type',
  status: 'status',
  mime: 'mime',
  param: 'param',
  paramKey: 'paramKey',
  paramValue: 'paramValue',
  query: 'query',
  body: 'body',
  header: 'header',
  response: 'response',
}

const STATUS_GROUPS = new Set(['all', 'failed', '200', '300', '400', '500'])

export function loadFilterState(): FilterState | null {
  return sanitizeFilterState(readStorage(FILTER_KEY))
}

export function saveFilterState(filter: FilterState): void {
  writeStorage(FILTER_KEY, filter)
}

export function loadPresets(): FilterPreset[] {
  const value = readStorage(PRESETS_KEY)
  if (!Array.isArray(value)) return []
  return value
    .map((item): FilterPreset | null => {
      if (typeof item !== 'object' || item === null) return null
      const preset = item as Record<string, unknown>
      const state = sanitizeFilterState(preset.state)
      if (typeof preset.name !== 'string' || !preset.name.trim() || !state) return null
      return { name: preset.name.trim(), savedAt: typeof preset.savedAt === 'number' ? preset.savedAt : Date.now(), state }
    })
    .filter((preset): preset is FilterPreset => preset !== null)
}

function writePresets(presets: FilterPreset[]): void {
  writeStorage(PRESETS_KEY, presets)
}

export function savePreset(name: string, state: FilterState): FilterPreset[] {
  const trimmed = name.trim()
  if (!trimmed) return loadPresets()
  const presets = loadPresets().filter((preset) => preset.name !== trimmed)
  presets.push({ name: trimmed, savedAt: Date.now(), state: sanitizeFilterState(state) ?? state })
  const sorted = presets.sort((a, b) => a.savedAt - b.savedAt)
  writePresets(sorted)
  return sorted
}

export function deletePreset(name: string): FilterPreset[] {
  const presets = loadPresets().filter((preset) => preset.name !== name)
  writePresets(presets)
  return presets
}

/** Copies a saved state onto the live reactive filter without replacing its identity. */
export function applyFilterState(target: FilterState, source: FilterState): void {
  target.search = source.search
  target.batchSearch = source.batchSearch ?? ''
  target.methods.splice(0, target.methods.length, ...source.methods)
  target.resourceTypes.splice(0, target.resourceTypes.length, ...source.resourceTypes)
  target.statusGroup = source.statusGroup
  target.conditions.splice(0, target.conditions.length, ...source.conditions.map((condition) => ({ ...condition })))
  target.conditionMode = source.conditionMode
}
