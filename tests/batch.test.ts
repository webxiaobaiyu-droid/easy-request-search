import { describe, expect, it } from 'vitest'
import { batchColor, splitHighlightSegments } from '../src/panel/utils/batch'

describe('splitHighlightSegments', () => {
  it('returns plain text when no keywords are given', () => {
    expect(splitHighlightSegments('hello world', [])).toEqual([{ text: 'hello world', keywordIndex: null }])
    expect(splitHighlightSegments('hello world', ['  '])).toEqual([{ text: 'hello world', keywordIndex: null }])
  })

  it('wraps case-insensitive matches with their keyword index', () => {
    expect(splitHighlightSegments('tenantId=3107', ['tenantid'])).toEqual([
      { text: 'tenantId', keywordIndex: 0 },
      { text: '=3107', keywordIndex: null },
    ])
  })

  it('handles multiple keywords and multiple occurrences', () => {
    expect(splitHighlightSegments('a-X-b a-Y-b a-X-b', ['a-x', 'a-y'])).toEqual([
      { text: 'a-X', keywordIndex: 0 },
      { text: '-b ', keywordIndex: null },
      { text: 'a-Y', keywordIndex: 1 },
      { text: '-b ', keywordIndex: null },
      { text: 'a-X', keywordIndex: 0 },
      { text: '-b', keywordIndex: null },
    ])
  })

  it('picks the earliest match when keywords overlap', () => {
    const segments = splitHighlightSegments('trace-id-123', ['trace-id', 'id-123'])
    expect(segments).toEqual([
      { text: 'trace-id', keywordIndex: 0 },
      { text: '-123', keywordIndex: null },
    ])
  })
})

describe('batchColor', () => {
  it('cycles over the 8-color palette', () => {
    expect(batchColor(0)).toBe('var(--batch-0)')
    expect(batchColor(7)).toBe('var(--batch-7)')
    expect(batchColor(8)).toBe('var(--batch-0)')
  })
})
