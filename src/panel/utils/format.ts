import type { CapturedRequest } from '../../types/network'
import { locale, t } from '../i18n'

export { formatResourceType } from '../../core/resource-type'

export function formatDuration(duration: number): string {
  if (duration < 1000) return `${Math.round(duration)} ms`
  return `${(duration / 1000).toFixed(duration >= 10000 ? 1 : 2)} s`
}

export function formatSize(bytes: number): string {
  if (!bytes) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes >= 10240 ? 0 : 1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function formatClock(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '--:--:--'
  return date.toLocaleTimeString(locale.value, { hour12: false })
}

export function prettyText(text: string, mimeType = ''): string {
  if (!text) return ''
  if (mimeType.includes('json') || /^[\s]*[\[{]/.test(text)) {
    try {
      return JSON.stringify(JSON.parse(text), null, 2)
    } catch {
      return text
    }
  }
  return text
}

export function responseText(request: CapturedRequest): string {
  const body = request.responseBody
  if (!body) return ''
  if (body.encoding !== 'base64') return prettyText(body.content, request.mimeType)
  try {
    const binary = atob(body.content)
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
    return prettyText(new TextDecoder().decode(bytes), request.mimeType)
  } catch {
    return body.content
  }
}

export function requestName(request: CapturedRequest): string {
  const segments = request.pathname.split('/').filter(Boolean)
  return segments.at(-1) || request.host || request.url
}

export function statusClass(status: number): string {
  if (status < 0) return 'status-failed'
  if (status === 0) return 'status-pending'
  if (status >= 500) return 'status-server-error'
  if (status >= 400) return 'status-client-error'
  if (status >= 300) return 'status-redirect'
  if (status >= 200) return 'status-success'
  return 'status-neutral'
}

/** Cell text for the list: failed requests have no numeric status to show. */
export function statusLabel(request: CapturedRequest): string {
  if (request.status < 0) return t('statusFailedShort')
  return request.status ? String(request.status) : '···'
}

export function methodClass(method: string): string {
  return `method-${method.toLowerCase()}`
}

export interface WaterfallWindow {
  start: number
  span: number
}

/** Time window covered by a request set: earliest start to latest end. */
export function waterfallWindow(requests: CapturedRequest[]): WaterfallWindow {
  if (requests.length === 0) return { start: 0, span: 1 }
  let start = Infinity
  let end = -Infinity
  for (const request of requests) {
    start = Math.min(start, request.timestamp)
    end = Math.max(end, request.timestamp + request.duration)
  }
  return { start, span: Math.max(1, end - start) }
}

/** Bar geometry for one request as percentages of the waterfall column. */
export function waterfallBar(request: CapturedRequest, window: WaterfallWindow): { left: number; width: number } {
  const left = Math.min(99, Math.max(0, ((request.timestamp - window.start) / window.span) * 100))
  const width = Math.min(100 - left, Math.max(0.5, (request.duration / window.span) * 100))
  return { left, width }
}
