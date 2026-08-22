import type { CapturedRequest, HeaderEntry } from '../../types/network'
import { SENSITIVE_HEADERS } from '../constants'

export function redactedHeaders(headers: HeaderEntry[]): HeaderEntry[] {
  return headers.map((header) => ({
    ...header,
    value: SENSITIVE_HEADERS.has(header.name.toLowerCase()) ? '[REDACTED]' : header.value,
  }))
}

export function buildExportPayload(requests: CapturedRequest[]): CapturedRequest[] {
  return requests.map((request) => ({
    ...request,
    requestHeaders: redactedHeaders(request.requestHeaders),
    responseHeaders: redactedHeaders(request.responseHeaders),
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
          url: request.url,
          httpVersion: 'HTTP/1.1',
          headers: redactedHeaders(request.requestHeaders),
          queryString: request.queryParameters.map(({ key, value }) => ({ name: key, value: String(value) })),
          cookies: [],
          headersSize: -1,
          bodySize: request.requestBody ? request.requestBody.length : 0,
          ...(request.requestBody
            ? { postData: { mimeType: request.requestBodyMime || 'application/octet-stream', text: request.requestBody } }
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
            ...(request.responseBody ? { text: request.responseBody.content, encoding: request.responseBody.encoding || undefined } : {}),
          },
          redirectURL: request.responseHeaders.find(({ name }) => name.toLowerCase() === 'location')?.value ?? '',
          headersSize: -1,
          bodySize: request.size,
        },
        cache: {},
        timings: { send: 0, wait: request.duration, receive: 0 },
      })),
    },
  }
}
