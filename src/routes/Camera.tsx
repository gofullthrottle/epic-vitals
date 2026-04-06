import { useRef, useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { SkeletonOverlay } from '../components/SkeletonOverlay'
import { HUD } from '../components/HUD'
import { useSessionStore } from '../store/session-store'
import type { Landmark } from '../types/pose'
import { JointId } from '../types/pose'

/**
 * Camera screen: live camera feed + skeleton overlay + HUD.
 * MediaPipe integration is stubbed — the camera feed displays,
 * and the pose processing pipeline is wired up but awaiting
 * the MediaPipe Pose Landmarker connection.
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
  } = useSessionStore()

  // TODO: setLandmarks will be called by MediaPipe pose detection callback
  const [landmarks, _setLandmarks] = useState<Record<JointId, Landmark> | null>(null)
  const [videoDimensions, setVideoDimensions] = useState({ width: 640, height: 480 })

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

  // TODO: Connect MediaPipe Pose Landmarker here
  // The integration point is:
  //   1. Create a PoseLandmarker instance
  //   2. On each video frame, call poseLandmarker.detectForVideo(videoElement, timestamp)
  //   3. Convert results to Record<JointId, Landmark>
  //   4. Call setLandmarks(convertedLandmarks)
  //   5. Feed through PoseProcessor → AngleCalculator → RepDetector → ScoringEngine

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
        landmarks={landmarks}
        deviations={{}}
        tolerances={{}}
        width={videoDimensions.width}
        height={videoDimensions.height}
      />

      <HUD
        exerciseName={exerciseName}
        setNumber={currentSetIndex + 1}
        totalSets={4}
        repNumber={currentRepNumber}
        targetReps={8}
        lastRepScore={lastRepReport?.overallScore ?? null}
        coachingCue={lastRepReport?.primaryCue ?? null}
        cueSeverity={
          lastRepReport?.form.deviations[0]?.severity ?? 'minor'
        }
      />

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
          style={{
            padding: '12px 24px',
            borderRadius: 24,
            border: 'none',
            backgroundColor: isRecording ? '#EF4444' : '#22C55E',
            color: '#FFF',
            fontSize: 16,
            fontWeight: 600,
            cursor: 'pointer',
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
