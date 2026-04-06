import type { Landmark, PoseFrame } from '../types/pose'
import { JointId } from '../types/pose'
import { exponentialMovingAverage, vec3Midpoint } from '../utils/math'
import { SMOOTHING } from '../utils/constants'

/**
 * Processes raw MediaPipe landmarks with temporal smoothing and
 * coordinate normalization.
 */
export class PoseProcessor {
  private previousFrame: Record<JointId, Landmark> | null = null

  /**
   * Process raw MediaPipe landmarks into a smoothed PoseFrame.
   * Applies exponential moving average smoothing to reduce jitter.
   */
  processLandmarks(
    rawLandmarks: Record<JointId, Landmark>,
    timestamp: number,
  ): PoseFrame {
    const smoothed: Record<number, Landmark> = {} as Record<JointId, Landmark>

    for (const jointIdStr of Object.keys(rawLandmarks)) {
      const jointId = Number(jointIdStr) as JointId
      const current = rawLandmarks[jointId]

      if (this.previousFrame && this.previousFrame[jointId]) {
        const prevPos = this.previousFrame[jointId].position
        smoothed[jointId] = {
          position: exponentialMovingAverage(
            current.position,
            prevPos,
            SMOOTHING.alpha,
          ),
          visibility: current.visibility,
          presence: current.presence,
        }
      } else {
        smoothed[jointId] = { ...current }
      }
    }

    this.previousFrame = smoothed as Record<JointId, Landmark>

    return {
      timestamp,
      landmarks: smoothed as Record<JointId, Landmark>,
    }
  }

  /**
   * Compute the hip center (midpoint of left and right hip).
   * Used as the anchor point for many calculations.
   */
  static getHipCenter(landmarks: Record<JointId, Landmark>): {
    x: number
    y: number
    z: number
  } {
    return vec3Midpoint(
      landmarks[JointId.LEFT_HIP].position,
      landmarks[JointId.RIGHT_HIP].position,
    )
  }

  /**
   * Normalize landmark positions relative to hip center.
   * Makes comparisons body-position-independent.
   */
  static normalizeToPelvis(
    landmarks: Record<JointId, Landmark>,
  ): Record<JointId, Landmark> {
    const hipCenter = PoseProcessor.getHipCenter(landmarks)
    const normalized: Record<number, Landmark> = {} as Record<JointId, Landmark>

    for (const jointIdStr of Object.keys(landmarks)) {
      const jointId = Number(jointIdStr) as JointId
      const lm = landmarks[jointId]
      normalized[jointId] = {
        ...lm,
        position: {
          x: lm.position.x - hipCenter.x,
          y: lm.position.y - hipCenter.y,
          z: lm.position.z - hipCenter.z,
        },
      }
    }

    return normalized as Record<JointId, Landmark>
  }

  /** Reset smoothing state (e.g., when starting a new set) */
  reset(): void {
    this.previousFrame = null
  }
}
