import type { Landmark } from '../types/pose'
import { JointId } from '../types/pose'
import { angle3D, angleFromVertical, frontalPlaneAngle } from '../utils/math'

/**
 * Compute all critical angles from a set of pose landmarks.
 * Maps directly from spec section 10.2 — these are the angles used for
 * form scoring on every frame.
 */
export function computeAngles(
  landmarks: Record<JointId, Landmark>,
): Record<string, number> {
  const pos = (id: JointId) => landmarks[id].position

  return {
    // Sagittal plane
    kneeFlexion: angle3D(
      pos(JointId.LEFT_HIP),
      pos(JointId.LEFT_KNEE),
      pos(JointId.LEFT_ANKLE),
    ),
    hipFlexion: angle3D(
      pos(JointId.LEFT_SHOULDER),
      pos(JointId.LEFT_HIP),
      pos(JointId.LEFT_KNEE),
    ),
    torsoLean: angleFromVertical(
      pos(JointId.LEFT_HIP),
      pos(JointId.LEFT_SHOULDER),
    ),
    ankleDorsiflexion: angle3D(
      pos(JointId.LEFT_KNEE),
      pos(JointId.LEFT_ANKLE),
      pos(JointId.LEFT_FOOT_INDEX),
    ),

    // Frontal plane
    kneeValgus: frontalPlaneAngle(
      pos(JointId.LEFT_HIP),
      pos(JointId.LEFT_KNEE),
      pos(JointId.LEFT_ANKLE),
    ),

    // Right side (for bilateral comparison)
    kneeFlexionRight: angle3D(
      pos(JointId.RIGHT_HIP),
      pos(JointId.RIGHT_KNEE),
      pos(JointId.RIGHT_ANKLE),
    ),
    kneeValgusRight: frontalPlaneAngle(
      pos(JointId.RIGHT_HIP),
      pos(JointId.RIGHT_KNEE),
      pos(JointId.RIGHT_ANKLE),
    ),

    // Derived: bar path horizontal displacement (wrist-to-wrist midpoint x-drift)
    barPath: Math.abs(
      pos(JointId.LEFT_WRIST).x - pos(JointId.RIGHT_WRIST).x,
    ),
  }
}

/**
 * Compute a single named angle given the landmark map and a joint triple.
 * Useful for evaluating individual constraints.
 */
export function computeNamedAngle(
  landmarks: Record<JointId, Landmark>,
  triple: [JointId, JointId, JointId],
): number {
  return angle3D(
    landmarks[triple[0]].position,
    landmarks[triple[1]].position,
    landmarks[triple[2]].position,
  )
}
