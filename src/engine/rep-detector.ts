import type { Landmark } from '../types/pose'
import { JointId } from '../types/pose'
import { REP_DETECTION } from '../utils/constants'

export interface RepBoundary {
  startFrame: number
  endFrame: number
  startTimestamp: number
  endTimestamp: number
}

/**
 * Detects rep boundaries using hip-center vertical position periodicity.
 * From spec section 3.4.1:
 *   - Track hip-center vertical position over sliding window
 *   - Detect local minima (bottom of squat) and maxima (lockout)
 *   - Each min→max→min cycle = 1 rep
 *   - Debounce: minimum 0.8s between rep boundaries
 */
export class RepDetector {
  private hipYHistory: { y: number; timestamp: number; frame: number }[] = []
  private completedReps: RepBoundary[] = []
  private lastBoundaryTime = 0
  private frameCount = 0
  private state: 'idle' | 'descending' | 'ascending' = 'idle'
  private currentRepStart: { frame: number; timestamp: number } | null = null
  private lastMinY = Infinity

  get reps(): RepBoundary[] {
    return [...this.completedReps]
  }

  get repCount(): number {
    return this.completedReps.length
  }

  /** Process a new pose frame and detect rep boundaries */
  processFrame(
    landmarks: Record<JointId, Landmark>,
    timestamp: number,
  ): RepBoundary | null {
    const leftHip = landmarks[JointId.LEFT_HIP].position
    const rightHip = landmarks[JointId.RIGHT_HIP].position
    const hipCenterY = (leftHip.y + rightHip.y) / 2

    this.hipYHistory.push({ y: hipCenterY, timestamp, frame: this.frameCount })
    this.frameCount++

    // Keep only the sliding window
    const windowMs = REP_DETECTION.windowDuration * 1000
    while (
      this.hipYHistory.length > 0 &&
      timestamp - this.hipYHistory[0].timestamp > windowMs
    ) {
      this.hipYHistory.shift()
    }

    // Need at least a few frames to detect direction
    if (this.hipYHistory.length < 3) return null

    const current = hipCenterY
    const prev = this.hipYHistory[this.hipYHistory.length - 2].y

    // Debounce check
    const timeSinceLastBoundary = timestamp - this.lastBoundaryTime
    const debounceMs = REP_DETECTION.debounceTime * 1000

    // In MediaPipe, Y increases downward, so descending = hip moving down = Y increasing
    const isDescending = current > prev
    const isAscending = current < prev

    if (this.state === 'idle') {
      if (isDescending) {
        this.state = 'descending'
        this.currentRepStart = { frame: this.frameCount - 1, timestamp }
        this.lastMinY = Infinity
      }
    } else if (this.state === 'descending') {
      if (current < this.lastMinY) {
        this.lastMinY = current
      }
      if (isAscending && timeSinceLastBoundary > debounceMs) {
        this.state = 'ascending'
      }
    } else if (this.state === 'ascending') {
      if (isDescending && timeSinceLastBoundary > debounceMs && this.currentRepStart) {
        // Completed one rep cycle: standing → down → standing
        const rep: RepBoundary = {
          startFrame: this.currentRepStart.frame,
          endFrame: this.frameCount - 1,
          startTimestamp: this.currentRepStart.timestamp,
          endTimestamp: timestamp,
        }
        this.completedReps.push(rep)
        this.lastBoundaryTime = timestamp

        // Start tracking next rep
        this.currentRepStart = { frame: this.frameCount - 1, timestamp }
        this.state = 'descending'
        this.lastMinY = Infinity

        return rep
      }
    }

    return null
  }

  /** Reset detector state for a new set */
  reset(): void {
    this.hipYHistory = []
    this.completedReps = []
    this.lastBoundaryTime = 0
    this.frameCount = 0
    this.state = 'idle'
    this.currentRepStart = null
    this.lastMinY = Infinity
  }
}
