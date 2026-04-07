import { useRef, useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { SkeletonOverlay } from '../components/SkeletonOverlay'
import { HUD } from '../components/HUD'
import { useSessionStore } from '../store/session-store'
import { usePoseDetection } from '../hooks/usePoseDetection'

/**
 * Camera screen: live camera feed + MediaPipe pose detection
 * + deviation-colored skeleton overlay + HUD.
 */
export function Camera() {
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const {
    session,
    currentSetIndex,
    currentRepNumber,
    lastRepReport,
    isRecording,
    setRecording,
    recordRep,
  } = useSessionStore()

  const [videoDimensions, setVideoDimensions] = useState({ width: 640, height: 480 })

  // MediaPipe + full engine pipeline
  const pose = usePoseDetection(videoRef, isRecording)

  // Sync rep detections to session store
  useEffect(() => {
    if (pose.lastRepScore && pose.repCount > currentRepNumber) {
      recordRep({
        repNumber: pose.repCount,
        durationMs: 0,
        form: pose.lastRepScore,
        tempo: {
          eccentricVelocity: [],
          concentricVelocity: [],
          peakConcentricVelocity: 0,
          eccentricSteadiness: 0,
          transitionSmoothness: 0,
          meanConcentricVelocity: 0,
          peakVelocity: 0,
          timeToPeakVelocity: 0,
        },
        overallScore: pose.lastRepScore.overall,
        primaryCue: pose.lastRepScore.deviations[0]?.cue ?? 'Good form!',
        secondaryCues: pose.lastRepScore.deviations.slice(1).map((d) => d.cue),
        fatigueIndicator: 0,
        poseFrames: [],
      })
    }
  }, [pose.repCount, pose.lastRepScore, currentRepNumber, recordRep])

  // Start camera feed
  useEffect(() => {
    let stream: MediaStream | null = null

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: 640, height: 480 },
          audio: false,
        })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
      } catch (err) {
        console.error('Camera access denied:', err)
      }
    }

    startCamera()

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  const handleVideoMetadata = useCallback(() => {
    if (videoRef.current) {
      setVideoDimensions({
        width: videoRef.current.videoWidth || 640,
        height: videoRef.current.videoHeight || 480,
      })
    }
  }, [])

  const handleEndSet = () => {
    setRecording(false)
    navigate('/session/review')
  }

  const handleEndSession = () => {
    setRecording(false)
    navigate('/session/summary')
  }

  const exerciseName = session?.exercises[0]?.exerciseId
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase()) ?? 'Unknown Exercise'

  // Determine coaching cue — prefer live pose data, fall back to last rep report
  const activeCue = pose.lastRepScore?.deviations[0]?.cue
    ?? lastRepReport?.primaryCue
    ?? null

  const activeSeverity = pose.lastRepScore?.deviations[0]?.severity
    ?? lastRepReport?.form.deviations[0]?.severity
    ?? 'minor'

  const displayScore = pose.lastRepScore?.overall
    ?? lastRepReport?.overallScore
    ?? null

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: 640,
        margin: '0 auto',
        backgroundColor: '#000',
        aspectRatio: `${videoDimensions.width} / ${videoDimensions.height}`,
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        onLoadedMetadata={handleVideoMetadata}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />

      <SkeletonOverlay
        landmarks={pose.landmarks}
        deviations={pose.deviations}
        tolerances={pose.tolerances}
        width={videoDimensions.width}
        height={videoDimensions.height}
      />

      <HUD
        exerciseName={exerciseName}
        setNumber={currentSetIndex + 1}
        totalSets={4}
        repNumber={isRecording ? pose.repCount : currentRepNumber}
        targetReps={8}
        lastRepScore={displayScore}
        coachingCue={activeCue}
        cueSeverity={activeSeverity}
      />

      {/* Status indicator */}
      {!pose.isReady && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            padding: '16px 24px',
            borderRadius: 12,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: '#FFF',
            fontSize: 14,
            textAlign: 'center',
          }}
        >
          {pose.error
            ? `Pose detection error: ${pose.error}`
            : 'Loading pose detection model...'}
        </div>
      )}

      {/* Phase indicator (when recording) */}
      {isRecording && pose.isReady && (
        <div
          style={{
            position: 'absolute',
            top: 56,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '4px 12px',
            borderRadius: 12,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            color: pose.currentPhase === 'eccentric' ? '#3B82F6'
              : pose.currentPhase === 'concentric' ? '#22C55E'
              : '#EAB308',
            fontSize: 12,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: 1,
          }}
        >
          {pose.currentPhase}
        </div>
      )}

      {/* Controls */}
      <div
        style={{
          position: 'absolute',
          bottom: 80,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          gap: 16,
        }}
      >
        <button
          onClick={() => setRecording(!isRecording)}
          disabled={!pose.isReady}
          style={{
            padding: '12px 24px',
            borderRadius: 24,
            border: 'none',
            backgroundColor: !pose.isReady
              ? '#555'
              : isRecording
                ? '#EF4444'
                : '#22C55E',
            color: '#FFF',
            fontSize: 16,
            fontWeight: 600,
            cursor: pose.isReady ? 'pointer' : 'not-allowed',
          }}
        >
          {isRecording ? 'Stop Set' : 'Start Set'}
        </button>
        <button
          onClick={handleEndSet}
          style={{
            padding: '12px 24px',
            borderRadius: 24,
            border: '1px solid #555',
            backgroundColor: 'rgba(0,0,0,0.6)',
            color: '#FFF',
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          Review
        </button>
        <button
          onClick={handleEndSession}
          style={{
            padding: '12px 24px',
            borderRadius: 24,
            border: '1px solid #555',
            backgroundColor: 'rgba(0,0,0,0.6)',
            color: '#FFF',
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          End Session
        </button>
      </div>
    </div>
  )
}
