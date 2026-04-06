import { describe, it, expect } from 'vitest'
import {
  vec3Add,
  vec3Sub,
  vec3Scale,
  vec3Dot,
  vec3Cross,
  vec3Magnitude,
  vec3Normalize,
  angle3D,
  angleFromVertical,
  frontalPlaneAngle,
  rotateY,
  clamp,
} from './math'

describe('Vec3 operations', () => {
  it('adds two vectors', () => {
    expect(vec3Add({ x: 1, y: 2, z: 3 }, { x: 4, y: 5, z: 6 })).toEqual({
      x: 5, y: 7, z: 9,
    })
  })

  it('subtracts two vectors', () => {
    expect(vec3Sub({ x: 5, y: 7, z: 9 }, { x: 1, y: 2, z: 3 })).toEqual({
      x: 4, y: 5, z: 6,
    })
  })

  it('scales a vector', () => {
    expect(vec3Scale({ x: 1, y: 2, z: 3 }, 2)).toEqual({ x: 2, y: 4, z: 6 })
  })

  it('computes dot product', () => {
    expect(vec3Dot({ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 })).toBe(0)
    expect(vec3Dot({ x: 1, y: 2, z: 3 }, { x: 1, y: 2, z: 3 })).toBe(14)
  })

  it('computes cross product', () => {
    const result = vec3Cross({ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 })
    expect(result).toEqual({ x: 0, y: 0, z: 1 })
  })

  it('computes magnitude', () => {
    expect(vec3Magnitude({ x: 3, y: 4, z: 0 })).toBe(5)
  })

  it('normalizes a vector', () => {
    const n = vec3Normalize({ x: 3, y: 0, z: 0 })
    expect(n.x).toBeCloseTo(1)
    expect(n.y).toBeCloseTo(0)
    expect(n.z).toBeCloseTo(0)
  })

  it('handles zero vector normalization', () => {
    expect(vec3Normalize({ x: 0, y: 0, z: 0 })).toEqual({ x: 0, y: 0, z: 0 })
  })
})

describe('angle3D', () => {
  it('computes 90 degrees for a right angle', () => {
    const a = { x: 1, y: 0, z: 0 }
    const b = { x: 0, y: 0, z: 0 }
    const c = { x: 0, y: 1, z: 0 }
    expect(angle3D(a, b, c)).toBeCloseTo(90, 1)
  })

  it('computes 180 degrees for a straight line', () => {
    const a = { x: -1, y: 0, z: 0 }
    const b = { x: 0, y: 0, z: 0 }
    const c = { x: 1, y: 0, z: 0 }
    expect(angle3D(a, b, c)).toBeCloseTo(180, 1)
  })

  it('computes 0 degrees for overlapping vectors', () => {
    const a = { x: 1, y: 0, z: 0 }
    const b = { x: 0, y: 0, z: 0 }
    const c = { x: 2, y: 0, z: 0 }
    expect(angle3D(a, b, c)).toBeCloseTo(0, 1)
  })
})

describe('angleFromVertical', () => {
  it('returns 0 for a vertical segment pointing down', () => {
    const a = { x: 0, y: 0, z: 0 }
    const b = { x: 0, y: -1, z: 0 }
    expect(angleFromVertical(a, b)).toBeCloseTo(0, 1)
  })

  it('returns 90 for a horizontal segment', () => {
    const a = { x: 0, y: 0, z: 0 }
    const b = { x: 1, y: 0, z: 0 }
    expect(angleFromVertical(a, b)).toBeCloseTo(90, 1)
  })
})

describe('frontalPlaneAngle', () => {
  it('returns ~0 for a straight leg (no valgus)', () => {
    const hip = { x: 0, y: 0, z: 0 }
    const knee = { x: 0, y: 1, z: 0 }
    const ankle = { x: 0, y: 2, z: 0 }
    expect(Math.abs(frontalPlaneAngle(hip, knee, ankle))).toBeCloseTo(0, 0)
  })
})

describe('rotateY', () => {
  it('rotates 90 degrees around Y axis', () => {
    const v = { x: 1, y: 0, z: 0 }
    const result = rotateY(v, Math.PI / 2)
    expect(result.x).toBeCloseTo(0, 5)
    expect(result.y).toBeCloseTo(0, 5)
    expect(result.z).toBeCloseTo(-1, 5)
  })
})

describe('clamp', () => {
  it('clamps within range', () => {
    expect(clamp(5, 0, 10)).toBe(5)
    expect(clamp(-1, 0, 10)).toBe(0)
    expect(clamp(15, 0, 10)).toBe(10)
  })
})
