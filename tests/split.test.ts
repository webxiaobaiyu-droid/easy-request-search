import { describe, expect, it } from 'vitest'
import { clampSplitRatio, DEFAULT_SPLIT_RATIO, splitRatioFromPointer } from '../src/panel/utils/split'

describe('split pane sizing', () => {
  it('converts a pointer position to a percentage', () => {
    expect(splitRatioFromPointer(600, 100, 1005)).toBeCloseTo(50, 1)
  })

  it('preserves minimum space for both panes', () => {
    expect(clampSplitRatio(5, 1005)).toBeCloseTo(30, 1)
    expect(clampSplitRatio(95, 1005)).toBeCloseTo(70, 1)
  })

  it('handles invalid and narrow layouts safely', () => {
    expect(clampSplitRatio(Number.NaN, 1200)).toBe(DEFAULT_SPLIT_RATIO)
    expect(clampSplitRatio(10, 560)).toBe(28)
    expect(clampSplitRatio(90, 560)).toBe(72)
  })
})
