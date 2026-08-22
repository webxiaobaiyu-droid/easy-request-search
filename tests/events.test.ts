import { describe, expect, it } from 'vitest'
import { applyEventBatch, insertBySequence, replaceById } from '../src/core/events'
import type { BridgeEvent, CapturedRequest } from '../src/types/network'

function request(id: string, sequence: number): CapturedRequest {
  return { id, sequence } as CapturedRequest
}

describe('insertBySequence', () => {
  it('keeps the list ascending by sequence', () => {
    const list = insertBySequence([request('a', 1), request('c', 3)], request('b', 2))
    expect(list.map((item) => item.sequence)).toEqual([1, 2, 3])
  })

  it('appends after equal sequences (arrival order) and into an empty list', () => {
    const list = insertBySequence([request('a', 1)], request('b', 1))
    expect(list.map((item) => item.id)).toEqual(['a', 'b'])
    expect(insertBySequence([], request('x', 5)).map((item) => item.id)).toEqual(['x'])
  })
})

describe('replaceById', () => {
  it('replaces in place without reordering and ignores unknown ids', () => {
    const list = [request('a', 1), request('b', 2)]
    const updated = { ...request('a', 1), url: 'https://new.test' }
    expect(replaceById(list, updated).map((item) => item.id)).toEqual(['a', 'b'])
    expect(list[0].url).toBe('https://new.test')
    expect(replaceById(list, request('missing', 9)).length).toBe(2)
  })
})

describe('applyEventBatch', () => {
  it('merges adds in arrival order', () => {
    const events: BridgeEvent[] = [
      { type: 'request-added', request: request('a', 1) },
      { type: 'request-added', request: request('b', 2) },
    ]
    const { requests } = applyEventBatch([], events)
    expect(requests.map((item) => item.id)).toEqual(['a', 'b'])
  })

  it('applies a clear followed by adds to only the new requests', () => {
    const events: BridgeEvent[] = [
      { type: 'requests-cleared' },
      { type: 'request-added', request: request('c', 3) },
    ]
    const { requests, cleared } = applyEventBatch([request('a', 1)], events)
    expect(cleared).toBe(true)
    expect(requests.map((item) => item.id)).toEqual(['c'])
  })

  it('handles mixed add/update/clear in one batch', () => {
    const events: BridgeEvent[] = [
      { type: 'request-updated', request: { ...request('a', 1), url: 'https://updated.test' } },
      { type: 'request-added', request: request('b', 2) },
      { type: 'request-updated', request: { ...request('b', 2), status: 500 } },
    ]
    const { requests } = applyEventBatch([request('a', 1)], events)
    expect(requests.map((item) => item.url ?? item.status)).toEqual(['https://updated.test', 500])
    expect(requests.map((item) => item.sequence)).toEqual([1, 2])
  })
})

describe('applyEventBatch retention cap', () => {
  const make = (sequence: number) =>
    ({ id: `r${sequence}`, sequence }) as import('../src/types/network').CapturedRequest

  it('drops the oldest entries once the list grows past the cap', async () => {
    const { applyEventBatch } = await import('../src/core/events')
    const events = [1, 2, 3, 4, 5].map((sequence) => ({
      type: 'request-added',
      request: make(sequence),
    })) as import('../src/types/network').BridgeEvent[]
    const current: import('../src/types/network').CapturedRequest[] = []
    const { requests, dropped } = applyEventBatch(current, events, 3)
    expect(requests.map((request) => request.sequence)).toEqual([3, 4, 5])
    expect(dropped).toBe(2)
  })

  it('keeps the list intact below the cap and reports zero drops', async () => {
    const { applyEventBatch } = await import('../src/core/events')
    const events = [
      { type: 'request-added', request: make(1) },
    ] as import('../src/types/network').BridgeEvent[]
    const { requests, dropped } = applyEventBatch([], events, 3)
    expect(requests).toHaveLength(1)
    expect(dropped).toBe(0)
  })
})
