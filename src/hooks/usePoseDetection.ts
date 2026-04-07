import { useRef, useEffect, useState, useCallback } from 'react'
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'
import type { Landmark } from '../types/pose'
import { JointId } from '../types/pose'
import type { RepPhase } from '../types/scoring'
import { PoseProcessor } from '../engine/pose-processor'
import { computeAngles } from '../engine/angle-calculator'
import { RepDetector } from '../engine/rep-detector'
import { PhaseSegmenter } from '../engine/phase-segmenter'
import { scoreRep } from '../engine/scoring-engine'
import { SQUAT_ANGLE_WEIGHTS } from '../utils/constants'
import type { ReferenceLift } from '../types/reference'
import type { RepScore } from '../types/scoring'
import referenceData from '../data/references/barbell-back-squat-high-bar.json'

const reference = referenceData as unknown as ReferenceLift

interface PoseDetectionState {
  landmarks: Record<JointId, Landmark> | null
  angles: Record<string, number>
  deviations: Record<string, number>
  tolerances: Record<string, number>
  currentPhase: RepPhase
  repCount: number
  lastRepScore: RepScore | null
  isReady: boolean
  error: string | null
}

/**
 * Custom hook that manages the full MediaPipe → Engine pipeline:
 *   PoseLandmarker → PoseProcessor (smoothing) → AngleCalculator
 *   → RepDetector → PhaseSegmenter → ScoringEngine
 */
export function usePoseDetection(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  isRecording: boolean,
) {
  const [state, setState] = useState<PoseDetectionState>({
    landmarks: null,
    angles: {},
    deviations: {},
    tolerances: {},
    currentPhase: 'eccentric',
    repCount: 0,
    lastRepScore: null,
    isReady: false,
    error: null,
  })

  const landmarkerRef = useRef<PoseLandmarker | null>(null)
  const processorRef = useRef(new PoseProcessor())
  const repDetectorRef = useRef(new RepDetector())
  const phaseSegmenterRef = useRef(new PhaseSegmenter())
  const animFrameRef = useRef<number>(0)
  const lastTimestampRef = useRef<number>(-1)
  const repAnglesRef = useRef<Record<string, number>[]>([])

  // Initialize MediaPipe PoseLandmarker
  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
        )

        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        })

        if (!cancelled) {
          landmarkerRef.current = landmarker
          setState((s) => ({ ...s, isReady: true }))
        }
      } catch (err) {
        if (!cancelled) {
          console.error('MediaPipe init failed:', err)
          setState((s) => ({
            ...s,
            error: err instanceof Error ? err.message : 'Failed to initialize pose detection',
          }))
        }
      }
    }

    init()

    return () => {
      cancelled = true
      if (landmarkerRef.current) {
        landmarkerRef.current.close()
        landmarkerRef.current = null
      }
    }
  }, [])

  // Reset engine state when recording starts/stops
  useEffect(() => {
    if (isRecording) {
      processorRef.current.reset()
      repDetectorRef.current.reset()
      phaseSegmenterRef.current.reset()
      repAnglesRef.current = []
      lastTimestampRef.current = -1
    }
  }, [isRecording])

  // Process video frames
  const processFrame = useCallback(() => {
    const video = videoRef.current
    const landmarker = landmarkerRef.current

    if (!video || !landmarker || video.readyState < 2) {
      animFrameRef.current = requestAnimationFrame(processFrame)
      return
    }

    const timestamp = performance.now()

    // MediaPipe requires strictly increasing timestamps
    if (timestamp <= lastTimestampRef.current) {
      animFrameRef.current = requestAnimationFrame(processFrame)
      return
    }
    lastTimestampRef.current = timestamp

    try {
      const result = landmarker.detectForVideo(video, timestamp)

      if (result.landmarks && result.landmarks.length > 0) {
        const mpLandmarks = result.landmarks[0]
        const worldLandmarks = result.worldLandmarks?.[0]

        // Convert MediaPipe NormalizedLandmark[] to our Record<JointId, Landmark>
        const converted = convertLandmarks(mpLandmarks, worldLandmarks)

        // Run through PoseProcessor for smoothing
        const smoothed = processorRef.current.processLandmarks(converted, timestamp)

        // Compute angles
        const angles = computeAngles(smoothed.landmarks)

        // Compute deviations from reference (midpoint keyframe)
        const refKeyframe = reference.trajectory[Math.floor(reference.trajectory.length / 2)]
        const deviations: Record<string, number> = {}
        const tolerances: Record<string, number> = {}
        for (const [angleName, config] of Object.entries(SQUAT_ANGLE_WEIGHTS)) {
          const observed = angles[angleName]
          const expected = refKeyframe?.criticalAngles?.[angleName]
          if (observed !== undefined && expected !== undefined) {
            deviations[angleName] = Math.abs(observed - expected)
          }
          tolerances[angleName] = config.tolerance
        }

        let repCount = state.repCount
        let lastRepScore = state.lastRepScore

        if (isRecording) {
          // Accumulate angles for current rep
          repAnglesRef.current.push(angles)

          // Detect reps
          const repBoundary = repDetectorRef.current.processFrame(
            smoothed.landmarks,
            timestamp,
          )

          // Detect phase
          const { phase } = phaseSegmenterRef.current.processFrame(
            smoothed.landmarks,
            timestamp,
          )

          if (repBoundary) {
            // Score the completed rep
            const score = scoreRep(
              repAnglesRef.current,
              reference.trajectory,
              reference.constraints,
              SQUAT_ANGLE_WEIGHTS,
              phase,
            )
            lastRepScore = score
            repCount = repDetectorRef.current.repCount

            // Reset angle accumulator for next rep
            repAnglesRef.current = []
          }

          setState({
            landmarks: smoothed.landmarks,
            angles,
            deviations,
            tolerances,
            currentPhase: phase,
            repCount,
            lastRepScore,
            isReady: true,
            error: null,
          })
        } else {
          // Not recording — just show landmarks
          setState((s) => ({
            ...s,
            landmarks: smoothed.landmarks,
            angles,
            deviations,
            tolerances,
          }))
        }
      }
    } catch (err) {
      // Silently skip frames that fail (can happen during transitions)
    }

    animFrameRef.current = requestAnimationFrame(processFrame)
  }, [isRecording, videoRef, state.repCount, state.lastRepScore])

  // Start/stop detection loop
  useEffect(() => {
    if (state.isReady) {
      animFrameRef.current = requestAnimationFrame(processFrame)
    }
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
      }
    }
  }, [state.isReady, processFrame])

  return state
}

/**
 * Convert MediaPipe NormalizedLandmark[] into our Record<JointId, Landmark>.
 * MediaPipe returns landmarks as an array indexed 0-32 matching our JointId values.
 * Uses worldLandmarks (metric 3D) for z-depth when available, falling back to
 * normalized landmarks' z for relative depth.
 */
function convertLandmarks(
  normalizedLandmarks: Array<{ x: number; y: number; z: number; visibility?: number }>,
  worldLandmarks?: Array<{ x: number; y: number; z: number; visibility?: number }>,
): Record<JointId, Landmark> {
  const result: Record<number, Landmark> = {} as Record<JointId, Landmark>

  for (let i = 0; i < 33; i++) {
    const nl = normalizedLandmarks[i]
    const wl = worldLandmarks?.[i]

    result[i as JointId] = {
      position: {
        x: nl.x,
        y: nl.y,
        // Prefer world landmark z (metric depth from hip) over normalized z
        z: wl?.z ?? nl.z,
      },
      visibility: nl.visibility ?? 0,
      presence: nl.visibility ?? 0,
    }
  }

  return result as Record<JointId, Landmark>
}
