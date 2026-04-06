import type { JointId, PoseFrame } from './pose'

export type RepPhase = 'eccentric' | 'concentric' | 'pause'
export type LetterGrade = 'S' | 'A' | 'B' | 'C' | 'D'

/** Score for a single rep */
export interface RepScore {
  overall: number
  formScore: number
  tempoScore: number
  depthScore: number
  stabilityScore: number
  deviations: Deviation[]
  phase: RepPhase
}

/** A specific form deviation detected during a rep */
export interface Deviation {
  joint: JointId
  angle: string
  observed: number
  expected: number
  delta: number
  severity: 'minor' | 'warning' | 'critical'
  cue: string
  timestamp: number
}

/** Velocity profile for a rep */
export interface VelocityProfile {
  eccentricVelocity: number[]
  concentricVelocity: number[]
  peakConcentricVelocity: number
  eccentricSteadiness: number
  transitionSmoothness: number
  meanConcentricVelocity: number
  peakVelocity: number
  timeToPeakVelocity: number
}

/** Combined report for a single rep across all pipelines */
export interface CombinedRepReport {
  repNumber: number
  durationMs: number
  form: RepScore
  tempo: VelocityProfile
  overallScore: number
  primaryCue: string
  secondaryCues: string[]
  fatigueIndicator: number
  poseFrames: PoseFrame[]
}

/** Aggregated score for a complete set */
export interface SetScore {
  reps: CombinedRepReport[]
  averageScore: number
  consistencyBonus: number
  fatigueResistanceBonus: number
  formDecayRate: number
  rep1Score: number
  lastRepScore: number
  achievements: Achievement[]
}

/** An achievement earned during a session */
export interface Achievement {
  id: string
  name: string
  description: string
  earnedAt: number
}

/** Convert a numeric score (0-100) to a letter grade */
export function scoreToGrade(score: number): LetterGrade {
  if (score >= 95) return 'S'
  if (score >= 85) return 'A'
  if (score >= 70) return 'B'
  if (score >= 50) return 'C'
  return 'D'
}
