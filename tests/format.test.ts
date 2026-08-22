import { describe, expect, it } from 'vitest'
import {
  formatClock,
  formatDuration,
  formatResourceType,
  formatSize,
  requestName,
  statusClass,
} from '../src/panel/utils/format'
import { redactedHeaders, buildExportPayload } from '../src/panel/utils/export'
import type { CapturedRequest, HeaderEntry } from '../src/types/network'

describe('formatDuration', () => {
  it('formats milliseconds and seconds at boundaries', () => {
    expect(formatDuration(0)).toBe('0 ms')
    expect(formatDuration(999)).toBe('999 ms')
    expect(formatDuration(1000)).toBe('1.00 s')
    expect(formatDuration(10000)).toBe('10.0 s')
    expect(formatDuration(2450)).toBe('2.45 s')
  })
})

describe('formatSize', () => {
  it('formats bytes at boundaries', () => {
    expect(formatSize(0)).toBe('0 B')
    expect(formatSize(512)).toBe('512 B')
    expect(formatSize(1024)).toBe('1.0 KB')
    expect(formatSize(15360)).toBe('15 KB')
    expect(formatSize(2.5 * 1024 * 1024)).toBe('2.5 MB')
  })
})

describe('formatClock', () => {
  it('formats ISO timestamps and falls back for invalid input', () => {
    expect(formatClock('2026-08-21T10:00:00.000Z')).toMatch(/^\d{2}:\d{2}:\d{2}$/)
    expect(formatClock('not-a-date')).toBe('--:--:--')
  })
})

describe('statusClass', () => {
  it('classifies status boundaries', () => {
    expect(statusClass(0)).toBe('status-pending')
    expect(statusClass(199)).toBe('status-neutral')
    expect(statusClass(200)).toBe('status-success')
    expect(statusClass(299)).toBe('status-success')
    expect(statusClass(300)).toBe('status-redirect')
    expect(statusClass(400)).toBe('status-client-error')
    expect(statusClass(500)).toBe('status-server-error')
  })
})

describe('requestName', () => {
  it('uses the last path segment, falling back to host or URL', () => {
    const base = { host: 'api.test', pathname: '/v1/orders/42', url: 'https://api.test/v1/orders/42' } as CapturedRequest
    expect(requestName(base)).toBe('42')
    expect(requestName({ ...base, pathname: '/' })).toBe('api.test')
    expect(requestName({ ...base, pathname: '/', host: '' })).toBe('https://api.test/v1/orders/42')
  })
})

describe('formatResourceType', () => {
  it('maps resource types to DevTools-style labels', () => {
    expect(formatResourceType('xhr')).toBe('xhr')
    expect(formatResourceType('xmlhttprequest')).toBe('xhr')
    expect(formatResourceType('stylesheet')).toBe('stylesheet')
    expect(formatResourceType('')).toBe('other')
  })

  it('shows image mime subtypes like DevTools does', () => {
    expect(formatResourceType('image', 'image/png')).toBe('png')
    expect(formatResourceType('image', 'image/svg+xml')).toBe('svg')
    expect(formatResourceType('image', 'image/png; charset=binary')).toBe('png')
  })
})

describe('export redaction', () => {
  const headers: HeaderEntry[] = [
    { name: 'Authorization', value: 'Bearer secret' },
    { name: 'x-api-key', value: 'k-123' },
    { name: 'x-trace-id', value: 'trace-9' },
  ]

  it('redacts sensitive headers case-insensitively', () => {
    expect(redactedHeaders(headers)).toEqual([
      { name: 'Authorization', value: '[REDACTED]' },
      { name: 'x-api-key', value: '[REDACTED]' },
      { name: 'x-trace-id', value: 'trace-9' },
    ])
  })

  it('redacts both header sides of an exported request', () => {
    const request = { requestHeaders: headers, responseHeaders: [{ name: 'Set-Cookie', value: 'sid=1' }] } as CapturedRequest
    const [exported] = buildExportPayload([request])
    expect(exported.requestHeaders[0].value).toBe('[REDACTED]')
    expect(exported.responseHeaders[0].value).toBe('[REDACTED]')
  })
})

describe('statusClass failures', () => {
  it('classifies negative statuses as failed', () => {
    expect(statusClass(-1)).toBe('status-failed')
    expect(statusClass(-15)).toBe('status-failed')
    expect(statusClass(0)).toBe('status-pending')
  })
})

describe('statusLabel', () => {
  it('labels failed requests and keeps numeric statuses', async () => {
    const { statusLabel } = await import('../src/panel/utils/format')
    expect(statusLabel({ status: -1 } as CapturedRequest)).toBe('失败')
    expect(statusLabel({ status: 404 } as CapturedRequest)).toBe('404')
    expect(statusLabel({ status: 0 } as CapturedRequest)).toBe('···')
  })
})

describe('buildHar', () => {
  const harRequest: CapturedRequest = {
    ...plainLikeRequest(),
  }

  function plainLikeRequest(): CapturedRequest {
    return {
      id: 'r1',
      sequence: 1,
      startedAt: '2026-08-21T10:00:00.000Z',
      timestamp: Date.parse('2026-08-21T10:00:00.000Z'),
      method: 'POST',
      url: 'https://api.test/orders?page=2',
      displayUrl: '/orders?page=2',
      host: 'api.test',
      pathname: '/orders',
      status: 201,
      statusText: 'Created',
      resourceType: 'fetch',
      mimeType: 'application/json',
      duration: 128,
      size: 480,
      requestHeaders: [
        { name: 'content-type', value: 'application/json' },
        { name: 'authorization', value: 'Bearer secret' },
      ],
      responseHeaders: [{ name: 'content-type', value: 'application/json' }],
      requestBody: '{"page":2}',
      requestBodyMime: 'application/json',
      parameters: [],
      queryParameters: [{ source: 'query', path: 'page', key: 'page', value: '2', rawValue: '2' }],
      bodyParameters: [],
      responseBody: { content: '{"ok":true}', encoding: '' },
    }
  }

  it('produces a HAR 1.2 log with redacted sensitive headers', async () => {
    const { buildHar } = await import('../src/panel/utils/export')
    const har = buildHar([harRequest], '9.9.9')
    expect(har.log.version).toBe('1.2')
    expect(har.log.creator).toEqual({ name: 'EasyRequestSearch', version: '9.9.9' })
    const entry = har.log.entries[0] as Record<string, any>
    expect(entry.request.method).toBe('POST')
    expect(entry.request.postData.text).toBe('{"page":2}')
    expect(entry.request.queryString).toEqual([{ name: 'page', value: '2' }])
    expect(entry.request.headers).toContainEqual({ name: 'authorization', value: '[REDACTED]' })
    expect(entry.response.status).toBe(201)
    expect(entry.response.content.text).toBe('{"ok":true}')
    expect(entry.timings.wait).toBe(128)
  })
})

describe('waterfall geometry', () => {
  it('builds the time window from earliest start to latest end', async () => {
    const { waterfallWindow } = await import('../src/panel/utils/format')
    const window = waterfallWindow([
      { timestamp: 1000, duration: 50 } as CapturedRequest,
      { timestamp: 1100, duration: 400 } as CapturedRequest,
    ])
    expect(window).toEqual({ start: 1000, span: 500 })
  })

  it('guards the degenerate single-instant window', async () => {
    const { waterfallWindow } = await import('../src/panel/utils/format')
    expect(waterfallWindow([])).toEqual({ start: 0, span: 1 })
    expect(waterfallWindow([{ timestamp: 5, duration: 0 } as CapturedRequest]).span).toBe(1)
  })

  it('maps a request to bar percentages within the column', async () => {
    const { waterfallBar, waterfallWindow } = await import('../src/panel/utils/format')
    const window = waterfallWindow([
      { timestamp: 0, duration: 100 } as CapturedRequest,
      { timestamp: 900, duration: 100 } as CapturedRequest,
    ])
    // starts halfway, spans 10% of the window
    expect(waterfallBar({ timestamp: 500, duration: 100 } as CapturedRequest, window)).toEqual({ left: 50, width: 10 })
    // first request fills from the left edge
    expect(waterfallBar({ timestamp: 0, duration: 100 } as CapturedRequest, window)).toEqual({ left: 0, width: 10 })
    // zero-duration requests still render a sliver
    expect(waterfallBar({ timestamp: 1000, duration: 0 } as CapturedRequest, window).width).toBeGreaterThanOrEqual(0.5)
  })
})
