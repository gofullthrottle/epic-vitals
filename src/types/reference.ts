import type { JointId, Vec3 } from './pose'

/** A complete reference lift model — the "gold standard" trajectory for an exercise */
export interface ReferenceLift {
  exerciseId: string
  variant: string
  source: 'coach_recording' | 'dataset' | 'biomechanics_literature'

  /** Normalized rep trajectory — time is 0.0 (start) to 1.0 (end) */
  trajectory: NormalizedKeyframe[]

  /** Per-phase timing ratios (what % of the rep should each phase occupy) */
  phaseTimingRatios: {
    eccentric: number
    pause: number
    concentric: number
  }

  /** Critical angle constraints (hard boundaries, not just scoring) */
  constraints: AngleConstraint[]

  /** Velocity profile expectations */
  velocityProfile: VelocityPhase[]
}

/** A single keyframe in the normalized (0.0-1.0) rep trajectory */
export interface NormalizedKeyframe {
  /** Normalized time: 0.0 = rep start, 1.0 = rep end */
  t: number
  /** All 33 MediaPipe landmarks at this point in the rep */
  joints: Partial<Record<JointId, JointState>>
  /** Named critical angles at this frame (e.g., "kneeFlexion": 90) */
  criticalAngles: Record<string, number>
}

/** State of a single joint at a keyframe */
export interface JointState {
  position: Vec3
  velocity: Vec3
  acceleration: Vec3
  /** How important this joint is at this phase (0-1) */
  confidence: number
}

/** A constraint on a specific angle during a phase of the lift */
export interface AngleConstraint {
  name: string
  jointTriple: [JointId, JointId, JointId]
  phase: 'eccentric' | 'concentric' | 'pause' | 'all'
  min: number
  max: number
  ideal: number
  severity: 'warning' | 'critical'
  plane: 'sagittal' | 'frontal' | 'transverse'
}

/** Expected velocity characteristics for a phase */
export interface VelocityPhase {
  phase: 'eccentric' | 'concentric' | 'pause'
  minVelocity: number
  maxVelocity: number
  targetSteadiness: number
}
