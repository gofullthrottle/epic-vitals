import type { AngleConstraint, NormalizedKeyframe } from '../types/reference'
import type { Deviation, RepScore, RepPhase } from '../types/scoring'
import { JointId } from '../types/pose'
import { SQUAT_ANGLE_WEIGHTS } from '../utils/constants'
import { clamp } from '../utils/math'

interface AngleWeightConfig {
  weight: number
  tolerance: number
}

/**
 * Score a single rep by comparing observed angles against a reference trajectory.
 *
 * Scoring formula from spec section 3.4.3:
 *   formScore = 100 - Σ(weight_i × clamp(|θ_observed - θ_reference| / tolerance, 0, 1) × 100)
 */
export function scoreRep(
  observedAngles: Record<string, number>[],
  referenceKeyframes: NormalizedKeyframe[],
  constraints: AngleConstraint[],
  weights: Record<string, AngleWeightConfig> = SQUAT_ANGLE_WEIGHTS,
  currentPhase: RepPhase = 'eccentric',
): RepScore {
  const deviations: Deviation[] = []
  let totalPenalty = 0

  // Average observed angles for comparison against the reference
  const avgObserved = averageAngles(observedAngles)

  // Find the closest reference keyframe (simplified: use midpoint)
  const refKeyframe =
    referenceKeyframes[Math.floor(referenceKeyframes.length / 2)]

  for (const [angleName, config] of Object.entries(weights)) {
    const observed = avgObserved[angleName]
    const expected = refKeyframe?.criticalAngles?.[angleName]

    if (observed === undefined || expected === undefined) continue

    const delta = Math.abs(observed - expected)
    const normalizedDeviation = clamp(delta / config.tolerance, 0, 1)
    const penalty = config.weight * normalizedDeviation * 100

    totalPenalty += penalty

    // Generate deviation callout if significant
    if (normalizedDeviation > 0.5) {
      const severity =
        normalizedDeviation > 0.8
          ? 'critical'
          : normalizedDeviation > 0.5
            ? 'warning'
            : 'minor'

      deviations.push({
        joint: getJointForAngle(angleName),
        angle: angleName,
        observed,
        expected,
        delta,
        severity,
        cue: getCueForAngle(angleName, delta),
        timestamp: 0,
      })
    }
  }

  // Check hard constraints
  for (const constraint of constraints) {
    if (constraint.phase !== 'all' && constraint.phase !== currentPhase) continue

    const angleName = constraint.name
    const observed = avgObserved[angleName]
    if (observed === undefined) continue

    if (observed < constraint.min || observed > constraint.max) {
      const existing = deviations.find((d) => d.angle === angleName)
      if (existing) {
        existing.severity = constraint.severity === 'critical' ? 'critical' : existing.severity
      } else {
        deviations.push({
          joint: constraint.jointTriple[1],
          angle: angleName,
          observed,
          expected: constraint.ideal,
          delta: Math.abs(observed - constraint.ideal),
          severity: constraint.severity === 'critical' ? 'critical' : 'warning',
          cue: getCueForAngle(angleName, observed - constraint.ideal),
          timestamp: 0,
        })
      }
    }
  }

  const formScore = Math.max(0, Math.round(100 - totalPenalty))

  return {
    overall: formScore,
    formScore,
    tempoScore: 0, // Placeholder — computed in Phase 2
    depthScore: computeDepthScore(avgObserved),
    stabilityScore: 0, // Placeholder
    deviations,
    phase: currentPhase,
  }
}

function averageAngles(
  frames: Record<string, number>[],
): Record<string, number> {
  if (frames.length === 0) return {}

  const sums: Record<string, number> = {}
  const counts: Record<string, number> = {}

  for (const frame of frames) {
    for (const [key, val] of Object.entries(frame)) {
      sums[key] = (sums[key] ?? 0) + val
      counts[key] = (counts[key] ?? 0) + 1
    }
  }

  const result: Record<string, number> = {}
  for (const key of Object.keys(sums)) {
    result[key] = sums[key] / counts[key]
  }
  return result
}

function computeDepthScore(angles: Record<string, number>): number {
  const kneeAngle = angles['kneeFlexion']
  if (kneeAngle === undefined) return 50

  // Full depth squat: knee flexion ~70-90° (vertex angle at knee)
  // Above parallel: ~100-110°
  // Partial: >120°
  if (kneeAngle <= 90) return 100
  if (kneeAngle <= 100) return 85
  if (kneeAngle <= 110) return 70
  if (kneeAngle <= 120) return 50
  return 30
}

function getJointForAngle(angleName: string): JointId {
  const mapping: Record<string, JointId> = {
    kneeFlexion: JointId.LEFT_KNEE,
    kneeFlexionRight: JointId.RIGHT_KNEE,
    hipFlexion: JointId.LEFT_HIP,
    torsoLean: JointId.LEFT_SHOULDER,
    kneeValgus: JointId.LEFT_KNEE,
    kneeValgusRight: JointId.RIGHT_KNEE,
    lumbarFlexion: JointId.LEFT_HIP,
    ankleDorsiflexion: JointId.LEFT_ANKLE,
  }
  return mapping[angleName] ?? JointId.LEFT_HIP
}

function getCueForAngle(angleName: string, delta: number): string {
  const cues: Record<string, string> = {
    kneeFlexion: 'Go deeper — break parallel',
    hipFlexion: 'Hinge at the hips more',
    torsoLean: delta > 0 ? 'Stay more upright' : 'Lean forward slightly',
    kneeValgus: 'Push knees out',
    kneeValgusRight: 'Push right knee out',
    lumbarFlexion: 'Brace your core — avoid butt wink',
    ankleDorsiflexion: 'Drive knees over toes',
  }
  return cues[angleName] ?? 'Check form'
}
