import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { locale, setLocale, t, toggleLocale } from '../src/panel/i18n'

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

describe('i18n', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage())
  })

  afterEach(() => {
    setLocale('zh-CN')
    vi.unstubAllGlobals()
  })

  it('translates known keys in both locales', () => {
    setLocale('zh-CN')
    expect(t('advancedFilter')).toBe('高级筛选')
    setLocale('en')
    expect(t('advancedFilter')).toBe('Advanced')
  })

  it('substitutes placeholders', () => {
    setLocale('en')
    expect(t('requestCount', { n: 15 })).toBe('15 requests')
    setLocale('zh-CN')
    expect(t('requestCount', { n: 15 })).toBe('15 个请求')
    expect(t('viewAllItems', { n: 5 })).toBe('查看全部 5 项')
  })

  it('persists the locale and toggles back and forth', () => {
    setLocale('en')
    expect(localStorage.getItem('easy-request-search:locale')).toBe('en')
    toggleLocale()
    expect(locale.value).toBe('zh-CN')
  })
})
