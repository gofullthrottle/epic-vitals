import { COLORS } from '../utils/constants'

/**
 * Determine the color for a skeleton segment based on angular deviation.
 * From spec section 8.1:
 *   Green  = within 50% of tolerance band
 *   Yellow = within 80% of tolerance
 *   Orange = at tolerance edge
 *   Red    = exceeding tolerance (form breakdown)
 */
export function getSegmentColor(
  deviation: number,
  tolerance: number,
): string {
  if (tolerance <= 0) return COLORS.GREEN

  const ratio = deviation / tolerance

  if (ratio < 0.5) return COLORS.GREEN
  if (ratio < 0.8) return COLORS.YELLOW
  if (ratio < 1.0) return COLORS.ORANGE
  return COLORS.RED
}

/**
 * Get a color with opacity for canvas rendering.
 * Returns an RGBA string.
 */
export function getSegmentColorRGBA(
  deviation: number,
  tolerance: number,
  alpha = 1.0,
): string {
  const hex = getSegmentColor(deviation, tolerance)
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
