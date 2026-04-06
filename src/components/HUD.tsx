import { ScoreBadge } from './ScoreBadge'
import { CoachingCue } from './CoachingCue'

interface HUDProps {
  exerciseName: string
  setNumber: number
  totalSets: number
  repNumber: number
  targetReps: number
  lastRepScore: number | null
  coachingCue: string | null
  cueSeverity?: 'minor' | 'warning' | 'critical'
}

export function HUD({
  exerciseName,
  setNumber,
  totalSets,
  repNumber,
  targetReps,
  lastRepScore,
  coachingCue,
  cueSeverity = 'warning',
}: HUDProps) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 16,
      }}
    >
      {/* Top bar: exercise name + set/rep */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            padding: '6px 12px',
            borderRadius: 8,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            color: '#FFFFFF',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {exerciseName}
        </div>
        <div
          style={{
            padding: '6px 12px',
            borderRadius: 8,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            color: '#FFFFFF',
            fontSize: 14,
          }}
        >
          Set {setNumber}/{totalSets} &middot; Rep {repNumber}/{targetReps}
        </div>
      </div>

      {/* Bottom area: score + coaching cue */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
        }}
      >
        {lastRepScore !== null ? (
          <ScoreBadge score={lastRepScore} size="large" />
        ) : (
          <div />
        )}
        <CoachingCue cue={coachingCue} severity={cueSeverity} />
      </div>
    </div>
  )
}
