import type { BridgeEvent, CapturedRequest } from '../types/network'

/**
 * Inserts an item into an ascending-by-sequence list via binary search.
 * The caller maintains the ascending invariant (requests arrive with monotonically
 * increasing sequence from the single capture producer); equal sequences insert
 * after existing entries, matching arrival order.
 */
export function insertBySequence<T extends { sequence: number }>(list: T[], item: T): T[] {
  let low = 0
  let high = list.length
  while (low < high) {
    const mid = (low + high) >> 1
    if (list[mid].sequence <= item.sequence) low = mid + 1
    else high = mid
  }
  list.splice(low, 0, item)
  return list
}

/** Replaces an item in place by id; a no-op when the id is not present (updates never insert). */
export function replaceById<T extends { id: string }>(list: T[], item: T): T[] {
  const index = list.findIndex((entry) => entry.id === item.id)
  if (index >= 0) list[index] = item
  return list
}

/**
 * Applies a burst of bridge events to the list in arrival order, mutating it in place.
 * `requests-cleared` empties the list; subsequent adds in the same batch repopulate it.
 * When `maxEntries` is given the list is trimmed to the most recent entries afterwards.
 */
export function applyEventBatch(
  current: CapturedRequest[],
  events: BridgeEvent[],
  maxEntries?: number,
): { requests: CapturedRequest[]; cleared: boolean; dropped: number } {
  let cleared = false
  for (const event of events) {
    if (event.type === 'request-added') insertBySequence(current, event.request)
    else if (event.type === 'request-updated') replaceById(current, event.request)
    else if (event.type === 'requests-cleared') {
      current.splice(0, current.length)
      cleared = true
    }
  }
  let dropped = 0
  if (maxEntries !== undefined && current.length > maxEntries) {
    dropped = current.length - maxEntries
    // The list is ascending by sequence; the oldest entries sit at the front.
    current.splice(0, dropped)
  }
  return { requests: current, cleared, dropped }
}
