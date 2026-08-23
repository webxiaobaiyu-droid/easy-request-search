import { describe, expect, it } from 'vitest'
import { normalizeHarEntry } from '../src/core/normalize'
import { filterRequests, matchesCondition } from '../src/core/filter'
import type { FilterState } from '../src/types/network'

const request = normalizeHarEntry(
  {
    startedDateTime: '2026-08-21T10:00:00.000Z',
    time: 128,
    _resourceType: 'fetch',
    request: {
      method: 'POST',
      url: 'https://api.test/orders?page=2&tenantId=3107',
      headers: [{ name: 'content-type', value: 'application/json' }, { name: 'x-trace-id', value: 'trace-9' }],
      postData: { mimeType: 'application/json', text: '{"order":{"sku":"M-9"},"quantity":3}' },
    },
    response: {
      status: 201,
      statusText: 'Created',
      headers: [{ name: 'content-type', value: 'application/json' }],
      bodySize: 480,
    },
  },
  1,
)

const quoted = normalizeHarEntry(
  {
    startedDateTime: '2026-08-21T10:01:00.000Z',
    time: 55,
    _resourceType: 'xhr',
    request: {
      method: 'POST',
      url: 'https://api.test/search?q=hello+world',
      headers: [{ name: 'content-type', value: 'application/json' }],
      postData: { mimeType: 'application/json', text: '{"note":"urgent order","sku":"M-9"}' },
    },
    response: { status: 200, statusText: 'OK' },
  },
  2,
)

const plain = normalizeHarEntry(
  {
    startedDateTime: '2026-08-21T10:02:00.000Z',
    time: 12,
    _resourceType: 'fetch',
    request: { method: 'GET', url: 'https://api.test/ping' },
    response: { status: 204 },
  },
  3,
)

const baseFilter = (): FilterState => ({
  search: '',
  methods: [],
  resourceTypes: [],
  statusGroup: 'all',
  conditions: [],
  conditionMode: 'all',
})

describe('request filters', () => {
  it('matches a nested body parameter path and query value', () => {
    expect(matchesCondition(request, { id: '1', field: 'paramKey', operator: 'equals', value: 'order.sku' })).toBe(true)
    expect(matchesCondition(request, { id: '2', field: 'paramValue', operator: 'equals', value: 'M-9' })).toBe(true)
    expect(matchesCondition(request, { id: '3', field: 'query', operator: 'contains', value: 'tenantId=3107' })).toBe(true)
  })

  it('combines method, type, status and conditions', () => {
    const filter = baseFilter()
    filter.methods = ['POST']
    filter.resourceTypes = ['fetch']
    filter.statusGroup = '200'
    filter.conditions = [{ id: '1', field: 'paramKey', operator: 'contains', value: 'tenantId' }]
    expect(filterRequests([request], filter)).toHaveLength(1)

    filter.methods = ['GET']
    expect(filterRequests([request], filter)).toHaveLength(0)
  })

  it('supports any-condition mode and invalid regex safely', () => {
    const filter = baseFilter()
    filter.conditionMode = 'any'
    filter.conditions = [
      { id: '1', field: 'url', operator: 'regex', value: '[' },
      { id: '2', field: 'status', operator: 'equals', value: '201' },
    ]
    expect(filterRequests([request], filter)).toHaveLength(1)
  })

  it('supports compact search tokens for fast filtering', () => {
    const filter = baseFilter()
    filter.search = 'method:POST key:tenantId value:3107'
    expect(filterRequests([request], filter)).toHaveLength(1)
    filter.search = 'type:xhr'
    expect(filterRequests([request], filter)).toHaveLength(0)
  })

  it('parses quoted alias values in both glued and spaced forms', () => {
    const withKey = baseFilter()
    withKey.search = 'key:"note"'
    expect(filterRequests([quoted], withKey)).toHaveLength(1)

    const spaced = baseFilter()
    spaced.search = 'key: "note"'
    expect(filterRequests([quoted], spaced)).toHaveLength(1)

    const withValue = baseFilter()
    withValue.search = 'value:"urgent order"'
    expect(filterRequests([quoted], withValue)).toHaveLength(1)

    const methodQuoted = baseFilter()
    methodQuoted.search = 'method:"POST"'
    expect(filterRequests([quoted], methodQuoted)).toHaveLength(1)
    methodQuoted.search = 'method:"GET"'
    expect(filterRequests([quoted], methodQuoted)).toHaveLength(0)
  })

  it('treats bare quoted text as free text and empty aliases deliberately', () => {
    const bare = baseFilter()
    bare.search = '"urgent order"'
    expect(filterRequests([quoted], bare)).toHaveLength(1)

    const emptyAlias = baseFilter()
    emptyAlias.search = 'key:'
    expect(filterRequests([quoted], emptyAlias)).toHaveLength(0)

    const colonText = baseFilter()
    colonText.search = '"a:b"'
    expect(filterRequests([quoted], colonText)).toHaveLength(0)
  })

  it('combines field tokens with free text (AND semantics)', () => {
    const filter = baseFilter()
    filter.search = 'method:POST "urgent order"'
    expect(filterRequests([quoted], filter)).toHaveLength(1)
  })

  it('keeps the url alias with an unquoted value working', () => {
    const filter = baseFilter()
    filter.search = 'url:https://api.test'
    expect(filterRequests([quoted], filter)).toHaveLength(1)
  })

  it('matches the formatted type label, not the raw resource type', () => {
    const imageRequest = normalizeHarEntry(
      {
        startedDateTime: '2026-08-21T10:03:00.000Z',
        time: 9,
        _resourceType: 'image',
        request: { method: 'GET', url: 'https://cdn.test/logo.png' },
        response: { status: 200, content: { mimeType: 'image/png', size: 1024 } },
      },
      4,
    )
    const png = baseFilter()
    png.search = 'type:png'
    expect(filterRequests([imageRequest], png)).toHaveLength(1)

    const imageFilter = baseFilter()
    imageFilter.resourceTypes = ['png']
    expect(filterRequests([imageRequest], imageFilter)).toHaveLength(1)
  })

  it('does not satisfy a notEquals condition when no values exist', () => {
    expect(matchesCondition(plain, { id: '1', field: 'param', operator: 'notEquals', value: 'x' })).toBe(false)
    expect(matchesCondition(plain, { id: '1', field: 'paramKey', operator: 'notEquals', value: 'x' })).toBe(false)
    expect(matchesCondition(plain, { id: '1', field: 'paramValue', operator: 'notEquals', value: 'x' })).toBe(false)
  })

  it('notEquals is satisfied when any parameter differs from the target', () => {
    expect(matchesCondition(request, { id: '1', field: 'paramKey', operator: 'notEquals', value: 'missing' })).toBe(true)
    expect(matchesCondition(request, { id: '1', field: 'paramKey', operator: 'notEquals', value: 'order.sku' })).toBe(false)
  })

  it('equals on composite fields compares each entry, not the joined block', () => {
    expect(matchesCondition(request, { id: '1', field: 'query', operator: 'equals', value: 'page=2' })).toBe(true)
    expect(matchesCondition(request, { id: '2', field: 'param', operator: 'equals', value: 'quantity=3' })).toBe(true)
    expect(matchesCondition(request, { id: '3', field: 'param', operator: 'equals', value: '3107' })).toBe(false)
    expect(matchesCondition(request, { id: '4', field: 'header', operator: 'equals', value: 'x-trace-id:trace-9' })).toBe(true)
    expect(matchesCondition(request, { id: '5', field: 'header', operator: 'notEquals', value: 'x-trace-id:trace-9' })).toBe(false)
    expect(matchesCondition(request, { id: '6', field: 'param', operator: 'notEquals', value: 'page=2' })).toBe(false)
  })
})

describe('response body search', () => {
  const withBody = normalizeHarEntry(
    {
      startedDateTime: '2026-08-21T10:04:00.000Z',
      time: 40,
      _resourceType: 'fetch',
      request: { method: 'GET', url: 'https://api.test/orders/9' },
      response: { status: 200, statusText: 'OK' },
    },
    9,
  )
  withBody.responseBody = { content: '{"code":0,"data":{"requestId":"req_42","note":"urgent"}}', encoding: '' }

  it('matches free text against a loaded response body', () => {
    const filter = baseFilter()
    filter.search = 'req_42'
    expect(filterRequests([withBody, plain], filter)).toHaveLength(1)
  })

  it('matches the response alias token', () => {
    const filter = baseFilter()
    filter.search = 'response:urgent'
    expect(filterRequests([withBody, plain], filter)).toHaveLength(1)
  })

  it('response: with no loaded body never matches', () => {
    const filter = baseFilter()
    filter.search = 'response:orders'
    expect(filterRequests([plain], filter)).toHaveLength(0)
  })

  it('supports response field conditions', () => {
    expect(matchesCondition(withBody, { id: '1', field: 'response', operator: 'contains', value: 'requestId' })).toBe(true)
    expect(matchesCondition(plain, { id: '1', field: 'response', operator: 'contains', value: 'requestId' })).toBe(false)
  })
})

describe('failed status group', () => {
  const failed = normalizeHarEntry(
    {
      startedDateTime: '2026-08-21T10:05:00.000Z',
      time: 30,
      _resourceType: 'xhr',
      request: { method: 'GET', url: 'https://api.test/broken' },
      response: { status: -1, statusText: 'net::ERR_CONNECTION_REFUSED' },
    },
    10,
  )

  it('negative statuses fall into the failed group', () => {
    const filter = baseFilter()
    filter.statusGroup = 'failed'
    expect(filterRequests([failed, request, plain], filter)).toHaveLength(1)
  })

  it('failed group excludes successful requests', () => {
    const filter = baseFilter()
    filter.statusGroup = 'failed'
    expect(filterRequests([request], filter)).toHaveLength(0)
  })

  it('failed group includes zero-status (no response) requests', () => {
    const filter = baseFilter()
    filter.statusGroup = 'failed'
    const zero = normalizeHarEntry(
      {
        startedDateTime: '2026-08-21T10:05:00.001Z',
        time: 30,
        _resourceType: 'xhr',
        request: { method: 'GET', url: 'https://api.test/canceled' },
        response: { status: 0, statusText: '', _error: 'net::ERR_ABORTED' },
      },
      11,
    )
    expect(filterRequests([zero, failed, request, plain], filter)).toHaveLength(2)
  })
})

describe('batch search', () => {
  const orders = normalizeHarEntry(
    {
      startedDateTime: '2026-08-21T10:06:00.000Z',
      time: 30,
      _resourceType: 'fetch',
      request: { method: 'GET', url: 'https://api.test/orders/ORD-1' },
      response: { status: 200, statusText: 'OK' },
    },
    11,
  )
  const users = normalizeHarEntry(
    {
      startedDateTime: '2026-08-21T10:07:00.000Z',
      time: 30,
      _resourceType: 'xhr',
      request: { method: 'GET', url: 'https://api.test/users/u_9' },
      response: { status: 200, statusText: 'OK' },
    },
    12,
  )

  it('parses multi-line input into a deduped keyword list', async () => {
    const { parseBatchKeywords } = await import('../src/core/filter')
    expect(parseBatchKeywords('orders\n  users \norders\n\n')).toEqual(['orders', 'users'])
    expect(parseBatchKeywords('orders users')).toEqual(['orders users'])
    expect(parseBatchKeywords('')).toBeNull()
    expect(parseBatchKeywords('\n\n')).toBeNull()
  })

  it('single-line batchSearch input is still batch semantics', async () => {
    const { parseBatchKeywords } = await import('../src/core/filter')
    const filter = { ...baseFilter(), batchSearch: 'ORD-1' }
    expect(parseBatchKeywords(filter.batchSearch ?? '')).toEqual(['ORD-1'])
    expect(filterRequests([orders, users, plain], filter)).toHaveLength(1)
  })

  it('keeps a request when ANY batch keyword matches (OR semantics)', () => {
    const filter = baseFilter()
    filter.search = 'ORD-1\nnothing-matches\nu_9'
    expect(filterRequests([orders, users, plain], filter)).toHaveLength(2)
  })

  it('reports matched keyword indices for row markers', async () => {
    const { matchBatchKeywords } = await import('../src/core/filter')
    const keywords = ['ORD-1', 'users', 'api.test']
    expect(matchBatchKeywords(orders, keywords)).toEqual([0, 2])
    expect(matchBatchKeywords(users, keywords)).toEqual([1, 2])
  })

  it('single-line search keeps AND semantics', () => {
    const filter = baseFilter()
    filter.search = 'orders u_9'
    expect(filterRequests([orders, users], filter)).toHaveLength(0)
  })
})

describe('batch search via filter state', () => {
  it('applies OR matching from the dedicated batchSearch field', () => {
    const filter = { ...baseFilter(), batchSearch: 'ORD-2048\nmissing' }
    const hit = normalizeHarEntry(
      {
        startedDateTime: '2026-08-21T10:08:00.000Z',
        time: 20,
        _resourceType: 'document',
        request: { method: 'GET', url: 'https://api.test/orders/ORD-2048' },
        response: { status: 302 },
      },
      13,
    )
    expect(filterRequests([hit, plain], filter)).toHaveLength(1)
  })

  it('combines with the regular search (AND across dimensions)', () => {
    const filter = { ...baseFilter(), search: 'orders', batchSearch: 'ORD-2048\nu_9' }
    const order = normalizeHarEntry(
      { startedDateTime: '2026-08-21T10:09:00.000Z', time: 20, request: { method: 'GET', url: 'https://api.test/orders/ORD-2048' }, response: { status: 302 } },
      14,
    )
    expect(filterRequests([order], filter)).toHaveLength(1)
    filter.search = 'users'
    expect(filterRequests([order], filter)).toHaveLength(0)
  })
})

describe('field tokens vs same-named parameters', () => {
  const statusParam = normalizeHarEntry(
    {
      startedDateTime: '2026-08-21T10:10:00.000Z',
      time: 20,
      _resourceType: 'fetch',
      request: { method: 'GET', url: 'https://api.test/orders?status=failed&state=done' },
      response: { status: 204, statusText: 'No Content' },
    },
    21,
  )
  const methodParam = normalizeHarEntry(
    {
      startedDateTime: '2026-08-21T10:11:00.000Z',
      time: 20,
      _resourceType: 'xhr',
      request: { method: 'GET', url: 'https://api.test/run?method=POST' },
      response: { status: 200, statusText: 'OK' },
    },
    22,
  )

  it('status:failed finds a request whose status query param is failed', () => {
    const filter = baseFilter()
    filter.search = 'status:failed'
    expect(filterRequests([statusParam, plain], filter)).toHaveLength(1)
  })

  it('status:ok still matches HTTP semantics, not only the param', () => {
    const filter = baseFilter()
    filter.search = 'status:ok'
    expect(filterRequests([statusParam, plain], filter)).toHaveLength(2)
  })

  it('method:POST finds a GET request with a method query param', () => {
    const filter = baseFilter()
    filter.search = 'method:POST'
    expect(filterRequests([methodParam, plain], filter)).toHaveLength(1)
  })

  it('does not match unrelated parameters', () => {
    const filter = baseFilter()
    filter.search = 'status:failed'
    expect(filterRequests([plain], filter)).toHaveLength(0)
  })
})

describe('search token parsing', () => {
  it('binds the token after a spaced alias, quoted or bare', () => {
    const withKey = baseFilter()
    withKey.search = 'status: 404'
    expect(filterRequests([request, quoted], withKey)).toHaveLength(0)

    const status404 = normalizeHarEntry(
      {
        startedDateTime: '2026-08-21T10:12:00.000Z',
        time: 20,
        _resourceType: 'fetch',
        request: { method: 'GET', url: 'https://api.test/missing' },
        response: { status: 404, statusText: 'Not Found' },
      },
      23,
    )
    const spaced = baseFilter()
    spaced.search = 'url: api.test/missing'
    expect(filterRequests([status404, plain], spaced)).toHaveLength(1)
  })
})

describe('status semantic keywords', () => {
  const make = (sequence: number, status: number) =>
    normalizeHarEntry(
      {
        startedDateTime: `2026-08-21T10:${String(10 + sequence).padStart(2, '0')}:00.000Z`,
        time: 20,
        _resourceType: 'fetch',
        request: { method: 'GET', url: `https://api.test/r${sequence}` },
        response: { status, statusText: status < 0 ? 'net::ERR_FAILED' : '' },
      },
      sequence,
    )
  const statuses = [
    make(1, 0),    // 0 = no HTTP status: aborted/failed, never in flight
    make(2, -1),   // failed
    make(3, 204),  // 2xx
    make(4, 302),  // 3xx
    make(5, 404),  // 4xx
    make(6, 500),  // 5xx
  ]
  const searchAs = (term: string) => {
    const filter = baseFilter()
    filter.search = term
    return filterRequests(statuses, filter).map((request) => request.status)
  }

  it('maps semantic words onto status classes', () => {
    // running/pending were dropped: onRequestFinished never delivers in-flight requests.
    expect(searchAs('status:running')).toEqual([])
    expect(searchAs('status:pending')).toEqual([])
    expect(searchAs('status:failed')).toEqual([0, -1])
    expect(searchAs('status:error')).toEqual([0, -1])
    expect(searchAs('status:取消')).toEqual([0, -1])
    expect(searchAs('status:ok')).toEqual([204])
    expect(searchAs('status:success')).toEqual([204])
    expect(searchAs('status:redirect')).toEqual([302])
    expect(searchAs('status:bad')).toEqual([404])
    expect(searchAs('status:client')).toEqual([404])
    expect(searchAs('status:server')).toEqual([500])
    expect(searchAs('status:5xx')).toEqual([500])
    expect(searchAs('status:失败')).toEqual([0, -1])
    expect(searchAs('status:进行中')).toEqual([])
  })

  it('keeps numeric status matching intact', () => {
    expect(searchAs('status:404')).toEqual([404])
    expect(searchAs('status:40')).toEqual([404])
  })

  it('free text does not pick up semantic labels', () => {
    const filter = baseFilter()
    filter.search = 'running'
    expect(filterRequests(statuses, filter)).toHaveLength(0)
  })
})
