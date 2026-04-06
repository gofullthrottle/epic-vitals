import { useNavigate } from 'react-router-dom'
import { ScoreBadge } from '../components/ScoreBadge'
import { useSessionStore } from '../store/session-store'
import { SCORE_WEIGHTS } from '../utils/constants'

/**
 * Rep review screen shown between sets.
 * Displays score breakdown, coaching cues, and deviation details.
 */
export function Review() {
  const navigate = useNavigate()
  const { lastRepReport, currentSetIndex, nextSet } = useSessionStore()

  const handleNextSet = () => {
    nextSet()
    navigate('/session/camera')
  }

  // Demo data when no actual rep has been recorded yet
  const score = lastRepReport?.overallScore ?? 82
  const formScore = lastRepReport?.form.formScore ?? 85
  const depthScore = lastRepReport?.form.depthScore ?? 70
  const tempoScore = lastRepReport?.form.tempoScore ?? 0
  const stabilityScore = lastRepReport?.form.stabilityScore ?? 0
  const primaryCue = lastRepReport?.primaryCue ?? 'Push knees out over toes'
  const deviations = lastRepReport?.form.deviations ?? []

  return (
    <div style={{ padding: 24, maxWidth: 480, margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Set Review</h1>
        <span style={{ color: '#888', fontSize: 14 }}>
          Set {currentSetIndex + 1}
        </span>
      </div>

      {/* Overall score */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          marginBottom: 32,
          padding: 20,
          borderRadius: 12,
          backgroundColor: '#1A1A1A',
        }}
      >
        <ScoreBadge score={score} size="large" />
        <div>
          <p style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>
            Last Rep Score
          </p>
          <p style={{ fontSize: 14, color: '#888', margin: '4px 0 0' }}>
            {primaryCue}
          </p>
        </div>
      </div>

      {/* Score breakdown */}
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
        Score Breakdown
      </h2>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          marginBottom: 24,
        }}
      >
        <ScoreBar label="Form" score={formScore} weight={SCORE_WEIGHTS.form} />
        <ScoreBar label="Depth / ROM" score={depthScore} weight={SCORE_WEIGHTS.depth} />
        <ScoreBar label="Tempo" score={tempoScore} weight={SCORE_WEIGHTS.tempo} />
        <ScoreBar label="Stability" score={stabilityScore} weight={SCORE_WEIGHTS.stability} />
      </div>

      {/* Deviations */}
      {deviations.length > 0 && (
        <>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
            Form Notes
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
            {deviations.map((d, i) => (
              <div
                key={i}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  backgroundColor: '#1A1A1A',
                  borderLeft: `3px solid ${
                    d.severity === 'critical' ? '#EF4444' : d.severity === 'warning' ? '#EAB308' : '#22C55E'
                  }`,
                  fontSize: 14,
                }}
              >
                <span style={{ fontWeight: 600 }}>{d.cue}</span>
                <span style={{ color: '#888', marginLeft: 8 }}>
                  ({d.delta.toFixed(1)}° off)
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 12 }}>
        <button
          onClick={handleNextSet}
          style={{
            flex: 1,
            padding: '14px 20px',
            borderRadius: 12,
            border: 'none',
            backgroundColor: '#22C55E',
            color: '#FFF',
            fontSize: 16,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Next Set
        </button>
        <button
          onClick={() => navigate('/session/summary')}
          style={{
            flex: 1,
            padding: '14px 20px',
            borderRadius: 12,
            border: '1px solid #333',
            backgroundColor: 'transparent',
            color: '#FFF',
            fontSize: 16,
            cursor: 'pointer',
          }}
        >
          End Session
        </button>
      </div>
    </div>
  )
}

function ScoreBar({
  label,
  score,
  weight,
}: {
  label: string
  score: number
  weight: number
}) {
  const barColor =
    score >= 85 ? '#22C55E' : score >= 70 ? '#3B82F6' : score >= 50 ? '#EAB308' : '#EF4444'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ width: 90, fontSize: 13, color: '#AAA' }}>{label}</span>
      <div
        style={{
          flex: 1,
          height: 8,
          borderRadius: 4,
          backgroundColor: '#333',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${score}%`,
            height: '100%',
            borderRadius: 4,
            backgroundColor: barColor,
          }}
        />
      </div>
      <span style={{ width: 32, fontSize: 13, fontWeight: 600, textAlign: 'right' }}>
        {score || '—'}
      </span>
      <span style={{ width: 36, fontSize: 11, color: '#666' }}>
        ×{(weight * 100).toFixed(0)}%
      </span>
    </div>
  )
}
