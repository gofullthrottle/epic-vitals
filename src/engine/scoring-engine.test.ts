import { describe, it, expect } from 'vitest'
import { scoreRep } from './scoring-engine'
import type { NormalizedKeyframe } from '../types/reference'

describe('scoreRep', () => {
  const mockKeyframes: NormalizedKeyframe[] = [
    {
      t: 0.5,
      joints: {},
      criticalAngles: {
        kneeFlexion: 80,
        hipFlexion: 80,
        torsoLean: 40,
        kneeValgus: 0,
        lumbarFlexion: 5,
        ankleDorsiflexion: 65,
      },
    },
  ]

  it('returns a perfect score when observed matches reference exactly', () => {
    const observed = [
      {
        kneeFlexion: 80,
        hipFlexion: 80,
        torsoLean: 40,
        kneeValgus: 0,
        lumbarFlexion: 5,
        ankleDorsiflexion: 65,
      },
    ]
    const result = scoreRep(observed, mockKeyframes, [])
    expect(result.formScore).toBe(100)
    expect(result.deviations).toHaveLength(0)
  })

  it('penalizes deviations proportionally', () => {
    const observed = [
      {
        kneeFlexion: 90, // 10° off, tolerance 5° → full penalty for this angle
        hipFlexion: 80,
        torsoLean: 40,
        kneeValgus: 0,
        lumbarFlexion: 5,
        ankleDorsiflexion: 65,
      },
    ]
    const result = scoreRep(observed, mockKeyframes, [])
    expect(result.formScore).toBeLessThan(100)
    expect(result.formScore).toBeGreaterThan(0)
  })

  it('generates deviations for significant angular differences', () => {
    const observed = [
      {
        kneeFlexion: 95, // 15° off
        hipFlexion: 80,
        torsoLean: 40,
        kneeValgus: 8, // 8° off, tolerance 5°
        lumbarFlexion: 5,
        ankleDorsiflexion: 65,
      },
    ]
    const result = scoreRep(observed, mockKeyframes, [])
    expect(result.deviations.length).toBeGreaterThan(0)
    const kneeValgusDeviation = result.deviations.find(
      (d) => d.angle === 'kneeValgus',
    )
    expect(kneeValgusDeviation).toBeDefined()
    expect(kneeValgusDeviation?.cue).toBe('Push knees out')
  })

  it('computes depth score based on knee flexion', () => {
    const deepSquat = [{ kneeFlexion: 80 }]
    const shallowSquat = [{ kneeFlexion: 130 }]

    const deepResult = scoreRep(deepSquat, mockKeyframes, [])
    const shallowResult = scoreRep(shallowSquat, mockKeyframes, [])

    expect(deepResult.depthScore).toBe(100)
    expect(shallowResult.depthScore).toBeLessThan(deepResult.depthScore)
  })

  it('returns valid score range (0-100)', () => {
    const extremeDeviation = [
      {
        kneeFlexion: 170,
        hipFlexion: 170,
        torsoLean: 0,
        kneeValgus: 20,
        lumbarFlexion: 30,
        ankleDorsiflexion: 110,
      },
    ]
    const result = scoreRep(extremeDeviation, mockKeyframes, [])
    expect(result.formScore).toBeGreaterThanOrEqual(0)
    expect(result.formScore).toBeLessThanOrEqual(100)
  })
})
