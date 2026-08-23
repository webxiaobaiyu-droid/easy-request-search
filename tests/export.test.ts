import { describe, expect, it } from 'vitest'
import {
  buildExportPayload,
  buildHar,
  isSensitiveParameterName,
  redactBodyText,
  redactUrlQuery,
} from '../src/panel/utils/export'
import type { CapturedRequest } from '../src/types/network'

function request(overrides: Partial<CapturedRequest> = {}): CapturedRequest {
  return {
    id: 'r1',
    sequence: 1,
    startedAt: '2026-08-21T10:00:00.000Z',
    timestamp: 0,
    method: 'POST',
    url: 'https://api.test/orders?page=2',
    displayUrl: '/orders?page=2',
    host: 'api.test',
    pathname: '/orders',
    status: 200,
    statusText: 'OK',
    resourceType: 'fetch',
    mimeType: 'application/json',
    duration: 10,
    size: 10,
    requestHeaders: [{ name: 'content-type', value: 'application/json' }],
    responseHeaders: [],
    requestBody: '',
    requestBodyMime: '',
    parameters: [],
    queryParameters: [],
    bodyParameters: [],
    ...overrides,
  }
}

describe('isSensitiveParameterName', () => {
  it('matches credential-looking names, not ordinary ones', () => {
    expect(isSensitiveParameterName('token')).toBe(true)
    expect(isSensitiveParameterName('access_token')).toBe(true)
    expect(isSensitiveParameterName('api-key')).toBe(true)
    expect(isSensitiveParameterName('password')).toBe(true)
    expect(isSensitiveParameterName('key')).toBe(true)
    expect(isSensitiveParameterName('tenantId')).toBe(false)
    expect(isSensitiveParameterName('monkey')).toBe(false)
  })
})

describe('redactUrlQuery', () => {
  it('redacts sensitive query params and keeps the rest', () => {
    const redacted = redactUrlQuery('https://api.test/orders?token=abc&page=2')
    expect(redacted).not.toContain('abc')
    expect(redacted).toContain('page=2')
    expect(redactUrlQuery('https://api.test/orders?page=2&tenantId=3107')).toBe('https://api.test/orders?page=2&tenantId=3107')
    expect(redactUrlQuery('not a url')).toBe('not a url')
  })
})

describe('redactBodyText', () => {
  it('redacts sensitive values inside JSON while keeping its shape', () => {
    const redacted = redactBodyText('{"user":{"name":"Lin","password":"p1"},"n":1}', 'application/json')
    expect(redacted).not.toContain('p1')
    expect(redacted).toContain('Lin')
    expect(JSON.parse(redacted).user.password).toBe('[REDACTED]')
  })
  it('redacts form-encoded bodies and passes unknown formats through', () => {
    expect(redactBodyText('token=abc&a=1', 'application/x-www-form-urlencoded')).toBe('token=%5BREDACTED%5D&a=1')
    expect(redactBodyText('hello world', 'text/plain')).toBe('hello world')
  })
})

describe('buildExportPayload', () => {
  it('redacts URLs, parameter values, bodies and headers', () => {
    const [exported] = buildExportPayload([
      request({
        url: 'https://api.test/orders?access_token=abc',
        requestHeaders: [{ name: 'authorization', value: 'Bearer abc' }],
        parameters: [{ source: 'query', path: 'access_token', key: 'access_token', value: 'abc', rawValue: 'abc' }],
        queryParameters: [{ source: 'query', path: 'access_token', key: 'access_token', value: 'abc', rawValue: 'abc' }],
        bodyParameters: [{ source: 'body', path: 'user.password', key: 'password', value: 'p1', rawValue: 'p1' }],
        requestBody: '{"password":"p1"}',
        requestBodyMime: 'application/json',
      }),
    ])
    expect(exported.url).not.toContain('abc')
    expect(exported.requestHeaders[0].value).toBe('[REDACTED]')
    expect(exported.parameters[0].value).toBe('[REDACTED]')
    expect(exported.bodyParameters[0].value).toBe('[REDACTED]')
    expect(exported.requestBody).not.toContain('p1')
  })
})

describe('buildHar redaction', () => {
  it('redacts urls, query strings, bodies and the redirect target', () => {
    const har = buildHar([
      request({
        url: 'https://api.test/orders?token=abc',
        queryParameters: [{ source: 'query', path: 'token', key: 'token', value: 'abc', rawValue: 'abc' }],
        requestBody: '{"password":"p1"}',
        requestBodyMime: 'application/json',
        responseHeaders: [{ name: 'location', value: 'https://next.test/cont?signature=zzz' }],
      }),
    ])
    const entry = har.log.entries[0] as Record<string, any>
    expect(entry.request.url).not.toContain('abc')
    expect(entry.request.queryString).toEqual([{ name: 'token', value: '[REDACTED]' }])
    expect(entry.request.postData.text).not.toContain('p1')
    expect(entry.response.redirectURL).not.toContain('zzz')
  })
})
