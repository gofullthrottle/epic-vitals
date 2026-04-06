import type { Landmark } from '../types/pose'
import { JointId } from '../types/pose'
import type { NormalizedKeyframe } from '../types/reference'
import { vec3Sub, vec3Magnitude, vec3Scale, rotateY } from '../utils/math'

export interface AlignmentResult {
  viewingAngle: number
  scaleFactor: number
  hipCenter: { x: number; y: number; z: number }
}

/**
 * Compute the camera's viewing angle relative to the lifter using shoulder orientation.
 * From spec section 3.2.1:
 *   shoulderVector = rightShoulder - leftShoulder
 *   viewingAngle = atan2(shoulderVector.z, shoulderVector.x)
 */
export function computeAlignment(
  landmarks: Record<JointId, Landmark>,
): AlignmentResult {
  const leftShoulder = landmarks[JointId.LEFT_SHOULDER].position
  const rightShoulder = landmarks[JointId.RIGHT_SHOULDER].position
  const leftHip = landmarks[JointId.LEFT_HIP].position
  const rightHip = landmarks[JointId.RIGHT_HIP].position

  // Viewing angle from shoulder vector
  const shoulderVec = vec3Sub(rightShoulder, leftShoulder)
  const viewingAngle = Math.atan2(shoulderVec.z, shoulderVec.x)

  // Scale factor from shoulder width (can also use hip-to-shoulder distance)
  const shoulderWidth = vec3Magnitude(shoulderVec)
  // Normalize against a "standard" shoulder width of ~0.4 in MediaPipe coords
  const scaleFactor = shoulderWidth > 0 ? 0.4 / shoulderWidth : 1

  // Hip center as translation anchor
  const hipCenter = {
    x: (leftHip.x + rightHip.x) / 2,
    y: (leftHip.y + rightHip.y) / 2,
    z: (leftHip.z + rightHip.z) / 2,
  }

  return { viewingAngle, scaleFactor, hipCenter }
}

/**
 * Rotate and scale a reference trajectory to match the user's camera-relative coordinate space.
 * Applies R(viewingAngle) and scale S to all keyframe joint positions.
 */
export function alignReference(
  trajectory: NormalizedKeyframe[],
  alignment: AlignmentResult,
): NormalizedKeyframe[] {
  return trajectory.map((keyframe) => {
    const alignedJoints: typeof keyframe.joints = {}

    for (const [jointIdStr, jointState] of Object.entries(keyframe.joints)) {
      const jointId = Number(jointIdStr) as JointId
      if (!jointState) continue

      const rotated = rotateY(jointState.position, alignment.viewingAngle)
      const scaled = vec3Scale(rotated, alignment.scaleFactor)

      alignedJoints[jointId] = {
        ...jointState,
        position: {
          x: scaled.x + alignment.hipCenter.x,
          y: scaled.y + alignment.hipCenter.y,
          z: scaled.z + alignment.hipCenter.z,
        },
      }
    }

    return {
      ...keyframe,
      joints: alignedJoints,
    }
  })
}

/**
 * Check if the viewing angle is valid for scoring.
 * Returns false if the camera is directly behind the lifter (poor z-depth).
 */
export function isViewingAngleValid(
  landmarks: Record<JointId, Landmark>,
  minSeparation = 0.05,
): boolean {
  const leftShoulder = landmarks[JointId.LEFT_SHOULDER].position
  const rightShoulder = landmarks[JointId.RIGHT_SHOULDER].position
  const zSeparation = Math.abs(rightShoulder.z - leftShoulder.z)
  const xSeparation = Math.abs(rightShoulder.x - leftShoulder.x)
  // If both z and x separation are tiny, camera is behind
  return zSeparation > minSeparation || xSeparation > minSeparation
}
