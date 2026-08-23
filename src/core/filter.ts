import type { CapturedRequest, FilterCondition, FilterField, FilterState } from '../types/network'
import { formatResourceType } from './resource-type'

function normalize(value: unknown): string {
  return String(value ?? '').toLocaleLowerCase()
}

function headerText(request: CapturedRequest): string {
  return request.requestHeaders.map(({ name, value }) => `${name}:${value}`).join('\n')
}

/** Decodes a loaded response body for search; base64 payloads are decoded to text. */
function responseText(request: CapturedRequest): string {
  const body = request.responseBody
  if (!body?.content) return ''
  if (body.encoding !== 'base64') return body.content
  try {
    const binary = atob(body.content)
    return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)))
  } catch {
    return body.content
  }
}

function parameterText(request: CapturedRequest, source?: 'query' | 'body'): string {
  return request.parameters
    .filter((parameter) => !source || parameter.source === source)
    .map((parameter) => `${parameter.path}=${parameter.value}`)
    .join('\n')
}

/** Human-readable labels per status class, searchable via `status:word`. Labels avoid substring overlaps. */
function statusLabels(status: number): string[] {
  if (status < 0) return ['failed', '失败', 'error', '错误']
  if (status === 0) return ['running', 'pending', '进行中']
  const hundred = Math.floor(status / 100) * 100
  switch (hundred) {
    case 100:
      return ['1xx', 'info', '信息']
    case 200:
      return ['ok', 'success', '成功', '2xx']
    case 300:
      return ['redirect', '重定向', '3xx']
    case 400:
      return ['bad', 'client', '客户端错误', '4xx']
    case 500:
      return ['server', '服务器错误', '5xx']
    default:
      return []
  }
}

function valuesForField(request: CapturedRequest, field: FilterField): string[] {
  switch (field) {
    case 'url':
      return [request.url]
    case 'method':
      return [request.method]
    case 'type':
      return [formatResourceType(request.resourceType, request.mimeType)]
    case 'status':
      return [String(request.status), ...statusLabels(request.status)]
    case 'mime':
      return [request.mimeType]
    case 'param': {
      const text = parameterText(request)
      return text ? [text] : []
    }
    case 'paramKey':
      return request.parameters.flatMap((parameter) => [parameter.key, parameter.path])
    case 'paramValue':
      return request.parameters.map((parameter) => parameter.value)
    case 'query': {
      const text = parameterText(request, 'query')
      return text ? [text] : []
    }
    case 'body': {
      return [parameterText(request, 'body'), request.requestBody].filter(Boolean)
    }
    case 'header': {
      const text = headerText(request)
      return text ? [text] : []
    }
    case 'response': {
      const text = responseText(request)
      return text ? [text] : []
    }
    case 'any':
    default:
      return [
        request.url,
        request.method,
        request.resourceType,
        String(request.status),
        request.mimeType,
        parameterText(request),
        headerText(request),
        responseText(request),
      ]
  }
}

function compare(value: string, target: string, operator: FilterCondition['operator']): boolean {
  const normalizedValue = normalize(value)
  const normalizedTarget = normalize(target)
  const numericValue = Number(value)
  const numericTarget = Number(target)

  switch (operator) {
    case 'equals':
      return normalizedValue === normalizedTarget
    case 'notEquals':
      return normalizedValue !== normalizedTarget
    case 'exists':
      return normalizedValue.length > 0
    case 'regex':
      try {
        return new RegExp(target, 'i').test(value)
      } catch {
        return false
      }
    case 'gt':
      return Number.isFinite(numericValue) && Number.isFinite(numericTarget) && numericValue > numericTarget
    case 'gte':
      return Number.isFinite(numericValue) && Number.isFinite(numericTarget) && numericValue >= numericTarget
    case 'lt':
      return Number.isFinite(numericValue) && Number.isFinite(numericTarget) && numericValue < numericTarget
    case 'lte':
      return Number.isFinite(numericValue) && Number.isFinite(numericTarget) && numericValue <= numericTarget
    case 'contains':
    default:
      return normalizedValue.includes(normalizedTarget)
  }
}

export function matchesCondition(request: CapturedRequest, condition: FilterCondition): boolean {
  const values = valuesForField(request, condition.field)
  if (values.length === 0) return false
  if (condition.operator === 'notEquals') return values.every((value) => compare(value, condition.value, condition.operator))
  return values.some((value) => compare(value, condition.value, condition.operator))
}

const searchAliases: Record<string, FilterField> = {
  url: 'url',
  method: 'method',
  type: 'type',
  status: 'status',
  mime: 'mime',
  param: 'param',
  key: 'paramKey',
  paramkey: 'paramKey',
  value: 'paramValue',
  paramvalue: 'paramValue',
  query: 'query',
  body: 'body',
  header: 'header',
  response: 'response',
  resp: 'response',
}

const BATCH_KEYWORD_LIMIT = 100

/**
 * Batch search: a pasted multi-line list (ids, URLs, …) switches the search box
 * into OR semantics — a request matches when ANY line matches. Returns null for
 * single-line input so the regular token search keeps its AND semantics.
 */
export function parseBatchKeywords(input: string): string[] | null {
  if (!input.includes('\n')) return null
  const seen = new Set<string>()
  for (const line of input.split('\n')) {
    const keyword = line.trim()
    if (keyword) seen.add(keyword)
  }
  const keywords = [...seen].slice(0, BATCH_KEYWORD_LIMIT)
  return keywords.length > 0 ? keywords : null
}

/** One lowercased haystack per request: every searchable field joined together. */
function requestHaystack(request: CapturedRequest): string {
  return normalize(valuesForField(request, 'any').join('\n'))
}

/** Indices of batch keywords this request matches (used for row markers). */
export function matchBatchKeywords(request: CapturedRequest, keywords: string[]): number[] {
  const haystack = requestHaystack(request)
  return keywords.reduce<number[]>((matched, keyword, index) => {
    if (haystack.includes(keyword.toLowerCase())) matched.push(index)
    return matched
  }, [])
}

function searchMatches(request: CapturedRequest, input: string): boolean {
  const batchKeywords = parseBatchKeywords(input)
  if (batchKeywords) {
    const haystack = requestHaystack(request)
    return batchKeywords.some((keyword) => haystack.includes(keyword.toLowerCase()))
  }

  const rawTokens = input.match(/(?:[^\s"]+|"[^"]*")+/g) ?? []
  const freeText: string[] = []
  const fieldTokens: FilterCondition[] = []

  for (let index = 0; index < rawTokens.length; index++) {
    const raw = rawTokens[index]
    const token = raw.replace(/^"|"$/g, '')
    const separator = token.indexOf(':')
    if (separator > 0) {
      const alias = token.slice(0, separator).toLowerCase()
      // `key:"tenant id"` arrives as one token carrying literal quotes; strip them.
      let value = token.slice(separator + 1).replace(/^"|"$/g, '')
      const field = searchAliases[alias]
      if (field) {
        // `key: "tenant id"` splits into `key:` plus a quoted token; bind the pair.
        if (!value && rawTokens[index + 1]?.startsWith('"')) {
          value = rawTokens[++index].slice(1, -1)
        }
        if (value) {
          fieldTokens.push({ id: `search-${index}`, field, operator: 'contains', value })
          continue
        }
      }
    }
    // Empty alias values (`key:`) and unknown aliases deliberately fall to free text.
    if (token) freeText.push(token)
  }

  if (fieldTokens.some((condition) => !matchesCondition(request, condition))) return false
  return freeText.every((term) => valuesForField(request, 'any').some((value) => normalize(value).includes(normalize(term))))
}

function matchesStatusGroup(status: number, group: string): boolean {
  if (!group || group === 'all') return true
  if (group === 'pending') return status === 0
  if (group === 'failed') return status < 0
  const hundred = Number.parseInt(group, 10)
  return status >= hundred && status < hundred + 100
}

export function matchesFilter(request: CapturedRequest, filter: FilterState): boolean {
  if (filter.methods.length > 0 && !filter.methods.includes(request.method)) return false
  if (
    filter.resourceTypes.length > 0 &&
    !filter.resourceTypes.includes(formatResourceType(request.resourceType, request.mimeType))
  )
    return false
  if (!matchesStatusGroup(request.status, filter.statusGroup)) return false

  const search = filter.search.trim()
  if (search && !searchMatches(request, search)) return false

  const batch = parseBatchKeywords(filter.batchSearch ?? '')
  if (batch) {
    const haystack = requestHaystack(request)
    if (!batch.some((keyword) => haystack.includes(keyword.toLowerCase()))) return false
  }

  const activeConditions = filter.conditions.filter((condition) => condition.operator === 'exists' || condition.value.trim())
  if (activeConditions.length === 0) return true
  const matches = activeConditions.map((condition) => matchesCondition(request, condition))
  return filter.conditionMode === 'all' ? matches.every(Boolean) : matches.some(Boolean)
}

export function filterRequests(requests: CapturedRequest[], filter: FilterState): CapturedRequest[] {
  return requests.filter((request) => matchesFilter(request, filter))
}
