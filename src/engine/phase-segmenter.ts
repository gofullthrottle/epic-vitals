import type { Landmark } from '../types/pose'
import { JointId } from '../types/pose'
import type { RepPhase } from '../types/scoring'

export interface PhaseEvent {
  phase: RepPhase
  startTimestamp: number
  endTimestamp: number | null
}

/**
 * Segments a rep into eccentric / pause / concentric phases.
 * From spec section 3.4.2:
 *   - Eccentric: hip center moving downward (Y increasing in screen coords)
 *   - Pause: velocity near zero at bottom position
 *   - Concentric: hip center moving upward (Y decreasing)
 */
export class PhaseSegmenter {
  private velocityHistory: number[] = []
  private currentPhase: RepPhase = 'eccentric'
  private phaseStartTimestamp = 0
  private completedPhases: PhaseEvent[] = []
  private readonly pauseVelocityThreshold = 0.002
  private lastHipY: number | null = null

  get phase(): RepPhase {
    return this.currentPhase
  }

  get phases(): PhaseEvent[] {
    return [...this.completedPhases]
  }

  /**
   * Process a frame and return the current phase.
   * Also returns true if a phase transition occurred.
   */
  processFrame(
    landmarks: Record<JointId, Landmark>,
    timestamp: number,
  ): { phase: RepPhase; transitioned: boolean } {
    const leftHip = landmarks[JointId.LEFT_HIP].position
    const rightHip = landmarks[JointId.RIGHT_HIP].position
    const hipCenterY = (leftHip.y + rightHip.y) / 2

    if (this.lastHipY === null) {
      this.lastHipY = hipCenterY
      this.phaseStartTimestamp = timestamp
      return { phase: this.currentPhase, transitioned: false }
    }

    const velocity = hipCenterY - this.lastHipY
    this.lastHipY = hipCenterY
    this.velocityHistory.push(velocity)

    // Keep recent velocity history (last 5 frames for smoothing)
    if (this.velocityHistory.length > 5) {
      this.velocityHistory.shift()
    }

    const avgVelocity =
      this.velocityHistory.reduce((sum, v) => sum + v, 0) /
      this.velocityHistory.length

    let newPhase = this.currentPhase

    if (this.currentPhase === 'eccentric') {
      // Transition to pause when velocity drops near zero
      if (Math.abs(avgVelocity) < this.pauseVelocityThreshold) {
        newPhase = 'pause'
      }
    } else if (this.currentPhase === 'pause') {
      // Transition to concentric when moving upward (Y decreasing)
      if (avgVelocity < -this.pauseVelocityThreshold) {
        newPhase = 'concentric'
      }
    } else if (this.currentPhase === 'concentric') {
      // Rep ends when velocity reaches near-zero at top
      // (handled by RepDetector — segmenter just tracks phase)
    }

    const transitioned = newPhase !== this.currentPhase
    if (transitioned) {
      this.completedPhases.push({
        phase: this.currentPhase,
        startTimestamp: this.phaseStartTimestamp,
        endTimestamp: timestamp,
      })
      this.currentPhase = newPhase
      this.phaseStartTimestamp = timestamp
    }

    return { phase: this.currentPhase, transitioned }
  }

  /** Reset for a new rep */
  reset(): void {
    this.velocityHistory = []
    this.currentPhase = 'eccentric'
    this.phaseStartTimestamp = 0
    this.completedPhases = []
    this.lastHipY = null
  }
}
