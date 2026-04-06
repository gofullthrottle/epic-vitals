import { useRef, useEffect } from 'react'
import type { Landmark } from '../types/pose'
import { JointId, SKELETON_CONNECTIONS } from '../types/pose'
import { getSegmentColor } from '../engine/skeleton-colors'
import { COLORS } from '../utils/constants'

interface SkeletonOverlayProps {
  landmarks: Record<JointId, Landmark> | null
  deviations: Record<string, number>
  tolerances: Record<string, number>
  width: number
  height: number
}

/** Maps skeleton segments to the angle names that affect their coloring */
const segmentToAngle: Record<string, string> = {
  [`${JointId.LEFT_HIP}-${JointId.LEFT_KNEE}`]: 'kneeFlexion',
  [`${JointId.LEFT_KNEE}-${JointId.LEFT_ANKLE}`]: 'kneeFlexion',
  [`${JointId.RIGHT_HIP}-${JointId.RIGHT_KNEE}`]: 'kneeFlexionRight',
  [`${JointId.RIGHT_KNEE}-${JointId.RIGHT_ANKLE}`]: 'kneeFlexionRight',
  [`${JointId.LEFT_SHOULDER}-${JointId.LEFT_HIP}`]: 'torsoLean',
  [`${JointId.RIGHT_SHOULDER}-${JointId.RIGHT_HIP}`]: 'torsoLean',
  [`${JointId.LEFT_SHOULDER}-${JointId.RIGHT_SHOULDER}`]: 'torsoLean',
  [`${JointId.LEFT_HIP}-${JointId.RIGHT_HIP}`]: 'hipFlexion',
}

/**
 * HTML5 Canvas overlay that renders the 33-point MediaPipe skeleton
 * with deviation-based coloring (green/yellow/orange/red).
 */
export function SkeletonOverlay({
  landmarks,
  deviations,
  tolerances,
  width,
  height,
}: SkeletonOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !landmarks) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, width, height)

    // Draw segments (bones)
    for (const segment of SKELETON_CONNECTIONS) {
      const from = landmarks[segment.from]
      const to = landmarks[segment.to]
      if (!from || !to) continue
      if (from.visibility < 0.5 || to.visibility < 0.5) continue

      const segKey = `${segment.from}-${segment.to}`
      const angleName = segmentToAngle[segKey]
      const deviation = angleName ? (deviations[angleName] ?? 0) : 0
      const tolerance = angleName ? (tolerances[angleName] ?? 10) : 10

      const color = getSegmentColor(Math.abs(deviation), tolerance)

      ctx.beginPath()
      ctx.moveTo(from.position.x * width, from.position.y * height)
      ctx.lineTo(to.position.x * width, to.position.y * height)
      ctx.strokeStyle = color
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      ctx.stroke()
    }

    // Draw joints (circles)
    for (const jointIdStr of Object.keys(landmarks)) {
      const jointId = Number(jointIdStr) as JointId
      const lm = landmarks[jointId]
      if (!lm || lm.visibility < 0.5) continue

      ctx.beginPath()
      ctx.arc(lm.position.x * width, lm.position.y * height, 4, 0, Math.PI * 2)
      ctx.fillStyle = COLORS.SKELETON_DEFAULT
      ctx.fill()
    }
  }, [landmarks, deviations, tolerances, width, height])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
      }}
    />
  )
}
