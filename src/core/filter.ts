import type { CapturedRequest, FilterCondition, FilterField, FilterState } from '../types/network'
import { formatResourceType } from './resource-type'

/** Locale-independent lowercasing; toLocaleLowerCase breaks on Turkish "I". */
function normalize(value: unknown): string {
  return String(value ?? '').toLowerCase()
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

/**
 * Human-readable labels per status class, searchable via `status:word`.
 * Zero and negative statuses both mean "no HTTP response" (failed/aborted/
 * canceled): `onRequestFinished` fires only after a request completes, so a
 * captured request is never genuinely in flight.
 */
function statusLabels(status: number): string[] {
  if (status <= 0) return ['failed', '失败', 'error', '错误', 'aborted', '取消']
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
      // One entry per parameter, so equals/notEquals compare each entry rather
      // than failing against the joined block of text.
      return request.parameters.map((parameter) => `${parameter.path}=${parameter.value}`)
    }
    case 'paramKey':
      return request.parameters.flatMap((parameter) => [parameter.key, parameter.path])
    case 'paramValue':
      return request.parameters.map((parameter) => parameter.value)
    case 'query': {
      return request.parameters
        .filter((parameter) => parameter.source === 'query')
        .map((parameter) => `${parameter.path}=${parameter.value}`)
    }
    case 'body': {
      const entries = request.parameters
        .filter((parameter) => parameter.source === 'body')
        .map((parameter) => `${parameter.path}=${parameter.value}`)
      return request.requestBody ? [...entries, request.requestBody] : entries
    }
    case 'header': {
      return request.requestHeaders.map(({ name, value }) => `${name}:${value}`)
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

/** Compiled patterns are cached: conditions can be evaluated thousands of times per keystroke. */
const regexCache = new Map<string, RegExp | null>()

function compileRegex(pattern: string): RegExp | null {
  let compiled = regexCache.get(pattern)
  if (compiled === undefined) {
    compiled = null
    try {
      compiled = new RegExp(pattern, 'i')
    } catch {
      // Invalid patterns simply never match.
    }
    regexCache.set(pattern, compiled)
  }
  return compiled
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
      return compileRegex(target)?.test(value) ?? false
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
  // notEquals means "no entry equals the target", so requests with zero values
  // never satisfy it either (handled above by the empty check).
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
 * Parses a keyword list (OR semantics: a request matches when ANY keyword hits).
 * The search box only enters batch mode for pasted multi-line lists, while the
 * dedicated batch box treats single-line input as one keyword.
 */
export function parseBatchKeywords(input: string, requireNewline = false): string[] | null {
  if (requireNewline && !input.includes('\n')) return null
  const seen = new Set<string>()
  for (const line of input.split('\n')) {
    const keyword = line.trim()
    if (keyword) seen.add(keyword)
  }
  const keywords = [...seen].slice(0, BATCH_KEYWORD_LIMIT)
  return keywords.length > 0 ? keywords : null
}

/**
 * One lowercased haystack per request: every searchable field joined together.
 * Cached per request, invalidated only when a lazily-loaded response body lands
 * (it changes what `response` contributes). WeakMap lets trimmed requests go.
 */
const haystackCache = new WeakMap<CapturedRequest, { body: CapturedRequest['responseBody']; hay: string }>()

function requestHaystack(request: CapturedRequest): string {
  const cached = haystackCache.get(request)
  if (cached && cached.body === request.responseBody) return cached.hay
  const hay = normalize(valuesForField(request, 'any').join('\n'))
  haystackCache.set(request, { body: request.responseBody, hay })
  return hay
}

/** Indices of batch keywords this request matches (used for row markers). */
export function matchBatchKeywords(request: CapturedRequest, keywords: string[]): number[] {
  const haystack = requestHaystack(request)
  return keywords.reduce<number[]>((matched, keyword, index) => {
    if (haystack.includes(keyword.toLowerCase())) matched.push(index)
    return matched
  }, [])
}

interface SearchToken {
  /** The alias the user typed (`status`, `key`, …) — also used for same-named parameters. */
  alias: string
  field: FilterField
  value: string
}

/**
 * A field token also matches same-named parameters, so `status:failed` finds a
 * request whose query says `?status=failed` — Query keys can collide with the
 * reserved aliases (status, method, type, url, …), so neither meaning wins:
 * both are applied.
 */
function paramMatchesToken(request: CapturedRequest, alias: string, value: string): boolean {
  const needle = normalize(value)
  if (!needle) return false
  const keys = new Set([alias, searchAliases[alias]].map((key) => key.toLowerCase()))
  return request.parameters.some(
    (parameter) => keys.has(parameter.key.toLowerCase()) && normalize(parameter.value).includes(needle),
  )
}

function matchesSearchToken(request: CapturedRequest, token: SearchToken): boolean {
  if (matchesCondition(request, { id: token.alias, field: token.field, operator: 'contains', value: token.value })) return true
  return paramMatchesToken(request, token.alias, token.value)
}

function searchMatches(request: CapturedRequest, input: string): boolean {
  // A pasted multi-line list (ids, URLs, …) keeps OR semantics; single-line
  // input goes through the token search below. The dedicated batch box applies
  // separately via filter.batchSearch.
  const batchKeywords = parseBatchKeywords(input, true)
  if (batchKeywords) {
    const haystack = requestHaystack(request)
    return batchKeywords.some((keyword) => haystack.includes(keyword.toLowerCase()))
  }

  const rawTokens = input.match(/(?:[^\s"]+|"[^"]*")+/g) ?? []
  const freeText: string[] = []
  const fieldTokens: SearchToken[] = []

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
        // `key: tenant id` splits into `key:` plus the next token; bind the pair.
        if (!value && rawTokens[index + 1]) {
          value = rawTokens[++index].replace(/^"|"$/g, '')
        }
        if (value) {
          fieldTokens.push({ alias, field, value })
          continue
        }
      }
    }
    // Empty alias values (`key:` with nothing after) and unknown aliases
    // deliberately fall to free text.
    if (token) freeText.push(token)
  }

  if (fieldTokens.some((token) => !matchesSearchToken(request, token))) return false
  return freeText.every((term) => valuesForField(request, 'any').some((value) => normalize(value).includes(normalize(term))))
}

function matchesStatusGroup(status: number, group: string): boolean {
  if (!group || group === 'all') return true
  // 0 and negative statuses are both "no HTTP response" — see statusLabels.
  if (group === 'failed') return status <= 0
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
