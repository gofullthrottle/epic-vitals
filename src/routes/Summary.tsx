import { useNavigate } from 'react-router-dom'
import { useSessionStore } from '../store/session-store'
import { useHistoryStore } from '../store/history-store'
import { useEffect } from 'react'
import { ScoreBadge } from '../components/ScoreBadge'
import { saveSession } from '../db/database'

/**
 * Session summary screen.
 * Shows aggregate stats for the completed session and past session history.
 */
export function Summary() {
  const navigate = useNavigate()
  const { session, endSession, reset } = useSessionStore()
  const { sessions, loading, fetchSessions } = useHistoryStore()

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  const handleFinish = async () => {
    const completed = endSession()
    if (completed) {
      await saveSession(completed)
    }
    reset()
    navigate('/')
  }

  return (
    <div style={{ padding: 24, maxWidth: 480, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>
        Session Summary
      </h1>

      {session && (
        <div
          style={{
            padding: 20,
            borderRadius: 12,
            backgroundColor: '#1A1A1A',
            marginBottom: 24,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
            }}
          >
            <span style={{ fontSize: 16, fontWeight: 600 }}>Current Session</span>
            <ScoreBadge score={session.averageFormScore || 0} size="small" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <StatCard label="Exercises" value={session.exercises.length} />
            <StatCard
              label="Total Sets"
              value={session.exercises.reduce((s, e) => s + e.sets.length, 0)}
            />
            <StatCard label="Duration" value={formatDuration(session.startedAt)} />
            <StatCard label="Avg Score" value={session.averageFormScore || '—'} />
          </div>

          <button
            onClick={handleFinish}
            style={{
              marginTop: 16,
              width: '100%',
              padding: '14px 20px',
              borderRadius: 12,
              border: 'none',
              backgroundColor: '#3B82F6',
              color: '#FFF',
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Save & Finish
          </button>
        </div>
      )}

      {/* History */}
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>
        Past Sessions
      </h2>

      {loading && <p style={{ color: '#888' }}>Loading...</p>}

      {!loading && sessions.length === 0 && (
        <p style={{ color: '#888' }}>
          No past sessions yet. Complete a workout to see your history.
        </p>
      )}

      {sessions.map((s) => (
        <div
          key={s.id}
          style={{
            padding: 16,
            borderRadius: 8,
            backgroundColor: '#1A1A1A',
            marginBottom: 8,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>
              {new Date(s.date).toLocaleDateString()}
            </div>
            <div style={{ fontSize: 12, color: '#888' }}>
              {s.exerciseCount} exercises &middot; {s.totalSets} sets &middot;{' '}
              {s.totalReps} reps
            </div>
          </div>
          <ScoreBadge score={s.averageScore} size="small" />
        </div>
      ))}

      {!session && (
        <button
          onClick={() => navigate('/')}
          style={{
            marginTop: 24,
            width: '100%',
            padding: '14px 20px',
            borderRadius: 12,
            border: '1px solid #333',
            backgroundColor: 'transparent',
            color: '#FFF',
            fontSize: 16,
            cursor: 'pointer',
          }}
        >
          Start New Session
        </button>
      )}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{
        padding: '8px 12px',
        borderRadius: 8,
        backgroundColor: '#222',
      }}
    >
      <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 600 }}>{value}</div>
    </div>
  )
}

function formatDuration(startedAt: number): string {
  const minutes = Math.floor((Date.now() - startedAt) / 60000)
  if (minutes < 1) return '<1m'
  return `${minutes}m`
}
