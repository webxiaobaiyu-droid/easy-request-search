export const DEFAULT_SPLIT_RATIO = 58
export const SPLITTER_WIDTH = 5

const MIN_REQUEST_PANE = 300
const MIN_DETAIL_PANE = 300

export function clampSplitRatio(ratio: number, workspaceWidth: number): number {
  if (!Number.isFinite(ratio)) return DEFAULT_SPLIT_RATIO
  const usableWidth = Math.max(1, workspaceWidth - SPLITTER_WIDTH)

  if (usableWidth < MIN_REQUEST_PANE + MIN_DETAIL_PANE) {
    return Math.min(72, Math.max(28, ratio))
  }

  const minimum = (MIN_REQUEST_PANE / usableWidth) * 100
  const maximum = ((usableWidth - MIN_DETAIL_PANE) / usableWidth) * 100
  return Math.min(maximum, Math.max(minimum, ratio))
}

export function splitRatioFromPointer(clientX: number, workspaceLeft: number, workspaceWidth: number): number {
  const usableWidth = Math.max(1, workspaceWidth - SPLITTER_WIDTH)
  const requestedRatio = ((clientX - workspaceLeft) / usableWidth) * 100
  return clampSplitRatio(requestedRatio, workspaceWidth)
}
