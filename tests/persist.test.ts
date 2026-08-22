import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyFilterState,
  deletePreset,
  loadFilterState,
  loadPresets,
  sanitizeFilterState,
  saveFilterState,
  savePreset,
} from '../src/panel/utils/persist'
import type { FilterState } from '../src/types/network'

function memoryStorage(): Storage {
  const store = new Map<string, string>()
  return {
    get length() {
      return store.size
    },
    clear: () => store.clear(),
    getItem: (key) => store.get(key) ?? null,
    key: (index) => [...store.keys()][index] ?? null,
    removeItem: (key) => void store.delete(key),
    setItem: (key, value) => void store.set(key, String(value)),
  }
}

const baseFilter = (): FilterState => ({
  search: '',
  methods: [],
  resourceTypes: [],
  statusGroup: 'all',
  conditions: [],
  conditionMode: 'all',
})

describe('persisted filter state', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('round-trips a filter state through storage', () => {
    const filter = baseFilter()
    filter.search = 'orders'
    filter.methods = ['GET', 'POST']
    filter.batchSearch = 'ORD-1\nORD-2'
    filter.conditions = [{ id: 'c1', field: 'response', operator: 'contains', value: 'tenantId' }]
    saveFilterState(filter)
    expect(loadFilterState()).toEqual(filter)
  })

  it('rejects malformed stored values', () => {
    localStorage.setItem('easy-request-search:filter', '{"search": 42, "methods": "nope"}')
    const restored = loadFilterState()
    expect(restored).toEqual({ ...baseFilter(), batchSearch: '', statusGroup: 'all' })
  })

  it('drops conditions with unknown fields or operators', () => {
    const sanitized = sanitizeFilterState({
      search: 'ok',
      conditions: [
        { id: 'a', field: 'response', operator: 'contains', value: 'x' },
        { id: 'b', field: 'dangerous', operator: 'contains', value: 'x' },
        { id: 'c', field: 'url', operator: 'rm -rf', value: 'x' },
      ],
    })
    expect(sanitized?.conditions).toHaveLength(1)
    expect(sanitized?.conditions[0].id).toBe('a')
  })

  it('returns null for unusable payloads', () => {
    expect(sanitizeFilterState('nope')).toBeNull()
    expect(sanitizeFilterState(null)).toBeNull()
  })
})

describe('filter presets', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('saves, overwrites, and deletes named presets', () => {
    const filter = baseFilter()
    filter.search = 'api'
    savePreset('daily', filter)

    filter.search = 'cdn'
    savePreset('assets', filter)
    expect(loadPresets().map((preset) => preset.name)).toEqual(['daily', 'assets'])

    filter.search = 'changed'
    savePreset('daily', filter)
    const names = loadPresets().map((preset) => preset.name)
    expect(names).toEqual(['assets', 'daily'])
    expect(loadPresets().find((preset) => preset.name === 'daily')?.state.search).toBe('changed')

    deletePreset('assets')
    expect(loadPresets().map((preset) => preset.name)).toEqual(['daily'])
  })

  it('ignores blank preset names', () => {
    const filter = baseFilter()
    savePreset('   ', filter)
    expect(loadPresets()).toHaveLength(0)
  })
})

describe('applyFilterState', () => {
  it('copies fields onto the target without replacing its identity', () => {
    const target = baseFilter()
    target.methods.push('GET')
    const source = baseFilter()
    source.search = 'q'
    source.statusGroup = '500'
    source.conditionMode = 'any'
    source.conditions.push({ id: 'c1', field: 'url', operator: 'contains', value: 'api' })

    applyFilterState(target, source)
    expect(target).toBe(target)
    expect(target.search).toBe('q')
    expect(target.methods).toEqual([])
    expect(target.statusGroup).toBe('500')
    expect(target.conditionMode).toBe('any')
    expect(target.conditions).toHaveLength(1)

    target.conditions[0].value = 'mutated'
    expect(source.conditions[0].value).toBe('api')
  })
})
