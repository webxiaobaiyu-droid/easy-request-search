import { describe, expect, it } from 'vitest'
import { requestToCurl, requestToFetch, requestToNodeAxios } from '../src/core/curl'
import { normalizeHarEntry } from '../src/core/normalize'
import type { CapturedRequest } from '../src/types/network'

const request = normalizeHarEntry(
  {
    startedDateTime: '2026-08-21T10:00:00.000Z',
    time: 96,
    _resourceType: 'xhr',
    request: {
      method: 'POST',
      url: 'https://api.test/orders?page=2',
      headers: [
        { name: 'content-type', value: 'application/json' },
        { name: 'content-length', value: '18' },
        { name: 'host', value: 'api.test' },
      ],
      postData: { mimeType: 'application/json', text: '{"sku":"M-9"}' },
    },
    response: { status: 201, statusText: 'Created' },
  },
  1,
)

const get = normalizeHarEntry(
  {
    startedDateTime: '2026-08-21T10:01:00.000Z',
    time: 20,
    _resourceType: 'fetch',
    request: { method: 'GET', url: 'https://api.test/ping' },
    response: { status: 204 },
  },
  2,
)

describe('requestToCurl', () => {
  it('quotes the URL, keeps the method, and drops browser-only headers', () => {
    const command = requestToCurl(request)
    expect(command).toContain(`curl 'https://api.test/orders?page=2'`)
    expect(command).toContain('-X POST')
    expect(command).toContain(`-H 'content-type: application/json'`)
    expect(command).not.toContain('content-length')
    expect(command).not.toContain('host')
    expect(command).toContain(`--data-raw '{"sku":"M-9"}'`)
  })

  it('omits the method flag and body for plain GET requests', () => {
    const command = requestToCurl(get)
    expect(command).toBe(`curl 'https://api.test/ping'`)
  })
})

describe('requestToFetch', () => {
  it('builds a fetch call with method, headers, and body', () => {
    const code = requestToFetch(request)
    expect(code).toContain(`fetch('https://api.test/orders?page=2', {`)
    expect(code).toContain(`method: 'POST'`)
    expect(code).toContain(`'content-type': 'application/json'`)
    expect(code).toContain(`body: '{"sku":"M-9"}'`)
    expect(code).not.toContain('content-length')
    expect(code.trim().endsWith('})')).toBe(true)
  })

  it('emits a bare fetch for plain GET requests', () => {
    expect(requestToFetch(get)).toBe(`fetch('https://api.test/ping')`)
  })
})

describe('requestToNodeAxios', () => {
  it('builds an axios call with url, method, headers, and data', () => {
    const code = requestToNodeAxios(request)
    expect(code).toContain(`url: "https://api.test/orders?page=2"`)
    expect(code).toContain(`method: 'post'`)
    expect(code).toContain(`"content-type": "application/json"`)
    expect(code).toContain(String.raw`data: "{\"sku\":\"M-9\"}"`)
    expect(code).not.toContain('content-length')
  })

  it('keeps GET minimal', () => {
    const code = requestToNodeAxios(get)
    expect(code).not.toContain('method')
    expect(code).not.toContain('data')
    expect(code).toContain('await axios({')
  })
})
