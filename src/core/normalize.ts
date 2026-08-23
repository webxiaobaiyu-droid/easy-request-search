import { parseBodyParameters, parseQueryParameters } from './body-parser'
import type { CapturedRequest, HeaderEntry } from '../types/network'

interface HarHeader {
  name: string
  value: string
}

interface HarEntryLike {
  startedDateTime?: string
  time?: number
  request: {
    method?: string
    url?: string
    headers?: HarHeader[]
    postData?: { mimeType?: string; text?: string }
  }
  response: {
    status?: number
    statusText?: string
    headers?: HarHeader[]
    content?: { mimeType?: string; size?: number }
    bodySize?: number
    _error?: string
  }
  type?: string
  _resourceType?: string
  /** Chrome's HAR puts the net::ERR_* reason here when a request failed at the network layer. */
  _error?: string
}

/** Failure reason for requests with no HTTP status; `statusText` is usually empty there. */
function failureReason(entry: HarEntryLike): string {
  return typeof entry._error === 'string' ? entry._error : typeof entry.response._error === 'string' ? entry.response._error : ''
}

function headerValue(headers: HeaderEntry[], name: string): string {
  return headers.find((header) => header.name.toLowerCase() === name.toLowerCase())?.value ?? ''
}

function formatDisplayUrl(url: URL): string {
  return `${url.pathname || '/'}${url.search}`
}

export function normalizeHarEntry(entry: HarEntryLike, sequence: number): CapturedRequest {
  const rawUrl = entry.request.url || ''
  let host = ''
  let pathname = rawUrl
  let displayUrl = rawUrl
  try {
    const url = new URL(rawUrl)
    host = url.host
    pathname = url.pathname || '/'
    displayUrl = formatDisplayUrl(url)
  } catch {
    // Keep the original URL for uncommon protocols and malformed requests.
  }

  const requestHeaders = entry.request.headers ?? []
  const responseHeaders = entry.response.headers ?? []
  const requestBodyMime = entry.request.postData?.mimeType || headerValue(requestHeaders, 'content-type')
  const requestBody = entry.request.postData?.text ?? ''
  const queryParameters = parseQueryParameters(rawUrl)
  const bodyParameters = parseBodyParameters(requestBody, requestBodyMime)
  const startedAt = entry.startedDateTime || new Date().toISOString()

  return {
    id: `${Date.parse(startedAt) || Date.now()}-${sequence}`,
    sequence,
    startedAt,
    timestamp: Date.parse(startedAt) || Date.now(),
    method: (entry.request.method || 'GET').toUpperCase(),
    url: rawUrl,
    displayUrl,
    host,
    pathname,
    status: entry.response.status ?? 0,
    statusText: entry.response.statusText || failureReason(entry),
    resourceType: (entry.type || entry._resourceType || inferResourceType(entry.response.content?.mimeType || '')).toLowerCase(),
    mimeType: entry.response.content?.mimeType || headerValue(responseHeaders, 'content-type'),
    duration: Math.max(0, entry.time ?? 0),
    size: Math.max(0, entry.response.bodySize || entry.response.content?.size || 0),
    requestHeaders,
    responseHeaders,
    requestBody,
    requestBodyMime,
    parameters: [...queryParameters, ...bodyParameters],
    queryParameters,
    bodyParameters,
  }
}

function inferResourceType(mimeType: string): string {
  const mime = mimeType.toLowerCase()
  if (mime.includes('json')) return 'fetch'
  if (mime.startsWith('image/')) return 'image'
  if (mime.includes('javascript')) return 'script'
  if (mime.includes('css')) return 'stylesheet'
  if (mime.includes('html')) return 'document'
  if (mime.includes('font')) return 'font'
  return 'other'
}
