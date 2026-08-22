/** Shared helpers for batch-search keyword coloring across list and detail views. */

export const BATCH_PALETTE = 8

/** CSS color for a keyword index — cycles over the --batch-N token palette. */
export function batchColor(index: number): string {
  return `var(--batch-${index % BATCH_PALETTE})`
}

export interface HighlightSegment {
  text: string
  /** Index into the keyword list, or null for plain text. */
  keywordIndex: number | null
}

/**
 * Splits text into plain and matched segments (case-insensitive, earliest match
 * wins on overlap). Keywords are matched literally, empty lines ignored.
 */
export function splitHighlightSegments(text: string, keywords: string[]): HighlightSegment[] {
  const terms = keywords.map((keyword) => keyword.trim().toLowerCase()).filter((keyword) => keyword.length > 0)
  if (terms.length === 0 || !text) return [{ text, keywordIndex: null }]

  const segments: HighlightSegment[] = []
  const lower = text.toLowerCase()
  let cursor = 0

  while (cursor < text.length) {
    let hitIndex = -1
    let hitAt = -1
    for (let index = 0; index < terms.length; index++) {
      const at = lower.indexOf(terms[index], cursor)
      if (at >= 0 && (hitAt < 0 || at < hitAt)) {
        hitAt = at
        hitIndex = index
      }
    }
    if (hitIndex < 0) break
    if (hitAt > cursor) segments.push({ text: text.slice(cursor, hitAt), keywordIndex: null })
    const length = terms[hitIndex].length
    segments.push({ text: text.slice(hitAt, hitAt + length), keywordIndex: hitIndex })
    cursor = hitAt + length
  }

  if (cursor < text.length) segments.push({ text: text.slice(cursor), keywordIndex: null })
  return segments.length > 0 ? segments : [{ text, keywordIndex: null }]
}
