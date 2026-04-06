/** 3D vector type used throughout the pose system */
export interface Vec3 {
  x: number
  y: number
  z: number
}

/**
 * MediaPipe Pose Landmarker 33-point landmark IDs.
 * See: https://developers.google.com/mediapipe/solutions/vision/pose_landmarker
 */
export const JointId = {
  NOSE: 0,
  LEFT_EYE_INNER: 1,
  LEFT_EYE: 2,
  LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4,
  RIGHT_EYE: 5,
  RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  MOUTH_LEFT: 9,
  MOUTH_RIGHT: 10,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_PINKY: 17,
  RIGHT_PINKY: 18,
  LEFT_INDEX: 19,
  RIGHT_INDEX: 20,
  LEFT_THUMB: 21,
  RIGHT_THUMB: 22,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
} as const

export type JointId = (typeof JointId)[keyof typeof JointId]

/** A single landmark from MediaPipe with position and confidence */
export interface Landmark {
  position: Vec3
  visibility: number
  presence: number
}

/** A complete pose frame: 33 landmarks + timestamp */
export interface PoseFrame {
  timestamp: number
  landmarks: Record<JointId, Landmark>
}

/** Skeleton segment: a bone connecting two joints (for rendering) */
export interface SkeletonSegment {
  from: JointId
  to: JointId
}

/** The standard MediaPipe skeleton connectivity for rendering */
export const SKELETON_CONNECTIONS: SkeletonSegment[] = [
  // Torso
  { from: JointId.LEFT_SHOULDER, to: JointId.RIGHT_SHOULDER },
  { from: JointId.LEFT_SHOULDER, to: JointId.LEFT_HIP },
  { from: JointId.RIGHT_SHOULDER, to: JointId.RIGHT_HIP },
  { from: JointId.LEFT_HIP, to: JointId.RIGHT_HIP },
  // Left arm
  { from: JointId.LEFT_SHOULDER, to: JointId.LEFT_ELBOW },
  { from: JointId.LEFT_ELBOW, to: JointId.LEFT_WRIST },
  // Right arm
  { from: JointId.RIGHT_SHOULDER, to: JointId.RIGHT_ELBOW },
  { from: JointId.RIGHT_ELBOW, to: JointId.RIGHT_WRIST },
  // Left leg
  { from: JointId.LEFT_HIP, to: JointId.LEFT_KNEE },
  { from: JointId.LEFT_KNEE, to: JointId.LEFT_ANKLE },
  { from: JointId.LEFT_ANKLE, to: JointId.LEFT_HEEL },
  { from: JointId.LEFT_ANKLE, to: JointId.LEFT_FOOT_INDEX },
  // Right leg
  { from: JointId.RIGHT_HIP, to: JointId.RIGHT_KNEE },
  { from: JointId.RIGHT_KNEE, to: JointId.RIGHT_ANKLE },
  { from: JointId.RIGHT_ANKLE, to: JointId.RIGHT_HEEL },
  { from: JointId.RIGHT_ANKLE, to: JointId.RIGHT_FOOT_INDEX },
]
