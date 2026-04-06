import type { Vec3 } from '../types/pose'

// --- Vec3 Operations ---

export function vec3Add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }
}

export function vec3Sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
}

export function vec3Scale(v: Vec3, s: number): Vec3 {
  return { x: v.x * s, y: v.y * s, z: v.z * s }
}

export function vec3Dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

export function vec3Cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  }
}

export function vec3Magnitude(v: Vec3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)
}

export function vec3Normalize(v: Vec3): Vec3 {
  const mag = vec3Magnitude(v)
  if (mag === 0) return { x: 0, y: 0, z: 0 }
  return vec3Scale(v, 1 / mag)
}

export function vec3Midpoint(a: Vec3, b: Vec3): Vec3 {
  return vec3Scale(vec3Add(a, b), 0.5)
}

// --- Angle Calculations ---

/**
 * Compute the angle at vertex B formed by points A→B→C in 3D space.
 * Returns angle in degrees.
 */
export function angle3D(a: Vec3, b: Vec3, c: Vec3): number {
  const ba = vec3Sub(a, b)
  const bc = vec3Sub(c, b)
  const dot = vec3Dot(ba, bc)
  const magBA = vec3Magnitude(ba)
  const magBC = vec3Magnitude(bc)
  if (magBA === 0 || magBC === 0) return 0
  const cosAngle = Math.max(-1, Math.min(1, dot / (magBA * magBC)))
  return Math.acos(cosAngle) * (180 / Math.PI)
}

/**
 * Compute the angle from vertical (Y-axis) of vector A→B.
 * Used for torso lean measurement.
 * Returns angle in degrees (0 = perfectly vertical).
 */
export function angleFromVertical(a: Vec3, b: Vec3): number {
  const ab = vec3Sub(b, a)
  const vertical: Vec3 = { x: 0, y: -1, z: 0 } // Y-down in screen space
  const dot = vec3Dot(ab, vertical)
  const mag = vec3Magnitude(ab)
  if (mag === 0) return 0
  const cosAngle = Math.max(-1, Math.min(1, dot / mag))
  return Math.acos(cosAngle) * (180 / Math.PI)
}

/**
 * Compute frontal plane angle for knee valgus/varus detection.
 * Projects hip→knee→ankle onto the frontal (XY) plane and measures deviation.
 * Returns angle in degrees. Positive = valgus (knees in), negative = varus (knees out).
 */
export function frontalPlaneAngle(hip: Vec3, knee: Vec3, ankle: Vec3): number {
  // Project onto frontal plane (ignore z)
  const hipXY: Vec3 = { x: hip.x, y: hip.y, z: 0 }
  const kneeXY: Vec3 = { x: knee.x, y: knee.y, z: 0 }
  const ankleXY: Vec3 = { x: ankle.x, y: ankle.y, z: 0 }
  const fullAngle = angle3D(hipXY, kneeXY, ankleXY)
  // 180 = perfectly straight; deviation from 180 indicates valgus/varus
  const deviation = 180 - fullAngle
  // Sign based on whether knee is medial (inside) relative to hip-ankle line
  const hipToAnkle = vec3Sub(ankle, hip)
  const hipToKnee = vec3Sub(knee, hip)
  const cross = hipToAnkle.x * hipToKnee.y - hipToAnkle.y * hipToKnee.x
  return cross > 0 ? deviation : -deviation
}

// --- Rotation ---

/** Apply Y-axis rotation to a Vec3 (for auto-alignment reference rotation) */
export function rotateY(v: Vec3, angleRad: number): Vec3 {
  const cos = Math.cos(angleRad)
  const sin = Math.sin(angleRad)
  return {
    x: v.x * cos + v.z * sin,
    y: v.y,
    z: -v.x * sin + v.z * cos,
  }
}

// --- Smoothing ---

/**
 * Exponential moving average for temporal smoothing.
 * alpha = smoothing factor (0-1). Lower = smoother, higher = more responsive.
 * Recommended: alpha=0.5 for 3-frame equivalent window.
 */
export function exponentialMovingAverage(
  current: Vec3,
  previous: Vec3,
  alpha: number,
): Vec3 {
  return {
    x: alpha * current.x + (1 - alpha) * previous.x,
    y: alpha * current.y + (1 - alpha) * previous.y,
    z: alpha * current.z + (1 - alpha) * previous.z,
  }
}

// --- Utility ---

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function degreesToRadians(degrees: number): number {
  return degrees * (Math.PI / 180)
}

export function radiansToDegrees(radians: number): number {
  return radians * (180 / Math.PI)
}
