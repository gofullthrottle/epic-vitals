import { describe, it, expect } from 'vitest'
import { getSegmentColor } from './skeleton-colors'
import { COLORS } from '../utils/constants'

describe('getSegmentColor', () => {
  it('returns green for low deviation', () => {
    expect(getSegmentColor(1, 10)).toBe(COLORS.GREEN)
  })

  it('returns yellow for moderate deviation', () => {
    expect(getSegmentColor(6, 10)).toBe(COLORS.YELLOW)
  })

  it('returns orange at tolerance edge', () => {
    expect(getSegmentColor(9, 10)).toBe(COLORS.ORANGE)
  })

  it('returns red when exceeding tolerance', () => {
    expect(getSegmentColor(12, 10)).toBe(COLORS.RED)
  })

  it('returns green for zero deviation', () => {
    expect(getSegmentColor(0, 10)).toBe(COLORS.GREEN)
  })
})
