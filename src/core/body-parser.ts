import type { ParameterEntry, ParameterSource } from '../types/network'

const MAX_DEPTH = 12
const MAX_PARAMETERS = 1000

function displayValue(value: unknown): string {
  if (value === null) return 'null'
  if (value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function finalKey(path: string): string {
  const normalized = path.replace(/\[\d+\]$/, '')
  return normalized.split('.').pop() || normalized || '$'
}

export function flattenValue(
  value: unknown,
  source: ParameterSource,
  path = '',
  depth = 0,
  output: ParameterEntry[] = [],
): ParameterEntry[] {
  if (output.length >= MAX_PARAMETERS) return output

  const isLeaf = value === null || typeof value !== 'object' || depth >= MAX_DEPTH
  if (isLeaf) {
    const resolvedPath = path || '$'
    output.push({
      source,
      path: resolvedPath,
      key: finalKey(resolvedPath),
      value: displayValue(value),
      rawValue: value,
    })
    return output
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      flattenValue([], source, path || '$', MAX_DEPTH, output)
      return output
    }
    value.forEach((item, index) => {
      flattenValue(item, source, `${path || '$'}[${index}]`, depth + 1, output)
    })
    return output
  }

  const entries = Object.entries(value as Record<string, unknown>)
  if (entries.length === 0) {
    flattenValue({}, source, path || '$', MAX_DEPTH, output)
    return output
  }

  entries.forEach(([key, item]) => {
    const nextPath = path ? `${path}.${key}` : key
    flattenValue(item, source, nextPath, depth + 1, output)
  })
  return output
}

function parseUrlEncoded(text: string, source: ParameterSource): ParameterEntry[] {
  const output: ParameterEntry[] = []
  const counts = new Map<string, number>()
  new URLSearchParams(text).forEach((value, key) => {
    const count = counts.get(key) ?? 0
    counts.set(key, count + 1)
    const path = count === 0 ? key : `${key}[${count}]`
    output.push({ source, path, key, value, rawValue: value })
  })
  return output
}

function parseMultipart(text: string, contentType: string): ParameterEntry[] {
  const boundary = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType)?.slice(1).find(Boolean)?.trim()
  if (!boundary) return []

  return text
    .split(`--${boundary}`)
    .map((part) => part.trim())
    .filter((part) => part && part !== '--')
    .flatMap((part) => {
      const [rawHeaders, ...bodyParts] = part.split(/\r?\n\r?\n/)
      const disposition = /content-disposition:[^\n]*name="([^"]+)"(?:;\s*filename="([^"]*)")?/i.exec(rawHeaders)
      if (!disposition) return []
      const key = disposition[1]
      const filename = disposition[2]
      const value = filename ? `[文件] ${filename}` : bodyParts.join('\n\n').replace(/\r?\n--$/, '').trim()
      return [{ source: 'body' as const, path: key, key, value, rawValue: value }]
    })
}

export function parseBodyParameters(text: string, contentType = ''): ParameterEntry[] {
  if (!text) return []
  const mime = contentType.toLowerCase()

  if (mime.includes('json') || /^[\s]*[\[{]/.test(text)) {
    try {
      return flattenValue(JSON.parse(text), 'body')
    } catch {
      // Some APIs declare JSON but send non-JSON payloads. Fall through to text parsing.
    }
  }

  if (mime.includes('application/x-www-form-urlencoded')) {
    return parseUrlEncoded(text, 'body')
  }

  if (mime.includes('multipart/form-data')) {
    return parseMultipart(text, contentType)
  }

  if (/^[^=&\s]+=[^&]*(?:&[^=&\s]+=[^&]*)*$/.test(text.trim())) {
    return parseUrlEncoded(text, 'body')
  }

  return [{ source: 'body', path: '$', key: '$', value: text, rawValue: text }]
}

export function parseQueryParameters(url: string): ParameterEntry[] {
  try {
    return parseUrlEncoded(new URL(url).search.slice(1), 'query')
  } catch {
    return []
  }
}
