import type { CapturedRequest, HeaderEntry, ParameterEntry } from '../../types/network'
import { SENSITIVE_HEADERS } from '../constants'

export function redactedHeaders(headers: HeaderEntry[]): HeaderEntry[] {
  return headers.map((header) => ({
    ...header,
    value: SENSITIVE_HEADERS.has(header.name.toLowerCase()) ? '[REDACTED]' : header.value,
  }))
}

/** Parameter names whose values look like credentials — redacted in exports. */
const SENSITIVE_KEY = /(token|secret|password|passwd|credential|signature|session|authorization|cookie|api[-_]?key)/i
const BARE_KEY = /(^|[._\-])key$/i

export function isSensitiveParameterName(name: string): boolean {
  return SENSITIVE_KEY.test(name) || BARE_KEY.test(name)
}

/** Redacts sensitive query params (e.g. `?api_key=…`) inside a URL. */
export function redactUrlQuery(rawUrl: string): string {
  try {
    const url = new URL(rawUrl)
    const params = url.searchParams
    let touched = false
    for (const name of [...params.keys()]) {
      if (isSensitiveParameterName(name)) {
        params.set(name, '[REDACTED]')
        touched = true
      }
    }
    return touched ? url.toString() : rawUrl
  } catch {
    return rawUrl
  }
}

function redactParameters(parameters: ParameterEntry[]): ParameterEntry[] {
  return parameters.map((parameter) =>
    isSensitiveParameterName(parameter.key) ? { ...parameter, value: '[REDACTED]' } : parameter,
  )
}

/** Best-effort value redaction inside a JSON text, keyed on names; unchanged shape when nothing is sensitive. */
function redactJsonValue(value: unknown, depth = 0): unknown {
  if (depth > 12 || value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map((item) => redactJsonValue(item, depth + 1))
  let changed = false
  const output: Record<string, unknown> = {}
  for (const [name, item] of Object.entries(value as Record<string, unknown>)) {
    if (isSensitiveParameterName(name)) {
      output[name] = '[REDACTED]'
      changed = true
    } else {
      const redacted = redactJsonValue(item, depth + 1)
      output[name] = redacted
      changed = changed || redacted !== item
    }
  }
  return changed ? output : value
}

function redactFormText(text: string): string {
  const params = new URLSearchParams(text)
  let touched = false
  for (const name of [...params.keys()]) {
    if (isSensitiveParameterName(name)) {
      params.set(name, '[REDACTED]')
      touched = true
    }
  }
  return touched ? params.toString() : text
}

/** Redacts sensitive values in a body text when its shape is parseable; other formats pass through. */
export function redactBodyText(text: string, mimeType: string): string {
  if (!text) return text
  if (/json/i.test(mimeType) || /^[\s]*[\[{]/.test(text)) {
    try {
      const parsed = JSON.parse(text)
      const redacted = redactJsonValue(parsed)
      return redacted === parsed ? text : JSON.stringify(redacted, null, 2)
    } catch {
      return text
    }
  }
  if (/urlencoded/i.test(mimeType)) return redactFormText(text)
  return text
}

export function buildExportPayload(requests: CapturedRequest[]): CapturedRequest[] {
  return requests.map((request) => ({
    ...request,
    url: redactUrlQuery(request.url),
    requestHeaders: redactedHeaders(request.requestHeaders),
    responseHeaders: redactedHeaders(request.responseHeaders),
    requestBody: redactBodyText(request.requestBody, request.requestBodyMime),
    parameters: redactParameters(request.parameters),
    queryParameters: redactParameters(request.queryParameters),
    bodyParameters: redactParameters(request.bodyParameters),
    ...(request.responseBody
      ? { responseBody: { ...request.responseBody, content: redactBodyText(request.responseBody.content, request.mimeType) } }
      : {}),
  }))
}

export function downloadJsonFile(payload: unknown, fileName?: string): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName ?? `easy-request-search-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

interface HarLog {
  log: {
    version: '1.2'
    creator: { name: string; version: string }
    entries: unknown[]
  }
}

/** Builds a HAR 1.2 document from captured requests; sensitive headers are redacted. */
export function buildHar(requests: CapturedRequest[], creatorVersion = '0.1.0'): HarLog {
  return {
    log: {
      version: '1.2',
      creator: { name: 'EasyRequestSearch', version: creatorVersion },
      entries: requests.map((request) => ({
        startedDateTime: request.startedAt,
        time: request.duration,
        _resourceType: request.resourceType,
        request: {
          method: request.method,
          url: redactUrlQuery(request.url),
          httpVersion: 'HTTP/1.1',
          headers: redactedHeaders(request.requestHeaders),
          queryString: request.queryParameters.map(({ key, value }) => ({
            name: key,
            value: isSensitiveParameterName(key) ? '[REDACTED]' : String(value),
          })),
          cookies: [],
          headersSize: -1,
          bodySize: request.requestBody ? request.requestBody.length : 0,
          ...(request.requestBody
            ? {
                postData: {
                  mimeType: request.requestBodyMime || 'application/octet-stream',
                  text: redactBodyText(request.requestBody, request.requestBodyMime),
                },
              }
            : {}),
        },
        response: {
          status: request.status,
          statusText: request.statusText,
          httpVersion: 'HTTP/1.1',
          headers: redactedHeaders(request.responseHeaders),
          content: {
            size: request.size,
            mimeType: request.mimeType,
            ...(request.responseBody
              ? {
                  text: redactBodyText(request.responseBody.content, request.mimeType),
                  encoding: request.responseBody.encoding || undefined,
                }
              : {}),
          },
          redirectURL: redactUrlQuery(request.responseHeaders.find(({ name }) => name.toLowerCase() === 'location')?.value ?? ''),
          headersSize: -1,
          bodySize: request.size,
        },
        cache: {},
        timings: { send: 0, wait: request.duration, receive: 0 },
      })),
    },
  }
}
