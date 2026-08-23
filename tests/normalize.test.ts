import { describe, expect, it } from 'vitest'
import { normalizeHarEntry } from '../src/core/normalize'

function entry(overrides: Partial<Parameters<typeof normalizeHarEntry>[0]> = {}): Parameters<typeof normalizeHarEntry>[0] {
  return {
    startedDateTime: '2026-08-21T10:00:00.000Z',
    time: 100,
    request: { method: 'GET', url: 'https://api.test/orders?page=2' },
    response: { status: 200, statusText: 'OK' },
    ...overrides,
  }
}

describe('normalizeHarEntry', () => {
  it('merges the HAR _error field into statusText when statusText is empty', () => {
    const request = normalizeHarEntry(entry({ _error: 'net::ERR_ABORTED', response: { status: 0, statusText: '' } }), 1)
    expect(request.status).toBe(0)
    expect(request.statusText).toBe('net::ERR_ABORTED')
  })

  it('falls back to a nested response _error', () => {
    const request = normalizeHarEntry(
      entry({
        response: {
          status: -1,
          statusText: '',
          _error: 'net::ERR_CONNECTION_REFUSED',
        },
      }),
      2,
    )
    expect(request.statusText).toBe('net::ERR_CONNECTION_REFUSED')
  })

  it('keeps a non-empty statusText over _error', () => {
    const request = normalizeHarEntry(entry({ _error: 'net::ERR_ABORTED' }), 3)
    expect(request.status).toBe(200)
    expect(request.statusText).toBe('OK')
  })

  it('falls back to empty when no reason is present', () => {
    const request = normalizeHarEntry(entry({ response: { status: 200 } }), 4)
    expect(request.statusText).toBe('')
  })

  it('keeps malformed URLs intact instead of crashing', () => {
    const request = normalizeHarEntry(entry({ request: { method: 'GET', url: 'http://[broken' } }), 5)
    expect(request.url).toBe('http://[broken')
    expect(request.host).toBe('')
    expect(request.pathname).toBe('http://[broken')
  })
})
